import { describe, expect, it } from 'vitest';
import type { ComplianceCockpitAction, ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';
import { hasLinesToShow, pendingLines, propertyLinesOf, stayLinesOf, viewOfLines, type ComplianceLine } from '../lib/compliance-lines';

const empty = { count: 0, items: [] };
const summaryOf = (parts: Partial<ComplianceSummaryResult>): ComplianceSummaryResult => ({
  propertiesPending: empty,
  guestCheckInsIncomplete: empty,
  checkoutsDue: empty,
  alloggiatiFailures: empty,
  alloggiatiManualRequired: empty,
  turnoversPending: empty,
  ...parts,
});

const stay = (action: ComplianceCockpitAction, bookingId: string, light: ComplianceSummaryItem['light'], extra: Partial<ComplianceSummaryItem> = {}): ComplianceSummaryItem => ({
  id: bookingId,
  label: 'Mario Rossi',
  action,
  propertyId: null,
  bookingId,
  light,
  reason: 'awaiting_receipt',
  ...extra,
});
const ofProperty = (action: ComplianceCockpitAction, propertyId: string, light: ComplianceSummaryItem['light'], extra: Partial<ComplianceSummaryItem> = {}): ComplianceSummaryItem => ({
  id: propertyId,
  label: 'Casa Como',
  action,
  propertyId,
  bookingId: null,
  light,
  ...extra,
});
const section = (...items: ComplianceSummaryItem[]) => ({ count: items.length, items });
const states = (lines: readonly ComplianceLine[]) => lines.map((line) => `${line.action}:${line.state}`);

describe('stayLinesOf (the lights of one stay, NF-52 AC-NF52-9)', () => {
  it('stayLinesOf_ItemsOfTheStay_AreTheIdentityTheCommunicationAndTheReceiptWorstFirst', () => {
    const lines = stayLinesOf(
      summaryOf({
        identityPending: section(stay('VerifyIdentity', 'b1', 'Green')),
        receiptsToUpload: section(stay('UploadAlloggiatiReceipt', 'b1', 'Yellow')),
        manualSendsRequired: section(stay('SendAlloggiatiManually', 'b1', 'Red')),
      }),
      'b1',
    );

    expect(states(lines)).toEqual(['SendAlloggiatiManually:red', 'UploadAlloggiatiReceipt:yellow', 'VerifyIdentity:green']);
  });

  it('stayLinesOf_OtherStaysAndOtherActions_AreNotLines', () => {
    const lines = stayLinesOf(
      summaryOf({
        identityPending: section(stay('VerifyIdentity', 'b2', 'Red')),
        // The guest data, the departure and the turnover have their own steps.
        guestCheckInsIncomplete: section(stay('CompleteGuestCheckIn', 'b1', 'Red')),
        checkoutsDue: section(stay('CheckOut', 'b1', 'Red')),
        turnoversPending: section(stay('ConfirmPropertyReady', 'b1', 'Red')),
        alloggiatiManualRequired: section(stay('SendAlloggiati', 'b1', 'Red')),
        alloggiatiFailures: section(stay('ResolveAlloggiatiFailure', 'b1', 'Yellow')),
      }),
      'b1',
    );

    expect(states(lines)).toEqual(['SendAlloggiati:red', 'ResolveAlloggiatiFailure:yellow']);
  });

  it('stayLinesOf_NoLightOrALightThisVersionDoesNotKnow_IsNotALineNeverGreen', () => {
    const lines = stayLinesOf(
      summaryOf({
        receiptsToUpload: section(stay('UploadAlloggiatiReceipt', 'b1', undefined), stay('UploadAlloggiatiReceipt', 'b1', 'Blue' as never, { id: 'x' })),
        manualSendsRequired: section(stay('SendAlloggiatiManually', 'b1', null)),
      }),
      'b1',
    );

    expect(lines).toEqual([]);
  });

  it('stayLinesOf_TheSameItemInTwoSections_IsOneLine', () => {
    const item = stay('SendAlloggiatiManually', 'b1', 'Red');
    const lines = stayLinesOf(summaryOf({ manualSendsRequired: section(item), receiptsToUpload: section({ ...item }) }), 'b1');

    expect(lines).toHaveLength(1);
  });

  it('stayLinesOf_SameLightTheNearestDeadlineFirst', () => {
    const lines = stayLinesOf(
      summaryOf({
        receiptsToUpload: section(stay('UploadAlloggiatiReceipt', 'b1', 'Red', { dueAt: '2026-09-30T10:00:00Z' })),
        manualSendsRequired: section(stay('SendAlloggiatiManually', 'b1', 'Red', { dueAt: '2026-09-20T10:00:00Z' })),
      }),
      'b1',
    );

    expect(states(lines)).toEqual(['SendAlloggiatiManually:red', 'UploadAlloggiatiReceipt:red']);
  });

  it.each([undefined, null, {}, '<!doctype html>' as never])('stayLinesOf_PartialOrOddPayload_%j_IsEmpty', (payload) => {
    expect(stayLinesOf(payload, 'b1')).toEqual([]);
  });

  it('stayLinesOf_NoBooking_IsEmpty', () => {
    expect(stayLinesOf(summaryOf({ identityPending: section(stay('VerifyIdentity', '', 'Red')) }), '')).toEqual([]);
  });

  it('stayLinesOf_ReasonAndDeadline_AreTheOnesOfTheApi', () => {
    const [line] = stayLinesOf(summaryOf({ receiptsToUpload: section(stay('UploadAlloggiatiReceipt', 'b1', 'Yellow', { reason: 'entrusted_to_channel_manager', dueAt: '2026-09-20T10:00:00Z' })) }), 'b1');

    expect(line).toMatchObject({ state: 'yellow', reason: 'entrusted_to_channel_manager', dueAt: '2026-09-20T10:00:00Z', period: null });
  });
});

describe('propertyLinesOf (the lights of one property)', () => {
  it('propertyLinesOf_ItemsOfTheProperty_AreTheConnectionTheRateAndEveryMonth', () => {
    const lines = propertyLinesOf(
      summaryOf({
        connectionsToFix: section(ofProperty('ActivateOctorateSend', 'p1', 'Red'), ofProperty('RenewPoliceCredentials', 'p1', 'Green')),
        periodItems: section(
          ofProperty('UploadIstatProof', 'p1', 'Yellow', { period: '2026-08' }),
          ofProperty('UploadIstatProof', 'p1', 'Green', { period: '2026-07' }),
          ofProperty('DeclareTouristTax', 'p1', 'Red', { period: '2026-08' }),
          ofProperty('EnterMunicipalityTaxRate', 'p1', 'Red'),
        ),
      }),
      'p1',
    );

    expect(states(lines)).toEqual([
      'ActivateOctorateSend:red',
      'EnterMunicipalityTaxRate:red',
      'DeclareTouristTax:red',
      'UploadIstatProof:yellow',
      'RenewPoliceCredentials:green',
      'UploadIstatProof:green',
    ]);
    // Two months of the same action are two lines.
    expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
  });

  it('propertyLinesOf_OtherPropertiesAndTheActivation_AreNotLines', () => {
    const lines = propertyLinesOf(
      summaryOf({
        propertiesPending: section(ofProperty('ActivateProperty', 'p1', 'Red')),
        connectionsToFix: section(ofProperty('ActivateOctorateSend', 'p2', 'Red')),
      }),
      'p1',
    );

    expect(lines).toEqual([]);
  });
});

describe('viewOfLines (what a card lists)', () => {
  const line = (id: string, state: ComplianceLine['state']): ComplianceLine => ({
    id,
    action: 'UploadIstatProof',
    state,
    reason: null,
    period: null,
    dueAt: null,
    item: ofProperty('UploadIstatProof', 'p1', state === 'green' ? 'Green' : state === 'yellow' ? 'Yellow' : 'Red'),
  });

  it('viewOfLines_SomethingToDo_ListsAtMostThreeAndCountsTheRest', () => {
    const view = viewOfLines([line('a', 'red'), line('b', 'red'), line('c', 'yellow'), line('d', 'yellow'), line('e', 'red')]);

    expect(view.shown.map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect(view.hidden).toBe(2);
    // What is in order is noise next to something to do.
    expect(view.inOrder).toEqual([]);
  });

  it('viewOfLines_TheLineOfTheBlockItself_IsNotListedAgain', () => {
    const view = viewOfLines([line('a', 'red'), line('b', 'yellow')], { skip: 'a' });

    expect(view.shown.map((l) => l.id)).toEqual(['b']);
    expect(view.hidden).toBe(0);
  });

  it('viewOfLines_OnlyTheLineOfTheBlock_HasNothingMoreToSay', () => {
    const view = viewOfLines([line('a', 'red'), line('g', 'green')], { skip: 'a' });

    // The green one is not listed next to a red one, even when the red one is the block.
    expect(hasLinesToShow(view)).toBe(false);
  });

  it('viewOfLines_NothingToDo_ListsWhatIsInOrder', () => {
    const view = viewOfLines([line('g1', 'green'), line('g2', 'green')]);

    expect(view.shown).toEqual([]);
    expect(view.inOrder.map((l) => l.id)).toEqual(['g1', 'g2']);
    expect(hasLinesToShow(view)).toBe(true);
  });

  it('viewOfLines_NoLines_HasNothingToSayNeverAllInOrder', () => {
    expect(hasLinesToShow(viewOfLines([]))).toBe(false);
  });

  it('pendingLines_AreEverythingButWhatIsInOrder', () => {
    expect(pendingLines([line('a', 'red'), line('b', 'yellow'), line('c', 'green')]).map((l) => l.id)).toEqual(['a', 'b']);
  });
});
