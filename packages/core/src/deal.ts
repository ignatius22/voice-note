export const DEAL_STATUSES = [
  'lead',
  'negotiating',
  'active',
  'delivered',
  'paid',
  'archived',
] as const;

export const DEAL_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];
export type DealCurrency = (typeof DEAL_CURRENCIES)[number];

export interface Deal {
  id: string;
  brandName: string;
  campaignName?: string;
  amount?: number;
  currency?: DealCurrency;
  status: DealStatus;
  dueDate?: string;
  contactHandle?: string;
  privateNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealInput {
  brandName: string;
  campaignName?: string;
  amount?: number;
  currency?: DealCurrency;
  status: DealStatus;
  dueDate?: string;
  contactHandle?: string;
  privateNotes?: string;
}

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeAmount(amount?: number): number | undefined {
  if (amount === undefined) {
    return undefined;
  }

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('INVALID_DEAL_AMOUNT');
  }

  return Number(amount.toFixed(2));
}

function normalizeInput(input: DealInput): DealInput {
  const brandName = input.brandName.trim();
  if (!brandName) {
    throw new Error('INVALID_DEAL_BRAND_NAME');
  }

  return {
    brandName,
    campaignName: normalizeOptionalString(input.campaignName),
    amount: normalizeAmount(input.amount),
    currency: input.currency,
    status: input.status,
    dueDate: normalizeOptionalString(input.dueDate),
    contactHandle: normalizeOptionalString(input.contactHandle),
    privateNotes: normalizeOptionalString(input.privateNotes),
  };
}

export function createDeal(input: DealInput, now = new Date()): Deal {
  const normalized = normalizeInput(input);
  const timestamp = now.toISOString();

  return {
    id: `deal_${Date.now()}`,
    ...normalized,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateDeal(existing: Deal, input: DealInput, now = new Date()): Deal {
  const normalized = normalizeInput(input);

  return {
    ...existing,
    ...normalized,
    createdAt: existing.createdAt,
    updatedAt: now.toISOString(),
  };
}

export function bucketDealAmount(
  amount?: number,
): 'unknown' | '1_999' | '1000_4999' | '5000_19999' | '20000_plus' {
  if (amount === undefined) {
    return 'unknown';
  }

  if (amount < 1000) {
    return '1_999';
  }

  if (amount < 5000) {
    return '1000_4999';
  }

  if (amount < 20000) {
    return '5000_19999';
  }

  return '20000_plus';
}

export function isDeal(value: unknown): value is Deal {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Deal>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.brandName === 'string' &&
    typeof candidate.status === 'string' &&
    DEAL_STATUSES.includes(candidate.status as DealStatus) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    (candidate.amount === undefined || typeof candidate.amount === 'number') &&
    (candidate.currency === undefined ||
      DEAL_CURRENCIES.includes(candidate.currency as DealCurrency)) &&
    (candidate.campaignName === undefined ||
      typeof candidate.campaignName === 'string') &&
    (candidate.dueDate === undefined || typeof candidate.dueDate === 'string') &&
    (candidate.contactHandle === undefined ||
      typeof candidate.contactHandle === 'string') &&
    (candidate.privateNotes === undefined ||
      typeof candidate.privateNotes === 'string')
  );
}

export function isDealArray(value: unknown): value is Deal[] {
  return Array.isArray(value) && value.every(isDeal);
}
