import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { AppScreen } from './src/screens/AppScreen';

function App() {
  return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <AppScreen />
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});

export default App;
