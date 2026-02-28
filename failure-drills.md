# Failure Drills

## Remote Config Failure
- Disable the control-plane config endpoint.
- Expected: app falls back to defaults or cached last-known-good config.

## Analytics Vendor Down
- Force the telemetry adapter to reject.
- Expected: app flow continues and no crash occurs.

## Forced Crash Capture
- Trigger the diagnostics crash action.
- Expected: observability records the crash with scrubbed context only.

## Offline Mode
- Launch the app without network.
- Expected: local notes still load and config falls back safely.

## OTA Rollback
- Publish a bad staging bundle.
- Expected: the update system rolls back to the last known good bundle.
