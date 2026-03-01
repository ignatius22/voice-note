import { describe, expect, it } from 'vitest';
import { createNotesRepository, type NoteStorageAdapter } from './storage';

function createMemoryStore(initial: Record<string, string | boolean> = {}): NoteStorageAdapter {
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

describe('createNotesRepository', () => {
  it('creates an encryption key on first note write', async () => {
    let persistedKey: string | null = null;
    const encryptedStore = createMemoryStore();
    const metaStore = createMemoryStore();

    const repository = createNotesRepository({
      createEncryptedStore: () => encryptedStore,
      metaStore,
      restoreKey: async () => persistedKey,
      persistKey: async key => {
        persistedKey = key;
      },
      clearKey: async () => {
        persistedKey = null;
      },
      generateKey: () => 'generated-key',
    });

    await repository.addNote('hello vault');

    expect(persistedKey).toBe('generated-key');
    expect(encryptedStore.getString('notes')).toContain('hello vault');
  });

  it('wipes corrupt note payloads safely', async () => {
    const encryptedStore = createMemoryStore({
      notes: 'garbage',
    });
    const metaStore = createMemoryStore({
      notes_initialized: true,
    });

    const repository = createNotesRepository({
      createEncryptedStore: () => encryptedStore,
      metaStore,
      restoreKey: async () => 'key',
      persistKey: async () => {},
      clearKey: async () => {},
      generateKey: () => 'key',
    });

    await expect(repository.listNotes()).resolves.toEqual([]);
    expect(encryptedStore.getString('notes')).toBeUndefined();
    expect(metaStore.getBoolean('notes_initialized')).toBeUndefined();
  });

  it('wipes orphaned encrypted notes when the key is missing', async () => {
    let persistedKey: string | null = null;
    const encryptedStore = createMemoryStore({
      notes: 'encrypted-data',
    });
    const metaStore = createMemoryStore({
      notes_initialized: true,
    });

    const repository = createNotesRepository({
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

    await expect(repository.listNotes()).resolves.toEqual([]);
    expect(encryptedStore.getString('notes')).toBeUndefined();
    expect(persistedKey).toBe('replacement-key');
  });
});
