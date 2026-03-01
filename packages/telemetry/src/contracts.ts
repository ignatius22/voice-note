import { z } from 'zod';

export const eventContracts = {
  app_opened: z.object({
    source: z.enum(['cold_start', 'foreground']),
  }),
  auth_otp_requested: z.object({
    channel: z.literal('email_otp'),
  }),
  auth_otp_verified: z.object({
    success: z.boolean(),
  }),
  auth_session_restored: z.object({
    restored: z.boolean(),
  }),
  auth_logged_out: z.object({}),
  note_created: z.object({
    lengthBucket: z.enum(['1_50', '51_140', '141_280', '281_plus']),
  }),
} as const;

export type EventName = keyof typeof eventContracts;
export type EventPayload<T extends EventName> = z.infer<(typeof eventContracts)[T]>;
