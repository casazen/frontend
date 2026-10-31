import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { readInquiryFailure } from '../inquiry-errors';
import { EMPTY_INQUIRY_DRAFT, messageProblem, toInquiryBody, validateInquiry, type InquiryDraft } from '../inquiry-flow';

const ready: InquiryDraft = {
  ...EMPTY_INQUIRY_DRAFT,
  service: 'pulizia-vetri',
  message: '  Servono i vetri di un bilocale\r\ncon balcone.  ',
  fullName: 'Anna Rossi',
  email: ' anna@example.test ',
  phone: '+39 333 1234567',
};

function refused(status: number, code: string, extra: Record<string, unknown> = {}) {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('refused', 'ERR_BAD_REQUEST', config, undefined, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { code, ...extra },
  });
}

describe('the request on measure: what is ready to send', () => {
  it('validateInquiry_EverythingFilled_HasNoProblem', () => {
    expect(validateInquiry(ready, true, true)).toEqual({});
  });

  it('validateInquiry_NoComuneNoConsent_NamesBoth_TheConsentIsNeverRemembered', () => {
    expect(validateInquiry(ready, false, false)).toEqual({ comune: 'required', consent: 'required' });
  });

  it('messageProblem_ShortOrWithoutLettersOrTooLong_IsRefusedBeforeTheServerDoes', () => {
    expect(messageProblem('')).toBe('required');
    expect(messageProblem('   ')).toBe('required');
    expect(messageProblem('ciao')).toBe('tooShort');
    expect(messageProblem('!!!!!!!!!!!!')).toBe('tooShort');
    expect(messageProblem('a'.repeat(1001))).toBe('tooLong');
    expect(messageProblem('Servono i vetri.')).toBeNull();
  });

  it('toInquiryBody_ADraftThatIsReady_CarriesTheWordsTrimmedTheVersionOfTheNoticeAndTheTrap', () => {
    const body = toInquiryBody({
      draft: ready,
      comune: { istatCode: '015146', name: 'Milano', provinceCode: 'MI' },
      locale: 'en-GB',
      privacyNoticeVersion: '2026-10',
      clientRequestId: 'c0ffee00-0000-4000-8000-000000000001',
      trap: '',
    });

    expect(body.message).toBe('Servono i vetri di un bilocale\ncon balcone.');
    expect(body.email).toBe('anna@example.test');
    expect(body).toMatchObject({ service: 'pulizia-vetri', comuneIstat: '015146', city: 'Milano', locale: 'en', privacyAccepted: true, privacyNoticeVersion: '2026-10', website: '' });
  });

  it('toInquiryBody_NoService_LeavesTheServiceOut', () => {
    const body = toInquiryBody({ draft: { ...ready, service: null }, comune: { istatCode: '015146', name: 'Milano', provinceCode: 'MI' }, locale: 'it', privacyNoticeVersion: 'v', clientRequestId: 'x', trap: '' });

    expect('service' in body).toBe(false);
  });
});

describe('the request on measure: what a refusal of the server means', () => {
  it('readInquiryFailure_OutsideTheZone_IsNamedAsSuch', () => {
    expect(readInquiryFailure(refused(422, 'supplier_booking_outside_zone'))).toEqual({ kind: 'outsideZone' });
  });

  it('readInquiryFailure_ConsentMissingOrOutdated_AsksAgain', () => {
    expect(readInquiryFailure(refused(422, 'supplier_booking_consent_required'))).toEqual({ kind: 'consent', outdated: false });
    expect(readInquiryFailure(refused(422, 'supplier_booking_consent_outdated'))).toEqual({ kind: 'consent', outdated: true });
  });

  it('readInquiryFailure_InvalidFields_AreMappedToTheFieldsOfThePage', () => {
    const failure = readInquiryFailure(refused(422, 'supplier_booking_invalid', { fields: ['message', 'city', 'comuneIstat', 'email', 'clientRequestId'] }));

    expect(failure).toEqual({ kind: 'invalid', fields: ['message', 'comune', 'email'] });
  });

  it('readInquiryFailure_APausedShowcase_IsOffline', () => {
    expect(readInquiryFailure(refused(422, 'supplier_booking_offline'))).toEqual({ kind: 'offline' });
  });

  it('readInquiryFailure_AGoneServiceOrShowcase_AreTold_AnythingElseIsOther', () => {
    expect(readInquiryFailure(refused(404, 'supplier_service_not_found'))).toEqual({ kind: 'serviceGone' });
    expect(readInquiryFailure(refused(404, 'not_found'))).toEqual({ kind: 'siteGone' });
    expect(readInquiryFailure(new Error('network'))).toEqual({ kind: 'other' });
  });
});
