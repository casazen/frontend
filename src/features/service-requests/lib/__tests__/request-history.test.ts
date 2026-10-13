import { describe, it, expect } from 'vitest';
import type { ServiceRequest } from '@/types/service-request';
import { hasReplacement, suppliersThatRejected } from '../request-history';

function request(overrides: Partial<ServiceRequest>): ServiceRequest {
  return {
    id: 'sr-1',
    orgId: 'org-1',
    bookingId: 'b-1',
    propertyId: 'p-1',
    supplierOrgId: 'sup-1',
    category: 'cleaning',
    urgency: 'Normal',
    status: 'Rifiutato',
    chargeToGuest: false,
    createdAt: '2026-09-20T08:00:00Z',
    updatedAt: '2026-09-20T09:00:00Z',
    ...overrides,
  };
}

describe('suppliersThatRejected (SU-09)', () => {
  it('suppliersThatRejected_SameStayAndCategory_ListsEverySupplierThatRejectedIt', () => {
    const rejected = request({ id: 'a', supplierOrgId: 'sup-1' });
    const requests = [
      rejected,
      request({ id: 'b', supplierOrgId: 'sup-2' }),
      // Another category, another stay, another property, or not rejected: not counted.
      request({ id: 'c', supplierOrgId: 'sup-3', category: 'plumbing' }),
      request({ id: 'd', supplierOrgId: 'sup-4', bookingId: 'b-2' }),
      request({ id: 'e', supplierOrgId: 'sup-5', propertyId: 'p-2' }),
      request({ id: 'f', supplierOrgId: 'sup-6', status: 'Richiesto' }),
    ];

    expect(suppliersThatRejected(rejected, requests).sort()).toEqual(['sup-1', 'sup-2']);
  });

  it('suppliersThatRejected_ListWithoutTheRequestItself_StillIncludesItsSupplier', () => {
    expect(suppliersThatRejected(request({ supplierOrgId: 'sup-9' }), [])).toEqual(['sup-9']);
  });

  it('suppliersThatRejected_PropertyLevelRequests_MatchOnTheProperty', () => {
    const lease = request({ id: 'a', bookingId: null, supplierOrgId: 'sup-1' });
    const other = request({ id: 'b', bookingId: null, supplierOrgId: 'sup-2' });
    const stay = request({ id: 'c', bookingId: 'b-1', supplierOrgId: 'sup-3' });

    expect(suppliersThatRejected(lease, [lease, other, stay]).sort()).toEqual(['sup-1', 'sup-2']);
  });
});

describe('hasReplacement (SU-09)', () => {
  const rejected = request({ id: 'a' });

  it('hasReplacement_NewerRequestForTheSameJobNotRejected_IsTrue', () => {
    const newer = request({ id: 'b', status: 'Richiesto', supplierOrgId: 'sup-2', createdAt: '2026-09-21T08:00:00Z' });

    expect(hasReplacement(rejected, [rejected, newer])).toBe(true);
  });

  it.each([
    ['older than the rejected one', { createdAt: '2026-09-19T08:00:00Z' }],
    ['rejected too', { status: 'Rifiutato' as const }],
    ['another category', { category: 'plumbing' }],
    ['another stay', { bookingId: 'b-2' }],
  ])('hasReplacement_RequestThatIs_%s_IsFalse', (_label, overrides) => {
    const other = request({ id: 'b', status: 'Richiesto', createdAt: '2026-09-21T08:00:00Z', ...overrides });

    expect(hasReplacement(rejected, [rejected, other])).toBe(false);
  });

  it('hasReplacement_OnlyTheRequestItself_IsFalse', () => {
    expect(hasReplacement(rejected, [rejected])).toBe(false);
  });
});
