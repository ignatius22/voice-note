import { appConfigSchema, type AppConfig } from './schema';

export const defaultConfig: AppConfig = appConfigSchema.parse({});
