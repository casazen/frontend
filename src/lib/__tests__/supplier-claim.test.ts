import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingSupplierClaim,
  parsePendingSupplierClaim,
  readPendingSupplierClaim,
  savePendingSupplierClaim,
} from '../supplier-claim';

const NOW = new Date('2026-09-24T10:00:00Z');
const CLAIM = { token: 'a1'.repeat(32), email: 'fornitore@example.com', expiresAt: '2026-10-01T10:00:00Z' };

describe('supplier claim storage (SU-02)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('parsePendingSupplierClaim_WellFormedAndNotExpired_ReturnsTheClaim', () => {
    expect(parsePendingSupplierClaim(CLAIM, NOW)).toEqual(CLAIM);
  });

  it('parsePendingSupplierClaim_MalformedTokenEmailOrExpiry_ReturnsNull', () => {
    expect(parsePendingSupplierClaim({ ...CLAIM, token: 'short' }, NOW)).toBeNull();
    expect(parsePendingSupplierClaim({ ...CLAIM, token: 'Z'.repeat(64) }, NOW)).toBeNull();
    expect(parsePendingSupplierClaim({ ...CLAIM, email: ' ' }, NOW)).toBeNull();
    expect(parsePendingSupplierClaim({ ...CLAIM, expiresAt: 'soon' }, NOW)).toBeNull();
    expect(parsePendingSupplierClaim({ ...CLAIM, expiresAt: '2026-09-24T09:59:59Z' }, NOW)).toBeNull();
    expect(parsePendingSupplierClaim(null, NOW)).toBeNull();
    expect(parsePendingSupplierClaim('token', NOW)).toBeNull();
  });

  it('readPendingSupplierClaim_SavedClaim_IsReadUntilCleared', () => {
    savePendingSupplierClaim({ ...CLAIM, expiresAt: '2999-01-01T00:00:00Z' });

    expect(readPendingSupplierClaim()?.token).toBe(CLAIM.token);
    clearPendingSupplierClaim();
    expect(readPendingSupplierClaim()).toBeNull();
  });

  it('readPendingSupplierClaim_ExpiredOrCorrupted_IsRemoved', () => {
    localStorage.setItem('cz-supplier-claim', JSON.stringify(CLAIM));
    expect(readPendingSupplierClaim(new Date('2026-10-02T00:00:00Z'))).toBeNull();
    expect(localStorage.getItem('cz-supplier-claim')).toBeNull();

    localStorage.setItem('cz-supplier-claim', '{not json');
    expect(readPendingSupplierClaim(NOW)).toBeNull();
    expect(localStorage.getItem('cz-supplier-claim')).toBeNull();
  });

  it('savePendingSupplierClaim_StorageUnavailable_DoesNotThrow', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => savePendingSupplierClaim({ ...CLAIM, expiresAt: '2999-01-01T00:00:00Z' })).not.toThrow();
  });
});
