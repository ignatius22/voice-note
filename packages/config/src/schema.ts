import { z } from 'zod';

export const appConfigSchema = z.object({
  biometricsEnabled: z.boolean().default(false),
  noteExportEnabled: z.boolean().default(false),
  diagnosticsScreenEnabled: z.boolean().default(false),
  maxNoteLength: z.number().int().min(1).max(5000).default(280),
  otaEnabled: z.boolean().default(true),
  otaKillSwitch: z.boolean().default(false),
  otaChannel: z.enum(['staging', 'production']).default('production'),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
