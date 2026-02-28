import Fastify from 'fastify';
import { defaultConfig } from '@vault/config';
import {
  configResponseSchema,
  requestOtpBodySchema,
  requestOtpResponseSchema,
  verifyOtpBodySchema,
  verifyOtpResponseSchema,
} from './contracts';

const app = Fastify({ logger: true });

app.post('/auth/request-otp', async request => {
  requestOtpBodySchema.parse(request.body);

  return requestOtpResponseSchema.parse({
    ok: true,
  });
});

app.post('/auth/verify-otp', async request => {
  const body = verifyOtpBodySchema.parse(request.body);

  return verifyOtpResponseSchema.parse({
    ok: true,
    sessionToken: `session_${body.otp}`,
    hashedUserId: 'hashed_user_placeholder',
  });
});

app.get('/config', async () => {
  return configResponseSchema.parse({
    ok: true,
    config: defaultConfig,
  });
});

app.listen({ port: 4000, host: '0.0.0.0' }).catch(error => {
  app.log.error(error);
  process.exit(1);
});
