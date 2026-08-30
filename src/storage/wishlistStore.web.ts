import { Frame } from '../ocr/types';
import { WishlistEntry } from '../types/book';

const STORAGE_KEY = 'livros-e-lombadas.wishlist';

function readAll(): WishlistEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WishlistEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAll(entries: WishlistEntry[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function initWishlistStore(): Promise<void> {
  // localStorage needs no setup
}

export async function addWishlistEntry(title: string, author: string, coverUrl?: string): Promise<void> {
  const entries = readAll();
  const nextId = entries.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  entries.unshift({ id: nextId, title: title.trim(), author: author.trim(), coverUrl });
  writeAll(entries);
}

export async function removeWishlistEntry(id: number): Promise<void> {
  writeAll(readAll().filter((e) => e.id !== id));
}

export async function getWishlistEntries(): Promise<WishlistEntry[]> {
  return readAll();
}

export async function markWishlistEntryFound(
  id: number,
  photoUri: string,
  box?: Frame | null,
  imageWidth?: number,
  imageHeight?: number
): Promise<void> {
  const entries = readAll();
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  entry.foundPhotoUri = photoUri;
  entry.foundAt = new Date().toISOString();
  entry.foundBox = box ?? undefined;
  entry.foundImageWidth = imageWidth;
  entry.foundImageHeight = imageHeight;
  writeAll(entries);
}
