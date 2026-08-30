export interface BookSearchResult {
  title: string;
  author: string;
  year: number | null;
  coverUrl: string | null;
  workKey: string;
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

// How many results to ask Open Library for. The list in the UI scrolls, so
// this can be generous — raise it here if the search still feels too narrow.
const SEARCH_LIMIT = 25;

// Library catalog data sometimes files titles with the leading article moved
// to the end for alphabetical sorting (e.g. "Cidade na História, A"). That
// never appears on an actual book spine/cover, so it would stop the vision
// model from ever matching it — undo it back to natural reading order.
function normalizeTitle(title: string): string {
  const match = title.match(/^(.+),\s*(a|o|as|os|the|um|uma|un|una)$/i);
  if (!match) return title;
  const article = match[2];
  return `${article.charAt(0).toUpperCase()}${article.slice(1)} ${match[1]}`;
}

/** Free, no API key required. https://openlibrary.org/dev/docs/api/search */
export async function searchBooks(title: string, author = ''): Promise<BookSearchResult[]> {
  const t = title.trim();
  const a = author.trim();
  if (t.length < 2) return [];

  // A fielded query (title=/author=) is far more precise than dumping both
  // into the free-text `q`. With no author we fall back to a title-only `q`
  // so the search stays broad.
  const common = `limit=${SEARCH_LIMIT}&fields=key,title,author_name,first_publish_year,cover_i`;
  const url = a
    ? `https://openlibrary.org/search.json?title=${encodeURIComponent(t)}&author=${encodeURIComponent(a)}&${common}`
    : `https://openlibrary.org/search.json?q=${encodeURIComponent(t)}&${common}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library error ${response.status}`);
  }

  const json = await response.json();
  const docs: OpenLibraryDoc[] = json?.docs ?? [];

  const results = docs.map((doc) => ({
    title: normalizeTitle(doc.title),
    author: doc.author_name?.[0] ?? '',
    year: doc.first_publish_year ?? null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    workKey: doc.key,
  }));

  // The catalog returns many near-identical works for the same book. Collapse
  // them by title+author so the user sees distinct options, not repeats.
  const seen = new Set<string>();
  return results.filter((r) => {
    const fingerprint = `${r.title.toLowerCase().trim()}|${r.author.toLowerCase().trim()}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}
