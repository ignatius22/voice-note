import { describe, expect, it } from 'vitest';
import {
  bucketDealAmount,
  createDeal,
  isDealArray,
  updateDeal,
} from './deal';

describe('deal domain', () => {
  it('creates a normalized deal', () => {
    const deal = createDeal(
      {
        brandName: '  Acme  ',
        status: 'lead',
        amount: 1234.567,
        currency: 'USD',
        privateNotes: '  high priority  ',
      },
      new Date('2026-03-01T12:00:00.000Z'),
    );

    expect(deal.brandName).toBe('Acme');
    expect(deal.amount).toBe(1234.57);
    expect(deal.privateNotes).toBe('high priority');
    expect(deal.createdAt).toBe('2026-03-01T12:00:00.000Z');
    expect(deal.updatedAt).toBe('2026-03-01T12:00:00.000Z');
  });

  it('updates a deal without changing createdAt', () => {
    const original = createDeal(
      {
        brandName: 'Acme',
        status: 'lead',
      },
      new Date('2026-03-01T12:00:00.000Z'),
    );

    const updated = updateDeal(
      original,
      {
        brandName: 'Acme',
        status: 'paid',
      },
      new Date('2026-03-02T12:00:00.000Z'),
    );

    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt).toBe('2026-03-02T12:00:00.000Z');
    expect(updated.status).toBe('paid');
  });

  it('rejects invalid amount values', () => {
    expect(() =>
      createDeal({
        brandName: 'Acme',
        status: 'lead',
        amount: -1,
      }),
    ).toThrowError('INVALID_DEAL_AMOUNT');
  });

  it('buckets deal amounts for telemetry safely', () => {
    expect(bucketDealAmount()).toBe('unknown');
    expect(bucketDealAmount(500)).toBe('1_999');
    expect(bucketDealAmount(1500)).toBe('1000_4999');
    expect(bucketDealAmount(7000)).toBe('5000_19999');
    expect(bucketDealAmount(25000)).toBe('20000_plus');
  });

  it('validates persisted deal arrays', () => {
    const deal = createDeal({
      brandName: 'Acme',
      status: 'active',
    });

    expect(isDealArray([deal])).toBe(true);
    expect(isDealArray([{ brandName: 'bad' }])).toBe(false);
  });
});
