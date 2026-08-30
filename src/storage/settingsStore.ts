import * as SQLite from 'expo-sqlite';

// Same database file as everything else — one db, a key/value settings table.
const dbPromise = SQLite.openDatabaseAsync('wishlist.db');

async function ready() {
  const db = await dbPromise;
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT);`
  );
  return db;
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await ready();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?;',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await ready();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
    key,
    value
  );
}
