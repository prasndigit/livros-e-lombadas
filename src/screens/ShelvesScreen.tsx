import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  deleteShelf,
  deleteShelfBook,
  getShelfBooks,
  getShelves,
  initShelfStore,
  searchShelfBooks,
  ShelfBook,
  ShelfHit,
  ShelfSummary,
  updateShelfBook,
} from '../storage/shelfStore';
import { addWishlistEntry } from '../storage/wishlistStore';

interface Props {
  onBack: () => void;
}

export default function ShelvesScreen({ onBack }: Props) {
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());

  const [bookQuery, setBookQuery] = useState('');
  const [bookHits, setBookHits] = useState<ShelfHit[]>([]);
  const [searching, setSearching] = useState(false);

  const reload = useCallback(async () => {
    await initShelfStore();
    setShelves(await getShelves());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Debounced "procurar livro nas estantes".
  useEffect(() => {
    const q = bookQuery.trim();
    if (q.length < 2) {
      setBookHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        await initShelfStore();
        setBookHits(await searchShelfBooks(q));
      } catch {
        setBookHits([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [bookQuery]);

  const reloadBooks = useCallback(async (id: number) => {
    setBooks(await getShelfBooks(id));
  }, []);

  const openShelf = async (id: number) => {
    setOpenId(id);
    setEditingId(null);
    setSentIds(new Set());
    await reloadBooks(id);
  };

  const closeShelf = () => {
    setOpenId(null);
    setBooks([]);
    setEditingId(null);
  };

  const removeShelf = async (id: number) => {
    await deleteShelf(id);
    if (openId === id) closeShelf();
    await reload();
  };

  const removeBook = async (book: ShelfBook) => {
    if (openId === null) return;
    await deleteShelfBook(openId, book.id);
    await reloadBooks(openId);
    await reload();
  };

  const startEdit = (book: ShelfBook) => {
    setEditingId(book.id);
    setDraft(book.rawText);
  };

  const saveEdit = async () => {
    if (openId === null || editingId === null) return;
    const text = draft.trim();
    if (text) {
      await updateShelfBook(openId, editingId, text);
      await reloadBooks(openId);
    }
    setEditingId(null);
  };

  const sendToSearch = async (book: ShelfBook) => {
    await addWishlistEntry(book.rawText, '');
    setSentIds((prev) => new Set(prev).add(book.id));
  };

  if (openId !== null) {
    const shelf = shelves.find((s) => s.id === openId);
    return (
      <View style={styles.container}>
        <Pressable onPress={closeShelf}>
          <Text style={styles.link}>‹ Estantes</Text>
        </Pressable>
        <Text style={styles.heading}>{shelf?.name ?? 'Estante'}</Text>
        {!!shelf?.location && <Text style={styles.meta}>{shelf.location}</Text>}
        <Text style={styles.meta}>
          {books.length} título{books.length === 1 ? '' : 's'}
        </Text>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {books.map((b) => (
            <View key={b.id} style={styles.bookRow}>
              {editingId === b.id ? (
                <>
                  <TextInput
                    style={styles.bookInput}
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    onSubmitEditing={saveEdit}
                    returnKeyType="done"
                  />
                  <View style={styles.bookActions}>
                    <Pressable onPress={saveEdit}>
                      <Text style={styles.act}>guardar</Text>
                    </Pressable>
                    <Pressable onPress={() => setEditingId(null)}>
                      <Text style={styles.actMuted}>cancelar</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.bookLine}>{b.rawText}</Text>
                  <View style={styles.bookActions}>
                    {sentIds.has(b.id) ? (
                      <Text style={styles.sent}>✓ enviado</Text>
                    ) : (
                      <Pressable onPress={() => sendToSearch(b)}>
                        <Text style={styles.act}>procurar</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => startEdit(b)}>
                      <Text style={styles.act}>editar</Text>
                    </Pressable>
                    <Pressable onPress={() => removeBook(b)}>
                      <Text style={styles.actDanger}>apagar</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ))}
          {books.length === 0 && <Text style={styles.meta}>Esta estante ficou sem títulos.</Text>}
        </ScrollView>
      </View>
    );
  }

  const query = bookQuery.trim();

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>‹ Início</Text>
      </Pressable>
      <Text style={styles.heading}>Estantes guardadas</Text>

      {shelves.length > 0 && (
        <TextInput
          style={styles.search}
          placeholder="Procurar livro nas estantes"
          value={bookQuery}
          onChangeText={setBookQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
      )}

      {query.length >= 2 ? (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {searching && <ActivityIndicator style={{ marginTop: 8 }} />}
          {!searching && bookHits.length === 0 && (
            <Text style={styles.meta}>Nenhum livro encontrado nas estantes.</Text>
          )}
          {bookHits.map((h, i) => (
            <Pressable
              key={`${h.shelfId}-${i}`}
              style={styles.hitRow}
              onPress={() => openShelf(h.shelfId)}
            >
              <Text style={styles.hitTitle}>{h.rawText}</Text>
              <Text style={styles.meta}>
                em: {h.shelfName}
                {h.shelfLocation ? `  ·  ${h.shelfLocation}` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <ScrollView style={styles.list}>
          {shelves.length === 0 && (
            <Text style={styles.meta}>Ainda não guardaste nenhuma estante.</Text>
          )}
          {shelves.map((s) => (
            <View key={s.id} style={styles.shelfRow}>
              <Pressable style={styles.shelfRowMain} onPress={() => openShelf(s.id)}>
                <Text style={styles.shelfName}>{s.name}</Text>
                <Text style={styles.meta}>
                  {[s.location, `${s.bookCount} livro${s.bookCount === 1 ? '' : 's'}`]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Text>
              </Pressable>
              <Pressable onPress={() => removeShelf(s.id)}>
                <Text style={styles.actDanger}>apagar</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  link: { color: '#2f6690', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  heading: { fontSize: 22, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  meta: { fontSize: 13, color: '#666', marginBottom: 2 },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  list: { flex: 1, marginTop: 8 },
  hitRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  hitTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  shelfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  shelfRowMain: { flex: 1, marginRight: 10 },
  shelfName: { fontSize: 16, fontWeight: '600' },
  bookRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  bookLine: { fontSize: 15, color: '#333' },
  bookInput: {
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2f6690',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  bookActions: { flexDirection: 'row', gap: 18, marginTop: 8 },
  act: { color: '#2f6690', fontSize: 13, fontWeight: '600' },
  actMuted: { color: '#888', fontSize: 13 },
  actDanger: { color: '#c0392b', fontSize: 13, fontWeight: '600' },
  sent: { color: '#1b998b', fontSize: 13, fontWeight: '700' },
});
