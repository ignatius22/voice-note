import Fastify from 'fastify';
import { defaultConfig } from '@vault/config';
import {
  createAuthService,
  isUsingFallbackDevSalt,
} from './authService';
import {
  authErrorResponseSchema,
  configResponseSchema,
  requestOtpBodySchema,
  requestOtpResponseSchema,
  verifyOtpBodySchema,
  verifyOtpResponseSchema,
} from './contracts';

const app = Fastify({ logger: true });
const authService = createAuthService();

if (process.env.NODE_ENV !== 'production' && isUsingFallbackDevSalt(authService.salt)) {
  app.log.warn(
    'VAULT_DEV_OTP_SALT is not set. Using an unsafe development fallback salt.',
  );
}

app.post('/auth/request-otp', async request => {
  const body = requestOtpBodySchema.parse(request.body);
  const { code } = authService.requestOtp(body.email);

  if (process.env.NODE_ENV !== 'production') {
    app.log.info({ otpCode: code }, 'Development OTP issued');
  }

  return requestOtpResponseSchema.parse({
    ok: true,
  });
});

app.post('/auth/verify-otp', async (request, reply) => {
  const body = verifyOtpBodySchema.parse(request.body);
  const result = authService.verifyOtp(body.email, body.otp);

  if (!result.ok) {
    return reply.code(401).send(
      authErrorResponseSchema.parse({
        ok: false,
        code: result.reason,
      }),
    );
  }

  return verifyOtpResponseSchema.parse({
    ok: true,
    sessionToken: result.sessionToken,
    userIdHash: result.userIdHash,
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
