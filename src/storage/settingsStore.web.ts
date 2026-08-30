const STORAGE_KEY = 'livros-e-lombadas.settings';

function readAll(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function getSetting(key: string): Promise<string | null> {
  return readAll()[key] ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const all = readAll();
  all[key] = value;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
