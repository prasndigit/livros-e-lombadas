import { File, Paths } from 'expo-file-system';

/**
 * Moves a captured temp photo into permanent app storage, only called for
 * a confirmed wishlist match — everything else stays in-memory only.
 */
export async function persistMatchedPhoto(tempUri: string, wishlistEntryId: number): Promise<string> {
  const target = new File(Paths.document, `found-${wishlistEntryId}-${Date.now()}.jpg`);
  await new File(tempUri).move(target);
  return target.uri;
}
