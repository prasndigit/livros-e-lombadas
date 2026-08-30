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

  return dedupeByTitleAuthor(results);
}

// The catalog returns many near-identical works for the same book. Collapse
// them by title+author so the user sees distinct options, not repeats.
function dedupeByTitleAuthor(results: BookSearchResult[]): BookSearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const fingerprint = `${r.title.toLowerCase().trim()}|${r.author.toLowerCase().trim()}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}

export interface AuthorResult {
  key: string;
  name: string;
  workCount: number;
  topWork: string | null;
  lifespan: string | null;
}

interface OpenLibraryAuthorDoc {
  key: string;
  name: string;
  work_count?: number;
  top_work?: string;
  birth_date?: string;
  death_date?: string;
}

interface OpenLibraryWorkEntry {
  key: string;
  title: string;
  covers?: number[];
  first_publish_date?: string;
}

/** Author name -> candidate authors, for disambiguation. */
export async function searchAuthors(name: string): Promise<AuthorResult[]> {
  const q = name.trim();
  if (q.length < 2) return [];

  const url = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(q)}&limit=10`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library error ${response.status}`);
  }

  const json = await response.json();
  const docs: OpenLibraryAuthorDoc[] = json?.docs ?? [];

  return docs
    .filter((doc) => doc.key && doc.name)
    .map((doc) => {
      const birth = doc.birth_date?.trim();
      const death = doc.death_date?.trim();
      const lifespan = birth || death ? `${birth ?? '?'}–${death ?? ''}`.replace(/–$/, '') : null;
      return {
        key: doc.key,
        name: doc.name,
        workCount: doc.work_count ?? 0,
        topWork: doc.top_work ?? null,
        lifespan,
      };
    });
}

/**
 * Every work Open Library files under an author, mapped to the same shape as
 * a title search so the picker and the wishlist store can treat them alike.
 * `authorKey` is the bare OLxxxxA id (no "/authors/" prefix).
 */
export async function getAuthorWorks(
  authorKey: string,
  authorName: string,
  limit = 50
): Promise<BookSearchResult[]> {
  const url = `https://openlibrary.org/authors/${encodeURIComponent(authorKey)}/works.json?limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open Library error ${response.status}`);
  }

  const json = await response.json();
  const entries: OpenLibraryWorkEntry[] = json?.entries ?? [];

  const results: BookSearchResult[] = entries
    .filter((e) => e.title)
    .map((e) => {
      const yearMatch = e.first_publish_date?.match(/\d{4}/);
      return {
        title: normalizeTitle(e.title),
        author: authorName,
        year: yearMatch ? parseInt(yearMatch[0], 10) : null,
        coverUrl: e.covers?.[0] ? `https://covers.openlibrary.org/b/id/${e.covers[0]}-M.jpg` : null,
        workKey: e.key,
      };
    });

  return dedupeByTitleAuthor(results).sort((a, b) =>
    a.title.localeCompare(b.title, 'pt', { sensitivity: 'base' })
  );
}
