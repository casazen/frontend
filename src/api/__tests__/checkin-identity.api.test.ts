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
