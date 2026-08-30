export interface ShelfSummary {
  id: number;
  name: string;
  location: string | null;
  createdAt: string;
  bookCount: number;
}

export interface ShelfBook {
  id: number;
  rawText: string;
  capturedAt: string;
}

export interface ShelfHit {
  shelfId: number;
  shelfName: string;
  shelfLocation: string | null;
  rawText: string;
}

interface StoredShelf {
  id: number;
  name: string;
  location: string | null;
  createdAt: string;
  books: { rawText: string; capturedAt: string }[];
}

const STORAGE_KEY = 'livros-e-lombadas.shelves';

function readAll(): StoredShelf[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredShelf[]) : [];
  } catch {
    return [];
  }
}

function writeAll(shelves: StoredShelf[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shelves));
}

export async function initShelfStore(): Promise<void> {
  // localStorage needs no setup
}

export async function createShelf(name: string, location: string, titles: string[]): Promise<number> {
  const all = readAll();
  const id = all.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  const now = new Date().toISOString();
  all.unshift({
    id,
    name: name.trim(),
    location: location.trim() || null,
    createdAt: now,
    books: titles.map((rawText) => ({ rawText, capturedAt: now })),
  });
  writeAll(all);
  return id;
}

export async function getShelves(): Promise<ShelfSummary[]> {
  return readAll().map((s) => ({
    id: s.id,
    name: s.name,
    location: s.location,
    createdAt: s.createdAt,
    bookCount: s.books.length,
  }));
}

export async function getShelfBooks(shelfId: number): Promise<ShelfBook[]> {
  const shelf = readAll().find((s) => s.id === shelfId);
  return shelf ? shelf.books.map((b, i) => ({ id: i, rawText: b.rawText, capturedAt: b.capturedAt })) : [];
}

export async function deleteShelf(id: number): Promise<void> {
  writeAll(readAll().filter((s) => s.id !== id));
}

export async function searchShelfBooks(query: string): Promise<ShelfHit[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: ShelfHit[] = [];
  for (const shelf of readAll()) {
    for (const book of shelf.books) {
      if (book.rawText.toLowerCase().includes(q)) {
        hits.push({
          shelfId: shelf.id,
          shelfName: shelf.name,
          shelfLocation: shelf.location,
          rawText: book.rawText,
        });
      }
    }
  }
  return hits;
}

// bookId is the array index (see getShelfBooks, which returns id: i).
export async function deleteShelfBook(shelfId: number, bookId: number): Promise<void> {
  const all = readAll();
  const shelf = all.find((s) => s.id === shelfId);
  if (!shelf || !shelf.books[bookId]) return;
  shelf.books.splice(bookId, 1);
  writeAll(all);
}

export async function updateShelfBook(
  shelfId: number,
  bookId: number,
  rawText: string
): Promise<void> {
  const all = readAll();
  const shelf = all.find((s) => s.id === shelfId);
  if (!shelf || !shelf.books[bookId]) return;
  shelf.books[bookId].rawText = rawText;
  writeAll(all);
}
