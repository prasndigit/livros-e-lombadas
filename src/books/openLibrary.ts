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
export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&limit=6&fields=key,title,author_name,first_publish_year,cover_i`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library error ${response.status}`);
  }

  const json = await response.json();
  const docs: OpenLibraryDoc[] = json?.docs ?? [];

  return docs.map((doc) => ({
    title: normalizeTitle(doc.title),
    author: doc.author_name?.[0] ?? '',
    year: doc.first_publish_year ?? null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    workKey: doc.key,
  }));
}
