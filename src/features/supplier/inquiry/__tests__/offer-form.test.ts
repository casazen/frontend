import { describe, expect, it } from 'vitest';
import type { SupplierOffer } from '@/types/supplier-inquiry';
import { emptyOfferForm, hoursOf, offerFormOf, offerPayloadOf, offerProblemsOf, type OfferForm } from '../offer-form';

/** A sheet filled in as a supplier would: two lines, a day in November (winter time in Rome, UTC+1), nine o'clock, an hour and a half. */
function filled(overrides: Partial<OfferForm['quote']> = {}, hours = '1,5'): OfferForm {
  const form = emptyOfferForm();
  return {
    quote: {
      ...form.quote,
      rows: [
        { key: 'a', label: ' Pulizia a fondo ', amount: '80' },
        { key: 'b', label: 'Prodotti', amount: '20,50' },
      ],
      note: '  Porto io i prodotti.  ',
      day: '2026-11-10',
      time: '09:00',
      ...overrides,
    },
    hours,
  };
}

describe('offerPayloadOf (SP-08e): what is sent is what the supplier wrote, in cents and in UTC', () => {
  it('offerPayloadOf_ValidSheet_SendsTheLinesInCentsTheTimeInUtcAndTheEndAfterTheHours', () => {
    const body = offerPayloadOf(filled());

    expect(body).toEqual({
      lines: [
        { label: 'Pulizia a fondo', quantity: 1, unitAmountCents: 8000 },
        { label: 'Prodotti', quantity: 1, unitAmountCents: 2050 },
      ],
      // 09:00 in Rome in November is 08:00 UTC; an hour and a half later is 09:30.
      startUtc: '2026-11-10T08:00:00.000Z',
      endUtc: '2026-11-10T09:30:00.000Z',
      note: 'Porto io i prodotti.',
    });
  });

  it('offerPayloadOf_NoNote_SendsNoNoteAndNoTotal', () => {
    const body = offerPayloadOf(filled({ note: '   ' }));

    expect(body).not.toHaveProperty('note');
    // The server adds the lines up: the total is never sent.
    expect(body).not.toHaveProperty('totalCents');
  });

  it('offerPayloadOf_ATimeThatIsMissingOrHoursThatAreNotAnumber_SendsNothing', () => {
    expect(offerPayloadOf(filled({ time: '' }))).toBeNull();
    expect(offerPayloadOf(filled({}, 'due ore'))).toBeNull();
  });
});

describe('offerProblemsOf (SP-08e)', () => {
  const NOW = Date.parse('2026-11-09T12:00:00.000Z');

  it('offerProblemsOf_ValidSheetInTheFuture_HasNoProblem', () => {
    expect(offerProblemsOf(filled(), NOW)).toMatchObject({ time: null, duration: null, valid: true });
  });

  it('offerProblemsOf_TimeMissingOrPast_IsTold', () => {
    expect(offerProblemsOf(filled({ day: '' }), NOW)).toMatchObject({ time: 'timeRequired', valid: false });
    // 09:00 Rome on the 9th is 08:00 UTC, before "now" (12:00 UTC).
    expect(offerProblemsOf(filled({ day: '2026-11-09' }), NOW)).toMatchObject({ time: 'timePast', valid: false });
  });

  it('offerProblemsOf_HoursOutsideAQuarterOfAnHourAndADay_AreRefused', () => {
    expect(offerProblemsOf(filled({}, ''), NOW).duration).toBe('durationRequired');
    expect(offerProblemsOf(filled({}, '0'), NOW).duration).toBe('durationInvalid');
    expect(offerProblemsOf(filled({}, '25'), NOW).duration).toBe('durationInvalid');
    expect(hoursOf('0,25')).toBe(0.25);
    expect(hoursOf('1,5')).toBe(1.5);
  });

  it('offerProblemsOf_AnEmptyLine_IsNotValid', () => {
    const form = filled();
    form.quote.rows = [{ key: 'a', label: '', amount: '' }];

    expect(offerProblemsOf(form, NOW).valid).toBe(false);
  });
});

describe('offerFormOf (SP-08e): replacing the offer that waits', () => {
  const offer: SupplierOffer = {
    sentAt: '2026-11-09T10:00:00.000Z',
    lines: [{ label: 'Ore di lavoro', quantity: 3, unitAmountCents: 1000, amountCents: 3000 }],
    totalCents: 3000,
    currency: 'EUR',
    note: 'Con i materiali.',
    startUtc: '2026-11-10T08:00:00.000Z',
    endUtc: '2026-11-10T10:00:00.000Z',
    validUntil: '2026-11-10T10:00:00.000Z',
  };

  it('offerFormOf_AnOfferWithAQuantity_FoldsItIntoTheAmountOfTheLineAndKeepsTheTotal', () => {
    const body = offerPayloadOf(offerFormOf(offer, ','));

    // Three hours at 10 euro: the sheet has one amount per line, so the new offer says 30 euro once. The total is the same.
    expect(body?.lines).toEqual([{ label: 'Ore di lavoro', quantity: 1, unitAmountCents: 3000 }]);
    expect(body?.startUtc).toBe('2026-11-10T08:00:00.000Z');
    expect(body?.endUtc).toBe('2026-11-10T10:00:00.000Z');
    expect(body?.note).toBe('Con i materiali.');
  });
});
