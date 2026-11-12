import { describe, expect, it } from 'vitest';
import { DIRECT_CHECKOUT_CONSENT_VERSION } from '@/types/direct-booking.types';
import {
  EMPTY_DETAILS,
  EMPTY_DRAFT,
  PETS_NOTE,
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
 * consents to the offers (one per channel, only when the site has a text for them, never preselected), the version of the soft opt-in
 * notice (only when the site has one) and the ages (only when complete).
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

describe('the offers boxes of the checkout (NF-90)', () => {
  it('EmptyDetails_TheTwoOffersBoxes_AreNeverPreselected', () => {
    // The guest ticks them or they stay «no»: a blank draft, and the one the page starts from, have both unticked.
    expect(EMPTY_DETAILS.offersEmail).toBe(false);
    expect(EMPTY_DETAILS.offersWhatsApp).toBe(false);
    expect(EMPTY_DRAFT.details.offersEmail).toBe(false);
    expect(EMPTY_DRAFT.details.offersWhatsApp).toBe(false);
  });
});

describe('buildBookingPayload', () => {
  it('buildBookingPayload_Basics_TrimsTheGuestAndSendsTheCheckoutConsentOnly', () => {
    const payload = buildBookingPayload({ ...stay, draft });

    expect(payload.guest).toEqual({ firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', country: 'IT' });
    expect(payload.consent).toEqual({ dataProcessing: true, consentVersion: DIRECT_CHECKOUT_CONSENT_VERSION });
    expect(payload).not.toHaveProperty('marketingConsent');
    expect(payload).not.toHaveProperty('marketingConsentEmail');
    expect(payload).not.toHaveProperty('marketingConsentWhatsApp');
    expect(payload).not.toHaveProperty('softOptInNoticeVersion');
    expect(payload).not.toHaveProperty('childrenAges');
    expect(payload).not.toHaveProperty('specialRequests');
    expect(payload).not.toHaveProperty('expectedArrivalTime');
  });

  it('buildBookingPayload_OffersBoxesWithoutVersion_SendNoConsentEvenIfTicked', () => {
    const ticked = { ...draft, details: { ...draft.details, phone: '+39 333 1234567', offersEmail: true, offersWhatsApp: true } };

    for (const version of [null, undefined, '']) {
      const payload = buildBookingPayload({ ...stay, draft: ticked, marketingConsentVersion: version });
      expect(payload).not.toHaveProperty('marketingConsentEmail');
      expect(payload).not.toHaveProperty('marketingConsentWhatsApp');
    }
  });

  it('buildBookingPayload_OffersBoxesWithVersion_SendWhatTheGuestChoseAndNeverTheOldSingleConsent', () => {
    const phone = '+39 333 1234567';
    const both = { ...draft, details: { ...draft.details, phone, offersEmail: true, offersWhatsApp: true } };
    const onlyEmail = { ...draft, details: { ...draft.details, phone, offersEmail: true } };
    const onlyWhatsApp = { ...draft, details: { ...draft.details, phone, offersWhatsApp: true } };

    const bothPayload = buildBookingPayload({ ...stay, draft: both, marketingConsentVersion: '2026-10' });
    expect(bothPayload.marketingConsentEmail).toBe(true);
    expect(bothPayload.marketingConsentWhatsApp).toBe(true);
    expect(buildBookingPayload({ ...stay, draft: onlyEmail, marketingConsentVersion: '2026-10' }).marketingConsentWhatsApp).toBe(false);
    expect(buildBookingPayload({ ...stay, draft: onlyWhatsApp, marketingConsentVersion: '2026-10' }).marketingConsentEmail).toBe(false);
    // Never preselected: the default answer is "no" on each channel, and it is sent as a "no".
    const untouched = buildBookingPayload({ ...stay, draft, marketingConsentVersion: '2026-10' });
    expect(untouched.marketingConsentEmail).toBe(false);
    expect(untouched.marketingConsentWhatsApp).toBe(false);
    // The single «send me offers» of before is gone, whatever the boxes say.
    expect(bothPayload).not.toHaveProperty('marketingConsent');
    expect(untouched).not.toHaveProperty('marketingConsent');
  });

  it('buildBookingPayload_WhatsAppTickedWithoutAPhone_NeverSendsTheConsent', () => {
    // The form refuses this (the schema); the payload holds the same line, because the API answers 422 and a consent with no number is no consent.
    const noPhone = { ...draft, details: { ...draft.details, phone: '   ', offersWhatsApp: true } };

    expect(buildBookingPayload({ ...stay, draft: noPhone, marketingConsentVersion: '2026-10' }).marketingConsentWhatsApp).toBe(false);
  });

  it('buildBookingPayload_SoftOptInNotice_SendsItsVersionOnlyWhenTheSiteHasOne', () => {
    expect(buildBookingPayload({ ...stay, draft, softOptInNoticeVersion: '2026-11' }).softOptInNoticeVersion).toBe('2026-11');
    for (const version of [null, undefined, '']) {
      expect(buildBookingPayload({ ...stay, draft, softOptInNoticeVersion: version })).not.toHaveProperty('softOptInNoticeVersion');
    }
    // A notice, not a consent: it travels with or without the boxes and ticks nothing.
    const withNotice = buildBookingPayload({ ...stay, draft, softOptInNoticeVersion: '2026-11' });
    expect(withNotice).not.toHaveProperty('marketingConsentEmail');
    expect(withNotice).not.toHaveProperty('marketingConsentWhatsApp');
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

  it('buildBookingPayload_GuestsTravelWithAPet_TellsTheHostFirstInTheRequests', () => {
    expect(buildBookingPayload({ ...stay, pets: true, draft }).specialRequests).toBe(PETS_NOTE);
    expect(buildBookingPayload({ ...stay, pets: true, draft: { ...draft, requests: '  Arrivo tardi  ' } }).specialRequests).toBe(`${PETS_NOTE}\nArrivo tardi`);
    // No pet, no note: the requests are only what the guest wrote.
    expect(buildBookingPayload({ ...stay, pets: false, draft: { ...draft, requests: 'Arrivo tardi' } }).specialRequests).toBe('Arrivo tardi');
    expect(buildBookingPayload({ ...stay, pets: false, draft })).not.toHaveProperty('specialRequests');
  });

  it('buildBookingPayload_PetAndVeryLongRequests_NeverCutsTheNoteAndStaysWithinTheLimit', () => {
    const payload = buildBookingPayload({ ...stay, pets: true, draft: { ...draft, requests: 'x'.repeat(SPECIAL_REQUESTS_MAX + 50) } });

    expect(payload.specialRequests).toHaveLength(SPECIAL_REQUESTS_MAX);
    expect(payload.specialRequests?.startsWith(PETS_NOTE)).toBe(true);
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
