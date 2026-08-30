import { File } from 'expo-file-system';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { ScanResult, ScannedLine } from './types';

export async function recognizeText(photoUri: string, photoWidth: number, photoHeight: number): Promise<ScanResult> {
  const result = await TextRecognition.recognize(photoUri);
  const lines: ScannedLine[] = result.blocks.flatMap((block) =>
    block.lines.map((line) => ({ text: line.text, frame: line.frame }))
  );
  return { lines, imageWidth: photoWidth, imageHeight: photoHeight };
}

/**
 * Deletes a captured frame that did not match anything — nothing is kept
 * on disk unless a wishlist match explicitly asks for it to be persisted.
 */
export function discardPhoto(photoUri: string): void {
  try {
    new File(photoUri).delete();
  } catch {
    // already gone; nothing to persist either way
  }
}
