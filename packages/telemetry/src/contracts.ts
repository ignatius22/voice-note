import { z } from 'zod';

export const eventContracts = {
  app_opened: z.object({
    source: z.enum(['cold_start', 'foreground']),
  }),
  note_created: z.object({
    lengthBucket: z.enum(['1_50', '51_140', '141_280', '281_plus']),
  }),
} as const;

export type EventName = keyof typeof eventContracts;
export type EventPayload<T extends EventName> = z.infer<(typeof eventContracts)[T]>;
