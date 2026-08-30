/**
 * On web the captured frame is already just a data URI string — it becomes
 * "persisted" the moment it's saved onto the wishlist entry, no file move needed.
 */
export async function persistMatchedPhoto(dataUri: string, _wishlistEntryId: number): Promise<string> {
  return dataUri;
}
