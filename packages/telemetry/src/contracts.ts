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
  deal_created: z.object({
    status: z.enum([
      'lead',
      'negotiating',
      'active',
      'delivered',
      'paid',
      'archived',
    ]),
    amountBucket: z.enum(['unknown', '1_999', '1000_4999', '5000_19999', '20000_plus']),
    currency: z.enum(['NGN', 'USD', 'GBP', 'EUR']).nullable(),
  }),
  deal_status_changed: z.object({
    fromStatus: z.enum([
      'lead',
      'negotiating',
      'active',
      'delivered',
      'paid',
      'archived',
    ]),
    toStatus: z.enum([
      'lead',
      'negotiating',
      'active',
      'delivered',
      'paid',
      'archived',
    ]),
  }),
  deal_deleted: z.object({
    status: z.enum([
      'lead',
      'negotiating',
      'active',
      'delivered',
      'paid',
      'archived',
    ]),
  }),
} as const;

export type EventName = keyof typeof eventContracts;
export type EventPayload<T extends EventName> = z.infer<(typeof eventContracts)[T]>;
