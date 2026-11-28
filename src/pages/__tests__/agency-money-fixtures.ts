import type { OwnerStatement, WireBatch, WirePayout } from '@/types';

export function wirePayout(overrides: Partial<WirePayout> = {}): WirePayout {
  return {
    payoutId: 'dddddddd-0000-4000-8000-000000000001',
    ownerId: 'bbbbbbbb-0000-4000-8000-000000000001',
    ownerName: 'Marta Rossi',
    periodYear: 2026,
    periodMonth: 10,
    amount: 1234.5,
    currency: 'CHF',
    confirmedAt: '2026-11-10T09:00:00Z',
    status: 'Confirmed',
    ownerHasIban: true,
    ...overrides,
  };
}

export function wireBatch(overrides: Partial<WireBatch> = {}): WireBatch {
  return {
    id: 'b1b2c3d4-0000-4000-8000-000000000000',
    currency: 'CHF',
    status: 'Generated',
    transferCount: 1,
    totalAmount: 1234.5,
    executionDate: '2026-11-20',
    format: 'pain.001.001.09.ch.03',
    createdAt: '2026-11-14T10:00:00Z',
    downloadedAt: null,
    paidAt: null,
    ...overrides,
  };
}

export function statement(overrides: Partial<OwnerStatement> = {}): OwnerStatement {
  return {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    propertyOwnerId: 'bbbbbbbb-0000-4000-8000-000000000001',
    ownerName: 'Marta Rossi',
    propertyId: 'cccccccc-0000-4000-8000-000000000001',
    propertyName: 'Casa Mare',
    month: 10,
    year: 2026,
    currency: 'EUR',
    status: 'Published',
    totalRevenue: 1000.5,
    commission: 150.25,
    expenses: 20,
    withholdingTax: 0,
    netPayable: 830.25,
    ownershipPercent: 100,
    publishedAt: '2026-11-02T09:00:00Z',
    createdAt: '2026-11-01T09:00:00Z',
    ...overrides,
  };
}

export const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code, ...extra } } });

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

export const file = (contentDisposition: string | null = null) => ({ blob: new Blob(['x']), contentDisposition });
