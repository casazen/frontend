import { describe, expect, it } from 'vitest';
import type { PublicBookingView } from '@/api/public-supplier-booking.api';
import { buildIcs } from '../calendar-ics';
import { icsEventOf, negotiationOf, normalizeCode, phaseOf, stageIndexOf } from '../request-view';

const none = { canCancel: false, canReschedule: false, canRespondToProposal: false, canRespondToQuote: false, canConfirmOk: false, canReportProblem: false, canWithdrawProblem: false };

const view: PublicBookingView = {
  publicCode: '7K2XM-9QD4T',
  status: 'PresoInCarico',
  service: { name: 'Pulizia profonda', slug: 'pulizia-profonda' },
  supplier: { name: 'Rossi Servizi', slug: 'rossi-servizi' },
  startUtc: '2026-11-13T08:00:00Z',
  endUtc: '2026-11-13T10:00:00Z',
  startLocal: '2026-11-13T09:00:00+01:00',
  endLocal: '2026-11-13T11:00:00+01:00',
  // Once the supplier took the request the customer's view carries the exact place: a calendar file must not.
  place: { city: 'Monza', postalCode: '20900', address: 'Via Roma 12', floor: 'Scala B, interno 7', accessNotes: 'Citofono Bianchi' },
  price: { currency: 'EUR', amountCents: 9000, basis: 'estimate', lines: [] },
  cancellationTerms: { freeUntilUtc: '2026-11-12T08:00:00Z', freeUntilLocal: '2026-11-12T09:00:00+01:00', isFree: true },
  actions: { ...none, canCancel: true },
};

describe('the customer request: where it is and what the calendar file carries', () => {
  it('phaseOf_EveryStatus_HasItsPhase', () => {
    expect(phaseOf({ ...view, status: 'Richiesto' })).toBe('waiting');
    expect(phaseOf(view)).toBe('taken');
    expect(phaseOf({ ...view, status: 'InCorso' })).toBe('inProgress');
    expect(phaseOf({ ...view, status: 'Completato' })).toBe('done');
    expect(phaseOf({ ...view, status: 'Pagato' })).toBe('paid');
    expect(phaseOf({ ...view, status: 'Rifiutato' })).toBe('refused');
    expect(phaseOf({ ...view, status: 'Annullato' })).toBe('cancelled');
    // A request on measure that is still new is a conversation; once its offer is taken it goes the way of every other request.
    expect(phaseOf({ ...view, status: 'Richiesto', kind: 'Custom' })).toBe('conversation');
    expect(phaseOf({ ...view, kind: 'Custom' })).toBe('taken');
  });

  it('phaseOf_ARequestOnMeasure_FollowsItsOffer', () => {
    const offer = {
      sentAt: '2026-11-10T08:00:00Z',
      lines: [{ label: 'Pulizia vetri', quantity: 2, unitAmountCents: 4500, amountCents: 9000 }],
      totalCents: 9000,
      currency: 'EUR',
      startUtc: '2026-11-13T08:00:00Z',
      endUtc: '2026-11-13T10:00:00Z',
      startLocal: '2026-11-13T09:00:00+01:00',
      endLocal: '2026-11-13T11:00:00+01:00',
      validUntil: '2026-11-11T08:00:00Z',
    };
    const open = { ...view, status: 'Richiesto' as const, kind: 'Custom' as const };

    expect(phaseOf({ ...open, offer, negotiation: 'OfferSent', actions: { ...none, canRespondToOffer: true } })).toBe('offer');
    // The card of the offer: the offer stands, the customer has accepted and the card is not through.
    expect(phaseOf({ ...open, offer, negotiation: 'AwaitingPayment', actions: { ...none, canRespondToOffer: true } })).toBe('cardPending');
    // An offer nobody can answer any more is not offered for an answer.
    expect(phaseOf({ ...open, offer, negotiation: 'OfferSent', actions: none })).toBe('offerLapsed');
    expect(phaseOf({ ...open, negotiation: 'OfferDeclined' })).toBe('conversation');
  });

  it('negotiationOf_AStateTheServerAddsLater_IsAConversation', () => {
    expect(negotiationOf({ ...view, negotiation: 'OfferSent' })).toBe('OfferSent');
    expect(negotiationOf({ ...view, negotiation: 'SomethingNew' })).toBe('InConversation');
    expect(negotiationOf(view)).toBe('InConversation');
  });

  it('phaseOf_AnOfferTheCustomerCanStillAnswer_IsTheOffer_AnExpiredOneIsWaiting', () => {
    const proposal = { startUtc: '2026-11-14T08:00:00Z', endUtc: '2026-11-14T10:00:00Z', startLocal: '', endLocal: '', proposedAt: '2026-11-10T08:00:00Z' };
    const quote = { sentAt: '2026-11-10T08:00:00Z', lines: [{ label: 'Lavoro', amountCents: 5000 }], totalCents: 5000 };

    expect(phaseOf({ ...view, status: 'Richiesto', proposal, actions: { ...none, canRespondToProposal: true } })).toBe('proposal');
    expect(phaseOf({ ...view, status: 'Richiesto', quote, actions: { ...none, canRespondToQuote: true } })).toBe('quote');
    expect(phaseOf({ ...view, status: 'Richiesto', proposal, actions: none })).toBe('waiting');
    expect(phaseOf({ ...view, status: 'Richiesto', quote, actions: none })).toBe('waiting');
  });

  it('stageIndexOf_RefusedOrCancelled_IsOutsideThePath', () => {
    expect(stageIndexOf('Richiesto')).toBe(0);
    expect(stageIndexOf('Pagato')).toBe(4);
    expect(stageIndexOf('Rifiutato')).toBe(-1);
    expect(stageIndexOf('Annullato')).toBe(-1);
  });

  it('normalizeCode_TypedOrPasted_IsTheCodeOfTheEmails', () => {
    expect(normalizeCode(' 7k2xm 9qd4t ')).toBe('7K2XM-9QD4T');
    expect(normalizeCode('7K2XM')).toBe('7K2XM');
    expect(normalizeCode('7K2XM-9QD4T-EXTRA')).toBe('7K2XM-9QD4T');
  });

  it('icsEventOf_ATakenRequest_CarriesTheComuneNeverTheStreetTheFloorOrTheAccessNotes', () => {
    const text = buildIcs(icsEventOf(view, { summary: 'Pulizia profonda · Rossi Servizi', description: 'Codice della richiesta: 7K2XM-9QD4T.' }), new Date('2026-11-10T09:00:00Z'));

    expect(text).toContain('LOCATION:Monza');
    expect(text).not.toContain('Via Roma');
    expect(text).not.toContain('Scala B');
    expect(text).not.toContain('Bianchi');
    expect(text).toContain('DTSTART:20261113T080000Z');
    expect(text).toContain('DTEND:20261113T100000Z');
    expect(text.endsWith('\r\n')).toBe(true);
  });

  it('buildIcs_ATextWithSpecialCharactersAndALongLine_IsEscapedAndFolded', () => {
    const long = 'Descrizione, con virgole; punto e virgola e a capo\ninterno '.repeat(6);
    const text = buildIcs({ uid: 'x@y', startUtc: '2026-11-13T08:00:00Z', endUtc: '2026-11-13T10:00:00Z', summary: 'A, B; C', location: 'Monza', description: long }, new Date('2026-11-10T09:00:00Z'));

    expect(text).toContain('SUMMARY:A\\, B\\; C');
    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('buildIcs_TimesThatAreNotDates_GivesNothing', () => {
    expect(buildIcs({ uid: 'x', startUtc: 'domani', endUtc: 'dopodomani', summary: 's', location: '', description: '' }, new Date())).toBe('');
  });
});
