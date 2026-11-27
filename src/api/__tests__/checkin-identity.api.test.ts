import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { publicCheckinApi } from '../checkin.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const TOKEN = 'link-token';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.post).mockResolvedValue({ data: {} });
});

/** The body and the options of the only call to `post`. */
function postCall() {
  const [url, body, options] = vi.mocked(axios.post).mock.calls[0];
  return { url, body, options: options as { public?: boolean; headers?: Record<string, string> } };
}

describe('the identity calls of the guest check-in (E03/F04/US03/T01)', () => {
  it('postBiometricConsent_Agreement_SendsTheAnswerAndTheVersionAsJsonWithoutAToken', async () => {
    await publicCheckinApi.postBiometricConsent(TOKEN, { consentGiven: true, consentVersion: 'checkin-biometric-2026-11' });

    expect(postCall()).toEqual({
      url: `/public/checkin/${TOKEN}/biometric-consent`,
      body: { consentGiven: true, consentVersion: 'checkin-biometric-2026-11' },
      options: { public: true },
    });
  });

  it('postBiometricConsent_Refusal_SendsOnlyTheAnswer', async () => {
    await publicCheckinApi.postBiometricConsent(TOKEN, { consentGiven: false });

    expect(postCall().body).toEqual({ consentGiven: false });
  });

  it('postDocument_Photo_IsAMultipartFormWithTheFieldTheApiReadsAndNoToken', async () => {
    const photo = new Blob(['document'], { type: 'image/jpeg' });

    await publicCheckinApi.postDocument(TOKEN, photo);

    const { url, body, options } = postCall();
    expect(url).toBe(`/public/checkin/${TOKEN}/document`);
    // `multipart/form-data` is said: the instance is JSON by default and would turn the form into JSON, and the API would get no file.
    expect(options).toEqual({ public: true, headers: { 'Content-Type': 'multipart/form-data' } });
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect([...form.keys()]).toEqual(['document']);
    expect((form.get('document') as File).name).toBe('document.jpg');
    expect((form.get('document') as File).type).toBe('image/jpeg');
  });

  it('postSelfie_OutsideTicino_SendsTheSelfieAlone', async () => {
    await publicCheckinApi.postSelfie(TOKEN, new Blob(['selfie'], { type: 'image/jpeg' }));

    const { url, body, options } = postCall();
    expect(url).toBe(`/public/checkin/${TOKEN}/selfie`);
    expect(options).toEqual({ public: true, headers: { 'Content-Type': 'multipart/form-data' } });
    expect([...(body as FormData).keys()]).toEqual(['selfie']);
    expect(((body as FormData).get('selfie') as File).name).toBe('selfie.jpg');
  });

  it('postSelfie_Ticino_SendsThePhotoOfTheDocumentAgainInTheFieldTheApiReads', async () => {
    await publicCheckinApi.postSelfie(TOKEN, new Blob(['selfie'], { type: 'image/jpeg' }), new Blob(['document'], { type: 'image/jpeg' }));

    expect([...(postCall().body as FormData).keys()]).toEqual(['selfie', 'documentPhoto']);
  });

  it('postSelfie_NoPhotoOfTheDocument_NeverSendsAnEmptyField', async () => {
    await publicCheckinApi.postSelfie(TOKEN, new Blob(['selfie']), null);

    expect([...(postCall().body as FormData).keys()]).toEqual(['selfie']);
  });

  it('requestOperator_AnyStep_IsAnAnonymousPostWithoutABody', async () => {
    await publicCheckinApi.requestOperator(TOKEN);

    expect(postCall()).toEqual({ url: `/public/checkin/${TOKEN}/request-operator`, body: undefined, options: { public: true } });
  });
});

describe('the opening of the self-hosted identity step (E70/F03/US01/T01)', () => {
  it('openIdentity_TheVersionShown_IsAnAnonymousJsonPostWhoseBodyHoldsTheVersionAndTheAddressNone', async () => {
    const state = { step: 'consent', selfHosted: true, opened: true, noticeVersion: 'checkin-biometric-2026-11', closed: false };
    vi.mocked(axios.post).mockResolvedValue({ data: { state } });

    await expect(publicCheckinApi.openIdentity(TOKEN, 'checkin-biometric-2026-11')).resolves.toEqual({ state });

    expect(postCall()).toEqual({
      url: `/public/checkin/${TOKEN}/identity/open`,
      body: { noticeVersion: 'checkin-biometric-2026-11' },
      options: { public: true },
    });
    // The version is the one the guest read, sent in the body: never part of the address of the call.
    expect(postCall().url).not.toContain('checkin-biometric-2026-11');
  });

  it('openIdentity_TheServerRefuses_RejectsAndNothingIsHidden', async () => {
    const refusal = Object.assign(new Error('Request failed'), { isAxiosError: true, response: { status: 422, data: { code: 'notice_version_unknown' } } });
    vi.mocked(axios.post).mockRejectedValue(refusal);

    await expect(publicCheckinApi.openIdentity(TOKEN, 'an-old-version')).rejects.toBe(refusal);
  });
});

describe('the document on two sides, the legal texts and the door (E22/F02/US01/T01)', () => {
  it.each(['front', 'back'] as const)('postDocument_Side_%s_SendsTheSideInTheFieldTheApiReads', async (side) => {
    await publicCheckinApi.postDocument(TOKEN, new Blob(['document'], { type: 'image/jpeg' }), side);

    const form = postCall().body as FormData;
    expect([...form.keys()]).toEqual(['document', 'side']);
    expect(form.get('side')).toBe(side);
  });

  it('postSelfie_TicinoWithTwoSides_SendsBothPicturesInTheFieldsTheApiReads', async () => {
    await publicCheckinApi.postSelfie(
      TOKEN,
      new Blob(['selfie'], { type: 'image/jpeg' }),
      new Blob(['front'], { type: 'image/jpeg' }),
      new Blob(['back'], { type: 'image/jpeg' }),
    );

    const form = postCall().body as FormData;
    expect([...form.keys()]).toEqual(['selfie', 'documentPhoto', 'documentPhotoBack']);
    expect((form.get('documentPhotoBack') as File).name).toBe('document-back.jpg');
  });

  it('getLegalTexts_TheLanguageOfThePage_IsAnAnonymousGetWithTheLanguageInTheQuery', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { language: 'de', texts: [] } });

    await expect(publicCheckinApi.getLegalTexts(TOKEN, 'de')).resolves.toEqual({ language: 'de', texts: [] });

    const [url, config] = vi.mocked(axios.get).mock.calls[0];
    expect(url).toBe(`/public/checkin/${TOKEN}/legal-texts`);
    expect(config).toMatchObject({ params: { lang: 'de' }, public: true });
  });

  it('openDoor_BookingCodeAndDate_IsAnAnonymousPostWhoseBodyHoldsTheDataAndTheAddressNone', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { token: 'link-token' } });

    await expect(publicCheckinApi.openDoor('door-token', { bookingCode: 'ABC123', arrivalDate: '2026-11-20' })).resolves.toEqual({ token: 'link-token' });

    expect(postCall()).toEqual({
      url: '/public/checkin/door/door-token',
      body: { bookingCode: 'ABC123', arrivalDate: '2026-11-20' },
      options: { public: true },
    });
    // What was typed is personal data: it is in the body only, never in the address of the call.
    expect(postCall().url).not.toContain('ABC123');
    expect(postCall().url).not.toContain('2026-11-20');
  });
});
