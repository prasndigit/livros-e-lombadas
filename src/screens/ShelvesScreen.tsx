import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  deleteShelf,
  getShelfBooks,
  getShelves,
  initShelfStore,
  ShelfBook,
  ShelfSummary,
} from '../storage/shelfStore';

interface Props {
  onBack: () => void;
}

export default function ShelvesScreen({ onBack }: Props) {
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [books, setBooks] = useState<ShelfBook[]>([]);

  const reload = useCallback(async () => {
    await initShelfStore();
    setShelves(await getShelves());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const openShelf = async (id: number) => {
    setOpenId(id);
    setBooks(await getShelfBooks(id));
  };

  const remove = async (id: number) => {
    await deleteShelf(id);
    if (openId === id) {
      setOpenId(null);
      setBooks([]);
    }
    await reload();
  };

  if (openId !== null) {
    const shelf = shelves.find((s) => s.id === openId);
    return (
      <View style={styles.container}>
        <Pressable onPress={() => setOpenId(null)}>
          <Text style={styles.link}>‹ Estantes</Text>
        </Pressable>
        <Text style={styles.heading}>{shelf?.name ?? 'Estante'}</Text>
        {!!shelf?.location && <Text style={styles.meta}>{shelf.location}</Text>}
        <Text style={styles.meta}>
          {books.length} título{books.length === 1 ? '' : 's'}
        </Text>
        <ScrollView style={styles.list}>
          {books.map((b) => (
            <Text key={b.id} style={styles.bookLine}>
              • {b.rawText}
            </Text>
          ))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>‹ Início</Text>
      </Pressable>
      <Text style={styles.heading}>Estantes guardadas</Text>
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
            <Pressable onPress={() => remove(s.id)}>
              <Text style={styles.remove}>remover</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  link: { color: '#2f6690', fontSize: 14, fontWeight: '600', paddingVertical: 4 },
  heading: { fontSize: 22, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  meta: { fontSize: 13, color: '#666', marginBottom: 2 },
  list: { flex: 1, marginTop: 8 },
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
  remove: { color: '#c0392b', fontSize: 13 },
  bookLine: { fontSize: 15, color: '#333', paddingVertical: 6 },
});
