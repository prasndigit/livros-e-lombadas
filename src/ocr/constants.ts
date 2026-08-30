// 0-100. Below this, a line is treated as noise rather than real text.
// Only web/Tesseract reports confidence — lowered from an earlier 65 after
// real shelf-scanning showed genuine (if imperfect) spine reads often score
// lower than that. Tune this, not the fuzzy-match threshold, if false
// positives/negatives come back.
export const MIN_OCR_CONFIDENCE = 45;
