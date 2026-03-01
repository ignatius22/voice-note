import { describe, expect, it } from 'vitest';
import { createDealStorage, type DealStorageAdapter } from './dealStorage';

function createMemoryStore(
  initial: Record<string, string | boolean> = {},
): DealStorageAdapter {
  const state = new Map<string, string | boolean>(Object.entries(initial));

  return {
    getString(key: string) {
      const value = state.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    set(key: string, value: string | boolean) {
      state.set(key, value);
    },
    getBoolean(key: string) {
      const value = state.get(key);
      return typeof value === 'boolean' ? value : undefined;
    },
    delete(key: string) {
      state.delete(key);
    },
    clearAll() {
      state.clear();
    },
  };
}

describe('createDealStorage', () => {
  it('creates an encryption key on first save', async () => {
    let persistedKey: string | null = null;
    const encryptedStore = createMemoryStore();
    const metaStore = createMemoryStore();

    const storage = createDealStorage({
      createEncryptedStore: () => encryptedStore,
      metaStore,
      restoreKey: async () => persistedKey,
      persistKey: async key => {
        persistedKey = key;
      },
      clearKey: async () => {
        persistedKey = null;
      },
      generateKey: () => 'generated-deals-key',
    });

    await storage.saveDeals([
      {
        id: 'deal_1',
        brandName: 'Acme',
        status: 'lead',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ]);

    expect(persistedKey).toBe('generated-deals-key');
    expect(encryptedStore.getString('deals')).toContain('Acme');
  });

  it('wipes garbage payloads and reports safe corruption recovery', async () => {
    const encryptedStore = createMemoryStore({
      deals: 'garbage',
    });
    const metaStore = createMemoryStore({
      deals_initialized: true,
    });

    const storage = createDealStorage({
      createEncryptedStore: () => encryptedStore,
      metaStore,
      restoreKey: async () => 'deals-key',
      persistKey: async () => {},
      clearKey: async () => {},
      generateKey: () => 'deals-key',
    });

    await expect(storage.loadDeals()).rejects.toThrowError('DEALS_RESET_DUE_TO_CORRUPTION');
    expect(encryptedStore.getString('deals')).toBeUndefined();
    expect(metaStore.getBoolean('deals_initialized')).toBeUndefined();
  });

  it('wipes orphaned encrypted deals when the key is missing', async () => {
    let persistedKey: string | null = null;
    const encryptedStore = createMemoryStore({
      deals: 'encrypted-data',
    });
    const metaStore = createMemoryStore({
      deals_initialized: true,
    });

    const storage = createDealStorage({
      createEncryptedStore: () => encryptedStore,
      metaStore,
      restoreKey: async () => persistedKey,
      persistKey: async key => {
        persistedKey = key;
      },
      clearKey: async () => {
        persistedKey = null;
      },
      generateKey: () => 'replacement-key',
    });

    await expect(storage.loadDeals()).rejects.toThrowError('DEALS_RESET_DUE_TO_CORRUPTION');
    expect(encryptedStore.getString('deals')).toBeUndefined();
    expect(metaStore.getBoolean('deals_initialized')).toBeUndefined();
  });
});
