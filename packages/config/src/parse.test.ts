import { describe, expect, it } from 'vitest';
import { parseConfig } from './parse';

describe('parseConfig', () => {
  it('returns defaults when the input is invalid', () => {
    const result = parseConfig({
      maxNoteLength: -1,
      otaChannel: 'invalid',
    });

    expect(result.ok).toBe(false);
    expect(result.config.maxNoteLength).toBe(280);
    expect(result.config.otaChannel).toBe('production');
  });
});
