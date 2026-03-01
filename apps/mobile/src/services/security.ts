const SESSION_SERVICE = 'com.vaultnotes.session';
const NOTES_KEY_SERVICE = 'com.vaultnotes.notes-key';

export interface StoredSession {
  sessionToken: string;
  userIdHash: string;
}

export interface SecureStringAdapter {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  reset(): Promise<void>;
}

function createJsonSecretStore<T>(
  adapter: SecureStringAdapter,
  isValid: (value: unknown) => value is T,
) {
  return {
    async restore(): Promise<T | null> {
      const raw = await adapter.get();

      if (!raw) {
        return null;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isValid(parsed)) {
          await adapter.reset();
          return null;
        }

        return parsed;
      } catch {
        await adapter.reset();
        return null;
      }
    },

    async save(value: T): Promise<void> {
      await adapter.set(JSON.stringify(value));
    },

    async clear(): Promise<void> {
      await adapter.reset();
    },
  };
}

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredSession>;
  return (
    typeof candidate.sessionToken === 'string' &&
    typeof candidate.userIdHash === 'string'
  );
}

export function createSessionStore(adapter: SecureStringAdapter) {
  return createJsonSecretStore(adapter, isStoredSession);
}

async function createKeychainAdapter(service: string): Promise<SecureStringAdapter> {
  let Keychain: typeof import('react-native-keychain');
  try {
    Keychain = await import('react-native-keychain');
  } catch {
    throw new Error('SECURE_STORAGE_UNAVAILABLE');
  }

  return {
    async get() {
      const credentials = await Keychain.getGenericPassword({ service });
      return credentials ? credentials.password : null;
    },

    async set(value: string) {
      await Keychain.setGenericPassword('vault', value, {
        service,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    },

    async reset() {
      await Keychain.resetGenericPassword({ service });
    },
  };
}

function createEncryptionKeyStore(adapter: SecureStringAdapter) {
  return {
    async restore(): Promise<string | null> {
      const key = await adapter.get();
      return key && key.length > 0 ? key : null;
    },

    async save(key: string): Promise<void> {
      await adapter.set(key);
    },

    async clear(): Promise<void> {
      await adapter.reset();
    },
  };
}

// Protected: session token and notes encryption key stay in Keychain/Keystore only.
// Not protected: rooted devices, OS compromise, malware on an unlocked device.
export async function restoreSession(): Promise<StoredSession | null> {
  const store = createSessionStore(await createKeychainAdapter(SESSION_SERVICE));
  return store.restore();
}

export async function persistSession(session: StoredSession): Promise<void> {
  const store = createSessionStore(await createKeychainAdapter(SESSION_SERVICE));
  await store.save(session);
}

export async function clearSession(): Promise<void> {
  const store = createSessionStore(await createKeychainAdapter(SESSION_SERVICE));
  await store.clear();
}

export async function restoreNotesEncryptionKey(): Promise<string | null> {
  const store = createEncryptionKeyStore(await createKeychainAdapter(NOTES_KEY_SERVICE));
  return store.restore();
}

export async function persistNotesEncryptionKey(key: string): Promise<void> {
  const store = createEncryptionKeyStore(await createKeychainAdapter(NOTES_KEY_SERVICE));
  await store.save(key);
}

export async function clearNotesEncryptionKey(): Promise<void> {
  const store = createEncryptionKeyStore(await createKeychainAdapter(NOTES_KEY_SERVICE));
  await store.clear();
}
