# Vault Notes

`Vault Notes` is a small React Native CLI app in a `pnpm` + Turborepo monorepo. The project is intentionally focused on systems architecture rather than UI polish.

Current scope:
- `apps/mobile`: React Native mobile app
- `apps/control-plane`: minimal Fastify service
- `packages/core`: domain logic
- `packages/config`: typed config schema and parsing
- `packages/telemetry`: telemetry contracts and scrubbing

## Monorepo Layout

```txt
apps/
  mobile/
  control-plane/
packages/
  core/
  config/
  telemetry/
```

## Requirements

- Node.js 22+
- `pnpm` 10+
- Android Studio / Android SDK for Android builds
- Xcode + CocoaPods for iOS builds

## Install

```sh
pnpm install
```

## Development

Start Metro:

```sh
pnpm mobile:start
```

Run Android:

```sh
pnpm mobile:android
```

Run iOS:

```sh
pnpm mobile:ios
```

Run the control plane:

```sh
pnpm control-plane:dev
```

## Workspace Commands

Lint everything:

```sh
pnpm lint
```

Typecheck everything:

```sh
pnpm typecheck
```

Run tests:

```sh
pnpm test
```

Build workspace packages:

```sh
pnpm build
```

## Mobile Notes

The mobile app lives in [apps/mobile](/c:/Users/USER/Documents/workspace/RN/voiceNote/apps/mobile) and uses workspace packages directly:
- `@vault/core`
- `@vault/config`
- `@vault/telemetry`

Metro is configured for `pnpm` workspaces and symlink resolution in [apps/mobile/metro.config.js](/c:/Users/USER/Documents/workspace/RN/voiceNote/apps/mobile/metro.config.js).

Android native paths were updated for the monorepo in:
- [apps/mobile/android/settings.gradle](/c:/Users/USER/Documents/workspace/RN/voiceNote/apps/mobile/android/settings.gradle)
- [apps/mobile/android/app/build.gradle](/c:/Users/USER/Documents/workspace/RN/voiceNote/apps/mobile/android/app/build.gradle)

## Control Plane

The control plane is a minimal Fastify service in [apps/control-plane/src/server.ts](/c:/Users/USER/Documents/workspace/RN/voiceNote/apps/control-plane/src/server.ts).

Current routes:
- `POST /auth/request-otp`
- `POST /auth/verify-otp`
- `GET /config`

## Documentation

- Security notes: [SECURITY.md](/c:/Users/USER/Documents/workspace/RN/voiceNote/SECURITY.md)
- Failure drills: [failure-drills.md](/c:/Users/USER/Documents/workspace/RN/voiceNote/failure-drills.md)

## Current Status

This repo has been migrated from a single React Native app into a monorepo scaffold. The core workspace structure, shared packages, Android monorepo path fixes, and control-plane skeleton are in place.

The next major task is to finish stabilizing the mobile runtime path and then wire the first real integrations:
- secure storage
- observability
- typed remote config
- OTA flow
