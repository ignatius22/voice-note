# Code Walkthrough

This file explains the current app in plain terms so the code feels familiar before you read it.

The current product is still small:

- OTP login against the control-plane
- Secure session persistence in Keychain/Keystore
- Encrypted notes stored locally on the device
- Logout wipes both auth state and notes state

## Read This In Order

If you want to understand the code quickly, read these files in this order:

1. [`apps/mobile/src/screens/AppScreen.tsx`](../apps/mobile/src/screens/AppScreen.tsx)
2. [`apps/mobile/src/services/auth.ts`](../apps/mobile/src/services/auth.ts)
3. [`apps/mobile/src/services/security.ts`](../apps/mobile/src/services/security.ts)
4. [`apps/mobile/src/services/storage.ts`](../apps/mobile/src/services/storage.ts)
5. [`apps/control-plane/src/server.ts`](../apps/control-plane/src/server.ts)
6. [`apps/control-plane/src/authService.ts`](../apps/control-plane/src/authService.ts)
7. [`packages/core/src/note.ts`](../packages/core/src/note.ts)
8. [`packages/telemetry/src/contracts.ts`](../packages/telemetry/src/contracts.ts)

That order follows the real runtime flow.

## Mental Model

Think of the app as 4 layers:

1. UI layer
   - `AppScreen.tsx`
   - handles user input and rendering

2. Mobile service layer
   - `auth.ts`
   - `security.ts`
   - `storage.ts`
   - handles network, secure secrets, and encrypted local data

3. Control-plane layer
   - `server.ts`
   - `authService.ts`
   - handles OTP issuing and session token generation

4. Shared pure-TS layer
   - `@vault/core`
   - `@vault/telemetry`
   - reusable business logic and contracts

The important architectural rule is:

- `packages/*` stay pure TypeScript
- React Native-specific code lives only in `apps/mobile`

## Runtime Flow

## 1. App Launch

Entry starts in the mobile app, but the important logic begins in [`AppScreen.tsx`](../apps/mobile/src/screens/AppScreen.tsx).

The key state is:

```ts
const [session, setSession] = useState<AuthSession | null>(null);
```

That single state controls whether the app is:

- logged out and showing auth UI
- logged in and showing notes UI

On first render, the app runs `restoreSession()` inside `useEffect`.

That means:

1. ask secure storage for a previously saved session
2. if found, restore logged-in state
3. if not found, stay logged out

So the app is not using a backend session refresh yet. Right now, startup auth state is entirely based on what is stored securely on device.

## 2. Request OTP

When the user enters an email and taps `Request OTP`, `AppScreen.tsx` calls:

```ts
await requestOtp(normalizedEmail);
```

That function lives in [`auth.ts`](../apps/mobile/src/services/auth.ts).

`auth.ts` is intentionally small. Its job is:

- normalize the email
- choose the correct local backend URL for Android vs iOS
- send JSON to the control-plane
- turn backend failures into small error codes

Important detail:

- Android emulator uses `http://10.0.2.2:4000`
- iOS simulator uses `http://127.0.0.1:4000`

This is why the same local backend can work on both platforms.

The request goes to:

- `POST /auth/request-otp`

Inside [`server.ts`](../apps/control-plane/src/server.ts), that route delegates to [`authService.ts`](../apps/control-plane/src/authService.ts).

`authService.requestOtp(email)` does 3 things:

1. normalizes the email
2. generates a random 6-digit OTP
3. stores that OTP in memory with an expiry time

This is intentionally simple:

- no database
- no real email delivery yet
- dev-only flow

In development, the backend logs the OTP code to the console so you can use it manually.

Important safety rule:

- it does not log the email

## 3. Verify OTP

When the user enters the 6-digit code and taps `Verify OTP`, `AppScreen.tsx` calls:

```ts
const nextSession = await verifyOtp(normalizedEmail, normalizedOtp);
```

That hits:

- `POST /auth/verify-otp`

The backend then:

1. looks up the stored OTP for that normalized email
2. checks whether it exists
3. checks whether it expired
4. checks whether the code matches
5. if valid, issues a random session token
6. returns a hashed user id

The returned shape is:

```ts
{
  sessionToken: string;
  userIdHash: string;
}
```

The app does not receive any user profile object yet. It only gets:

- a session token
- a privacy-safe identifier

## 4. Session Persistence

After verification succeeds, `AppScreen.tsx` calls:

```ts
await persistSession(nextSession);
setSession(nextSession);
```

The secure storage logic lives in [`security.ts`](../apps/mobile/src/services/security.ts).

That file has 2 separate responsibilities:

1. session storage
2. notes encryption key storage

Both use Keychain/Keystore through `react-native-keychain`.

### Why `security.ts` exists

The UI should not know how Keychain works.

So `AppScreen.tsx` asks for simple operations:

- `restoreSession()`
- `persistSession()`
- `clearSession()`

and `security.ts` handles:

- JSON serialization
- schema validation on restore
- corruption cleanup
- Keychain-specific setup

### The important pattern in `security.ts`

`createJsonSecretStore()` is the reusable helper.

Its job is:

1. read a raw string from secure storage
2. parse JSON
3. validate the parsed shape
4. if invalid or corrupt, wipe it instead of trusting it

That is a good pattern because it keeps startup stable. A bad or stale secret does not crash the app.

## 5. Showing Notes Only After Login

There is a second `useEffect` in [`AppScreen.tsx`](../apps/mobile/src/screens/AppScreen.tsx) that depends on `session`.

That means:

- when `session` becomes non-null, load notes
- when `session` becomes null, clear notes from memory

This is the bridge between auth state and the local vault.

## 6. Notes Storage

Notes logic lives in [`storage.ts`](../apps/mobile/src/services/storage.ts).

This file is the heart of the local vault.

It manages:

- encryption key lifecycle
- encrypted MMKV access
- note list loading
- note creation
- note deletion
- wipe behavior

### What is stored where

Session token:

- Keychain/Keystore

Notes encryption key:

- Keychain/Keystore

Notes payload:

- encrypted MMKV store

This split is intentional. The sensitive data is not all kept in one place.

### What `createNotesRepository()` does

This is the main abstraction in `storage.ts`.

It returns an object with:

- `listNotes()`
- `addNote()`
- `deleteNote()`
- `wipeAll()`

That means the screen never talks to MMKV directly. It calls a small repository API instead.

### The most important function: `ensureReady()`

Before notes can be read or written, the repository must make sure encryption is usable.

`ensureReady()` does that.

It checks:

1. does the metadata say encrypted notes exist?
2. does the encryption key exist in Keychain?

If the key is missing and encrypted notes existed before, the app treats that as corrupt state and wipes the notes store.

This is a deliberate safety decision.

Why?

Because encrypted data without the key is not recoverable in this app. Pretending otherwise only leaves the app in a broken state.

After that, if no key exists, the app generates a fresh 256-bit key and saves it in Keychain.

### How the encryption key is generated

`generateEncryptionKey()` creates 32 random bytes:

```ts
const bytes = new Uint8Array(32);
crypto.getRandomValues(bytes);
```

32 bytes = 256 bits.

That is then converted to a hex string and used as the MMKV encryption key.

### What is actually encrypted

The notes array is stored under:

- `notes`

inside an MMKV instance created with:

- `id: 'vault-notes'`
- `encryptionKey: <generated key>`

So the note payload at rest is encrypted by MMKV.

### Why there is also a meta store

There is a second MMKV instance:

- `vault-meta`

This stores only metadata like:

- `notes_initialized`

This is used to detect the case:

- "notes used to exist, but the encryption key is gone"

That is the signal for corruption recovery.

## 7. Creating a Note

When the user taps `Add Note`, `AppScreen.tsx` calls:

```ts
const nextNote = await addNote(noteBody);
```

Inside [`storage.ts`](../apps/mobile/src/services/storage.ts):

1. `createNoteDraft()` from [`@vault/core`](../packages/core/src/note.ts) validates and shapes the note
2. existing notes are loaded
3. the new note is prepended
4. the full notes array is re-saved into encrypted storage

The shared `@vault/core` package is intentionally small right now. It owns note-domain logic like:

- "a note cannot be empty"
- "bucket note length for telemetry"

That keeps the mobile layer thinner.

## 8. Deleting a Note

Delete is simple:

1. load current notes
2. filter out the matching id
3. write the updated array back to encrypted storage

There is no soft delete or sync yet. It is purely local state.

## 9. Logout

When the user taps `Logout`, `AppScreen.tsx` does:

```ts
await clearSession();
await wipeNotesVault();
```

This is an important guarantee:

- session token wiped
- notes encryption key wiped
- encrypted notes wiped
- in-memory React state wiped

So logout is not just "change the screen". It is a real local security reset.

## 10. Telemetry

Telemetry contracts live in [`packages/telemetry/src/contracts.ts`](../packages/telemetry/src/contracts.ts).

Right now, the app tracks events like:

- `auth_otp_requested`
- `auth_otp_verified`
- `auth_session_restored`
- `auth_logged_out`
- `note_created`

The important part is what it does **not** track:

- email
- OTP
- note content

For notes, only the note length bucket is tracked.

This is one of the main privacy constraints in the project.

## Failure Paths

These are the important defensive paths already in the code.

### Invalid OTP

Backend returns:

- `INVALID_OTP`

The mobile app turns that into a user-friendly message and does not store a session.

### Expired OTP

Backend returns:

- `OTP_EXPIRED`

Again, no session is stored.

### Corrupt Stored Session

If Keychain contains invalid JSON or the wrong shape, `security.ts` clears it and returns `null`.

That prevents startup crashes.

### Missing Notes Key

If encrypted notes existed before but the encryption key is missing, `storage.ts` wipes the notes store and generates a fresh key.

That prevents an unrecoverable broken state.

### Corrupt Notes Payload

If encrypted notes can be read from MMKV but JSON parsing or note validation fails, `storage.ts` clears the notes store and returns an empty list.

Again, the rule is:

- fail safe
- do not crash

## Why The Current Code Feels "Vibe Coded"

That feeling usually comes from one file doing too much at once.

Right now [`AppScreen.tsx`](../apps/mobile/src/screens/AppScreen.tsx) mixes:

- auth UI
- notes UI
- startup restore flow
- network calls
- save/delete handlers
- user messaging

So the code works, but it is denser than it needs to be.

The architecture underneath is actually more structured than it first looks:

- UI lives in `AppScreen.tsx`
- network lives in `auth.ts`
- secure secrets live in `security.ts`
- encrypted notes live in `storage.ts`
- backend OTP logic lives in `authService.ts`
- pure note logic lives in `@vault/core`

That is the part to focus on. The screen is busy, but the responsibilities are already separated underneath it.

## What To Read With Confidence

If you want to get comfortable with this codebase, focus on these ideas:

### `session` is the main app switch

```ts
const [session, setSession] = useState<AuthSession | null>(null);
```

If `session` exists:

- user is treated as logged in
- notes are loaded

If it does not:

- auth form is shown
- notes are cleared from memory

### `security.ts` is the secret boundary

Any secret that must survive restarts but stay protected should go through `security.ts`.

### `storage.ts` is the vault boundary

Any note persistence change should go through `storage.ts`, not directly from the UI.

### `authService.ts` is the backend source of truth for OTP behavior

If OTP timing, hashing, or validation changes, that file is where it belongs.

## Good Next Refactors

These would make the code easier to read without changing the architecture:

1. split `AppScreen.tsx` into:
   - `AuthPanel`
   - `NotesPanel`

2. move message formatting into a small helper module

3. add a small `sessionStore.ts` wrapper if session state grows beyond one screen

4. add navigation only when there are truly multiple screens

## Short Summary

The current app is doing this:

1. restore a secure session from Keychain
2. if logged out, request and verify OTP against Fastify
3. persist the session securely
4. create or restore a notes encryption key from Keychain
5. store notes encrypted in MMKV
6. wipe everything on logout

So the code is not random. It is a small app with a real security-oriented flow:

- backend issues auth state
- mobile stores secrets securely
- notes are encrypted at rest
- corrupt state is wiped instead of trusted

If you want, the next useful step is to turn this into a second document:

- `docs/file-by-file-reference.md`

That one would explain each exported function in `auth.ts`, `security.ts`, and `storage.ts` line by line.
