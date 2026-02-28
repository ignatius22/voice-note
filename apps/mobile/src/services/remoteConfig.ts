import { defaultConfig, parseConfig } from '@vault/config';

export async function loadRemoteConfig() {
  const result = parseConfig(defaultConfig);
  return result.ok ? result.config : defaultConfig;
}
