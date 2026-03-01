import { trackEvent } from '@vault/telemetry';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useAppState } from '../app/AppProvider';
import { requestOtp, verifyOtp } from '../services/auth';

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Something went wrong.';
  }

  switch (error.message) {
    case 'INVALID_OTP':
      return 'The OTP is invalid.';
    case 'OTP_EXPIRED':
      return 'The OTP has expired. Request a new one.';
    case 'Network request failed':
      return 'The control-plane service is unavailable.';
    case 'SECURE_STORAGE_UNAVAILABLE':
      return 'Secure storage is unavailable on this device.';
    default:
      return 'Request failed. Please try again.';
  }
}

export function AuthScreen() {
  const { completeSignIn, notice, setNotice } = useAppState();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  async function handleRequestOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setNotice('Enter an email address first.');
      return;
    }

    setIsRequestingOtp(true);
    setNotice(null);

    try {
      await requestOtp(normalizedEmail);
      await trackEvent('auth_otp_requested', {
        channel: 'email_otp',
      });
      setNotice('OTP requested. Check the control-plane console in development.');
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otp.trim();

    if (!normalizedEmail || normalizedOtp.length !== 6) {
      setNotice('Enter a valid email and 6-digit OTP.');
      return;
    }

    setIsVerifyingOtp(true);
    setNotice(null);

    try {
      const session = await verifyOtp(normalizedEmail, normalizedOtp);
      await completeSignIn(session);
      await trackEvent('auth_otp_verified', {
        success: true,
      });
      setOtp('');
    } catch (error) {
      await trackEvent('auth_otp_verified', {
        success: false,
      });
      setNotice(getErrorMessage(error));
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Creator Deal Vault</Text>
      <Text style={styles.statusText}>Status: Logged out</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#9ca3af"
        style={styles.input}
        value={email}
      />
      <Pressable
        disabled={isRequestingOtp}
        onPress={handleRequestOtp}
        style={[styles.primaryButton, isRequestingOtp && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>
          {isRequestingOtp ? 'Requesting...' : 'Request OTP'}
        </Text>
      </Pressable>
      <TextInput
        autoCapitalize="none"
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={setOtp}
        placeholder="OTP"
        placeholderTextColor="#9ca3af"
        style={styles.input}
        value={otp}
      />
      <Pressable
        disabled={isVerifyingOtp}
        onPress={handleVerifyOtp}
        style={[styles.primaryButton, isVerifyingOtp && styles.disabledButton]}
      >
        <Text style={styles.primaryButtonText}>
          {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
        </Text>
      </Pressable>
      {notice ? <Text style={styles.helperText}>{notice}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  statusText: {
    fontSize: 16,
    color: '#1f2937',
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
