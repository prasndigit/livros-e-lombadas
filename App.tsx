import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import ScanScreen from './src/screens/ScanScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import { WishlistEntry } from './src/types/book';

export default function App() {
  const [scanWishlist, setScanWishlist] = useState<WishlistEntry[] | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      {scanWishlist ? (
        <ScanScreen wishlist={scanWishlist} onBack={() => setScanWishlist(null)} />
      ) : (
        <WishlistScreen onGoToScan={setScanWishlist} />
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
