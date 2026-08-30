import React, { useState } from 'react';
import { Image, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Frame } from '../ocr/types';

interface Props {
  uri: string;
  /** Whether this frame is a confirmed wishlist match (controls the "found" cues). */
  matched: boolean;
  /** ML Kit box of the matched text, in source-image pixels. Absent for cloud/IA matches. */
  box?: Frame | null;
  imageWidth?: number;
  imageHeight?: number;
}

/**
 * Shows a captured frame with the identified book marked. When the ML Kit
 * bounding box is known, a rectangle is redrawn over the matched region,
 * scaled to however the image ends up laid out (`contain`-style letterboxing).
 * When it is a match with no coordinates — e.g. the cloud/IA path — the whole
 * frame gets a green border instead. Non-matches are shown plain.
 */
export default function FoundPhoto({ uri, matched, box, imageWidth, imageHeight }: Props) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  };

  let rect: { left: number; top: number; width: number; height: number } | null = null;
  if (box && imageWidth && imageHeight && layout.width > 0 && layout.height > 0) {
    // Reproduce the contain fit: uniform scale, image centred, letterboxed.
    const scale = Math.min(layout.width / imageWidth, layout.height / imageHeight);
    const renderedW = imageWidth * scale;
    const renderedH = imageHeight * scale;
    const offsetX = (layout.width - renderedW) / 2;
    const offsetY = (layout.height - renderedH) / 2;
    rect = {
      left: offsetX + box.left * scale,
      top: offsetY + box.top * scale,
      width: box.width * scale,
      height: box.height * scale,
    };
  }

  const showFullBorder = matched && !rect;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <Image
        source={{ uri }}
        style={[styles.image, showFullBorder && styles.imageFullBorder]}
        resizeMode="contain"
      />
      {rect && <View pointerEvents="none" style={[styles.box, rect]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  imageFullBorder: { borderWidth: 3, borderColor: '#1b998b' },
  box: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#1b998b',
    borderRadius: 4,
  },
});
