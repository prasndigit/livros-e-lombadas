import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BookSearchResult, searchBooks } from '../books/openLibrary';
import FoundPhoto from '../components/FoundPhoto';
import { useT } from '../i18n/I18nProvider';
import { getAppLang } from '../i18n/langs';
import {
  addWishlistEntry,
  getWishlistEntries,
  initWishlistStore,
  removeWishlistEntry,
} from '../storage/wishlistStore';
import { WishlistEntry } from '../types/book';

interface Props {
  onGoToScan: (wishlist: WishlistEntry[]) => void;
  onBack: () => void;
}

export default function WishlistScreen({ onGoToScan, onBack }: Props) {
  const { t } = useT();
  const [title, setTitle] = useState('');
  const [entries, setEntries] = useState<WishlistEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [viewerEntry, setViewerEntry] = useState<WishlistEntry | null>(null);

  const reload = useCallback(async () => {
    setEntries(await getWishlistEntries());
  }, []);

  useEffect(() => {
    initWishlistStore()
      .then(reload)
      .then(() => setReady(true));
  }, [reload]);

  const handleSearch = async () => {
    if (!title.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const lang = await getAppLang();
      setSearchResults(await searchBooks(title, '', lang));
    } catch {
      setSearchError(t('title.offline'));
    } finally {
      setSearching(false);
    }
  };

  const clearForm = () => {
    setTitle('');
    setSearchResults([]);
    setSearchError(null);
  };

  const handlePickResult = async (result: BookSearchResult) => {
    await addWishlistEntry(result.title, result.author, result.coverUrl ?? undefined);
    clearForm();
    await reload();
  };

  const handleAddManual = async () => {
    if (!title.trim()) return;
    await addWishlistEntry(title, '');
    clearForm();
    await reload();
  };

  const handleRemove = async (id: number) => {
    await removeWishlistEntry(id);
    await reload();
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.backLink}>{t('common.backHome')}</Text>
      </Pressable>
      <Text style={styles.heading}>{t('title.heading')}</Text>

      <TextInput
        style={styles.input}
        placeholder={t('title.inputPlaceholder')}
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={handleSearch}
        returnKeyType="search"
      />
      <Pressable style={styles.addButton} onPress={handleSearch} disabled={searching}>
        <Text style={styles.addButtonText}>
          {searching ? t('title.searchBtnBusy') : t('title.searchBtn')}
        </Text>
      </Pressable>

      {searching && <ActivityIndicator style={{ marginBottom: 12 }} />}

      {!!searchError && <Text style={styles.searchError}>{searchError}</Text>}

      {searchResults.length > 0 && (
        <ScrollView
          style={styles.resultsBox}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {searchResults.map((r, i) => (
            <Pressable key={i} style={styles.resultRow} onPress={() => handlePickResult(r)}>
              {r.coverUrl ? (
                <Image source={{ uri: r.coverUrl }} style={styles.thumbnail} />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {r.title}
                </Text>
                <Text style={styles.rowAuthor}>
                  {r.author}
                  {r.year ? ` · ${r.year}` : ''}
                  {r.otherLanguage ? ` · ${t('author.inLang', { lang: r.otherLanguage })}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {(searchResults.length > 0 || (!searching && title.trim().length > 0)) && (
        <Pressable onPress={handleAddManual} style={styles.manualAddButton}>
          <Text style={styles.manualAddButtonText}>{t('title.notFound', { title })}</Text>
        </Pressable>
      )}

      <FlatList
        style={styles.list}
        data={entries}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={styles.empty}>{t('title.empty')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.foundPhotoUri ? (
              <Pressable onPress={() => setViewerEntry(item)}>
                <Image
                  source={{ uri: item.foundPhotoUri }}
                  style={[styles.thumbnail, styles.thumbnailFound]}
                />
              </Pressable>
            ) : item.coverUrl ? (
              <Image source={{ uri: item.coverUrl }} style={styles.thumbnail} />
            ) : null}
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              {!!item.author && <Text style={styles.rowAuthor}>{item.author}</Text>}
              {!!item.foundPhotoUri && <Text style={styles.foundBadge}>{t('title.found')}</Text>}
            </View>
            <Pressable onPress={() => handleRemove(item.id)}>
              <Text style={styles.remove}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        )}
      />

      <Pressable
        style={[styles.scanButton, entries.length === 0 && styles.scanButtonDisabled]}
        disabled={!ready || entries.length === 0}
        onPress={() => onGoToScan(entries)}
      >
        <Text style={styles.scanButtonText}>{t('title.goToScan')}</Text>
      </Pressable>

      {viewerEntry?.foundPhotoUri && (
        <View style={styles.viewerOverlay}>
          <Text style={styles.viewerTitle} numberOfLines={2}>
            ✓ {viewerEntry.title}
          </Text>
          <View style={styles.viewerPhotoWrap}>
            <FoundPhoto
              uri={viewerEntry.foundPhotoUri}
              matched
              box={viewerEntry.foundBox}
              imageWidth={viewerEntry.foundImageWidth}
              imageHeight={viewerEntry.foundImageHeight}
            />
          </View>
          <Pressable style={styles.viewerClose} onPress={() => setViewerEntry(null)}>
            <Text style={styles.viewerCloseText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  backLink: { color: '#2f6690', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  heading: { fontSize: 22, fontWeight: '700', marginTop: 4, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  addButton: {
    backgroundColor: '#2f6690',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  searchError: { color: '#c0392b', marginBottom: 10 },
  resultsBox: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginBottom: 8,
    maxHeight: 320,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  manualAddButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    backgroundColor: '#fff4e6',
    borderWidth: 1,
    borderColor: '#e0a44a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  manualAddButtonText: { color: '#b26a00', fontWeight: '600', fontSize: 13 },
  list: { flex: 1 },
  empty: { color: '#888', textAlign: 'center', marginTop: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowAuthor: { fontSize: 13, color: '#666' },
  foundBadge: { fontSize: 12, color: '#1b998b', fontWeight: '700', marginTop: 2 },
  thumbnail: { width: 44, height: 44, borderRadius: 6, marginRight: 12, backgroundColor: '#eee' },
  thumbnailPlaceholder: { backgroundColor: '#ddd' },
  thumbnailFound: { borderWidth: 2, borderColor: '#1b998b' },
  remove: { color: '#c0392b' },
  scanButton: {
    backgroundColor: '#1b998b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  scanButtonDisabled: { backgroundColor: '#a9a9a9' },
  scanButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  viewerOverlay: {
    position: 'absolute',
    top: -60,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  viewerTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  viewerPhotoWrap: { width: '100%', height: '76%' },
  viewerClose: {
    marginTop: 20,
    backgroundColor: '#2f6690',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  viewerCloseText: { color: '#fff', fontWeight: '600' },
});
