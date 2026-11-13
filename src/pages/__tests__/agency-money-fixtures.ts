import type { OwnerStatement } from '@/types';

/** An owner statement as `GET api/statements` answers it: the figures are the server's. */
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

/** What the server answers to a refusal: the status and the problem with its code (and what it adds). */
export const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code, ...extra } } });

/** A promise settled from outside: the request that is on its way. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** A file as the API hands it back: its bytes and the name the server gave it. */
export const file = (contentDisposition: string | null = null) => ({ blob: new Blob(['x']), contentDisposition });
