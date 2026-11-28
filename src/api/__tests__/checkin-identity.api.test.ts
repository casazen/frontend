import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from '@/lib/axios';
import { publicCheckinApi } from '../checkin.api';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const TOKEN = 'link-token';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(axios.post).mockResolvedValue({ data: {} });
});

function postCall() {
  const [url, body, options] = vi.mocked(axios.post).mock.calls[0];
  return { url, body, options: options as { public?: boolean; headers?: Record<string, string>; timeout?: number; signal?: AbortSignal } };
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

describe('the presence of the self-hosted identity step (E72/F02/US01/T01)', () => {
  const KEY = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const jpeg = (name: string) => new Blob([name], { type: 'image/jpeg' });

  it('startPresenceChallenge_AnAttempt_IsAnAnonymousPostWithoutABody', async () => {
    const challenge = { challengeToken: 'challenge-1', steps: ['turn_left'], stepMs: 2000, leadInMs: 1000, expiresAt: '2026-11-27T10:00:00Z', targetFps: 10, maxFrames: 80, maxFrameSide: 480 };
    vi.mocked(axios.post).mockResolvedValue({ data: challenge });

    await expect(publicCheckinApi.startPresenceChallenge(TOKEN)).resolves.toEqual(challenge);

    expect(postCall()).toEqual({ url: `/public/checkin/${TOKEN}/presence-challenge`, body: undefined, options: { public: true } });
  });

  it('postPresence_ASequence_IsAMultipartFormWithEveryFrameInOrderTheTimestampsAndTheToken', async () => {
    await publicCheckinApi.postPresence(TOKEN, { frames: [jpeg('one'), jpeg('two'), jpeg('three')], timestamps: [0, 100, 201], challengeToken: 'challenge-1' }, KEY);

    const { url, body } = postCall();
    expect(url).toBe(`/public/checkin/${TOKEN}/presence`);
    const form = body as FormData;
    expect([...form.keys()]).toEqual(['frames', 'frames', 'frames', 'timestamps', 'challengeToken']);
    expect(form.getAll('frames').map((part) => (part as File).type)).toEqual(['image/jpeg', 'image/jpeg', 'image/jpeg']);
    expect(form.getAll('frames').map((part) => (part as File).name)).toEqual(['frame-0.jpg', 'frame-1.jpg', 'frame-2.jpg']);
    expect(JSON.parse(form.get('timestamps') as string)).toEqual([0, 100, 201]);
    expect(form.get('challengeToken')).toBe('challenge-1');
  });

  it('postPresence_TheKeyOfTheRecording_GoesInTheIdempotencyKeyHeaderAndNeverInTheBodyOrTheAddress', async () => {
    await publicCheckinApi.postPresence(TOKEN, { frames: [jpeg('one')], timestamps: [0], challengeToken: 'challenge-1' }, KEY);

    const { url, body, options } = postCall();
    expect(options).toMatchObject({ public: true, headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': KEY } });
    expect(url).not.toContain(KEY);
    expect([...(body as FormData).values()].map(String)).not.toContain(KEY);
    expect(options.timeout).toBeGreaterThan(30_000);
  });

  it('postPresence_TheSignalOfTheGuestWhoStopsTheUpload_IsHandedToTheRequestAndTheTimeoutIsNotShortenedByIt', async () => {
    const stop = new AbortController();

    await publicCheckinApi.postPresence(TOKEN, { frames: [jpeg('one')], timestamps: [0], challengeToken: 'challenge-1' }, KEY, stop.signal);

    const { options } = postCall();
    expect(options.signal).toBe(stop.signal);
    expect(options.timeout).toBeGreaterThan(30_000);
  });

  it('postPresence_NoSignal_IsTheRequestItWas_WithNoSignalInItsOptions', async () => {
    await publicCheckinApi.postPresence(TOKEN, { frames: [jpeg('one')], timestamps: [0], challengeToken: 'challenge-1' }, KEY);

    expect(postCall().options).not.toHaveProperty('signal');
  });

  it('postPresence_Ticino_SendsThePicturesOfTheDocumentAgainInTheFieldsTheApiReads', async () => {
    await publicCheckinApi.postPresence(
      TOKEN,
      { frames: [jpeg('one')], timestamps: [0], challengeToken: 'challenge-1', documentPhoto: jpeg('front'), documentPhotoBack: jpeg('back') },
      KEY,
    );

    const form = postCall().body as FormData;
    expect([...form.keys()]).toEqual(['frames', 'timestamps', 'challengeToken', 'documentPhoto', 'documentPhotoBack']);
    expect((form.get('documentPhoto') as File).name).toBe('document.jpg');
    expect((form.get('documentPhotoBack') as File).name).toBe('document-back.jpg');
  });

  it('postPresence_NoPicturesOfTheDocument_NeverSendsAnEmptyField', async () => {
    await publicCheckinApi.postPresence(TOKEN, { frames: [jpeg('one')], timestamps: [0], challengeToken: 'challenge-1', documentPhoto: null, documentPhotoBack: null }, KEY);

    expect([...(postCall().body as FormData).keys()]).toEqual(['frames', 'timestamps', 'challengeToken']);
  });
});
