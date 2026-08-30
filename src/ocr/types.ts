export interface Frame {
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface ScannedLine {
  text: string;
  frame?: Frame;
  /** 0-100. Only set on platforms that report it (web/Tesseract); undefined on native/ML Kit. */
  confidence?: number;
}

export interface ScanResult {
  lines: ScannedLine[];
  imageWidth: number;
  imageHeight: number;
}
