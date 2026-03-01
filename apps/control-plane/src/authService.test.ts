import { describe, expect, it } from 'vitest';
import {
  createAuthService,
  hashUserId,
  normalizeEmail,
} from './authService';

describe('authService', () => {
  it('normalizes email before hashing', () => {
    const left = hashUserId(' User@Example.com ', 'salt');
    const right = hashUserId('user@example.com', 'salt');

    expect(left).toBe(right);
  });

  it('issues and verifies an otp', () => {
    const authService = createAuthService({
      salt: 'test-salt',
      randomOtp: () => '123456',
      randomToken: () => 'session-token',
    });

    authService.requestOtp('user@example.com');
    const result = authService.verifyOtp('USER@example.com', '123456');

    expect(result).toEqual({
      ok: true,
      sessionToken: 'session-token',
      userIdHash: hashUserId(normalizeEmail('user@example.com'), 'test-salt'),
    });
  });

  it('rejects an invalid otp', () => {
    const authService = createAuthService({
      randomOtp: () => '123456',
    });

    authService.requestOtp('user@example.com');
    const result = authService.verifyOtp('user@example.com', '000000');

    expect(result).toEqual({
      ok: false,
      reason: 'INVALID_OTP',
    });
  });

  it('rejects an expired otp', () => {
    let nowValue = 0;
    const authService = createAuthService({
      now: () => nowValue,
      randomOtp: () => '123456',
    });

    authService.requestOtp('user@example.com');
    nowValue = 6 * 60 * 1000;

    const result = authService.verifyOtp('user@example.com', '123456');

    expect(result).toEqual({
      ok: false,
      reason: 'OTP_EXPIRED',
    });
  });
});
