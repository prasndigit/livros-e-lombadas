import React, { useState } from 'react';
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
import { getSearchLang } from '../books/searchLanguage';
import { addWishlistEntry } from '../storage/wishlistStore';

interface Props {
  onBack: () => void;
  /** Called after titles are added to the scan list. */
  onAdded: () => void;
}

export default function AuthorSearchScreen({ onBack, onAdded }: Props) {
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

  const handleAuthorSearch = async () => {
    if (authorQuery.trim().length < 2) return;
    setLoadingAuthors(true);
    setError(null);
    setAuthors([]);
    try {
      setAuthors(await searchAuthors(authorQuery));
    } catch {
      setError('Não foi possível procurar agora — verifica a ligação à internet.');
    } finally {
      setLoadingAuthors(false);
    }
  };

  const pickAuthor = async (author: AuthorResult) => {
    setSelectedAuthor(author);
    setStep('works');
    setWorks([]);
    setChecked(new Set());
    setLoadingWorks(true);
    setError(null);
    try {
      const id = author.key.replace(/^\/authors\//, '');
      const lang = await getSearchLang();
      setWorks(await getAuthorWorks(id, author.name, lang));
    } catch {
      setError('Não foi possível carregar a bibliografia — verifica a ligação à internet.');
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
      setError('Não foi possível adicionar todos os títulos.');
      setAdding(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>‹ Início</Text>
        </Pressable>
        <Text style={styles.heading}>Procurar por autor</Text>
      </View>

      {step === 'author' && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Nome do autor"
            value={authorQuery}
            onChangeText={setAuthorQuery}
            onSubmitEditing={handleAuthorSearch}
            returnKeyType="search"
          />
          <Pressable style={styles.primaryButton} onPress={handleAuthorSearch} disabled={loadingAuthors}>
            <Text style={styles.primaryButtonText}>
              {loadingAuthors ? 'A procurar...' : 'Procurar autor'}
            </Text>
          </Pressable>

          {loadingAuthors && <ActivityIndicator style={{ marginTop: 12 }} />}
          {!!error && <Text style={styles.error}>{error}</Text>}

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {authors.map((a) => (
              <Pressable key={a.key} style={styles.authorRow} onPress={() => pickAuthor(a)}>
                <Text style={styles.authorName}>{a.name}</Text>
                <Text style={styles.authorMeta}>
                  {[a.lifespan, `${a.workCount} obra${a.workCount === 1 ? '' : 's'}`]
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
            {!loadingAuthors && authors.length === 0 && authorQuery.trim().length >= 2 && !error && (
              <Text style={styles.empty}>Sem resultados. Tenta outra grafia do nome.</Text>
            )}
          </ScrollView>
        </>
      )}

      {step === 'works' && selectedAuthor && (
        <>
          <Pressable onPress={() => setStep('author')}>
            <Text style={styles.link}>‹ outro autor</Text>
          </Pressable>
          <Text style={styles.bibHeading}>Bibliografia de {selectedAuthor.name}</Text>

          {loadingWorks && <ActivityIndicator style={{ marginTop: 12 }} />}
          {!!error && <Text style={styles.error}>{error}</Text>}

          {!loadingWorks && works.length > 0 && (
            <View style={styles.selectRow}>
              <Text style={styles.selectCount}>
                {works.length} obra{works.length === 1 ? '' : 's'} · {checked.size} selecionada
                {checked.size === 1 ? '' : 's'}
              </Text>
              <View style={styles.selectActions}>
                <Pressable onPress={selectAll}>
                  <Text style={styles.link}>todos</Text>
                </Pressable>
                <Pressable onPress={clearAll}>
                  <Text style={styles.link}>limpar</Text>
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
                      {[w.year, w.otherLanguage ? `em ${w.otherLanguage}` : null]
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
              {adding ? 'A adicionar...' : `Adicionar ${checked.size} à lista`}
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
    marginBottom: 10,
  },
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
