import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthorResult, BookSearchResult, getAuthorWorks, searchAuthors } from '../books/openLibrary';
import { useT } from '../i18n/I18nProvider';
import { getAppLang } from '../i18n/langs';
import { addWishlistEntry } from '../storage/wishlistStore';

interface Props {
  onBack: () => void;
  /** Called after titles are added to the scan list. */
  onAdded: () => void;
}

export default function AuthorSearchScreen({ onBack, onAdded }: Props) {
  const { t, plural } = useT();
  const [step, setStep] = useState<'author' | 'works'>('author');
  const [authorQuery, setAuthorQuery] = useState('');
  const [authors, setAuthors] = useState<AuthorResult[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorResult | null>(null);
  const [works, setWorks] = useState<BookSearchResult[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loadingAuthors, setLoadingAuthors] = useState(false);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchSeq = useRef(0);

  // Live suggestions: debounce the typing, then query. A sequence guard drops
  // any response that arrives after a newer keystroke.
  useEffect(() => {
    const q = authorQuery.trim();
    const seq = ++searchSeq.current;

    if (q.length < 3) {
      setAuthors([]);
      setLoadingAuthors(false);
      return;
    }

    setLoadingAuthors(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchAuthors(q);
        if (seq === searchSeq.current) {
          setAuthors(results);
          setError(null);
        }
      } catch {
        if (seq === searchSeq.current) {
          setError(t('author.offline'));
        }
      } finally {
        if (seq === searchSeq.current) setLoadingAuthors(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [authorQuery]);

  const pickAuthor = async (author: AuthorResult) => {
    setSelectedAuthor(author);
    setStep('works');
    setWorks([]);
    setChecked(new Set());
    setLoadingWorks(true);
    setError(null);
    try {
      const id = author.key.replace(/^\/authors\//, '');
      const lang = await getAppLang();
      setWorks(await getAuthorWorks(id, author.name, lang));
    } catch {
      setError(t('author.loadError'));
    } finally {
      setLoadingWorks(false);
    }
  };

  const toggle = (workKey: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(workKey)) next.delete(workKey);
      else next.add(workKey);
      return next;
    });
  };

  const selectAll = () => setChecked(new Set(works.map((w) => w.workKey)));
  const clearAll = () => setChecked(new Set());

  const handleAdd = async () => {
    if (checked.size === 0) return;
    setAdding(true);
    try {
      for (const work of works) {
        if (checked.has(work.workKey)) {
          await addWishlistEntry(work.title, work.author, work.coverUrl ?? undefined);
        }
      }
      onAdded();
    } catch {
      setError(t('author.addError'));
      setAdding(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>{t('common.backHome')}</Text>
        </Pressable>
        <Text style={styles.heading}>{t('author.heading')}</Text>
      </View>

      {step === 'author' && (
        <>
          <TextInput
            style={styles.input}
            placeholder={t('author.inputPlaceholder')}
            value={authorQuery}
            onChangeText={setAuthorQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="words"
          />
          <View style={styles.statusRow}>
            {loadingAuthors ? (
              <>
                <ActivityIndicator size="small" />
                <Text style={styles.hint}>{t('common.searchingLower')}</Text>
              </>
            ) : (
              <Text style={styles.hint}>{t('author.typeahead')}</Text>
            )}
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {authors.map((a) => (
              <Pressable key={a.key} style={styles.authorRow} onPress={() => pickAuthor(a)}>
                <Text style={styles.authorName}>{a.name}</Text>
                <Text style={styles.authorMeta}>
                  {[a.lifespan, `${a.workCount} ${plural(a.workCount, 'common.work')}`]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
                {!!a.topWork && (
                  <Text style={styles.authorTopWork} numberOfLines={1}>
                    {a.topWork}
                  </Text>
                )}
              </Pressable>
            ))}
            {!loadingAuthors && authors.length === 0 && authorQuery.trim().length >= 3 && !error && (
              <Text style={styles.empty}>{t('author.noResults')}</Text>
            )}
          </ScrollView>
        </>
      )}

      {step === 'works' && selectedAuthor && (
        <>
          <Pressable onPress={() => setStep('author')}>
            <Text style={styles.link}>{t('author.otherAuthor')}</Text>
          </Pressable>
          <Text style={styles.bibHeading}>
            {t('author.biblioOf', { name: selectedAuthor.name })}
          </Text>

          {loadingWorks && <ActivityIndicator style={{ marginTop: 12 }} />}
          {!!error && <Text style={styles.error}>{error}</Text>}

          {!loadingWorks && works.length > 0 && (
            <View style={styles.selectRow}>
              <Text style={styles.selectCount}>
                {t('author.counts', {
                  works: works.length,
                  worksNoun: plural(works.length, 'common.work'),
                  sel: checked.size,
                  selNoun: plural(checked.size, 'author.selectedFem'),
                })}
              </Text>
              <View style={styles.selectActions}>
                <Pressable onPress={selectAll}>
                  <Text style={styles.link}>{t('author.selectAll')}</Text>
                </Pressable>
                <Pressable onPress={clearAll}>
                  <Text style={styles.link}>{t('author.clear')}</Text>
                </Pressable>
              </View>
            </View>
          )}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {works.map((w) => {
              const on = checked.has(w.workKey);
              return (
                <Pressable key={w.workKey} style={styles.workRow} onPress={() => toggle(w.workKey)}>
                  <View style={[styles.checkbox, on && styles.checkboxOn]}>
                    {on && <Text style={styles.checkboxTick}>✓</Text>}
                  </View>
                  {w.coverUrl ? (
                    <Image source={{ uri: w.coverUrl }} style={styles.thumbnail} />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
                  )}
                  <View style={styles.workText}>
                    <Text style={styles.workTitle} numberOfLines={2}>
                      {w.title}
                    </Text>
                    <Text style={styles.workYear}>
                      {[w.year, w.otherLanguage ? t('author.inLang', { lang: w.otherLanguage }) : null]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            style={[styles.primaryButton, checked.size === 0 && styles.primaryButtonDisabled]}
            onPress={handleAdd}
            disabled={checked.size === 0 || adding}
          >
            <Text style={styles.primaryButtonText}>
              {adding ? t('author.addBtnBusy') : t('author.addBtn', { count: checked.size })}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  topBar: { marginBottom: 14 },
  link: { color: '#2f6690', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  heading: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 20 },
  hint: { fontSize: 12, color: '#8a8a8a' },
  primaryButton: {
    backgroundColor: '#2f6690',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: { backgroundColor: '#a9a9a9' },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c0392b', marginTop: 10 },
  empty: { color: '#888', marginTop: 16 },
  list: { flex: 1, marginTop: 12, marginBottom: 12 },
  authorRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  authorName: { fontSize: 16, fontWeight: '600' },
  authorMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  authorTopWork: { fontSize: 13, color: '#999', marginTop: 2, fontStyle: 'italic' },
  bibHeading: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  selectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  selectCount: { fontSize: 13, color: '#666', flex: 1 },
  selectActions: { flexDirection: 'row', gap: 16 },
  workRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#2f6690',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxOn: { backgroundColor: '#2f6690' },
  checkboxTick: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 16 },
  thumbnail: { width: 40, height: 56, borderRadius: 4, marginRight: 12, backgroundColor: '#eee' },
  thumbnailPlaceholder: { backgroundColor: '#ddd' },
  workText: { flex: 1 },
  workTitle: { fontSize: 15, fontWeight: '500' },
  workYear: { fontSize: 12, color: '#888', marginTop: 2 },
});
