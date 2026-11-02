import { describe, expect, it } from 'vitest';
import type { OutcomeView } from '@/features/public-booking/checkout-outcome';
import {
  buildNextSteps,
  calendarPlace,
  chipOf,
  confirmationVariant,
  formatStayRangeLong,
  stayTimes,
  ticketNote,
  type ConfirmationVariant,
} from '../confirmation-model';
import type { PublicPropertyDetailDto } from '@/types';

const immediate = { paymentOption: 'Immediate', deferredChargeDate: null } as const;
const onSite = { paymentOption: 'OnSite', deferredChargeDate: null } as const;
const deferred = { paymentOption: 'OnCancellationDeadline', deferredChargeDate: '2026-10-17' } as const;
const stayDays = { checkInDate: '2026-10-24', checkOutDate: '2026-10-27' } as const;

describe('confirmationVariant', () => {
  it.each<[OutcomeView, typeof immediate | typeof onSite | typeof deferred, ConfirmationVariant]>([
    ['confirmed', immediate, 'ok'],
    ['confirmed', onSite, 'ok'],
    ['confirmed', deferred, 'later'],
    ['awaitingEmail', onSite, 'email'],
    ['awaitingHost', onSite, 'wait'],
    ['processing', immediate, 'processing'],
    ['failed', immediate, 'pay'],
    ['awaitingPayment', deferred, 'pay'],
    ['expired', immediate, 'problem'],
    ['declined', onSite, 'problem'],
    ['datesUnavailable', immediate, 'problem'],
    ['cancelled', immediate, 'problem'],
  ])('confirmationVariant_%s_%j_Is%s', (view, payment, expected) => {
    expect(confirmationVariant(view, payment)).toBe(expected);
  });

  it('confirmationVariant_DeferredPaymentWithoutAChargeDay_IsAPlainConfirmedBooking', () => {
    expect(confirmationVariant('confirmed', { paymentOption: 'OnCancellationDeadline', deferredChargeDate: null })).toBe('ok');
  });
});

describe('chipOf and ticketNote', () => {
  it('chipOf_OnlyTheConfirmedViewSaysConfirmed', () => {
    const views: OutcomeView[] = ['processing', 'failed', 'awaitingPayment', 'awaitingEmail', 'awaitingHost', 'expired', 'declined', 'datesUnavailable', 'cancelled'];

    expect(chipOf('confirmed')).toEqual({ kind: 'confirmed', tone: 'ok' });
    for (const view of views) expect(chipOf(view).kind).not.toBe('confirmed');
  });

  it.each<[ConfirmationVariant, typeof immediate | typeof onSite | typeof deferred, string | null]>([
    ['ok', immediate, 'paid'],
    ['ok', onSite, 'onSite'],
    ['later', deferred, 'later'],
    ['email', onSite, 'request'],
    ['wait', onSite, 'request'],
    ['processing', immediate, 'processing'],
    ['pay', immediate, 'unpaid'],
    ['problem', immediate, null],
  ])('ticketNote_%s_%j_Is%s', (variant, payment, expected) => {
    expect(ticketNote(variant, payment)).toBe(expected);
  });
});

describe('buildNextSteps', () => {
  const ids = (steps: { id: string }[]) => steps.map((step) => step.id);
  const states = (steps: { state: string }[]) => steps.map((step) => step.state);

  it('buildNextSteps_ConfirmedStayInTheFuture_HasTheArrivalAsTheOneHappening', () => {
    const steps = buildNextSteps({ variant: 'ok', outcome: { ...stayDays, deferredChargeDate: null }, today: '2026-09-24' });

    expect(ids(steps)).toEqual(['confirmed', 'arrival', 'departure']);
    expect(states(steps)).toEqual(['done', 'current', 'todo']);
    expect(steps[1].date).toBe('2026-10-24');
    expect(steps[2].date).toBe('2026-10-27');
  });

  it('buildNextSteps_StayInProgress_HasTheDepartureAsTheOneHappening', () => {
    const steps = buildNextSteps({ variant: 'ok', outcome: { ...stayDays, deferredChargeDate: null }, today: '2026-10-25' });

    expect(states(steps)).toEqual(['done', 'done', 'current']);
  });

  it('buildNextSteps_StayOver_IsAllDone', () => {
    const steps = buildNextSteps({ variant: 'ok', outcome: { ...stayDays, deferredChargeDate: null }, today: '2026-11-02' });

    expect(states(steps)).toEqual(['done', 'done', 'done']);
  });

  it('buildNextSteps_ChargeOnADay_PutsTheChargeBeforeTheArrivalWithItsDay', () => {
    const steps = buildNextSteps({ variant: 'later', outcome: { ...stayDays, deferredChargeDate: '2026-10-17' }, today: '2026-09-24' });

    expect(ids(steps)).toEqual(['confirmed', 'charge', 'arrival', 'departure']);
    expect(states(steps)).toEqual(['done', 'current', 'todo', 'todo']);
    expect(steps[1].date).toBe('2026-10-17');
  });

  it('buildNextSteps_RequestWaitingForTheGuestEmail_StartsFromTheEmailAndPromisesNoTime', () => {
    const steps = buildNextSteps({ variant: 'email', outcome: { ...stayDays, deferredChargeDate: null }, today: '2026-09-24' });

    expect(ids(steps)).toEqual(['email', 'host', 'ifAccepted', 'arrival']);
    expect(states(steps)).toEqual(['current', 'todo', 'todo', 'todo']);
    // Only the arrival has a day of its own: the answer of the host is not given a made-up one (D24).
    expect(steps.filter((step) => step.date !== null).map((step) => step.id)).toEqual(['arrival']);
  });

  it('buildNextSteps_RequestWaitingForTheHost_HasTheEmailDoneAndNeverAConfirmedStep', () => {
    const steps = buildNextSteps({ variant: 'wait', outcome: { ...stayDays, deferredChargeDate: null }, today: '2026-09-24' });

    expect(states(steps)).toEqual(['done', 'current', 'todo', 'todo']);
    expect(ids(steps)).not.toContain('confirmed');
  });

  it.each<ConfirmationVariant>(['processing', 'pay', 'problem'])('buildNextSteps_%s_HasNoSteps', (variant) => {
    expect(buildNextSteps({ variant, outcome: { ...stayDays, deferredChargeDate: null }, today: '2026-09-24' })).toEqual([]);
  });

  it('buildNextSteps_OnlyAConfirmedBookingHasTheConfirmedStep', () => {
    const others: ConfirmationVariant[] = ['email', 'wait', 'processing', 'pay', 'problem'];

    for (const variant of others) {
      const steps = buildNextSteps({ variant, outcome: { ...stayDays, deferredChargeDate: null }, today: '2026-09-24' });
      expect(ids(steps)).not.toContain('confirmed');
    }
  });
});

describe('the house on the calendar', () => {
  const house = {
    city: 'Roma',
    postalCode: '00153',
    zone: { it: 'Trastevere, a due passi dal Tevere', en: 'Trastevere, steps from the Tiber' },
    checkInFrom: '15:00:00',
    checkOutBy: '10:00',
  } as unknown as PublicPropertyDetailDto;

  it('calendarPlace_ZoneWritten_IsTheZoneInTheLanguageOfTheGuest', () => {
    expect(calendarPlace(house, 'it')).toBe('Trastevere, a due passi dal Tevere');
    expect(calendarPlace(house, 'en')).toBe('Trastevere, steps from the Tiber');
  });

  it('calendarPlace_NoZone_IsTheCityAndNeverThePostalCode', () => {
    const place = calendarPlace({ ...house, zone: null } as PublicPropertyDetailDto, 'it');

    expect(place).toBe('Roma');
    expect(place).not.toContain('00153');
  });

  it('calendarPlace_HouseNotLoaded_IsEmpty', () => {
    expect(calendarPlace(undefined, 'it')).toBe('');
  });

  it('stayTimes_HoursOfTheHost_AreShortAndMissingOnesAreEmpty', () => {
    expect(stayTimes(house)).toEqual({ arrivalFrom: '15:00', departureBy: '10:00' });
    expect(stayTimes(undefined)).toEqual({ arrivalFrom: '', departureBy: '' });
  });

  it('formatStayRangeLong_SameMonth_NamesBothDaysAndTheMonthOnce', () => {
    const text = formatStayRangeLong('2026-10-24', '2026-10-27', 'it-IT');

    expect(text).toContain('24');
    expect(text).toContain('27');
    expect(text.match(/ottobre/g)).toHaveLength(1);
  });

  it('formatStayRangeLong_AcrossTwoYears_NamesTheYears', () => {
    const text = formatStayRangeLong('2026-12-30', '2027-01-03', 'it-IT');

    expect(text).toContain('2026');
    expect(text).toContain('2027');
  });

  it('formatStayRangeLong_BrokenDay_IsEmpty', () => {
    expect(formatStayRangeLong('', '2026-10-27', 'it-IT')).toBe('');
  });
});
