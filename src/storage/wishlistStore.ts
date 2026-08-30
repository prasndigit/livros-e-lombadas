import * as SQLite from 'expo-sqlite';
import { WishlistEntry } from '../types/book';

const dbPromise = SQLite.openDatabaseAsync('wishlist.db');

export async function initWishlistStore(): Promise<void> {
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      coverUrl TEXT,
      foundPhotoUri TEXT,
      foundAt TEXT
    );
  `);
  // Upgrade path for dev installs created before these columns existed.
  for (const column of ['coverUrl TEXT', 'foundPhotoUri TEXT', 'foundAt TEXT']) {
    try {
      await db.execAsync(`ALTER TABLE wishlist ADD COLUMN ${column};`);
    } catch {
      // column already exists
    }
  }
}

export async function addWishlistEntry(title: string, author: string, coverUrl?: string): Promise<void> {
  const db = await dbPromise;
  await db.runAsync(
    'INSERT INTO wishlist (title, author, coverUrl) VALUES (?, ?, ?);',
    title.trim(),
    author.trim(),
    coverUrl ?? null
  );
}

export async function removeWishlistEntry(id: number): Promise<void> {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM wishlist WHERE id = ?;', id);
}

export async function getWishlistEntries(): Promise<WishlistEntry[]> {
  const db = await dbPromise;
  return db.getAllAsync<WishlistEntry>(
    'SELECT id, title, author, coverUrl, foundPhotoUri, foundAt FROM wishlist ORDER BY id DESC;'
  );
}

export async function markWishlistEntryFound(id: number, photoUri: string): Promise<void> {
  const db = await dbPromise;
  await db.runAsync(
    'UPDATE wishlist SET foundPhotoUri = ?, foundAt = ? WHERE id = ?;',
    photoUri,
    new Date().toISOString(),
    id
  );
}
