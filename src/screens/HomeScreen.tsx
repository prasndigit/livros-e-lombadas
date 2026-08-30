import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  DEFAULT_LANG,
  getSearchLang,
  SEARCH_LANGS,
  SearchLang,
  setSearchLang,
} from '../books/searchLanguage';
import { getWishlistEntries } from '../storage/wishlistStore';

export type HomeDestination = 'title' | 'author' | 'shelf' | 'shelves';

interface Props {
  onNavigate: (dest: HomeDestination) => void;
  onGoToScan: () => void;
  /** Bumped by the parent whenever the wishlist may have changed, to refresh the count. */
  refreshKey?: number;
}

export default function HomeScreen({ onNavigate, onGoToScan, refreshKey }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [lang, setLang] = useState<SearchLang>(DEFAULT_LANG);

  const reloadCount = useCallback(async () => {
    try {
      const entries = await getWishlistEntries();
      setCount(entries.length);
    } catch {
      setCount(null);
    }
  }, []);

  useEffect(() => {
    reloadCount();
  }, [reloadCount, refreshKey]);

  useEffect(() => {
    getSearchLang().then(setLang);
  }, []);

  const chooseLang = (code: SearchLang) => {
    setLang(code);
    setSearchLang(code);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Livros e Lombadas</Text>
      <Text style={styles.subheading}>O que queres fazer?</Text>

      <Pressable style={styles.option} onPress={() => onNavigate('title')}>
        <Text style={styles.optionText}>Procurar livro por título</Text>
        <Text style={styles.optionHint}>Procura um título e junta-o à lista a scanear</Text>
      </Pressable>

      <Pressable style={styles.option} onPress={() => onNavigate('author')}>
        <Text style={styles.optionText}>Procurar livro por autor</Text>
        <Text style={styles.optionHint}>Escolhe um autor e junta obras da bibliografia dele</Text>
      </Pressable>

      <Pressable style={styles.option} onPress={() => onNavigate('shelf')}>
        <Text style={styles.optionText}>Guardar estante</Text>
        <Text style={styles.optionHint}>Regista as lombadas de uma estante e dá-lhe nome e local</Text>
      </Pressable>

      <Text style={styles.langLabel}>Idioma das pesquisas</Text>
      <View style={styles.langRow}>
        {SEARCH_LANGS.map((l) => {
          const on = l.code === lang;
          return (
            <Pressable
              key={l.code}
              style={[styles.langChip, on && styles.langChipOn]}
              onPress={() => chooseLang(l.code)}
            >
              <Text style={[styles.langChipText, on && styles.langChipTextOn]}>{l.short}</Text>
            </Pressable>
          );
        })}
      </View>

      {count !== null && count > 0 && (
        <Pressable style={styles.scanShortcut} onPress={onGoToScan}>
          <Text style={styles.scanShortcutText}>
            Ir para o scan ({count} livro{count === 1 ? '' : 's'})
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.secondaryLink} onPress={() => onNavigate('shelves')}>
        <Text style={styles.secondaryLinkText}>Estantes guardadas ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 72 },
  heading: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  subheading: { fontSize: 15, color: '#666', marginBottom: 28 },
  option: {
    backgroundColor: '#f2f6f9',
    borderWidth: 1,
    borderColor: '#dce6ee',
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
  },
  optionText: { fontSize: 18, fontWeight: '700', color: '#2f6690' },
  optionHint: { fontSize: 13, color: '#6b7c88', marginTop: 4 },
  langLabel: { fontSize: 13, color: '#6b7c88', marginTop: 8, marginBottom: 8 },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    borderWidth: 1,
    borderColor: '#dce6ee',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  langChipOn: { backgroundColor: '#2f6690', borderColor: '#2f6690' },
  langChipText: { fontSize: 13, fontWeight: '700', color: '#2f6690' },
  langChipTextOn: { color: '#fff' },
  scanShortcut: {
    marginTop: 20,
    backgroundColor: '#1b998b',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  scanShortcutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondaryLink: { marginTop: 18, alignSelf: 'center', padding: 8 },
  secondaryLinkText: { color: '#2f6690', fontSize: 14, fontWeight: '600' },
});
