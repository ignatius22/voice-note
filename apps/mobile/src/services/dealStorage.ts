import type { Deal } from '@vault/core';
import { isDealArray } from '@vault/core';
import {
  clearDealsEncryptionKey,
  persistDealsEncryptionKey,
  restoreDealsEncryptionKey,
} from './security';

const DEALS_STORAGE_ID = 'creator-deal-vault';
const DEALS_META_STORAGE_ID = 'creator-deal-vault-meta';
const DEALS_KEY = 'deals';
const DEALS_INITIALIZED_KEY = 'deals_initialized';

// Encrypted: all deal payloads are stored only in an MMKV instance opened with a
// per-device 256-bit key. That key lives in Keychain/Keystore via security.ts.
// Logout guarantee: wipe the encrypted MMKV blob and the encryption key together.
// Not protected: rooted devices, OS compromise, or malware on an unlocked device.

export interface DealStorageAdapter {
  getString(key: string): string | undefined;
  set(key: string, value: string | boolean): void;
  getBoolean(key: string): boolean | undefined;
  delete(key: string): void;
  clearAll(): void;
}

interface DealStorageOptions {
  createEncryptedStore: (encryptionKey?: string) => DealStorageAdapter;
  metaStore: DealStorageAdapter;
  restoreKey: () => Promise<string | null>;
  persistKey: (key: string) => Promise<void>;
  clearKey: () => Promise<void>;
  generateKey?: () => string;
}

function generateEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createDealStorage(options: DealStorageOptions) {
  async function ensureReady(): Promise<{ dealsStore: DealStorageAdapter }> {
    const hadEncryptedDeals = options.metaStore.getBoolean(DEALS_INITIALIZED_KEY) === true;
    let encryptionKey = await options.restoreKey();

    if (!encryptionKey) {
      if (hadEncryptedDeals) {
        options.createEncryptedStore(undefined).clearAll();
        options.metaStore.delete(DEALS_INITIALIZED_KEY);
        throw new Error('DEALS_RESET_DUE_TO_CORRUPTION');
      }

      encryptionKey = (options.generateKey ?? generateEncryptionKey)();
      await options.persistKey(encryptionKey);
    }

    return {
      dealsStore: options.createEncryptedStore(encryptionKey),
    };
  }

  return {
    async loadDeals(): Promise<Deal[]> {
      const { dealsStore } = await ensureReady();
      const raw = dealsStore.getString(DEALS_KEY);

      if (!raw) {
        return [];
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isDealArray(parsed)) {
          throw new Error('INVALID_DEALS_PAYLOAD');
        }

        return parsed;
      } catch {
        dealsStore.clearAll();
        options.metaStore.delete(DEALS_INITIALIZED_KEY);
        throw new Error('DEALS_RESET_DUE_TO_CORRUPTION');
      }
    },

    async saveDeals(deals: Deal[]): Promise<void> {
      if (!isDealArray(deals)) {
        throw new Error('INVALID_DEALS_PAYLOAD');
      }

      const { dealsStore } = await ensureReady();
      dealsStore.set(DEALS_KEY, JSON.stringify(deals));
      options.metaStore.set(DEALS_INITIALIZED_KEY, true);
    },

    async wipeDeals(): Promise<void> {
      const existingKey = await options.restoreKey();
      options.createEncryptedStore(existingKey ?? undefined).clearAll();
      options.metaStore.delete(DEALS_INITIALIZED_KEY);
      await options.clearKey();
    },
  };
}

async function createMmkvAdapters() {
  const { MMKV } = await import('react-native-mmkv');

  const metaStore = new MMKV({
    id: DEALS_META_STORAGE_ID,
  }) as DealStorageAdapter;

  return {
    metaStore,
    createEncryptedStore(encryptionKey?: string) {
      return new MMKV({
        id: DEALS_STORAGE_ID,
        ...(encryptionKey && { encryptionKey }),
      }) as DealStorageAdapter;
    },
  };
}

async function getDeviceDealStorage() {
  const adapters = await createMmkvAdapters();

  return createDealStorage({
    createEncryptedStore: adapters.createEncryptedStore,
    metaStore: adapters.metaStore,
    restoreKey: restoreDealsEncryptionKey,
    persistKey: persistDealsEncryptionKey,
    clearKey: clearDealsEncryptionKey,
  });
}

export async function loadDeals(): Promise<Deal[]> {
  return (await getDeviceDealStorage()).loadDeals();
}

export async function saveDeals(deals: Deal[]): Promise<void> {
  await (await getDeviceDealStorage()).saveDeals(deals);
}

export async function wipeDeals(): Promise<void> {
  await (await getDeviceDealStorage()).wipeDeals();
}
