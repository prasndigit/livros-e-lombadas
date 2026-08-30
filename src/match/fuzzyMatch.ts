import Fuse from 'fuse.js';
import { MIN_OCR_CONFIDENCE } from '../ocr/constants';
import { ScannedLine } from '../ocr/types';
import { WishlistEntry } from '../types/book';

const MATCH_THRESHOLD = 0.4;
const MIN_LINE_LENGTH = 3;

export interface MatchResult {
  entry: WishlistEntry;
  matchedLine: string;
}

export function findWishlistMatch(
  ocrLines: ScannedLine[],
  wishlist: WishlistEntry[]
): MatchResult | null {
  if (wishlist.length === 0 || ocrLines.length === 0) {
    return null;
  }

  const fuse = new Fuse(wishlist, {
    keys: ['title', 'author'],
    threshold: MATCH_THRESHOLD,
    includeScore: true,
  });

  // Compare every OCR line and keep the best-scoring match overall, instead
  // of stopping at the first line that clears the threshold — a single
  // noisy/misread line early on shouldn't be able to "win" over a much
  // better match found in a later line.
  let best: { entry: WishlistEntry; matchedLine: string; score: number } | null = null;

  for (const line of ocrLines) {
    // undefined confidence (native/ML Kit) is trusted; web/Tesseract lines
    // below MIN_OCR_CONFIDENCE are treated as noise and skipped.
    if (line.confidence !== undefined && line.confidence < MIN_OCR_CONFIDENCE) continue;

    const trimmed = line.text.trim();
    if (trimmed.length < MIN_LINE_LENGTH) continue;

    const results = fuse.search(trimmed);
    if (results.length === 0) continue;

    const score = results[0].score ?? 1;
    if (!best || score < best.score) {
      best = { entry: results[0].item, matchedLine: trimmed, score };
    }
  }

  return best ? { entry: best.entry, matchedLine: best.matchedLine } : null;
}
