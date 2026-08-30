import { languageName, SearchLang } from './searchLanguage';

export interface BookSearchResult {
  title: string;
  author: string;
  year: number | null;
  coverUrl: string | null;
  workKey: string;
  /** Language name (e.g. "inglês") when this result is NOT available in the chosen search language; otherwise null. */
  otherLanguage: string | null;
}

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
  editions?: { docs?: { title?: string; language?: string[] }[] };
}

interface OpenLibraryAuthorDoc {
  key: string;
  name: string;
  work_count?: number;
  top_work?: string;
  birth_date?: string;
  death_date?: string;
}

const SEARCH_LIMIT = 25;
const AUTHOR_WORKS_LIMIT = 50;
const FIELDS =
  'key,title,author_name,first_publish_year,cover_i,language,editions,editions.title,editions.language';

// Library catalog data sometimes files titles with the leading article moved
// to the end for alphabetical sorting (e.g. "Cidade na História, A"). That
// never appears on an actual book spine/cover — undo it back to reading order.
function normalizeTitle(title: string): string {
  const match = title.match(/^(.+),\s*(a|o|as|os|the|um|uma|un|una)$/i);
  if (!match) return title;
  const article = match[2];
  return `${article.charAt(0).toUpperCase()}${article.slice(1)} ${match[1]}`;
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

async function fetchDocs(params: string): Promise<OpenLibraryDoc[]> {
  const response = await fetch(`https://openlibrary.org/search.json?${params}`);
  if (!response.ok) {
    throw new Error(`Open Library error ${response.status}`);
  }
  const json = await response.json();
  return json?.docs ?? [];
}

function mapDoc(doc: OpenLibraryDoc, lang: SearchLang, authorName?: string): BookSearchResult {
  const langs = doc.language ?? [];
  // When we queried with a language filter, the matching edition (and its
  // localised title) is returned inline — prefer that title.
  const edition = doc.editions?.docs?.find((e) => e.language?.includes(lang));
  const inChosen = !!edition || langs.includes(lang);
  return {
    title: normalizeTitle(edition?.title ?? doc.title),
    author: authorName ?? doc.author_name?.[0] ?? '',
    year: doc.first_publish_year ?? null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    workKey: doc.key,
    otherLanguage: inChosen ? null : langs.length ? languageName(langs[0]) : null,
  };
}

/**
 * Runs a language-filtered query first (results come back in the chosen
 * language), then, if that was thin, a second unfiltered pass so books only
 * available in other languages still show up — flagged via `otherLanguage`.
 */
async function searchWorks(
  baseParams: string,
  lang: SearchLang,
  limit: number,
  authorName?: string
): Promise<BookSearchResult[]> {
  const tail = `fields=${FIELDS}&limit=${limit}`;
  const primary = await fetchDocs(`${baseParams}&language=${lang}&${tail}`);

  let docs = primary;
  if (primary.length < limit) {
    const seen = new Set(primary.map((d) => d.key));
    const extra = (await fetchDocs(`${baseParams}&${tail}`)).filter((d) => !seen.has(d.key));
    docs = [...primary, ...extra].slice(0, limit);
  }

  return dedupeByTitleAuthor(docs.map((d) => mapDoc(d, lang, authorName)));
}

/** Free, no API key required. https://openlibrary.org/dev/docs/api/search */
export async function searchBooks(
  title: string,
  author: string,
  lang: SearchLang
): Promise<BookSearchResult[]> {
  const t = title.trim();
  const a = author.trim();
  if (t.length < 2) return [];

  // A fielded query (title=/author=) is far more precise than dumping both
  // into the free-text `q`. With no author we fall back to a title-only `q`.
  const baseParams = a
    ? `title=${encodeURIComponent(t)}&author=${encodeURIComponent(a)}`
    : `q=${encodeURIComponent(t)}`;

  return searchWorks(baseParams, lang, SEARCH_LIMIT);
}

export interface AuthorResult {
  key: string;
  name: string;
  workCount: number;
  topWork: string | null;
  lifespan: string | null;
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
 * Every work Open Library files under an author, in the chosen language where
 * possible. `authorKey` is the bare OLxxxxA id (no "/authors/" prefix).
 * Chosen-language titles come first; other-language ones follow, flagged.
 */
export async function getAuthorWorks(
  authorKey: string,
  authorName: string,
  lang: SearchLang
): Promise<BookSearchResult[]> {
  const baseParams = `q=${encodeURIComponent(`author_key:${authorKey}`)}`;
  const works = await searchWorks(baseParams, lang, AUTHOR_WORKS_LIMIT, authorName);

  return works.sort((a, b) => {
    const byLang = Number(!!a.otherLanguage) - Number(!!b.otherLanguage);
    if (byLang !== 0) return byLang;
    return a.title.localeCompare(b.title, 'pt', { sensitivity: 'base' });
  });
}
