import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FoundPhoto from '../components/FoundPhoto';
import { useT } from '../i18n/I18nProvider';
import { playAlertSound, primeAlertSound } from '../alert/sound';
import { findWishlistMatch } from '../match/fuzzyMatch';
import { discardPhoto, recognizeText } from '../ocr/textRecognition';
import { Frame } from '../ocr/types';
import { persistMatchedPhoto } from '../photo/persistMatchedPhoto';
import { markWishlistEntryFound } from '../storage/wishlistStore';
import { WishlistEntry } from '../types/book';
import { identifyBook } from '../vision/identifyBook';

const CAPTURE_INTERVAL_MS = 1200;
const ALERT_COOLDOWN_MS = 4000;
const MAX_LOG_ENTRIES = 20;

interface LogEntry {
  time: string;
  imageUri: string;
  debugText: string;
  matchedTitle: string | null;
  box: Frame | null;
  imgW: number;
  imgH: number;
}

interface Props {
  wishlist: WishlistEntry[];
  onBack: () => void;
}

export default function ScanScreen({ wishlist, onBack }: Props) {
  const { t, plural } = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isProcessingRef = useRef(false);
  const lastAlertAtRef = useRef(0);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [matchedEntry, setMatchedEntry] = useState<WishlistEntry | null>(null);
  const [matchedBox, setMatchedBox] = useState<Frame | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [zoomedEntry, setZoomedEntry] = useState<LogEntry | null>(null);

  const addLogEntry = (
    imageUri: string,
    debugText: string,
    matchedTitle: string | null,
    box: Frame | null,
    imgW: number,
    imgH: number
  ) => {
    setLog((prev) =>
      [
        { time: new Date().toLocaleTimeString('pt-PT'), imageUri, debugText, matchedTitle, box, imgW, imgH },
        ...prev,
      ].slice(0, MAX_LOG_ENTRIES)
    );
  };

  useEffect(() => {
    primeAlertSound();
  }, []);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!permission?.granted) return;

    const interval = setInterval(async () => {
      if (isProcessingRef.current || !cameraRef.current) return;
      isProcessingRef.current = true;
      try {
        // shutterSound: false — este é um varrimento passivo contínuo, não uma
        // fotografia deliberada; o clique do obturador a cada 1-2 s é ruído.
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.4,
          base64: true,
          shutterSound: false,
        });
        if (!photo) return;
        const { lines, imageWidth, imageHeight } = await recognizeText(
          photo.uri,
          photo.width,
          photo.height
        );
        setImageSize({ width: imageWidth, height: imageHeight });

        const mlKitMatch = findWishlistMatch(lines, wishlist);
        let finalEntry: WishlistEntry | null = null;
        let finalBox: Frame | null = null;
        let debugText = `ML Kit: ${lines.length} linha(s) lida(s), sem correspondência`;

        if (mlKitMatch) {
          finalEntry = mlKitMatch.entry;
          const matchedLine = lines.find((l) => l.text.trim() === mlKitMatch.matchedLine);
          finalBox = matchedLine?.frame ?? null;
          debugText = `ML Kit: "${mlKitMatch.matchedLine}" → ${mlKitMatch.entry.title}`;
        } else if (photo.base64) {
          // ML Kit found nothing — ask the vision model as a slower, paid
          // fallback (handles decorative fonts / different editions ML Kit misses).
          try {
            const { entry, rawReply } = await identifyBook(photo.base64, wishlist);
            finalEntry = entry;
            debugText += `\nIA: ${rawReply}`;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            debugText += `\nIA: ERRO - ${message}`;
          }
        }

        setMatchedEntry(finalEntry);
        setMatchedBox(finalBox);
        if (photo.base64) {
          addLogEntry(
            `data:image/jpeg;base64,${photo.base64}`,
            debugText,
            finalEntry?.title ?? null,
            finalBox,
            imageWidth,
            imageHeight
          );
        }

        if (finalEntry) {
          const now = Date.now();
          if (now - lastAlertAtRef.current > ALERT_COOLDOWN_MS) {
            lastAlertAtRef.current = now;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            playAlertSound();
            const savedUri = await persistMatchedPhoto(photo.uri, finalEntry.id);
            await markWishlistEntryFound(finalEntry.id, savedUri, finalBox, imageWidth, imageHeight);
          } else {
            discardPhoto(photo.uri);
          }
        } else {
          discardPhoto(photo.uri);
        }
      } catch {
        // a falha de uma captura isolada não deve travar o loop de scan
      } finally {
        isProcessingRef.current = false;
      }
    }, CAPTURE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [permission?.granted, wishlist]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ width, height });
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>{t('scan.needCamera')}</Text>
        <Pressable style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t('common.allowCamera')}</Text>
        </Pressable>
      </View>
    );
  }

  if (showLog) {
    return (
      <View style={styles.container}>
        <View style={styles.logHeader}>
          <Text style={styles.logHeaderText}>{t('scan.logHeading', { count: log.length })}</Text>
          <Pressable onPress={() => setLog([])}>
            <Text style={styles.logHeaderAction}>{t('author.clear')}</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.logScroll}>
          {log.length === 0 && <Text style={styles.debugText}>{t('scan.logEmpty')}</Text>}
          {log.map((item, i) => (
            <View key={i} style={styles.logEntry}>
              <Pressable onPress={() => setZoomedEntry(item)}>
                <Image
                  source={{ uri: item.imageUri }}
                  style={[styles.logThumbnail, item.matchedTitle && styles.logThumbnailMatched]}
                />
              </Pressable>
              <View style={styles.logEntryText}>
                <Text style={styles.logEntryTime}>{item.time}</Text>
                <Text style={item.matchedTitle ? styles.logEntryMatched : styles.debugText}>
                  {item.matchedTitle ? `✓ ${item.matchedTitle}` : t('scan.noMatch')}
                </Text>
                <Text style={styles.debugText}>{item.debugText}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            setZoomedEntry(null);
            setShowLog(false);
          }}
        >
          <Text style={styles.backButtonText}>{t('scan.backToScan')}</Text>
        </Pressable>

        {zoomedEntry && (
          <View style={styles.zoomOverlay}>
            <View style={styles.zoomPhotoWrap}>
              <FoundPhoto
                uri={zoomedEntry.imageUri}
                matched={!!zoomedEntry.matchedTitle}
                box={zoomedEntry.box}
                imageWidth={zoomedEntry.imgW}
                imageHeight={zoomedEntry.imgH}
              />
            </View>
            <Pressable style={styles.zoomCloseButton} onPress={() => setZoomedEntry(null)}>
              <Text style={styles.backButtonText}>{t('scan.backToSize')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  const overlayStyle = matchedBox
    ? {
        left: (matchedBox.left / imageSize.width) * layout.width,
        top: (matchedBox.top / imageSize.height) * layout.height,
        width: (matchedBox.width / imageSize.width) * layout.width,
        height: (matchedBox.height / imageSize.height) * layout.height,
      }
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper} onLayout={handleLayout}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
        {overlayStyle && <View style={[styles.highlightBox, overlayStyle]} />}
        {matchedEntry && !overlayStyle && <View pointerEvents="none" style={styles.highlightFull} />}
        <Pressable
          style={styles.flipButton}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        >
          <Text style={styles.flipButtonText}>{t('scan.flip')}</Text>
        </Pressable>
        <Pressable style={styles.logButton} onPress={() => setShowLog(true)}>
          <Text style={styles.flipButtonText}>{t('scan.viewLog', { count: log.length })}</Text>
        </Pressable>
      </View>

      <View style={[styles.footer, matchedEntry && styles.footerMatched]}>
        <Text style={styles.footerText}>
          {matchedEntry
            ? t('scan.foundLabel', { title: matchedEntry.title })
            : t('scan.searchingN', {
                count: wishlist.length,
                noun: plural(wishlist.length, 'common.book'),
              })}
        </Text>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{t('scan.backToList')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraWrapper: { flex: 1 },
  highlightBox: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#1b998b',
    borderRadius: 6,
  },
  // Fallback cue when a match has no coordinates (cloud/IA path): frame the
  // whole preview so there is still a clear "found" signal.
  highlightFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: '#1b998b',
  },
  debugText: { color: '#0f0', fontSize: 11 },
  flipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  logButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  flipButtonText: { color: '#fff', fontWeight: '600' },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  footerMatched: { backgroundColor: '#1b998b' },
  footerText: { color: '#fff', fontSize: 16, marginBottom: 10, fontWeight: '700' },
  backButton: {
    backgroundColor: '#2f6690',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    margin: 16,
  },
  backButtonText: { color: '#fff', fontWeight: '600' },
  permissionText: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 100,
    marginBottom: 20,
    paddingHorizontal: 24,
  },
  button: {
    backgroundColor: '#2f6690',
    borderRadius: 8,
    padding: 12,
    alignSelf: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  logHeaderText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logHeaderAction: { color: '#c0392b', fontSize: 14 },
  logScroll: { flex: 1, paddingHorizontal: 16 },
  logEntry: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  logThumbnail: { width: 50, height: 70, borderRadius: 6, marginRight: 10, backgroundColor: '#222' },
  logThumbnailMatched: { borderWidth: 2, borderColor: '#1b998b' },
  logEntryText: { flex: 1 },
  logEntryTime: { color: '#888', fontSize: 11, marginBottom: 2 },
  logEntryMatched: { color: '#1b998b', fontWeight: '700', fontSize: 13, marginBottom: 2 },
  zoomOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  zoomPhotoWrap: { width: '100%', height: '82%' },
  zoomCloseButton: {
    marginTop: 20,
    backgroundColor: '#2f6690',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
