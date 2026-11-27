import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { publicCheckinApi } from '@/api/checkin.api';
import type { IdentityDocumentResponse, IdentitySelfieResponse, IdentityVerificationState } from '@/types/public-checkin.types';
import { IdentityStep } from '../identity-step';
import { useIdentityVerification, type IdentityVerificationController } from '../use-identity-verification';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    getLegalTexts: vi.fn(),
    postBiometricConsent: vi.fn(),
    postDocument: vi.fn(),
    postSelfie: vi.fn(),
    requestOperator: vi.fn(),
  },
}));

configure({ asyncUtilTimeout: 5_000 });

const TOKEN = 'tok-two-sided';

const state = (overrides: Partial<IdentityVerificationState> = {}): IdentityVerificationState => ({
  step: 'document',
  result: null,
  biometricOffered: true,
  consentRecorded: true,
  consentRefused: false,
  documentChecked: false,
  attemptsRemaining: 3,
  operatorRequested: false,
  operatorPathOpen: true,
  documentNotArchived: false,
  verifyingGuestPosition: 0,
  ...overrides,
});

/** A card with the face on the front and the lines of letters on the back (the Italian electronic identity card): the front alone is good, and the back is what is missing. */
const frontNeedsTheBack = (notArchived = false): IdentityDocumentResponse => ({
  success: true,
  acceptable: false,
  guidanceCodes: ['document_back_needed'],
  documentStored: !notArchived,
  documentNotArchived: notArchived,
  side: 'front',
  sides: ['front'],
});
const documentComplete = (notArchived = false): IdentityDocumentResponse => ({
  success: true,
  acceptable: true,
  guidanceCodes: [],
  documentStored: !notArchived,
  documentNotArchived: notArchived,
  side: 'back',
  sides: ['front', 'back'],
});
const passed: IdentitySelfieResponse = { result: 'ok', guidanceCodes: [], attemptsRemaining: 2, operatorPathOpen: true, lockCode: '4821' };
const tryAgain: IdentitySelfieResponse = { result: 'retry', guidanceCodes: ['hold_still'], attemptsRemaining: 1, operatorPathOpen: true };

const picture = (name: string) => new File([name], `${name}.jpg`, { type: 'image/jpeg' });

/** Whether a picture (a file or a blob) is anywhere in what the controller exposes: its state, its progress, whatever a screen could read. */
function holdsAPicture(value: unknown, seen = new Set<unknown>()): boolean {
  if (value instanceof Blob) return true;
  if (value === null || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value as Record<string, unknown>).some((entry) => holdsAPicture(entry, seen));
}

const controllerOf = (initial: IdentityVerificationState) => renderHook(() => useIdentityVerification(TOKEN, initial));

async function send(result: { current: IdentityVerificationController }, file: File) {
  await act(async () => {
    await result.current.sendDocument(file);
  });
}

async function sendSelfie(result: { current: IdentityVerificationController }) {
  await act(async () => {
    await result.current.sendSelfie(new Blob(['selfie'], { type: 'image/jpeg' }));
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(publicCheckinApi.getLegalTexts).mockResolvedValue({ language: 'it', texts: [] });
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the document on two sides: nothing of a picture is kept once it is sent (E22/F02/US01/T01, NF-50, ADR-013-R2)', () => {
  it('TwoSided_NoPictureKeptInStateAfterUpload_Test', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce(frontNeedsTheBack()).mockResolvedValueOnce(documentComplete());
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValue(passed);
    const { result } = controllerOf(state());
    const front = picture('front');
    const back = picture('back');

    await send(result, front);
    // The front is good and the back is asked: the answer is not a refusal, and the page holds no picture.
    expect(result.current.progress).toMatchObject({ stage: 'document', documentSideNeeded: 'back', documentTwoSided: true, documentRefused: false });
    expect(holdsAPicture(result.current)).toBe(false);

    await send(result, back);
    expect(result.current.progress?.stage).toBe('selfie');
    expect(holdsAPicture(result.current)).toBe(false);
    // Each picture went with the side it is of, in the order the answers asked.
    expect(vi.mocked(publicCheckinApi.postDocument).mock.calls.map((call) => call[2])).toEqual(['front', 'back']);

    await sendSelfie(result);
    // The server has the pictures (outside Ticino): the selfie goes alone, and the page has none to send again.
    expect(vi.mocked(publicCheckinApi.postSelfie).mock.calls[0].slice(2, 4)).toEqual([null, null]);
    expect(result.current.progress).toMatchObject({ stage: 'done', lockCode: '4821', documentSidesTaken: [] });
    expect(holdsAPicture(result.current)).toBe(false);
    expect(storage).not.toHaveBeenCalled();
  });

  it('TwoSided_TicinoKeepsNothingOnTheServer_TheTwoPicturesAreHeldForTheSelfiesAndLetGoWhenTheStepEnds_Test', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce(frontNeedsTheBack(true)).mockResolvedValueOnce(documentComplete(true));
    vi.mocked(publicCheckinApi.postSelfie).mockResolvedValueOnce(tryAgain).mockResolvedValueOnce(passed);
    const { result } = controllerOf(state({ documentNotArchived: true }));
    const front = picture('front');
    const back = picture('back');

    await send(result, front);
    await send(result, back);
    // Held in a reference to be sent with the selfie, never in state: nothing a screen could read.
    expect(result.current.progress?.stage).toBe('selfie');
    expect(holdsAPicture(result.current)).toBe(false);

    await sendSelfie(result);
    await sendSelfie(result);
    const [first, second] = vi.mocked(publicCheckinApi.postSelfie).mock.calls;
    expect(first[2]).toBe(front);
    expect(first[3]).toBe(back);
    expect(second[2]).toBe(front);
    expect(second[3]).toBe(back);

    // The step is over (a pass): both pictures are let go. A selfie sent now finds nothing to send with it, and the API is not called.
    expect(result.current.progress?.stage).toBe('done');
    await sendSelfie(result);
    expect(publicCheckinApi.postSelfie).toHaveBeenCalledTimes(2);
    expect(result.current.problem).toBe('document_photo');
    expect(holdsAPicture(result.current)).toBe(false);
  });

  it('TwoSided_TicinoAfterAReloadWithBothSidesOnFile_AsksForBothAgainBeforeTheSelfieBecauseThePageHoldsNothing_Test', async () => {
    vi.mocked(publicCheckinApi.postDocument)
      .mockResolvedValueOnce({ ...documentComplete(true), side: 'front', sides: ['front', 'back'] })
      .mockResolvedValueOnce(documentComplete(true));
    const { result } = controllerOf(state({ step: 'selfie', documentChecked: true, documentNotArchived: true, documentSides: ['front', 'back'] }));
    expect(result.current.progress).toMatchObject({ stage: 'document', documentSideNeeded: 'front', documentTwoSided: true, documentSidesTaken: [] });

    await send(result, picture('front'));
    // The server is satisfied, but the selfie of a property that keeps nothing carries both pictures: the page asks for the back as well.
    expect(result.current.progress).toMatchObject({ stage: 'document', documentSideNeeded: 'back' });

    await send(result, picture('back'));
    expect(result.current.progress?.stage).toBe('selfie');
  });

  it('TwoSided_AnythingTheGuestDoesNotFinish_AskingForAPersonLetsGoOfThePictures_Test', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce(frontNeedsTheBack(true)).mockResolvedValueOnce(documentComplete(true));
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({ result: 'operator', operatorPathOpen: true, state: state({ step: 'operator', operatorRequested: true }) });
    const { result } = controllerOf(state({ documentNotArchived: true }));
    await send(result, picture('front'));
    await send(result, picture('back'));

    await act(async () => {
      await result.current.askOperator();
    });
    await sendSelfie(result);

    expect(publicCheckinApi.postSelfie).not.toHaveBeenCalled();
    expect(holdsAPicture(result.current)).toBe(false);
  });
});

function Harness({ initial }: { initial: IdentityVerificationState }) {
  const identity = useIdentityVerification(TOKEN, initial);
  return <IdentityStep identity={identity} token={TOKEN} />;
}

const renderStep = (initial: IdentityVerificationState) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );

describe('the screen of the document on two sides', () => {
  const side = () => screen.getByTestId('checkin-identity-document').getAttribute('data-side');
  const pick = (file: File) => fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [file] } });

  it('TwoSided_TheCardHasTheLinesOnTheBack_AsksForTheFrontThenForTheBackWithTheDrawingAndEmptiesTheFileBox', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce(frontNeedsTheBack()).mockResolvedValueOnce(documentComplete());
    renderStep(state());

    // The face side first: a passport is complete with it, and nothing is said of a back yet.
    expect(side()).toBe('front');
    expect(screen.queryByTestId('checkin-identity-mrz-illustration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-document-progress')).not.toBeInTheDocument();

    pick(picture('front'));
    await waitFor(() => expect(side()).toBe('back'));
    expect(screen.getByTestId('checkin-identity-mrz-illustration')).toHaveAccessibleName(i18n.t('checkin.identity.document.back.illustration'));
    expect(screen.getByTestId('checkin-identity-document-progress')).toHaveTextContent('Foto 2 di 2');
    expect(screen.getByTestId('checkin-identity-document-front-received')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-document-pick')).toHaveTextContent(i18n.t('checkin.identity.document.back.pick'));
    // Not a refusal: no warning about the photo that was good.
    expect(screen.queryByTestId('checkin-identity-document-guidance')).not.toBeInTheDocument();
    // The file box does not keep the picture it was given.
    expect((screen.getByTestId('checkin-identity-document-file') as HTMLInputElement).value).toBe('');

    pick(picture('back'));
    await waitFor(() => expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'selfie'));
    expect(vi.mocked(publicCheckinApi.postDocument).mock.calls.map((call) => call[2])).toEqual(['front', 'back']);
  });

  it('TwoSided_ThePageIsOpenedAgainWithTheBackMissing_AsksForTheBackAtOnce', () => {
    renderStep(state({ documentSides: ['front'], documentSideNeeded: 'back' }));

    expect(side()).toBe('back');
    expect(screen.getByTestId('checkin-identity-mrz-illustration')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-document-front-received')).toBeInTheDocument();
  });

  it('TwoSided_TheBackIsNotGoodEnough_SaysWhatToChangeAndAsksForTheBackAgain', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({ ...frontNeedsTheBack(), guidanceCodes: ['avoid_glare'] });
    renderStep(state({ documentSides: ['front'], documentSideNeeded: 'back' }));

    pick(picture('back'));

    const guidance = await screen.findByTestId('checkin-identity-document-guidance');
    expect(guidance).toHaveTextContent(i18n.t('checkin.identity.guidance.avoid_glare'));
    expect(side()).toBe('back');
    expect(screen.getByTestId('checkin-identity-document-pick')).toHaveTextContent(i18n.t('checkin.identity.document.back.pickAgain'));
  });
});
