import { afterEach, describe, expect, it } from 'vitest';
import { BOOKING_DRAFT_TTL_MS, clearBookingDraft, readBookingDraft, startingDraft, writeBookingDraft } from '../booking-draft';
import { EMPTY_DRAFT, type BookingDraft } from '../booking-flow';

const NOW = Date.UTC(2026, 10, 3, 9, 0, 0);

const typed: BookingDraft = {
  ...EMPTY_DRAFT,
  service: 'pulizia-standard',
  options: { 'bagno-extra': 2 },
  startUtc: '2026-11-05T08:00:00.000Z',
  address: 'Via Roma 1',
  fullName: 'Anna Rossi',
  email: 'anna@example.test',
};

afterEach(() => window.localStorage.clear());

describe('the draft of a booking on the device (privacy)', () => {
  it('writeThenRead_SameSupplier_GivesBackWhatWasTyped', () => {
    writeBookingDraft('rossi', typed, NOW);

    expect(readBookingDraft('rossi', NOW + 1000)).toEqual(typed);
  });

  it('readBookingDraft_AnotherSupplier_NeverSeesIt', () => {
    writeBookingDraft('rossi', typed, NOW);

    expect(readBookingDraft('bianchi', NOW)).toBeNull();
  });

  it('readBookingDraft_AfterTheTimeToLive_IsGoneAndRemoved', () => {
    writeBookingDraft('rossi', typed, NOW);

    expect(readBookingDraft('rossi', NOW + BOOKING_DRAFT_TTL_MS + 1)).toBeNull();
    expect(window.localStorage.getItem('casazen.supplier-booking.rossi')).toBeNull();
  });

  it('readBookingDraft_AFileWithConsentOrPasswordInIt_BringsNeitherBack', () => {
    // Whatever else a stored file carries (an old version, a hand edit), only the members of the draft are read back.
    window.localStorage.setItem(
      'casazen.supplier-booking.rossi',
      JSON.stringify({ v: 1, savedAt: NOW, draft: { ...typed, privacyAccepted: true, consent: true, password: 'secret', privacyNoticeVersion: 'v1' } }),
    );

    const read = readBookingDraft('rossi', NOW);

    expect(read).not.toBeNull();
    expect(Object.keys(read ?? {})).not.toContain('privacyAccepted');
    expect(Object.keys(read ?? {})).not.toContain('privacyNoticeVersion');
    expect(Object.keys(read ?? {})).not.toContain('consent');
    expect(Object.keys(read ?? {})).not.toContain('password');
    expect(JSON.stringify(read)).not.toContain('secret');
  });

  it('readBookingDraft_NotAJsonFile_IsNull', () => {
    window.localStorage.setItem('casazen.supplier-booking.rossi', '{not json');

    expect(readBookingDraft('rossi', NOW)).toBeNull();
  });

  it('clearBookingDraft_AfterTheBookingIsSent_LeavesNothing', () => {
    writeBookingDraft('rossi', typed, NOW);

    clearBookingDraft('rossi');

    expect(readBookingDraft('rossi', NOW)).toBeNull();
  });

  it('startingDraft_TheAddressNamesAnotherService_LeavesTheOldChoicesBehind', () => {
    writeBookingDraft('rossi', typed, Date.now());

    const draft = startingDraft('rossi', { service: 'giardino' });

    expect(draft.service).toBe('giardino');
    expect(draft.options).toEqual({});
    expect(draft.startUtc).toBeNull();
    // What the person typed about itself stays.
    expect(draft.fullName).toBe('Anna Rossi');
  });
});
