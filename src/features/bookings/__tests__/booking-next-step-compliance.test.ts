import { describe, expect, it } from 'vitest';
import type { Booking } from '@/types';
import type { ComplianceLine } from '@/features/compliance/lib/compliance-lines';
import { claimsAllInOrder, nextStepOf } from '../lib/booking-next-step';

type Facts = Pick<Booking, 'status' | 'source' | 'onSiteRequestState' | 'checkInDate' | 'checkOutDate'>;

const confirmed = {
  status: 'Confirmed',
  source: 'Direct',
  onSiteRequestState: null,
  checkInDate: '2099-01-10T00:00:00Z',
  checkOutDate: '2099-01-12T00:00:00Z',
} as unknown as Facts;
const checkedIn = { ...confirmed, status: 'CheckedIn' } as Facts;
const checkedOut = { ...confirmed, status: 'CheckedOut' } as Facts;
const TODAY = '2099-01-11';

const line = (state: ComplianceLine['state'], action: ComplianceLine['action'] = 'UploadAlloggiatiReceipt', dueAt: string | null = null): ComplianceLine => ({
  id: `${action}-b1`,
  action,
  state,
  reason: null,
  period: null,
  dueAt,
  item: { id: 'b1', label: 'Mario Rossi', action, propertyId: null, bookingId: 'b1', light: state === 'green' ? 'Green' : state === 'yellow' ? 'Yellow' : 'Red' },
});

describe('nextStepOf with the compliance lights of the stay (NF-52, AC-NF52-9)', () => {
  it('nextStepOf_NoLines_IsTheStepOfAlways', () => {
    // An older API, the traffic light off, a stay the summary does not list: nothing changes, and nothing is told as in order.
    expect(nextStepOf(checkedOut, TODAY, { alloggiati: { status: 'Inviato' as never, isOverdue: false } }).kind).toBe('completed');
    expect(nextStepOf(checkedOut, TODAY, { compliance: [] }).kind).toBe('completed');
    expect(nextStepOf(checkedOut, TODAY, { compliance: undefined }).kind).toBe('completed');
  });

  it('nextStepOf_AStayThatIsOverWithARedItem_IsTheItemNotTheConclusion', () => {
    const red = line('red');
    const step = nextStepOf(checkedOut, TODAY, { compliance: [red, line('green', 'VerifyIdentity')] });

    expect(step).toEqual({ kind: 'compliance', tone: 'warning', line: red });
  });

  it('nextStepOf_RedItemWhoseDeadlineHasPassed_IsRedAsTheDeadline', () => {
    const late = line('red', 'UploadAlloggiatiReceipt', '2099-01-09T10:00:00Z');

    expect(nextStepOf(checkedOut, TODAY, { compliance: [late] }).tone).toBe('danger');
    // The day itself is not late yet.
    expect(nextStepOf(checkedOut, TODAY, { compliance: [line('red', 'UploadAlloggiatiReceipt', '2099-01-11T10:00:00Z')] }).tone).toBe('warning');
  });

  it('nextStepOf_ItemInHand_IsBlueAndStillTheStepWhenNothingElseIsAsked', () => {
    const yellow = line('yellow');

    expect(nextStepOf(checkedOut, TODAY, { compliance: [yellow] })).toEqual({ kind: 'compliance', tone: 'info', line: yellow });
    expect(nextStepOf(confirmed, '2098-12-01', { checkIn: { status: 'Completo', canIssueLink: false }, guestData: { complete: true }, compliance: [yellow] }).kind).toBe('compliance');
  });

  it('nextStepOf_OnlyWhatIsInOrder_IsTheStepOfAlwaysAndNeverTheLightsClaimAnything', () => {
    expect(nextStepOf(checkedOut, TODAY, { compliance: [line('green')] }).kind).toBe('completed');
  });

  it('nextStepOf_AStepThatAsksSomething_KeepsItWhateverTheLightsSay', () => {
    const red = line('red');

    // The answer owed, the arrival, the documents and the departure are the host's first: a light never takes them.
    expect(nextStepOf({ ...confirmed, status: 'Pending', source: 'Manual' } as Facts, TODAY, { compliance: [red] }).kind).toBe('confirmManual');
    expect(nextStepOf(confirmed, '2099-01-10', { compliance: [red] }).kind).toBe('registerArrival');
    expect(nextStepOf(confirmed, '2098-12-01', { checkIn: { status: null, canIssueLink: true }, compliance: [red] }).kind).toBe('sendLink');
    expect(nextStepOf(checkedIn, '2099-01-12', { compliance: [red] }).kind).toBe('registerDeparture');
    expect(nextStepOf(checkedIn, TODAY, { alloggiati: { status: 'DaInviareManualmente', isOverdue: false }, compliance: [red] }).kind).toBe('sendAlloggiati');
    expect(nextStepOf({ ...confirmed, status: 'Cancelled' } as Facts, TODAY, { compliance: [red] }).kind).toBe('cancelled');
  });

  it('nextStepOf_StayInProgressWithARedItem_IsTheItem', () => {
    expect(nextStepOf(checkedIn, TODAY, { compliance: [line('red', 'SendAlloggiatiManually')] }).kind).toBe('compliance');
  });

  it('claimsAllInOrder_OnlyTheStepsThatSayItAreTheOnesTheLightsCanTakeBack', () => {
    expect(claimsAllInOrder({ kind: 'allInOrder' })).toBe(true);
    expect(claimsAllInOrder({ kind: 'completed' })).toBe(true);
    expect(claimsAllInOrder({ kind: 'stayInProgress' })).toBe(false);
    expect(claimsAllInOrder({ kind: 'sendAlloggiati' })).toBe(false);
    expect(claimsAllInOrder({ kind: 'compliance' })).toBe(false);
  });
});
