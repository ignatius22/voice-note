import { createHash, randomBytes, randomInt } from 'node:crypto';

const OTP_TTL_MS = 5 * 60 * 1000;
const FALLBACK_DEV_SALT = 'unsafe-dev-salt-change-me';

interface OtpRecord {
  code: string;
  expiresAt: number;
}

interface AuthServiceOptions {
  now?: () => number;
  randomOtp?: () => string;
  randomToken?: () => string;
  salt?: string;
}

export type VerifyOtpResult =
  | {
      ok: true;
      sessionToken: string;
      userIdHash: string;
    }
  | {
      ok: false;
      reason: 'INVALID_OTP' | 'OTP_EXPIRED';
    };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveDevSalt(explicitSalt?: string): string {
  return explicitSalt ?? process.env.VAULT_DEV_OTP_SALT ?? FALLBACK_DEV_SALT;
}

export function isUsingFallbackDevSalt(salt: string): boolean {
  return salt === FALLBACK_DEV_SALT;
}

export function hashUserId(email: string, salt: string): string {
  return createHash('sha256')
    .update(`${normalizeEmail(email)}:${salt}`)
    .digest('hex');
}

export function createAuthService(options: AuthServiceOptions = {}) {
  const otpStore = new Map<string, OtpRecord>();
  const now = options.now ?? (() => Date.now());
  const salt = resolveDevSalt(options.salt);
  const randomOtp =
    options.randomOtp ?? (() => randomInt(0, 1000000).toString().padStart(6, '0'));
  const randomToken =
    options.randomToken ?? (() => randomBytes(24).toString('hex'));

  function requestOtp(email: string): { code: string; expiresAt: number } {
    const code = randomOtp();
    const expiresAt = now() + OTP_TTL_MS;

    otpStore.set(normalizeEmail(email), { code, expiresAt });

    return { code, expiresAt };
  }

  function verifyOtp(email: string, otp: string): VerifyOtpResult {
    const normalizedEmail = normalizeEmail(email);
    const stored = otpStore.get(normalizedEmail);

    if (!stored) {
      return { ok: false, reason: 'INVALID_OTP' };
    }

    if (stored.expiresAt < now()) {
      otpStore.delete(normalizedEmail);
      return { ok: false, reason: 'OTP_EXPIRED' };
    }

    if (stored.code !== otp.trim()) {
      return { ok: false, reason: 'INVALID_OTP' };
    }

    otpStore.delete(normalizedEmail);

    return {
      ok: true,
      sessionToken: randomToken(),
      userIdHash: hashUserId(normalizedEmail, salt),
    };
  }

  return {
    requestOtp,
    verifyOtp,
    salt,
  };
}
