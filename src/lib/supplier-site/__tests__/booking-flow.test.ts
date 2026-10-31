import { describe, expect, it } from 'vitest';
import type { PublicSupplierServiceDetail } from '@/api/public-supplier.api';
import { EMPTY_DRAFT, newClientRequestId, selectionOf, suggestEmail, toBookingBody, validateDetails, type BookingDraft } from '../booking-flow';

const service: PublicSupplierServiceDetail = {
  slug: 'pulizia-standard',
  name: 'Pulizia standard',
  category: 'cleaning',
  priceFromCents: 9000,
  priceUnit: 'PerJob',
  pricesIncludeVat: false,
  requiresQuote: false,
  durationMinutes: 120,
  included: [],
  excluded: [],
  photoUrls: [],
  urgent: { enabled: false, surchargeCents: 0 },
  supplements: [{ code: 'bagno-extra', label: 'Bagno in più', amountCents: 1500, per: 'bathroom', max: 3 }],
};

const complete: BookingDraft = {
  ...EMPTY_DRAFT,
  service: 'pulizia-standard',
  options: { 'bagno-extra': 2, 'non-esiste': 4 },
  quantity: 5,
  startUtc: '2026-11-05T08:00:00.000Z',
  postalCode: '20900',
  address: ' Via Roma 1 ',
  fullName: ' Anna Rossi ',
  email: ' anna@example.test ',
  phone: '+39 333 123 4567',
};

describe('the booking in five steps: what is sent to the server', () => {
  it('validateDetails_WithoutTheConsent_AsksForIt', () => {
    expect(validateDetails(complete, false)).toEqual({ consent: 'required' });
    expect(validateDetails(complete, true)).toEqual({});
  });

  it('toBookingBody_ACompleteDraft_SendsTheConsentOnceGivenAndTheTrapAsTyped', () => {
    const body = toBookingBody({
      draft: complete,
      service,
      selection: selectionOf(complete, service, '015146'),
      comune: { istatCode: '015146', name: 'Milano', provinceCode: 'MI' },
      locale: 'en-GB',
      privacyNoticeVersion: '2026-11-v1',
      clientRequestId: 'id-1',
      trap: '',
    });

    expect(body.privacyAccepted).toBe(true);
    expect(body.privacyNoticeVersion).toBe('2026-11-v1');
    expect(body.website).toBe('');
    expect(body.locale).toBe('en');
    // Trimmed, and only what fits the service: a quantity on a price per job, a supplement the service does not have, are left out.
    expect(body.address).toBe('Via Roma 1');
    expect(body.fullName).toBe('Anna Rossi');
    expect(body.email).toBe('anna@example.test');
    expect(body.quantity).toBeUndefined();
    expect(body.options).toEqual([{ code: 'bagno-extra', quantity: 2 }]);
  });

  it('selectionOf_ASupplementOverItsLimit_IsBroughtBackToTheLimit', () => {
    const selection = selectionOf({ ...complete, options: { 'bagno-extra': 99 } }, service, null);

    expect(selection.options).toEqual({ 'bagno-extra': 3 });
  });

  it('suggestEmail_AKnownSlipInTheDomain_OffersTheRightOne', () => {
    expect(suggestEmail('anna@gmial.com')).toBe('anna@gmail.com');
    expect(suggestEmail('anna@example.test')).toBeNull();
  });

  it('newClientRequestId_Always_IsAGuid', () => {
    expect(newClientRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
