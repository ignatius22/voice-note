import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { defaultConfig } from '@vault/config';
import { bucketNoteLength, createNoteDraft } from '@vault/core';

export function AppScreen() {
  const draft = createNoteDraft('hello vault');
  const bucket = bucketNoteLength(draft.plaintext.length);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vault Notes</Text>
      <Text style={styles.bodyText}>Render path is working.</Text>
      <Text style={styles.bodyText}>
        Diagnostics enabled: {String(defaultConfig.diagnosticsScreenEnabled)}
      </Text>
      <Text style={styles.bodyText}>Draft id: {draft.id}</Text>
      <Text style={styles.bodyText}>Length bucket: {bucket}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
  },
  bodyText: {
    color: '#374151',
  },
});
