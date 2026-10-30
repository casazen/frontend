import { describe, expect, it } from 'vitest';
import { DIRECT_CHECKOUT_CONSENT_VERSION } from '@/types/direct-booking.types';
import {
  EMPTY_DETAILS,
  EMPTY_DRAFT,
  SPECIAL_REQUESTS_MAX,
  arrivalSlots,
  buildBookingPayload,
  parseStep,
  paymentOptionOf,
  suggestEmail,
  type CheckoutDraft,
} from '../checkout-model';

/**
 * What the checkout sends to make a booking, and what it never sends. The amounts are not here: the server prices the same stay again
 * and charges its own total. What is here costs money or privacy when it is wrong: the payment option (when the card is charged), the
 * consent to the offers (only when the site has a text for it, never preselected) and the ages (only when complete).
 */
const draft: CheckoutDraft = {
  ...EMPTY_DRAFT,
  details: { ...EMPTY_DETAILS, firstName: ' Mario ', lastName: 'Rossi', email: ' mario@example.com ', country: 'IT' },
};

const stay = { propertyId: 'p1', checkIn: '2026-11-10', checkOut: '2026-11-13', adults: 2, children: 0 };

describe('paymentOptionOf', () => {
  it('paymentOptionOf_EachChoice_IsTheOptionTheCardIsChargedUnder', () => {
    expect(paymentOptionOf('instant', 'now')).toBe('Immediate');
    expect(paymentOptionOf('instant', 'deadline')).toBe('OnCancellationDeadline');
    // A request takes no card whatever the payment choice says.
    expect(paymentOptionOf('request', 'now')).toBe('OnSite');
    expect(paymentOptionOf('request', 'deadline')).toBe('OnSite');
  });
});

describe('buildBookingPayload', () => {
  it('buildBookingPayload_Basics_TrimsTheGuestAndSendsTheCheckoutConsentOnly', () => {
    const payload = buildBookingPayload({ ...stay, draft });

    expect(payload.guest).toEqual({ firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', country: 'IT' });
    expect(payload.consent).toEqual({ dataProcessing: true, consentVersion: DIRECT_CHECKOUT_CONSENT_VERSION });
    expect(payload).not.toHaveProperty('marketingConsent');
    expect(payload).not.toHaveProperty('childrenAges');
    expect(payload).not.toHaveProperty('specialRequests');
    expect(payload).not.toHaveProperty('expectedArrivalTime');
  });

  it('buildBookingPayload_OffersBoxWithoutVersion_SendsNoMarketingConsentEvenIfTicked', () => {
    const ticked = { ...draft, details: { ...draft.details, offers: true } };

    expect(buildBookingPayload({ ...stay, draft: ticked, marketingConsentVersion: null })).not.toHaveProperty('marketingConsent');
    expect(buildBookingPayload({ ...stay, draft: ticked, marketingConsentVersion: undefined })).not.toHaveProperty('marketingConsent');
  });

  it('buildBookingPayload_OffersBoxWithVersion_SendsWhatTheGuestChose', () => {
    const ticked = { ...draft, details: { ...draft.details, offers: true } };

    expect(buildBookingPayload({ ...stay, draft: ticked, marketingConsentVersion: '2026-10' }).marketingConsent).toBe(true);
    // Never preselected: the default answer is "no", and it is sent as a "no".
    expect(buildBookingPayload({ ...stay, draft, marketingConsentVersion: '2026-10' }).marketingConsent).toBe(false);
  });

  it('buildBookingPayload_RequestMode_AsksTheOnSiteOption', () => {
    expect(buildBookingPayload({ ...stay, draft: { ...draft, mode: 'request' } }).paymentOption).toBe('OnSite');
    expect(buildBookingPayload({ ...stay, draft: { ...draft, mode: 'instant', pay: 'deadline' } }).paymentOption).toBe('OnCancellationDeadline');
  });

  it('buildBookingPayload_OptionalFields_AreSentOnlyWhenFilled', () => {
    const filled: CheckoutDraft = {
      ...draft,
      requests: `  ${'x'.repeat(SPECIAL_REQUESTS_MAX + 50)}  `,
      details: { ...draft.details, phone: ' +39 333 1234567 ', arrival: 'late' },
    };
    const payload = buildBookingPayload({ ...stay, children: 1, childrenAges: [6], draft: filled });

    expect(payload.guest.phone).toBe('+39 333 1234567');
    expect(payload.specialRequests).toHaveLength(SPECIAL_REQUESTS_MAX);
    expect(payload.expectedArrivalTime).toBe('late');
    expect(payload.childrenAges).toEqual([6]);
    expect(buildBookingPayload({ ...stay, draft: { ...draft, details: { ...draft.details, phone: '   ' } } }).guest).not.toHaveProperty('phone');
  });
});

describe('parseStep', () => {
  it('parseStep_AnythingButTwoOrThree_IsTheFirstStep', () => {
    expect(parseStep(null)).toBe(1);
    expect(parseStep('1')).toBe(1);
    expect(parseStep('2')).toBe(2);
    expect(parseStep('3')).toBe(3);
    expect(parseStep('4')).toBe(1);
    expect(parseStep('abc')).toBe(1);
  });
});

describe('arrivalSlots', () => {
  it('arrivalSlots_Window_ListsTheWholeHours', () => {
    expect(arrivalSlots('15:00', '19:00')).toEqual(['15:00', '16:00', '17:00', '18:00']);
    expect(arrivalSlots('15:00', '15:00')).toEqual([]);
    expect(arrivalSlots('', '19:00')).toEqual([]);
  });
});

describe('suggestEmail', () => {
  it('suggestEmail_TypoOfAPopularDomain_ProposesTheRightOne', () => {
    expect(suggestEmail('mario@gmial.com')).toBe('mario@gmail.com');
    expect(suggestEmail('mario@hotmial.it')).toBe('mario@hotmail.it');
    expect(suggestEmail('mario@outlok.com')).toBe('mario@outlook.com');
  });

  it('suggestEmail_AddressThatLooksRight_IsLeftAlone', () => {
    expect(suggestEmail('mario@gmail.com')).toBeNull();
    expect(suggestEmail('mario@ymail.com')).toBeNull();
    expect(suggestEmail('mario@example.com')).toBeNull();
    expect(suggestEmail('not-an-email')).toBeNull();
    expect(suggestEmail('mario@')).toBeNull();
  });
});
