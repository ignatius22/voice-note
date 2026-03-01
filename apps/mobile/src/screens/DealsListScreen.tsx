import type { Deal } from '@vault/core';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppState } from '../app/AppProvider';
import type { AppStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<AppStackParamList, 'DealsList'>;

function formatAmount(deal: Deal): string | null {
  if (deal.amount === undefined || !deal.currency) {
    return null;
  }

  return `${deal.currency} ${deal.amount.toLocaleString()}`;
}

export function DealsListScreen({ navigation }: Props) {
  const { session, deals, isLoadingDeals, notice, setNotice, deleteDealRecord, logout } =
    useAppState();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.statusText}>Status: Logged in</Text>
      {session ? (
        <Text style={styles.helperText}>
          Hashed user id: {session.userIdHash.slice(0, 12)}...
        </Text>
      ) : null}
      <Pressable
        style={styles.primaryButton}
        onPress={() => {
          setNotice(null);
          navigation.navigate('DealEditor');
        }}
      >
        <Text style={styles.primaryButtonText}>Add Deal</Text>
      </Pressable>
      {isLoadingDeals ? (
        <ActivityIndicator size="small" color="#1f2937" />
      ) : deals.length === 0 ? (
        <Text style={styles.helperText}>No deals saved yet.</Text>
      ) : (
        <View style={styles.dealsList}>
          {deals.map(deal => (
            <Pressable
              key={deal.id}
              onPress={() => {
                setNotice(null);
                navigation.navigate('DealEditor', { dealId: deal.id });
              }}
              style={styles.dealCard}
            >
              <Text style={styles.dealTitle}>{deal.brandName}</Text>
              <Text style={styles.dealMeta}>
                {deal.status}
                {formatAmount(deal) ? ` | ${formatAmount(deal)}` : ''}
              </Text>
              <Text numberOfLines={1} style={styles.helperText}>
                {deal.privateNotes ? 'Private notes saved' : 'No private notes'}
              </Text>
              <View style={styles.cardActions}>
                <Pressable onPress={() => navigation.navigate('DealEditor', { dealId: deal.id })}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => void deleteDealRecord(deal.id)}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
        <Text style={styles.secondaryButtonText}>Logout</Text>
      </Pressable>
      {notice ? <Text style={styles.helperText}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  statusText: {
    fontSize: 16,
    color: '#1f2937',
  },
  helperText: {
    color: '#4b5563',
  },
  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#111827',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  dealsList: {
    gap: 12,
  },
  dealCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    backgroundColor: '#f9fafb',
  },
  dealTitle: {
    color: '#111827',
    fontWeight: '600',
  },
  dealMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 16,
  },
  editText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '600',
  },
});
