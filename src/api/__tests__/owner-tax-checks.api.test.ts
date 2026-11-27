import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import type { CompanyTenantCase, OwnerUnitsCheck } from '@/types';
import { acceptsRefusal } from '../accept-refusal';
import { ownerTaxChecksApi } from '../owner-tax-checks.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const get = vi.mocked(axios.get);

const OWNER = '11111111-1111-4111-8111-111111111111';

const CASES: CompanyTenantCase[] = [
  { bookingId: 'b-1', bookingCode: 'BK-1', propertyId: 'p-1', propertyName: 'Casa Lago', checkIn: '2026-10-10', checkOut: '2026-10-14', decision: null, decidedAt: null, decidedByUserId: null },
];
const CHECK: OwnerUnitsCheck = { ownerId: OWNER, applies: true, managedUnits: 2, externalUnits: 0, totalUnits: 2, maxUnits: 2, presumedBusiness: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the checks of the Italian short-let withholding (E18/F02/US01/T01)', () => {
  it('ListCompanyTenantCases_AsksTheListWithTheStateWhenOneIsGiven_AndTakesTheRefusalAsAnAnswer', async () => {
    get.mockResolvedValueOnce({ status: 200, data: CASES });
    get.mockResolvedValueOnce({ status: 200, data: [] });

    await expect(ownerTaxChecksApi.listCompanyTenantCases()).resolves.toBe(CASES);
    await ownerTaxChecksApi.listCompanyTenantCases('Pending');

    expect(get.mock.calls[0]![0]).toBe('/owner-tax-decisions');
    expect(get.mock.calls[0]![1]?.params).toBeUndefined();
    expect(get.mock.calls[1]![1]?.params).toEqual({ state: 'Pending' });
    expect(get.mock.calls[0]![1]?.validateStatus).toBe(acceptsRefusal);
  });

  // Permission: a 403 is an answer of the page («no access»), not a reason to send the whole app to the page of the missing access, and never an empty list.
  it('ListCompanyTenantCases_403_ResolvesToNullNeverToAnEmptyList', async () => {
    get.mockResolvedValueOnce({ status: 403, data: {} });

    await expect(ownerTaxChecksApi.listCompanyTenantCases()).resolves.toBeNull();
  });

  it('GetUnitsCheck_AsksTheOwnerOfTheAddress_AndTakesTheRefusalAsAnAnswer', async () => {
    get.mockResolvedValueOnce({ status: 200, data: CHECK });

    await expect(ownerTaxChecksApi.getUnitsCheck(OWNER)).resolves.toBe(CHECK);

    expect(get.mock.calls[0]![0]).toBe(`/owners/${OWNER}/tax-checks`);
    expect(get.mock.calls[0]![1]?.validateStatus).toBe(acceptsRefusal);
  });

  it('GetUnitsCheck_403_ResolvesToNullNeverToAnOwnerWithinTheLimit', async () => {
    get.mockResolvedValueOnce({ status: 403, data: {} });

    await expect(ownerTaxChecksApi.getUnitsCheck(OWNER)).resolves.toBeNull();
  });
});
