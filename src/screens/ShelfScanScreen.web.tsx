import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  onDone: () => void;
  onBack: () => void;
}

/**
 * Web stub. Shelf cataloguing relies on the phone's on-device text
 * recognition; the web build has no equivalent OCR path.
 */
export default function ShelfScanScreen({ onBack }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Guardar estante</Text>
      <Text style={styles.body}>
        A catalogação de estantes usa a câmara e o reconhecimento de texto do telemóvel. Abre a
        app no telemóvel para usar esta função.
      </Text>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Voltar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 72 },
  heading: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  body: { fontSize: 15, color: '#444', lineHeight: 22 },
  backButton: {
    marginTop: 32,
    backgroundColor: '#2f6690',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'flex-start',
  },
  backButtonText: { color: '#fff', fontWeight: '600' },
});
