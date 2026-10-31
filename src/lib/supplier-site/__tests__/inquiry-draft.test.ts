import { afterEach, describe, expect, it } from 'vitest';
import { INQUIRY_DRAFT_TTL_MS, readInquiryDraft, startingInquiryDraft, writeInquiryDraft } from '../inquiry-draft';
import { EMPTY_INQUIRY_DRAFT, type InquiryDraft } from '../inquiry-flow';

const NOW = Date.UTC(2026, 10, 3, 9, 0, 0);

const typed: InquiryDraft = {
  ...EMPTY_INQUIRY_DRAFT,
  service: 'pulizia-standard',
  comune: { istatCode: '015146', name: 'Milano', provinceCode: 'MI' },
  message: 'Pulizia dopo la ristrutturazione di un bilocale.',
  fullName: 'Anna Rossi',
  email: 'anna@example.test',
  phone: '+39 333 1234567',
};

afterEach(() => window.localStorage.clear());

describe('the draft of a request on measure on the device (privacy)', () => {
  it('writeThenRead_SameSupplier_GivesBackWhatWasTyped', () => {
    writeInquiryDraft('rossi', typed, NOW);

    expect(readInquiryDraft('rossi', NOW + 1000)).toEqual(typed);
  });

  it('readInquiryDraft_AnotherSupplier_NeverSeesIt', () => {
    writeInquiryDraft('rossi', typed, NOW);

    expect(readInquiryDraft('bianchi', NOW)).toBeNull();
  });

  it('readInquiryDraft_AfterTheTimeToLive_IsGoneAndRemoved', () => {
    writeInquiryDraft('rossi', typed, NOW);

    expect(readInquiryDraft('rossi', NOW + INQUIRY_DRAFT_TTL_MS + 1)).toBeNull();
    expect(window.localStorage.getItem('casazen.supplier-inquiry.rossi')).toBeNull();
  });

  it('readInquiryDraft_AFileWithTheConsentInIt_NeverBringsItBack', () => {
    // Whatever else a stored file carries (an old version, a hand edit), only the members of the draft are read back: the consent is asked every time.
    window.localStorage.setItem(
      'casazen.supplier-inquiry.rossi',
      JSON.stringify({ v: 1, savedAt: NOW, draft: { ...typed, privacyAccepted: true, consent: true, privacyNoticeVersion: 'v1', website: 'robot' } }),
    );

    const read = readInquiryDraft('rossi', NOW);

    expect(read).not.toBeNull();
    expect(Object.keys(read ?? {}).sort()).toEqual(['comune', 'email', 'fullName', 'message', 'phone', 'service']);
  });

  it('readInquiryDraft_AMessageLongerThanTheServerTakes_IsCut', () => {
    window.localStorage.setItem('casazen.supplier-inquiry.rossi', JSON.stringify({ v: 1, savedAt: NOW, draft: { ...typed, message: 'a'.repeat(5000) } }));

    expect(readInquiryDraft('rossi', NOW)?.message).toHaveLength(1000);
  });

  it('startingInquiryDraft_TheAddressNamesAnotherComune_WinsOverTheRememberedOne', () => {
    writeInquiryDraft('rossi', typed, Date.now());

    // The person comes from a message about Monza: the remembered Milano is dropped, the rest is kept, and the page resolves the code to a name.
    const started = startingInquiryDraft('rossi', { comune: '108033' });

    expect(started.comune).toBeUndefined();
    expect(started.message).toBe(typed.message);
  });

  it('startingInquiryDraft_TheAddressNamesTheSameComune_KeepsIt', () => {
    writeInquiryDraft('rossi', typed, Date.now());

    expect(startingInquiryDraft('rossi', { comune: '015146' }).comune).toEqual(typed.comune);
  });

  it('startingInquiryDraft_TheAddressNamesAService_WinsOverTheRememberedOne', () => {
    writeInquiryDraft('rossi', typed, Date.now());

    expect(startingInquiryDraft('rossi', { service: 'pulizia-vetri' }).service).toBe('pulizia-vetri');
  });
});
