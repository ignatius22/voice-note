import {
  DEAL_CURRENCIES,
  DEAL_STATUSES,
  type DealCurrency,
  type DealStatus,
} from '@vault/core';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAppState } from '../app/AppProvider';
import type { AppStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<AppStackParamList, 'DealEditor'>;

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong.';
  }

  switch (error.message) {
    case 'INVALID_DEAL_BRAND_NAME':
      return 'Brand name is required.';
    case 'INVALID_DEAL_AMOUNT':
      return 'Amount must be a valid positive number.';
    case 'DEALS_RESET_DUE_TO_CORRUPTION':
      return 'Data reset due to corruption.';
    default:
      return 'Request failed. Please try again.';
  }
}

export function DealEditorScreen({ navigation, route }: Props) {
  const { deals, saveDealRecord, notice, setNotice } = useAppState();
  const editingDeal = route.params?.dealId
    ? deals.find(deal => deal.id === route.params?.dealId)
    : undefined;

  const [brandName, setBrandName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState<DealCurrency>('USD');
  const [status, setStatus] = useState<DealStatus>('lead');
  const [privateNotes, setPrivateNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editingDeal) {
      setBrandName('');
      setAmountText('');
      setCurrency('USD');
      setStatus('lead');
      setPrivateNotes('');
      return;
    }

    setBrandName(editingDeal.brandName);
    setAmountText(editingDeal.amount === undefined ? '' : String(editingDeal.amount));
    setCurrency(editingDeal.currency ?? 'USD');
    setStatus(editingDeal.status);
    setPrivateNotes(editingDeal.privateNotes ?? '');
  }, [editingDeal]);

  async function handleSave() {
    setIsSaving(true);
    setNotice(null);

    try {
      const amount = amountText.trim();
      await saveDealRecord(
        {
          brandName,
          status,
          amount: amount ? Number(amount) : undefined,
          currency: amount ? currency : undefined,
          privateNotes,
        },
        editingDeal?.id,
      );
      navigation.goBack();
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextInput
        onChangeText={setBrandName}
        placeholder="Brand name"
        placeholderTextColor="#9ca3af"
        style={styles.input}
        value={brandName}
      />
      <Text style={styles.sectionLabel}>Status</Text>
      <View style={styles.optionRow}>
        {DEAL_STATUSES.map(option => (
          <Pressable
            key={option}
            onPress={() => setStatus(option)}
            style={[styles.optionChip, status === option && styles.optionChipSelected]}
          >
            <Text
              style={[
                styles.optionChipText,
                status === option && styles.optionChipTextSelected,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={setAmountText}
        placeholder="Amount (optional)"
        placeholderTextColor="#9ca3af"
        style={styles.input}
        value={amountText}
      />
      <Text style={styles.sectionLabel}>Currency</Text>
      <View style={styles.optionRow}>
        {DEAL_CURRENCIES.map(option => (
          <Pressable
            key={option}
            onPress={() => setCurrency(option)}
            style={[styles.optionChip, currency === option && styles.optionChipSelected]}
          >
            <Text
              style={[
                styles.optionChipText,
                currency === option && styles.optionChipTextSelected,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        multiline
        onChangeText={setPrivateNotes}
        placeholder="Private notes (optional)"
        placeholderTextColor="#9ca3af"
        style={[styles.input, styles.notesInput]}
        textAlignVertical="top"
        value={privateNotes}
      />
      <Pressable
        disabled={isSaving}
        onPress={() => void handleSave()}
        style={[styles.primaryButton, isSaving && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>
          {isSaving ? 'Saving...' : editingDeal ? 'Update Deal' : 'Save Deal'}
        </Text>
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
  sectionLabel: {
    color: '#111827',
    fontWeight: '600',
  },
  helperText: {
    color: '#4b5563',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
  },
  notesInput: {
    minHeight: 140,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionChipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  optionChipText: {
    color: '#111827',
    fontSize: 12,
  },
  optionChipTextSelected: {
    color: '#ffffff',
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
  disabledButton: {
    opacity: 0.6,
  },
});
