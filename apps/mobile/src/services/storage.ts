import { createNoteDraft, type NoteDraft } from '@vault/core';
import {
  clearNotesEncryptionKey,
  persistNotesEncryptionKey,
  restoreNotesEncryptionKey,
} from './security';

const NOTES_STORAGE_ID = 'vault-notes';
const META_STORAGE_ID = 'vault-meta';
const NOTES_KEY = 'notes';
const NOTES_INITIALIZED_KEY = 'notes_initialized';

// Encrypted: note bodies are stored only inside an MMKV instance created with a per-user
// encryption key. The encryption key itself lives in Keychain/Keystore via security.ts.
// Logout guarantee: wipe the encrypted MMKV store and wipe the encryption key together.
// Not protected: rooted devices, OS compromise, or malware with access to an unlocked device.

export interface NoteStorageAdapter {
  getString(key: string): string | undefined;
  set(key: string, value: string | boolean): void;
  getBoolean(key: string): boolean | undefined;
  delete(key: string): void;
  clearAll(): void;
}

interface NotesRepositoryOptions {
  createEncryptedStore: (encryptionKey?: string) => NoteStorageAdapter;
  metaStore: NoteStorageAdapter;
  restoreKey: () => Promise<string | null>;
  persistKey: (key: string) => Promise<void>;
  clearKey: () => Promise<void>;
  generateKey?: () => string;
}

function isNoteDraftArray(value: unknown): value is NoteDraft[] {
  return (
    Array.isArray(value) &&
    value.every(note =>
      Boolean(note) &&
      typeof note === 'object' &&
      typeof (note as NoteDraft).id === 'string' &&
      typeof (note as NoteDraft).plaintext === 'string' &&
      typeof (note as NoteDraft).updatedAt === 'string',
    )
  );
}

function generateEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createNotesRepository(options: NotesRepositoryOptions) {
  async function ensureReady(): Promise<{
    encryptionKey: string;
    notesStore: NoteStorageAdapter;
  }> {
    const hadEncryptedNotes = options.metaStore.getBoolean(NOTES_INITIALIZED_KEY) === true;
    let encryptionKey = await options.restoreKey();

    if (!encryptionKey) {
      if (hadEncryptedNotes) {
        // If the encrypted notes key is gone, the only safe move is to wipe the data file.
        options.createEncryptedStore(undefined).clearAll();
        options.metaStore.delete(NOTES_INITIALIZED_KEY);
      }

      encryptionKey = (options.generateKey ?? generateEncryptionKey)();
      await options.persistKey(encryptionKey);
    }

    return {
      encryptionKey,
      notesStore: options.createEncryptedStore(encryptionKey),
    };
  }

  async function loadNotes(): Promise<NoteDraft[]> {
    const { notesStore } = await ensureReady();
    const raw = notesStore.getString(NOTES_KEY);

    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isNoteDraftArray(parsed)) {
        throw new Error('INVALID_NOTES_PAYLOAD');
      }

      return parsed;
    } catch {
      // Corrupt or unreadable note payloads are wiped rather than crashing the app.
      notesStore.clearAll();
      options.metaStore.delete(NOTES_INITIALIZED_KEY);
      return [];
    }
  }

  async function persistNotes(notes: NoteDraft[]): Promise<void> {
    const { notesStore } = await ensureReady();
    notesStore.set(NOTES_KEY, JSON.stringify(notes));
    options.metaStore.set(NOTES_INITIALIZED_KEY, true);
  }

  return {
    async listNotes(): Promise<NoteDraft[]> {
      return loadNotes();
    },

    async addNote(plaintext: string): Promise<NoteDraft> {
      const draft = createNoteDraft(plaintext);
      const notes = await loadNotes();
      const nextNotes = [draft, ...notes];
      await persistNotes(nextNotes);
      return draft;
    },

    async deleteNote(id: string): Promise<NoteDraft[]> {
      const notes = await loadNotes();
      const nextNotes = notes.filter(note => note.id !== id);
      await persistNotes(nextNotes);
      return nextNotes;
    },

    async wipeAll(): Promise<void> {
      const existingKey = await options.restoreKey();
      options.createEncryptedStore(existingKey ?? undefined).clearAll();
      options.metaStore.delete(NOTES_INITIALIZED_KEY);
      await options.clearKey();
    },
  };
}

async function createMmkvAdapters() {
  const { MMKV } = await import('react-native-mmkv');

  const metaStore = new MMKV({
    id: META_STORAGE_ID,
  }) as NoteStorageAdapter;

  return {
    metaStore,
    createEncryptedStore(encryptionKey?: string) {
      return new MMKV({
        id: NOTES_STORAGE_ID,
        ...(encryptionKey && { encryptionKey }),
      }) as NoteStorageAdapter;
    },
  };
}

async function getDeviceNotesRepository() {
  const adapters = await createMmkvAdapters();

  return createNotesRepository({
    createEncryptedStore: adapters.createEncryptedStore,
    metaStore: adapters.metaStore,
    restoreKey: restoreNotesEncryptionKey,
    persistKey: persistNotesEncryptionKey,
    clearKey: clearNotesEncryptionKey,
  });
}

export async function listNotes(): Promise<NoteDraft[]> {
  return (await getDeviceNotesRepository()).listNotes();
}

export async function addNote(plaintext: string): Promise<NoteDraft> {
  return (await getDeviceNotesRepository()).addNote(plaintext);
}

export async function deleteNote(id: string): Promise<NoteDraft[]> {
  return (await getDeviceNotesRepository()).deleteNote(id);
}

// Logout guarantee: encrypted notes and the encryption key are wiped together.
export async function wipeNotesVault(): Promise<void> {
  await (await getDeviceNotesRepository()).wipeAll();
}
