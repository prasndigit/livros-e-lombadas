import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  onBack: () => void;
}

export default function SaveShelfScreen({ onBack }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Guardar estante</Text>
      <Text style={styles.body}>
        Aqui vais poder varrer as lombadas de uma estante inteira, dar-lhe um nome e uma
        localização (ex.: "A estante da casa da Rita") e guardar todos os títulos lidos numa
        base de dados local.
      </Text>
      <Text style={styles.soon}>Em breve.</Text>

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
  soon: { fontSize: 15, color: '#1b998b', fontWeight: '700', marginTop: 20 },
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
