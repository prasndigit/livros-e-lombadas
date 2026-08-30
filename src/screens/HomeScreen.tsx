import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n/I18nProvider';
import { APP_LANGS } from '../i18n/langs';
import { getWishlistEntries } from '../storage/wishlistStore';

export type HomeDestination = 'title' | 'author' | 'shelf' | 'shelves';

interface Props {
  onNavigate: (dest: HomeDestination) => void;
  onGoToScan: () => void;
  /** Bumped by the parent whenever the wishlist may have changed, to refresh the count. */
  refreshKey?: number;
}

export default function HomeScreen({ onNavigate, onGoToScan, refreshKey }: Props) {
  const { t, plural, lang, setLang } = useT();
  const [count, setCount] = useState<number | null>(null);

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

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Livros e Lombadas</Text>
      <Text style={styles.subheading}>{t('home.subtitle')}</Text>

      <Pressable style={styles.option} onPress={() => onNavigate('title')}>
        <Text style={styles.optionText}>{t('home.byTitle')}</Text>
        <Text style={styles.optionHint}>{t('home.byTitleHint')}</Text>
      </Pressable>

      <Pressable style={styles.option} onPress={() => onNavigate('author')}>
        <Text style={styles.optionText}>{t('home.byAuthor')}</Text>
        <Text style={styles.optionHint}>{t('home.byAuthorHint')}</Text>
      </Pressable>

      <Pressable style={styles.option} onPress={() => onNavigate('shelf')}>
        <Text style={styles.optionText}>{t('home.shelf')}</Text>
        <Text style={styles.optionHint}>{t('home.shelfHint')}</Text>
      </Pressable>

      <Text style={styles.langLabel}>{t('home.appLanguage')}</Text>
      <View style={styles.langRow}>
        {APP_LANGS.map((l) => {
          const on = l.code === lang;
          return (
            <Pressable
              key={l.code}
              style={[styles.langChip, on && styles.langChipOn]}
              onPress={() => setLang(l.code)}
            >
              <Text style={[styles.langChipText, on && styles.langChipTextOn]}>
                {l.flag} {l.short}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {count !== null && count > 0 && (
        <Pressable style={styles.scanShortcut} onPress={onGoToScan}>
          <Text style={styles.scanShortcutText}>
            {t('home.goToScan', { count, noun: plural(count, 'common.book') })}
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.secondaryLink} onPress={() => onNavigate('shelves')}>
        <Text style={styles.secondaryLinkText}>{t('home.savedShelves')}</Text>
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
