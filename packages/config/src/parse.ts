import { defaultConfig } from './defaults';
import { appConfigSchema, type AppConfig } from './schema';

export function parseConfig(input: unknown): { ok: boolean; config: AppConfig } {
  const result = appConfigSchema.safeParse(input);

  if (!result.success) {
    return {
      ok: false,
      config: defaultConfig,
    };
  }

  return {
    ok: true,
    config: result.data,
  };
}
