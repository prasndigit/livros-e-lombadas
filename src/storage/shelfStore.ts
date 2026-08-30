import * as SQLite from 'expo-sqlite';

// Same database file as the wishlist — one db, separate tables.
const dbPromise = SQLite.openDatabaseAsync('wishlist.db');

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

export async function initShelfStore(): Promise<void> {
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS shelves (
      id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS shelf_books (
      id INTEGER PRIMARY KEY NOT NULL,
      shelfId INTEGER NOT NULL,
      rawText TEXT NOT NULL,
      capturedAt TEXT NOT NULL
    );
  `);
}

/** Persists a whole cataloguing session at once. `titles` are raw OCR reads, in capture order. */
export async function createShelf(name: string, location: string, titles: string[]): Promise<number> {
  const db = await dbPromise;
  const now = new Date().toISOString();
  const result = await db.runAsync(
    'INSERT INTO shelves (name, location, createdAt) VALUES (?, ?, ?);',
    name.trim(),
    location.trim() || null,
    now
  );
  const shelfId = result.lastInsertRowId;
  for (const rawText of titles) {
    await db.runAsync(
      'INSERT INTO shelf_books (shelfId, rawText, capturedAt) VALUES (?, ?, ?);',
      shelfId,
      rawText,
      now
    );
  }
  return shelfId;
}

export async function getShelves(): Promise<ShelfSummary[]> {
  const db = await dbPromise;
  return db.getAllAsync<ShelfSummary>(`
    SELECT s.id, s.name, s.location, s.createdAt,
           (SELECT COUNT(*) FROM shelf_books b WHERE b.shelfId = s.id) AS bookCount
    FROM shelves s
    ORDER BY s.id DESC;
  `);
}

export async function getShelfBooks(shelfId: number): Promise<ShelfBook[]> {
  const db = await dbPromise;
  return db.getAllAsync<ShelfBook>(
    'SELECT id, rawText, capturedAt FROM shelf_books WHERE shelfId = ? ORDER BY id ASC;',
    shelfId
  );
}

export async function deleteShelf(id: number): Promise<void> {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM shelf_books WHERE shelfId = ?;', id);
  await db.runAsync('DELETE FROM shelves WHERE id = ?;', id);
}
