import { eventContracts, type EventName, type EventPayload } from './contracts';
import { scrub } from './scrub';

const FORBIDDEN_TELEMETRY_KEYS = new Set([
  'brandname',
  'campaignname',
  'contacthandle',
  'privatenotes',
  'email',
  'otp',
  'sessiontoken',
]);

function isDevMode(): boolean {
  const runtime = globalThis as typeof globalThis & {
    __DEV__?: boolean;
    process?: { env?: { NODE_ENV?: string } };
  };

  if (typeof runtime.__DEV__ === 'boolean') {
    return runtime.__DEV__;
  }

  if (runtime.process?.env?.NODE_ENV) {
    return runtime.process.env.NODE_ENV !== 'production';
  }

  return false;
}

function assertNoForbiddenKeys(value: unknown): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenKeys);
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_TELEMETRY_KEYS.has(key.toLowerCase())) {
      throw new Error(`FORBIDDEN_TELEMETRY_KEY:${key}`);
    }

    assertNoForbiddenKeys(child);
  }
}

export async function trackEvent<T extends EventName>(
  name: T,
  payload: EventPayload<T>,
): Promise<{ name: T; payload: Record<string, unknown> }> {
  if (isDevMode()) {
    assertNoForbiddenKeys(payload);
  }

  const parsed = eventContracts[name].parse(payload);
  return {
    name,
    payload: scrub(parsed) as Record<string, unknown>,
  };
}
