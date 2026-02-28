const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(email|note|content|body|token|secret|otp)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export function scrub<T>(value: T): T {
  if (typeof value === 'string') {
    return (EMAIL.test(value) ? REDACTED : value) as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => scrub(item)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrub(child);
    }
    return output as T;
  }

  return value;
}
