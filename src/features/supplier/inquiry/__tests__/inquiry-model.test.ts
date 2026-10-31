import { describe, expect, it } from 'vitest';
import type { SupplierOffer } from '@/types/supplier-inquiry';
import { isInquiry, isOpenInquiry, minutesLeft, negotiationViewOf, offerAsQuote, respondByLine } from '../inquiry-model';

const t = (key: string, options?: Record<string, unknown>) => `${key}|${JSON.stringify(options ?? {})}`;

describe('respondByLine (SP-08e): the time left is the server\'s deadline, never a number of the frontend', () => {
  // 14:30 in Rome in November (winter time, UTC+1).
  const due = '2026-11-09T13:30:00.000Z';

  it('respondByLine_ADeadlineToday_SaysUntilWhenAndHowLong', () => {
    const line = respondByLine(due, Date.parse('2026-11-09T12:48:00.000Z'), 'it', t);

    expect(line).toBe('supplier.requests.respondByToday|{"time":"14:30"} · supplier.inquiry.now.leftMinutes|{"count":42}');
  });

  it('respondByLine_MoreThanTwoHours_SaysHours', () => {
    expect(respondByLine(due, Date.parse('2026-11-09T09:00:00.000Z'), 'it', t)).toContain('supplier.inquiry.now.leftHours|{"count":4}');
  });

  it('respondByLine_APastDeadline_SaysOnlyThatTheTimeIsOver', () => {
    expect(respondByLine(due, Date.parse('2026-11-09T13:30:01.000Z'), 'it', t)).toBe('supplier.inquiry.now.timeOver|{}');
  });

  it('minutesLeft_RoundsUp_AndIsNullForADateThatIsNotOne', () => {
    expect(minutesLeft(due, Date.parse('2026-11-09T13:28:30.000Z'))).toBe(2);
    expect(minutesLeft('not a date', 0)).toBeNull();
  });
});

describe('the negotiation of a request on measure (SP-08e)', () => {
  it('negotiationViewOf_AStateThisVersionDoesNotKnow_IsTheConversationGoingOn', () => {
    expect(negotiationViewOf('AwaitingSupplier')).toBe('awaiting');
    expect(negotiationViewOf('OfferSent')).toBe('offerSent');
    expect(negotiationViewOf('OfferDeclined')).toBe('offerDeclined');
    expect(negotiationViewOf('SomethingNew')).toBe('conversation');
    expect(negotiationViewOf(undefined)).toBe('conversation');
  });

  it('isOpenInquiry_OnlyARequestOnMeasureThatIsStillBeingNegotiated', () => {
    expect(isInquiry({ kind: 'Custom' })).toBe(true);
    expect(isInquiry({ kind: 'Standard' })).toBe(false);
    expect(isInquiry({})).toBe(false);
    expect(isOpenInquiry({ kind: 'Custom', phase: 'to_answer', status: 'Richiesto' })).toBe(true);
    // The offer waits for the customer: the server's phase is the one of a quote.
    expect(isOpenInquiry({ kind: 'Custom', phase: 'quote_pending', status: 'Richiesto' })).toBe(true);
    // Accepted: it is a job like the others.
    expect(isOpenInquiry({ kind: 'Custom', phase: 'scheduled', status: 'PresoInCarico' })).toBe(false);
    // A host's request is never taken for one.
    expect(isOpenInquiry({ kind: 'Standard', phase: 'to_answer', status: 'Richiesto' })).toBe(false);
  });
});

describe('offerAsQuote (SP-08e, SP-D30: the offer is shown with the summary of the quote)', () => {
  const offer: SupplierOffer = {
    sentAt: '2026-11-09T10:00:00.000Z',
    lines: [
      { label: 'Pulizia', quantity: 1, unitAmountCents: 8000, amountCents: 8000 },
      { label: 'Ore in più', quantity: 3, unitAmountCents: 1500, amountCents: 4500 },
    ],
    totalCents: 12500,
    currency: 'EUR',
    note: null,
    startUtc: '2026-11-10T08:00:00.000Z',
    endUtc: '2026-11-10T10:00:00.000Z',
    validUntil: '2026-11-10T10:00:00.000Z',
  };

  it('offerAsQuote_KeepsTheTotalOfTheServerAndSaysHowManyOfAThing', () => {
    const quote = offerAsQuote(offer, (cents) => `${cents / 100} €`);

    // The total is the one the server added up; the frontend adds nothing.
    expect(quote.totalCents).toBe(12500);
    expect(quote.lines).toEqual([
      { label: 'Pulizia', amountCents: 8000 },
      { label: 'Ore in più (3 × 15 €)', amountCents: 4500 },
    ]);
    expect(quote.scheduledStart).toBe(offer.startUtc);
    expect(quote.answerBy).toBe(offer.validUntil);
  });
});
