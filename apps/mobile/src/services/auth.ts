import { Platform } from 'react-native';

export interface AuthSession {
  sessionToken: string;
  userIdHash: string;
}

interface ErrorResponse {
  ok: false;
  code?: 'INVALID_OTP' | 'OTP_EXPIRED';
}

function getControlPlaneBaseUrl(): string {
  return Platform.select({
    android: 'http://10.0.2.2:4000',
    ios: 'http://127.0.0.1:4000',
    default: 'http://127.0.0.1:4000',
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getControlPlaneBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('INVALID_RESPONSE');
  }

  if (!response.ok) {
    const errorPayload = payload as ErrorResponse;
    throw new Error(errorPayload.code ?? 'REQUEST_FAILED');
  }

  return payload as T;
}

export async function requestOtp(email: string): Promise<void> {
  await postJson<{ ok: true }>('/auth/request-otp', {
    email: normalizeEmail(email),
  });
}

export async function verifyOtp(email: string, otp: string): Promise<AuthSession> {
  const payload = await postJson<{
    ok: true;
    sessionToken: string;
    userIdHash: string;
  }>('/auth/verify-otp', {
    email: normalizeEmail(email),
    otp: otp.trim(),
  });

  return {
    sessionToken: payload.sessionToken,
    userIdHash: payload.userIdHash,
  };
}
