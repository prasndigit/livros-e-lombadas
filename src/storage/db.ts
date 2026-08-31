import * as SQLite from 'expo-sqlite';

// One connection, one schema-init, shared by every native store. Awaiting this
// is how each store guarantees its tables exist before the first read/write —
// screens no longer have to call an init function in the right order.
let readyPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Kept as "wishlist.db" so existing installs keep their data.
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('wishlist.db');
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
        CREATE INDEX IF NOT EXISTS idx_shelf_books_shelf ON shelf_books(shelfId);
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);
      // Add columns to wishlist tables created before these existed.
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
      return db;
    })();
  }
  return readyPromise;
}
