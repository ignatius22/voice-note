import { z } from 'zod';
import { appConfigSchema } from '@vault/config';

export const requestOtpBodySchema = z.object({
  email: z.email(),
});

export const verifyOtpBodySchema = z.object({
  email: z.email(),
  otp: z.string().length(6),
});

export const requestOtpResponseSchema = z.object({
  ok: z.literal(true),
});

export const verifyOtpResponseSchema = z.object({
  ok: z.literal(true),
  sessionToken: z.string(),
  hashedUserId: z.string(),
});

export const configResponseSchema = z.object({
  ok: z.literal(true),
  config: appConfigSchema,
});
