import { Frame } from '../ocr/types';

export interface WishlistEntry {
  id: number;
  title: string;
  author: string;
  coverUrl?: string;
  foundPhotoUri?: string;
  foundAt?: string;
  /**
   * ML Kit bounding box of the matched text on the found photo, in that
   * photo's pixel coordinates. Absent when the match came from the cloud/IA
   * path (no coordinates) or predates this feature.
   */
  foundBox?: Frame;
  foundImageWidth?: number;
  foundImageHeight?: number;
}
