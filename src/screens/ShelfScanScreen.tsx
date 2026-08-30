import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSearchLang, languageName } from '../books/searchLanguage';
import { tidyShelfTitles } from '../books/tidyTitles';
import { discardPhoto, recognizeText } from '../ocr/textRecognition';
import { createShelf, initShelfStore } from '../storage/shelfStore';

const CAPTURE_INTERVAL_MS = 1500;
const MIN_TITLE_LENGTH = 3;

interface Props {
  onDone: () => void;
  onBack: () => void;
}

/**
 * Catalogue a whole shelf. Point the camera at the spines; each capture is
 * OCR'd on-device and the longest line read is kept as a candidate title.
 * Nothing is looked up anywhere — it just records the raw text. The session
 * ends deliberately with "Terminar estante", which saves name + location +
 * every title to the local database.
 */
export default function ShelfScanScreen({ onDone, onBack }: Props) {
  const [phase, setPhase] = useState<'setup' | 'scanning'>('setup');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [titles, setTitles] = useState<string[]>([]);
  const [lastRead, setLastRead] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    initShelfStore();
  }, []);

  useEffect(() => {
    if (phase !== 'scanning' || !permission?.granted) return;

    const interval = setInterval(async () => {
      if (isProcessingRef.current || !cameraRef.current) return;
      isProcessingRef.current = true;
      setAnalyzing(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.4, shutterSound: false });
        if (!photo) return;
        const { lines } = await recognizeText(photo.uri, photo.width, photo.height);
        discardPhoto(photo.uri);

        const candidate = lines
          .map((l) => l.text.trim())
          .filter((t) => t.length >= MIN_TITLE_LENGTH)
          .sort((a, b) => b.length - a.length)[0];

        if (candidate) {
          setLastRead(candidate);
          setTitles((prev) =>
            prev.some((t) => t.toLowerCase() === candidate.toLowerCase()) ? prev : [candidate, ...prev]
          );
        }
      } catch {
        // a single failed capture shouldn't stop the loop
      } finally {
        isProcessingRef.current = false;
        setAnalyzing(false);
      }
    }, CAPTURE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [phase, permission?.granted]);

  const removeTitle = (index: number) => setTitles((prev) => prev.filter((_, i) => i !== index));

  const finish = async () => {
    if (titles.length === 0) {
      onBack();
      return;
    }
    setSaving(true);

    // titles are prepended newest-first while scanning; store in capture order
    const raw = [...titles].reverse();

    // One spell-correction pass over the whole session. If it fails (offline,
    // server error) we still save the raw OCR reads.
    let toSave = raw;
    try {
      const lang = await getSearchLang();
      toSave = await tidyShelfTitles(raw, languageName(lang));
    } catch {
      toSave = raw;
    }

    try {
      await createShelf(name, location, toSave);
      onDone();
    } catch {
      setSaving(false);
    }
  };

  if (phase === 'setup') {
    return (
      <View style={styles.container}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>‹ Início</Text>
        </Pressable>
        <Text style={styles.heading}>Guardar estante</Text>
        <Text style={styles.body}>
          Dá um nome e um local à estante. Depois aponta a câmara às lombadas — a app vai
          registando os títulos que consegue ler, sem os procurar em lado nenhum.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Nome da estante (ex.: Estante da casa da Sofia)"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Localização (opcional)"
          value={location}
          onChangeText={setLocation}
        />
        <Pressable
          style={[styles.primaryButton, !name.trim() && styles.primaryButtonDisabled]}
          disabled={!name.trim()}
          onPress={() => setPhase('scanning')}
        >
          <Text style={styles.primaryButtonText}>Começar a catalogar</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Precisamos de acesso à câmara para ler as lombadas.</Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir câmara</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.scanContainer}>
      <View style={styles.cameraWrapper}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View pointerEvents="none" style={styles.debugPanel}>
          <Text style={styles.debugText}>
            {analyzing ? 'A ler...' : lastRead || 'aponta a uma lombada'}
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelHeading}>
          {name} — {titles.length} título{titles.length === 1 ? '' : 's'}
        </Text>
        <ScrollView style={styles.titleList}>
          {titles.length === 0 && (
            <Text style={styles.hint}>Ainda nada. Aproxima e estabiliza numa lombada.</Text>
          )}
          {titles.map((t, i) => (
            <View key={`${t}-${i}`} style={styles.titleRow}>
              <Text style={styles.titleText} numberOfLines={2}>
                {t}
              </Text>
              <Pressable onPress={() => removeTitle(i)}>
                <Text style={styles.remove}>remover</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
        <Pressable style={styles.finishButton} onPress={finish} disabled={saving}>
          <Text style={styles.finishButtonText}>
            {saving
              ? 'A corrigir e guardar...'
              : titles.length === 0
                ? 'Terminar (sem títulos)'
                : `Terminar estante (${titles.length})`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  link: { color: '#2f6690', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  heading: { fontSize: 24, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  body: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 18 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#2f6690',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: { backgroundColor: '#a9a9a9' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  permissionText: {
    color: '#333',
    textAlign: 'center',
    marginTop: 80,
    marginBottom: 20,
    paddingHorizontal: 24,
  },

  scanContainer: { flex: 1, backgroundColor: '#000' },
  cameraWrapper: { flex: 1 },
  debugPanel: {
    position: 'absolute',
    left: 16,
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    padding: 8,
  },
  debugText: { color: '#0f0', fontSize: 12 },
  panel: {
    maxHeight: '45%',
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  panelHeading: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  titleList: { flexGrow: 0 },
  hint: { color: '#888', fontSize: 13, paddingVertical: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  titleText: { color: '#eee', fontSize: 14, flex: 1, marginRight: 10 },
  remove: { color: '#c0392b', fontSize: 13 },
  finishButton: {
    backgroundColor: '#1b998b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  finishButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
