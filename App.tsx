import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import AuthorSearchScreen from './src/screens/AuthorSearchScreen';
import HomeScreen, { HomeDestination } from './src/screens/HomeScreen';
import ScanScreen from './src/screens/ScanScreen';
import ShelfScanScreen from './src/screens/ShelfScanScreen';
import ShelvesScreen from './src/screens/ShelvesScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import { getWishlistEntries } from './src/storage/wishlistStore';
import { WishlistEntry } from './src/types/book';

type Route = 'home' | HomeDestination | 'scan';

export default function App() {
  const [route, setRoute] = useState<Route>('home');
  const [scanWishlist, setScanWishlist] = useState<WishlistEntry[] | null>(null);
  // Bumped whenever the wishlist may have changed, so HomeScreen refreshes its count.
  const [wishlistVersion, setWishlistVersion] = useState(0);

  const goHome = () => {
    setWishlistVersion((v) => v + 1);
    setRoute('home');
  };

  const goToScanWithCurrentList = async () => {
    setScanWishlist(await getWishlistEntries());
    setRoute('scan');
  };

  return (
    <SafeAreaView style={styles.container}>
      {route === 'home' && (
        <HomeScreen
          onNavigate={(dest) => setRoute(dest)}
          onGoToScan={goToScanWithCurrentList}
          refreshKey={wishlistVersion}
        />
      )}

      {route === 'title' && (
        <WishlistScreen
          onBack={goHome}
          onGoToScan={(wishlist) => {
            setScanWishlist(wishlist);
            setRoute('scan');
          }}
        />
      )}

      {route === 'author' && <AuthorSearchScreen onBack={goHome} onAdded={goHome} />}

      {route === 'shelf' && <ShelfScanScreen onBack={goHome} onDone={() => setRoute('shelves')} />}

      {route === 'shelves' && <ShelvesScreen onBack={goHome} />}

      {route === 'scan' && scanWishlist && (
        <ScanScreen wishlist={scanWishlist} onBack={goHome} />
      )}

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
