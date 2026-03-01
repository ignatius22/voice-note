# File-by-File Reference

This document is the "slow read" companion to [`docs/code-walkthrough.md`](./code-walkthrough.md).

The goal here is simpler:

- explain the important mobile service files
- explain each export
- explain why the code is shaped this way

The current focus is:

1. [`apps/mobile/src/services/auth.ts`](../apps/mobile/src/services/auth.ts)
2. [`apps/mobile/src/services/security.ts`](../apps/mobile/src/services/security.ts)
3. [`apps/mobile/src/services/storage.ts`](../apps/mobile/src/services/storage.ts)

## `apps/mobile/src/services/auth.ts`

This file is the network client for authentication.

It should stay small.

Its job is not to manage UI state or secure storage. Its only job is:

- talk to the backend
- normalize request data
- return typed results

### `AuthSession`

```ts
export interface AuthSession {
  sessionToken: string;
  userIdHash: string;
}
```

This is the shape the app cares about after login.

There are only 2 fields:

- `sessionToken`
- `userIdHash`

That is intentional. The app does not need the raw email after auth succeeds.

### `ErrorResponse`

```ts
interface ErrorResponse {
  ok: false;
  code?: 'INVALID_OTP' | 'OTP_EXPIRED';
}
```

This matches the backend error shape for OTP verification.

The important idea is:

- backend returns structured error codes
- mobile turns them into user-friendly messages

That is better than parsing random strings.

### `getControlPlaneBaseUrl()`

```ts
function getControlPlaneBaseUrl(): string
```

This exists because localhost is not the same on every runtime.

Why:

- Android emulator cannot use `127.0.0.1` for the host machine
- it must use `10.0.2.2`
- iOS simulator can use `127.0.0.1`

So this function hides that platform-specific detail from the rest of the auth code.

### `normalizeEmail()`

```ts
function normalizeEmail(email: string): string
```

This trims and lowercases the email before sending it to the backend.

Why this matters:

- `USER@example.com` and `user@example.com` should be treated as the same user
- consistent normalization prevents hard-to-debug OTP mismatches

### `postJson<T>()`

```ts
async function postJson<T>(path: string, body: unknown): Promise<T>
```

This is the shared helper for POST requests.

It does 4 things:

1. sends JSON
2. parses JSON
3. throws `INVALID_RESPONSE` if the response is not valid JSON
4. throws backend error codes like `INVALID_OTP` or `OTP_EXPIRED`

This is useful because `requestOtp()` and `verifyOtp()` can stay very small.

### `requestOtp()`

```ts
export async function requestOtp(email: string): Promise<void>
```

This calls:

- `POST /auth/request-otp`

It sends only:

```ts
{ email: normalizeEmail(email) }
```

This function does not return the OTP. That is by design.

In development, the backend prints the OTP to its own console. In production, that would eventually become email delivery.

### `verifyOtp()`

```ts
export async function verifyOtp(email: string, otp: string): Promise<AuthSession>
```

This calls:

- `POST /auth/verify-otp`

It sends:

```ts
{
  email: normalizeEmail(email),
  otp: otp.trim(),
}
```

If successful, it returns:

- `sessionToken`
- `userIdHash`

This return value is what later gets stored securely in Keychain.

## `apps/mobile/src/services/security.ts`

This file is the boundary for secrets.

Anything that is sensitive and must survive app restarts should go here first.

Right now it manages:

- auth session
- notes encryption key

### `SESSION_SERVICE` and `NOTES_KEY_SERVICE`

```ts
const SESSION_SERVICE = 'com.vaultnotes.session';
const NOTES_KEY_SERVICE = 'com.vaultnotes.notes-key';
```

These are Keychain service names.

Think of them as namespaces inside secure storage.

Why separate them:

- session and notes key are different secrets
- they may need different lifecycle handling later
- separation makes debugging and wipe logic cleaner

### `StoredSession`

```ts
export interface StoredSession {
  sessionToken: string;
  userIdHash: string;
}
```

This matches the secure data written for a logged-in user.

Important detail:

- the email is not stored here

### `SecureStringAdapter`

```ts
export interface SecureStringAdapter {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  reset(): Promise<void>;
}
```

This is a useful abstraction.

It means the rest of the file does not need to care whether secrets are backed by:

- Keychain
- a test fake
- another secure store later

That is why the tests can mock secure storage cleanly.

### `createJsonSecretStore()`

```ts
function createJsonSecretStore<T>(
  adapter: SecureStringAdapter,
  isValid: (value: unknown) => value is T,
)
```

This is one of the better patterns in the codebase.

It wraps a raw string adapter and turns it into a typed secret store.

It provides:

- `restore()`
- `save()`
- `clear()`

The most important part is `restore()`.

It does this:

1. read raw string
2. if empty, return `null`
3. parse JSON
4. validate the parsed shape
5. if parse or validation fails, wipe the secret and return `null`

That prevents bad secure-storage state from breaking the app on startup.

### `isStoredSession()`

```ts
function isStoredSession(value: unknown): value is StoredSession
```

This is the runtime validator for session restore.

TypeScript types disappear at runtime, so this function checks:

- `sessionToken` is a string
- `userIdHash` is a string

Without that check, any random JSON in secure storage could be treated as a real session.

### `createSessionStore()`

```ts
export function createSessionStore(adapter: SecureStringAdapter)
```

This is just a typed wrapper around `createJsonSecretStore()` for sessions.

It is exported mainly because it is easy to test in isolation.

### `createKeychainAdapter()`

```ts
async function createKeychainAdapter(service: string): Promise<SecureStringAdapter>
```

This is the React Native specific part.

It lazily imports `react-native-keychain` and returns a generic adapter with:

- `get`
- `set`
- `reset`

Important details:

- it throws `SECURE_STORAGE_UNAVAILABLE` if the native module cannot load
- it uses `WHEN_UNLOCKED_THIS_DEVICE_ONLY`

That accessibility mode means:

- secret is available only while the device is unlocked
- it is tied to that device

That is a good default for session tokens and encryption keys.

### `createEncryptionKeyStore()`

```ts
function createEncryptionKeyStore(adapter: SecureStringAdapter)
```

This is like the session store, but simpler.

The notes encryption key is just a raw string, not a JSON object, so it only needs:

- restore non-empty string
- save string
- clear string

### `restoreSession()`, `persistSession()`, `clearSession()`

These are the public auth-session APIs used by the screen.

The important design choice is:

- UI never touches Keychain directly

The UI just says:

- restore session
- persist session
- clear session

That keeps the UI simpler and keeps secret-handling logic in one place.

### `restoreNotesEncryptionKey()`, `persistNotesEncryptionKey()`, `clearNotesEncryptionKey()`

These are the same idea, but for the notes key.

They exist because note encryption key lifecycle is different from auth session lifecycle, even if both currently use Keychain under the hood.

## `apps/mobile/src/services/storage.ts`

This file is the encrypted notes layer.

If `security.ts` is the secret boundary, `storage.ts` is the vault boundary.

It owns:

- generating an encryption key
- creating encrypted MMKV instances
- loading notes
- saving notes
- deleting notes
- wiping notes on logout
- recovering from corrupt state

### Constants

```ts
const NOTES_STORAGE_ID = 'vault-notes';
const META_STORAGE_ID = 'vault-meta';
const NOTES_KEY = 'notes';
const NOTES_INITIALIZED_KEY = 'notes_initialized';
```

These give stable names to the MMKV storage buckets and keys.

There are 2 different storage areas:

1. encrypted notes store
2. meta store

The meta store exists only to help detect corruption scenarios.

### `NoteStorageAdapter`

```ts
export interface NoteStorageAdapter {
  getString(key: string): string | undefined;
  set(key: string, value: string | boolean): void;
  getBoolean(key: string): boolean | undefined;
  delete(key: string): void;
  clearAll(): void;
}
```

This is the storage abstraction used by the repository.

Why it matters:

- the repository logic can be tested without real MMKV
- the code depends on behavior, not directly on the native class

This is the same design idea as `SecureStringAdapter` in `security.ts`.

### `NotesRepositoryOptions`

This interface defines everything the repository needs injected:

- how to create the encrypted store
- where metadata lives
- how to restore/save/clear the encryption key
- optionally how to generate a key

This makes the core repository logic testable.

### `isNoteDraftArray()`

```ts
function isNoteDraftArray(value: unknown): value is NoteDraft[]
```

This validates the parsed JSON from storage.

Each note must have:

- `id`
- `plaintext`
- `updatedAt`

If the stored JSON does not match that, the app treats it as corruption.

### `generateEncryptionKey()`

```ts
function generateEncryptionKey(): string
```

This generates a 256-bit random key:

- 32 random bytes
- converted to hex

This key is not hardcoded and is not committed to the repo.

It is generated on device and then stored securely through `security.ts`.

### `createNotesRepository()`

```ts
export function createNotesRepository(options: NotesRepositoryOptions)
```

This is the main abstraction in the file.

It returns a small repository API:

- `listNotes()`
- `addNote()`
- `deleteNote()`
- `wipeAll()`

This is a good design because the screen does not need to know:

- how MMKV is configured
- how keys are restored
- how corruption is handled

### `ensureReady()`

This is the most important internal function in the repository.

It answers:

- "can I safely read or write encrypted notes right now?"

It does this:

1. check if metadata says notes were initialized
2. try to restore the notes encryption key from Keychain
3. if key is missing but notes existed, wipe encrypted data
4. if key is missing, generate a fresh key and persist it
5. create and return the encrypted MMKV store

This function is why the app can recover from:

- key loss
- first run
- partial secure-storage corruption

### `loadNotes()`

This handles reading notes safely.

Flow:

1. call `ensureReady()`
2. read raw JSON string from MMKV
3. if empty, return `[]`
4. parse JSON
5. validate note array shape
6. if parsing or validation fails, wipe notes and return `[]`

The key security behavior here is:

- corrupt state is wiped
- app does not crash

### `persistNotes()`

This is the shared write helper.

It:

1. ensures encryption is ready
2. writes the serialized notes array
3. marks `notes_initialized = true`

That metadata flag is what later lets the app detect:

- "we used to have encrypted notes here"

### `listNotes()`

This just returns the result of `loadNotes()`.

It is intentionally small because the complexity already lives in the safe read path.

### `addNote()`

Flow:

1. validate and create a note via `createNoteDraft()` from `@vault/core`
2. load existing notes
3. prepend the new note
4. persist the updated array

This keeps note-domain validation out of the UI.

### `deleteNote()`

Flow:

1. load existing notes
2. filter out one id
3. persist the updated array
4. return the new array

Nothing fancy yet. It is purely local CRUD.

### `wipeAll()`

This is the vault reset function.

It:

1. restores the current encryption key if one exists
2. clears the encrypted notes store
3. clears the metadata flag
4. clears the encryption key from Keychain

This is the core of the logout wipe guarantee.

### `createMmkvAdapters()`

```ts
async function createMmkvAdapters()
```

This is the native integration layer.

It dynamically imports `react-native-mmkv` and creates:

- a plain meta store
- a factory for encrypted notes stores

Why separate it from the repository:

- the repository stays testable
- native MMKV is isolated to one small section

### `getDeviceNotesRepository()`

This is the composition point.

It wires together:

- MMKV adapters
- key restore/save/clear functions from `security.ts`

So this is where the two systems meet:

- secure secret storage
- encrypted local note storage

### Top-level exports

The exported functions:

- `listNotes()`
- `addNote()`
- `deleteNote()`
- `wipeNotesVault()`

are just convenience wrappers around the device repository.

That keeps `AppScreen.tsx` simple:

- it never has to instantiate the repository itself

## How These 3 Files Work Together

The relationship is:

- `auth.ts` gets authenticated session data from the backend
- `security.ts` persists sensitive secrets safely
- `storage.ts` uses a separate secure key to encrypt local notes

In other words:

1. backend says who you are
2. Keychain remembers your session and your notes key
3. MMKV stores your notes in encrypted form

## If You Want To Read The Code Without Getting Lost

Use this checklist:

1. In `auth.ts`, follow only:
   - `requestOtp()`
   - `verifyOtp()`

2. In `security.ts`, focus on:
   - `createJsonSecretStore()`
   - `createKeychainAdapter()`
   - `restoreSession()`
   - `persistSession()`

3. In `storage.ts`, focus on:
   - `generateEncryptionKey()`
   - `ensureReady()`
   - `loadNotes()`
   - `wipeAll()`

Those are the real "shape of the system" functions.

## Short Summary

The service layer is not random glue.

Each file has a clean responsibility:

- `auth.ts`: talk to backend
- `security.ts`: protect secrets
- `storage.ts`: protect notes data

That is the main lens to keep in your head while reading the code.
