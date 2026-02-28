# Security Summary

## Assets
- Session token
- Data encryption key
- Encrypted notes
- Telemetry payloads

## Controls
- Session token and encryption key belong in Keychain/Keystore only.
- Notes are intended to be encrypted at rest in the mobile storage adapter.
- Telemetry is scrubbed by default and must only use typed event contracts.
- Logout must wipe secrets, encrypted storage, and in-memory session state.

## Threats Mitigated
- Plaintext secrets in app storage
- Plaintext notes at rest
- Accidental PII leakage through analytics and observability

## Threats Not Mitigated
- Rooted or jailbroken devices
- Malware on an unlocked device
- Full OS compromise
- Weak client-side hashing if a salt is bundled in the app
