import { Platform } from 'react-native';
import { WishlistEntry } from '../types/book';

interface IdentifyResult {
  entry: WishlistEntry | null;
  rawReply: string;
}

// A relative path only resolves on web (same origin as the page). Native
// has no "current origin", so it always needs the full deployed URL.
const IDENTIFY_ENDPOINT =
  Platform.OS === 'web' ? '/api/identify' : 'https://livros-e-lombadas.vercel.app/api/identify';

/**
 * Sends the captured frame to our own /api/identify proxy (a Vercel
 * serverless function), which holds the Anthropic API key server-side and
 * forwards to a vision-capable Claude model. The browser never sees the key.
 * Unlike mechanical OCR, this copes natively with rotated/vertical spine
 * text, decorative fonts, and low-contrast covers — and can recognize a
 * different edition/language of the same work through the model's own
 * world knowledge, not just exact character matches.
 */
export async function identifyBook(base64Jpeg: string, wishlist: WishlistEntry[]): Promise<IdentifyResult> {
  const response = await fetch(IDENTIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64Jpeg, wishlist }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error ?? `Erro do servidor (${response.status})`);
  }

  const rawReply: string = json?.rawReply ?? '';

  let matchedTitle: string | null = null;
  try {
    const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      matchedTitle = JSON.parse(jsonMatch[0]).matchedTitle ?? null;
    }
  } catch {
    matchedTitle = null;
  }

  const entry = matchedTitle ? wishlist.find((e) => e.title === matchedTitle) ?? null : null;
  return { entry, rawReply };
}
