import * as SQLite from 'expo-sqlite';
import { Frame } from '../ocr/types';
import { WishlistEntry } from '../types/book';

const dbPromise = SQLite.openDatabaseAsync('wishlist.db');

interface WishlistRow {
  id: number;
  title: string;
  author: string;
  coverUrl: string | null;
  foundPhotoUri: string | null;
  foundAt: string | null;
  foundBox: string | null;
  foundImageWidth: number | null;
  foundImageHeight: number | null;
}

export async function initWishlistStore(): Promise<void> {
  const db = await dbPromise;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      coverUrl TEXT,
      foundPhotoUri TEXT,
      foundAt TEXT,
      foundBox TEXT,
      foundImageWidth INTEGER,
      foundImageHeight INTEGER
    );
  `);
  // Upgrade path for dev installs created before these columns existed.
  for (const column of [
    'coverUrl TEXT',
    'foundPhotoUri TEXT',
    'foundAt TEXT',
    'foundBox TEXT',
    'foundImageWidth INTEGER',
    'foundImageHeight INTEGER',
  ]) {
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
  const rows = await db.getAllAsync<WishlistRow>(
    `SELECT id, title, author, coverUrl, foundPhotoUri, foundAt,
            foundBox, foundImageWidth, foundImageHeight
     FROM wishlist ORDER BY id DESC;`
  );

  return rows.map((r) => {
    let foundBox: Frame | undefined;
    if (r.foundBox) {
      try {
        foundBox = JSON.parse(r.foundBox) as Frame;
      } catch {
        foundBox = undefined;
      }
    }
    return {
      id: r.id,
      title: r.title,
      author: r.author,
      coverUrl: r.coverUrl ?? undefined,
      foundPhotoUri: r.foundPhotoUri ?? undefined,
      foundAt: r.foundAt ?? undefined,
      foundBox,
      foundImageWidth: r.foundImageWidth ?? undefined,
      foundImageHeight: r.foundImageHeight ?? undefined,
    };
  });
}

export async function markWishlistEntryFound(
  id: number,
  photoUri: string,
  box?: Frame | null,
  imageWidth?: number,
  imageHeight?: number
): Promise<void> {
  const db = await dbPromise;
  await db.runAsync(
    `UPDATE wishlist
     SET foundPhotoUri = ?, foundAt = ?, foundBox = ?, foundImageWidth = ?, foundImageHeight = ?
     WHERE id = ?;`,
    photoUri,
    new Date().toISOString(),
    box ? JSON.stringify(box) : null,
    imageWidth ?? null,
    imageHeight ?? null,
    id
  );
}
