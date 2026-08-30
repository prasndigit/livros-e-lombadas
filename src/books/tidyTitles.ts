import { Platform } from 'react-native';

// A relative path only resolves on web (same origin as the page). Native has
// no "current origin", so it always needs the full deployed URL.
const TIDY_ENDPOINT =
  Platform.OS === 'web' ? '/api/tidy' : 'https://livros-e-lombadas.vercel.app/api/tidy';

/**
 * Sends the raw OCR reads from a shelf session to our Vercel proxy, which asks
 * a small Claude model to fix spelling / casing / split words and drop noise.
 * Throws on network or server error so the caller can fall back to the raw text.
 */
export async function tidyShelfTitles(titles: string[], language?: string): Promise<string[]> {
  const response = await fetch(TIDY_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ titles, language }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error ?? `Erro do servidor (${response.status})`);
  }

  const cleaned: unknown = json?.titles;
  if (!Array.isArray(cleaned) || cleaned.length === 0) {
    throw new Error('Resposta vazia do corretor.');
  }

  return cleaned.filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
}
