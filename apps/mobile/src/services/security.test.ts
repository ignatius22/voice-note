import { describe, expect, it, vi } from 'vitest';
import { createSessionStore, type SecureStringAdapter } from './security';

function createFakeAdapter(initialValue: string | null = null): SecureStringAdapter {
  let value = initialValue;

  return {
    get: vi.fn(async () => value),
    set: vi.fn(async nextValue => {
      value = nextValue;
    }),
    reset: vi.fn(async () => {
      value = null;
    }),
  };
}

describe('createSessionStore', () => {
  it('restores a valid stored session', async () => {
    const store = createSessionStore(
      createFakeAdapter(
        JSON.stringify({
          sessionToken: 'token',
          userIdHash: 'hash',
        }),
      ),
    );

    await expect(store.restore()).resolves.toEqual({
      sessionToken: 'token',
      userIdHash: 'hash',
    });
  });

  it('wipes corrupt stored sessions', async () => {
    const adapter = createFakeAdapter('not-json');
    const store = createSessionStore(adapter);

    await expect(store.restore()).resolves.toBeNull();
    await expect(adapter.get()).resolves.toBeNull();
  });

  it('clears the stored session on logout', async () => {
    const adapter = createFakeAdapter();
    const store = createSessionStore(adapter);

    await store.save({
      sessionToken: 'token',
      userIdHash: 'hash',
    });
    await store.clear();

    await expect(adapter.get()).resolves.toBeNull();
  });
});
