import { describe, expect, it } from 'vitest';
import { scrub } from './scrub';
import { trackEvent } from './track';

describe('telemetry', () => {
  it('scrubs sensitive keys', () => {
    expect(scrub({ email: 'user@example.com', token: 'abc' })).toEqual({
      email: '[REDACTED]',
      token: '[REDACTED]',
    });
  });

  it('validates event contracts', async () => {
    const result = await trackEvent('app_opened', { source: 'cold_start' });
    expect(result.name).toBe('app_opened');
    expect(result.payload).toEqual({ source: 'cold_start' });
  });
});
