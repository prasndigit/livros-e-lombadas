import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Pressable, StyleSheet, Text, View, Image } from 'react-native';
import { useT } from '../i18n/I18nProvider';
import { playAlertSound, primeAlertSound } from '../alert/sound';
import { persistMatchedPhoto } from '../photo/persistMatchedPhoto';
import { markWishlistEntryFound } from '../storage/wishlistStore';
import { WishlistEntry } from '../types/book';
import { identifyBook } from '../vision/identifyBook';

const ALERT_COOLDOWN_MS = 4000;
// Instead of capturing on a blind fixed timer (which can land mid-motion
// and produce a blurry, unreadable frame), we sample the camera cheaply and
// only trigger a real capture once it detects the camera has settled —
// i.e. the user paused on a spine. A max-gap fallback still fires
// periodically so a slow continuous pan (never fully stopping) doesn't go
// unscanned forever.
const STILLNESS_SAMPLE_MS = 200;
const STILLNESS_REQUIRED_SAMPLES = 3; // ~600ms of a settled camera
const STILLNESS_DIFF_THRESHOLD = 8; // avg 0-255 grayscale diff between samples
const MIN_CAPTURE_GAP_MS = 2500;
const MAX_CAPTURE_GAP_MS = 5000;
// Crop to a central strip instead of sending the whole frame — smaller
// image (faster/cheaper API call) and keeps focus on the spine, matching
// its narrow, tall shape.
const SCAN_REGION = { xRatio: 0.35, yRatio: 0.1, wRatio: 0.3, hRatio: 0.8 };
const MAX_LOG_ENTRIES = 20;

interface LogEntry {
  time: string;
  imageUri: string;
  rawReply: string;
  matchedTitle: string | null;
}

interface Props {
  wishlist: WishlistEntry[];
  onBack: () => void;
}

const videoStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

/**
 * Web-only camera implementation. expo-camera's web `facing="back"` request
 * (facingMode: {ideal: 'environment'}) is not honored reliably on some
 * Android tablets/browsers — it silently returns the same (often front)
 * camera. Instead we enumerate every video input device ourselves and let
 * the user cycle through them explicitly with the "Trocar câmara" button.
 */
export default function ScanScreen({ wishlist, onBack }: Props) {
  const { t, plural } = useT();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);
  const lastAlertAtRef = useRef(0);
  const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const stableCountRef = useRef(0);
  const lastCaptureAtRef = useRef(0);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [serverConfigError, setServerConfigError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [matchedEntry, setMatchedEntry] = useState<WishlistEntry | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);

  const addLogEntry = (imageUri: string, rawReply: string, matchedTitle: string | null) => {
    setLog((prev) =>
      [
        {
          time: new Date().toLocaleTimeString('pt-PT'),
          imageUri,
          rawReply,
          matchedTitle,
        },
        ...prev,
      ].slice(0, MAX_LOG_ENTRIES)
    );
  };

  const startStream = async (deviceId?: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Device labels are only populated once permission has been granted.
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === 'videoinput'));
      setPermissionError(null);
    } catch {
      setPermissionError(t('scan.needCamera'));
    }
  };

  useEffect(() => {
    primeAlertSound();
    startStream();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cycleCamera = () => {
    if (devices.length === 0) return;
    const nextIndex = (deviceIndex + 1) % devices.length;
    setDeviceIndex(nextIndex);
    startStream(devices[nextIndex].deviceId);
  };

  const runScanCycle = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (isProcessingRef.current || !video || !canvas || video.videoWidth === 0) return;
    isProcessingRef.current = true;
    let dataUri: string | undefined;
    try {
      const sx = Math.round(video.videoWidth * SCAN_REGION.xRatio);
      const sy = Math.round(video.videoHeight * SCAN_REGION.yRatio);
      const sw = Math.round(video.videoWidth * SCAN_REGION.wRatio);
      const sh = Math.round(video.videoHeight * SCAN_REGION.hRatio);
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
      dataUri = canvas.toDataURL('image/jpeg', 0.8);
      const base64 = dataUri.split(',')[1];

      const { entry, rawReply } = await identifyBook(base64, wishlist);
      setServerConfigError(null);
      addLogEntry(dataUri, rawReply, entry ? entry.title : null);

      if (entry) {
        const now = Date.now();
        setMatchedEntry(entry);
        if (now - lastAlertAtRef.current > ALERT_COOLDOWN_MS) {
          lastAlertAtRef.current = now;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          playAlertSound();
          const savedUri = await persistMatchedPhoto(dataUri, entry.id);
          markWishlistEntryFound(entry.id, savedUri);
        }
      } else {
        setMatchedEntry(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('ANTHROPIC_API_KEY')) {
        setServerConfigError(message);
      } else if (dataUri) {
        // Regista o erro no log em vez de o engolir — sem isto não há forma
        // de saber se falhou por chave inválida, CORS, rede, etc.
        addLogEntry(dataUri, `ERRO: ${message}`, null);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [wishlist]);

  useEffect(() => {
    motionCanvasRef.current = document.createElement('canvas');
    motionCanvasRef.current.width = 32;
    motionCanvasRef.current.height = 24;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const video = videoRef.current;
      const motionCanvas = motionCanvasRef.current;
      if (isProcessingRef.current || !video || !motionCanvas || video.videoWidth === 0) return;

      const ctx = motionCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Sample the same region we actually scan, downscaled tiny — cheap
      // enough to run 5x/second without competing with the real capture.
      const sx = Math.round(video.videoWidth * SCAN_REGION.xRatio);
      const sy = Math.round(video.videoHeight * SCAN_REGION.yRatio);
      const sw = Math.round(video.videoWidth * SCAN_REGION.wRatio);
      const sh = Math.round(video.videoHeight * SCAN_REGION.hRatio);
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, motionCanvas.width, motionCanvas.height);
      const frame = ctx.getImageData(0, 0, motionCanvas.width, motionCanvas.height).data;

      const prev = prevFrameRef.current;
      if (prev) {
        let diffSum = 0;
        const pixelCount = frame.length / 4;
        for (let i = 0; i < frame.length; i += 4) {
          const g1 = (frame[i] + frame[i + 1] + frame[i + 2]) / 3;
          const g2 = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
          diffSum += Math.abs(g1 - g2);
        }
        const isStable = diffSum / pixelCount < STILLNESS_DIFF_THRESHOLD;
        stableCountRef.current = isStable ? stableCountRef.current + 1 : 0;
      }
      prevFrameRef.current = frame;

      const now = Date.now();
      const gapSinceCapture = now - lastCaptureAtRef.current;
      const settled = stableCountRef.current >= STILLNESS_REQUIRED_SAMPLES && gapSinceCapture >= MIN_CAPTURE_GAP_MS;
      const forcedByTimeout = gapSinceCapture >= MAX_CAPTURE_GAP_MS;

      if (settled || forcedByTimeout) {
        stableCountRef.current = 0;
        lastCaptureAtRef.current = now;
        runScanCycle();
      }
    }, STILLNESS_SAMPLE_MS);

    return () => clearInterval(timer);
  }, [runScanCycle]);

  if (permissionError) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>{permissionError}</Text>
        <Pressable style={styles.button} onPress={() => startStream()}>
          <Text style={styles.buttonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  if (serverConfigError) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          {serverConfigError}
          {'\n\n'}
          {t('scan.serverConfigHint')}
        </Text>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{t('scan.backToList')}</Text>
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
              <Image source={{ uri: item.imageUri }} style={styles.logThumbnail} />
              <View style={styles.logEntryText}>
                <Text style={styles.logEntryTime}>{item.time}</Text>
                <Text
                  style={item.matchedTitle ? styles.logEntryMatched : styles.debugText}
                >
                  {item.matchedTitle ? `✓ ${item.matchedTitle}` : t('scan.noMatch')}
                </Text>
                <Text style={styles.debugText}>{item.rawReply}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <Pressable style={styles.backButton} onPress={() => setShowLog(false)}>
          <Text style={styles.backButtonText}>{t('scan.backToScan')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraWrapper}>
        <video ref={videoRef} muted playsInline style={videoStyle} />
        <View pointerEvents="none" style={styles.scanGuide} />
        <Pressable style={styles.flipButton} onPress={cycleCamera}>
          <Text style={styles.flipButtonText}>
            {t('scan.flip')}{' '}
            {devices.length > 1 ? `(${deviceIndex + 1}/${devices.length})` : ''}
          </Text>
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

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  cameraWrapper: { flex: 1 },
  scanGuide: {
    position: 'absolute',
    left: `${SCAN_REGION.xRatio * 100}%`,
    top: `${SCAN_REGION.yRatio * 100}%`,
    width: `${SCAN_REGION.wRatio * 100}%`,
    height: `${SCAN_REGION.hRatio * 100}%`,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderStyle: 'dashed',
    borderRadius: 10,
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
  logEntryText: { flex: 1 },
  logEntryTime: { color: '#888', fontSize: 11, marginBottom: 2 },
  logEntryMatched: { color: '#1b998b', fontWeight: '700', fontSize: 13, marginBottom: 2 },
});
