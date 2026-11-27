import { describe, expect, it } from 'vitest';
import type { Booking } from '@/types';
import { nextStepOf } from '../lib/booking-next-step';
import { checkInWizardPath } from '../lib/stay-actions';

/** A confirmed stay that has not started: the arrival is on the 10th of January 2099. */
const stay = {
  status: 'Confirmed',
  source: 'Direct',
  onSiteRequestState: null,
  checkInDate: '2099-01-10T00:00:00Z',
  checkOutDate: '2099-01-12T00:00:00Z',
} as unknown as Pick<Booking, 'status' | 'source' | 'onSiteRequestState' | 'checkInDate' | 'checkOutDate'>;

const TODAY = '2098-12-01';

describe('nextStepOf with the guest data of the stay (NF-40)', () => {
  it('nextStepOf_GuestDoneWithTheLinkButTheDataAreIncomplete_LeadsTheHostToTheWizard', () => {
    const step = nextStepOf(stay, TODAY, {
      checkIn: { status: 'Completo', canIssueLink: false },
      guestData: { complete: false },
    });

    expect(step).toEqual({ kind: 'completeGuestData', tone: 'warning' });
  });

  it('nextStepOf_DataComplete_IsAllInOrder', () => {
    const step = nextStepOf(stay, TODAY, {
      checkIn: { status: 'Completo', canIssueLink: false },
      guestData: { complete: true },
    });

    expect(step.kind).toBe('allInOrder');
  });

  it('nextStepOf_DataNotRead_NeverInventsATask', () => {
    expect(nextStepOf(stay, TODAY, { checkIn: { status: 'Completo', canIssueLink: false } }).kind).toBe('allInOrder');
    expect(nextStepOf(stay, TODAY).kind).toBe('allInOrder');
  });

  it('nextStepOf_LinkStillToSendOrAnswer_KeepsTheLinkStepFirst', () => {
    const incomplete = { guestData: { complete: false } };

    expect(nextStepOf(stay, TODAY, { ...incomplete, checkIn: { status: null, canIssueLink: true } }).kind).toBe('sendLink');
    expect(nextStepOf(stay, TODAY, { ...incomplete, checkIn: { status: 'Scaduto', canIssueLink: true } }).kind).toBe('resendLink');
    expect(nextStepOf(stay, TODAY, { ...incomplete, checkIn: { status: 'InCompilazione', canIssueLink: true } }).kind).toBe('waitingDocuments');
  });

  it('nextStepOf_ArrivalDayAndIncompleteData_StillRegistersTheArrivalFirst', () => {
    expect(nextStepOf(stay, '2099-01-10', { guestData: { complete: false } }).kind).toBe('registerArrival');
  });

  it('checkInWizardPath_IsTheCheckInPageOfTheBooking', () => {
    expect(checkInWizardPath('abc')).toBe('/app/short-rent/bookings/abc/check-in');
  });
});
