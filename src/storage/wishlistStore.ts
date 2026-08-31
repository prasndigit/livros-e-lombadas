import { Frame } from '../ocr/types';
import { WishlistEntry } from '../types/book';
import { getDb } from './db';

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

/** Kept for callers that still init explicitly; getDb() already creates the tables. */
export async function initWishlistStore(): Promise<void> {
  await getDb();
}

export async function addWishlistEntry(title: string, author: string, coverUrl?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO wishlist (title, author, coverUrl) VALUES (?, ?, ?);',
    title.trim(),
    author.trim(),
    coverUrl ?? null
  );
}

export async function removeWishlistEntry(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM wishlist WHERE id = ?;', id);
}

export async function getWishlistEntries(): Promise<WishlistEntry[]> {
  const db = await getDb();
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
  const db = await getDb();
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
