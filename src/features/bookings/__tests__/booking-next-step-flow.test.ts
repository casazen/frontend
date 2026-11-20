import { describe, expect, it } from 'vitest';
import type { Booking } from '@/types';
import { nextStepOf, type FlowFacts } from '../lib/booking-next-step';

type Stay = Pick<Booking, 'status' | 'source' | 'onSiteRequestState' | 'checkInDate' | 'checkOutDate'>;

/** A stay from the 10th to the 12th of January 2099. */
function stay(status: Booking['status']): Stay {
  return {
    status,
    source: 'Direct',
    onSiteRequestState: null,
    checkInDate: '2099-01-10T00:00:00Z',
    checkOutDate: '2099-01-12T00:00:00Z',
  } as unknown as Stay;
}

const AUTOMATIC: FlowFacts = { sendsLink: true, registersArrival: true, registersDeparture: true };
const MANUAL: FlowFacts = { sendsLink: false, registersArrival: false, registersDeparture: false };
const NO_LINK_YET = { status: null, canIssueLink: true };

describe('nextStepOf with the booking flow of the organization (casazen/backend#978)', () => {
  it('nextStepOf_LinkSentByCasaZen_IsNotTheHostsTask', () => {
    expect(nextStepOf(stay('Confirmed'), '2099-01-01', { checkIn: NO_LINK_YET, flow: AUTOMATIC })).toEqual({ kind: 'linkScheduled', tone: 'info' });
  });

  it('nextStepOf_LinkSentByTheHost_AsksTheHostToSendIt', () => {
    expect(nextStepOf(stay('Confirmed'), '2099-01-01', { checkIn: NO_LINK_YET, flow: MANUAL }).kind).toBe('sendLink');
  });

  it('nextStepOf_FlowNotRead_StepIsTheHostsAsBefore', () => {
    expect(nextStepOf(stay('Confirmed'), '2099-01-01', { checkIn: NO_LINK_YET }).kind).toBe('sendLink');
    expect(nextStepOf(stay('Confirmed'), '2099-01-10').kind).toBe('registerArrival');
  });

  it('nextStepOf_ArrivalDayWithAutomaticArrival_SaysCasaZenRegistersIt', () => {
    expect(nextStepOf(stay('Confirmed'), '2099-01-10', { flow: AUTOMATIC }).kind).toBe('arrivalAutomatic');
    expect(nextStepOf(stay('Confirmed'), '2099-01-10', { flow: MANUAL }).kind).toBe('registerArrival');
  });

  it('nextStepOf_DepartureDayWithAutomaticDeparture_SaysCasaZenRegistersIt', () => {
    expect(nextStepOf(stay('CheckedIn'), '2099-01-12', { flow: AUTOMATIC }).kind).toBe('departureAutomatic');
    expect(nextStepOf(stay('CheckedIn'), '2099-01-12', { flow: MANUAL }).kind).toBe('registerDeparture');
  });

  it('nextStepOf_ConfirmedOnTheDepartureDayWithBothAutomatic_ClosesByItself', () => {
    expect(nextStepOf(stay('Confirmed'), '2099-01-12', { flow: AUTOMATIC }).kind).toBe('departureAutomatic');
  });
});
