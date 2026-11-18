import { AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { invitationDestination } from '../host-invite-path';
import { guidedDemoAdapter, readGuidedFixture } from './adapter';
import { sampleBooking, sampleFlat, sampleLease, sampleVilla } from './scenario';

const day = '2028-02-29';

describe('guided tour reads', () => {
  it('resolves the same incomplete arrival from the home and the booking detail across a month boundary', () => {
    const booking = sampleBooking(day);
    expect(readGuidedFixture('/dashboard/today', 'short-stay', day)).toMatchObject({
      today: day, arrivals: { count: 1, items: [{ bookingId: booking.id, propertyId: sampleVilla.id,
        checkInDate: day, checkOutDate: '2028-03-02', checkIn: { state: 'InProgress', dataComplete: false } }] },
    });
    expect(readGuidedFixture(`/bookings/${booking.id}`, 'short-stay', day)).toEqual(booking);
    expect(readGuidedFixture(`/bookings/${booking.id}/checkin-session`, 'short-stay', day))
      .toMatchObject({ status: 'InCompilazione', canIssueLink: false });
  });

  it('keeps host areas separate and identifies the lease of the long-rent property', () => {
    expect(readGuidedFixture('/dashboard/today', 'long-term', day)).toBeUndefined();
    expect(readGuidedFixture('/leases', 'short-stay', day)).toBeUndefined();
    expect(readGuidedFixture('/dashboard/today', 'supplier', day)).toBeUndefined();
    expect(readGuidedFixture('/leases', 'long-term', day)).toEqual([sampleLease(day)]);
    expect(readGuidedFixture('/properties', 'dual', day, { mode: 'long' })).toEqual([sampleFlat]);
  });

  it('rejects unknown reads and every write locally', async () => {
    const headers = new AxiosHeaders();
    await expect(guidedDemoAdapter({ url: '/missing', method: 'get', headers })).rejects.toMatchObject({ response: { status: 404 } });
    await expect(guidedDemoAdapter({ url: '/bookings', method: 'post', headers })).rejects.toMatchObject({ response: { status: 405 } });
  });
});

describe('invitation from the public example', () => {
  const allowed = ['https://app.example.test'];
  it('opens the existing invitation handler without forwarding query parameters', () => {
    expect(invitationDestination('https://app.example.test/invito-host/example-token?utm_source=test', allowed))
      .toBe('https://app.example.test/invito-host/example-token');
  });
  it.each(['https://other.example.test/invito-host/example-token', 'https://app.example.test/signup',
    'https://app.example.test/invito-host/short', 'https://app.example.test/invito-host/some%2Fother%2Fpath'])(
    'refuses an unrelated domain, route or malformed invitation (%s)', input => {
    expect(invitationDestination(input, allowed)).toBeNull();
  });
});
