import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { APP_RESOURCES } from '@/i18n/resources';
import guestDe from '@/i18n/locales/guest-checkin.de.json';
import guestEs from '@/i18n/locales/guest-checkin.es.json';
import guestFr from '@/i18n/locales/guest-checkin.fr.json';
import { publicCheckinApi } from '@/api/checkin.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { IdentityDocumentResponse, IdentityVerificationState } from '@/types/public-checkin.types';
import { IdentityDocumentCapture } from '../components/identity-document-capture';
import { IdentityStep } from '../identity-step';
import { differenceHash, fingerprintOfCanvas, hashDistance, looksLikeTheSameSide, SAME_SIDE_MAX_DISTANCE } from '../lib/document-fingerprint';
import {
  afterDocument,
  ASSISTED_GUIDANCE_CODES,
  assistedReasonOf,
  frontWasTaken,
  GUIDANCE_CODES,
  guidanceKey,
  listedGuidance,
  progressFromState,
  retakeTargetOf,
} from '../lib/identity-model';
import { useIdentityVerification } from '../use-identity-verification';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    getLegalTexts: vi.fn(),
    openIdentity: vi.fn(),
    postBiometricConsent: vi.fn(),
    postDocument: vi.fn(),
    postSelfie: vi.fn(),
    startSelfieChallenge: vi.fn(),
    requestOperator: vi.fn(),
  },
}));

const TOKEN = 'tok-retry';

/** The codes the document step of the self-hosted flow adds to the contract (E71/F01/US03/T01). */
const NEW_CODES = [
  'document_not_found',
  'document_edges_not_visible',
  'document_layout_mismatch',
  'document_orientation',
  'document_portrait_missing',
  'document_side_duplicate',
  'document_wrong_side',
  'document_format_unsupported',
  'document_glare',
  'document_blur',
  'document_unreadable',
] as const;

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
  selfHosted: true,
  opened: true,
  noticeVersion: 'checkin-biometric-2026-11',
  choice: 'automatic',
  formatId: null,
  guidedRetryAvailable: false,
  closed: false,
  outcome: null,
  ...overrides,
});

const refusal = (...codes: string[]): IdentityDocumentResponse => ({
  success: false,
  acceptable: false,
  guidanceCodes: codes,
  documentStored: false,
  documentNotArchived: false,
  side: 'front',
  sides: [],
});

const photo = () => new File(['document'], 'document.jpg', { type: 'image/jpeg' });
const text = (key: string) => i18n.t(key);

function Harness({ initial }: { initial: IdentityVerificationState }) {
  const identity = useIdentityVerification(TOKEN, initial);
  return (
    <>
      <IdentityStep identity={identity} token={TOKEN} />
      <span data-testid="harness-concluded">{String(identity.concluded)}</span>
    </>
  );
}

function renderStep(initial: IdentityVerificationState = state()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  // No camera on these screens: the photo comes from the file of the phone, which is the second way of a self-hosted capture.
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('identity-document-retry: every guidance code has its own words (E71/F02/US01/T02, AC1)', () => {
  it.each(NEW_CODES)('IdentityDocumentCapture_%s_ShowsItsOwnActionableMessageAndNotTheGenericOne', (code) => {
    render(
      <IdentityDocumentCapture refused guidanceCodes={[code]} side="front" twoSided frontReceived={false} busy={false} onPhoto={vi.fn()} onRequestOperator={vi.fn()} />,
    );

    const line = screen.getByTestId(`checkin-identity-document-guidance-${code}`);
    expect(line).toHaveTextContent(text(guidanceKey(code, 'front')));
    expect(line).not.toHaveTextContent(text('checkin.identity.guidance.other'));
    expect(text(guidanceKey(code, 'front')).length).toBeGreaterThan(10);
    // A picture next to the words, decorative: the words say it all.
    expect(line.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('IdentityDocumentCapture_TheContractExamples_SayWhatTheBriefAsks', () => {
    const say = (code: string) => text(guidanceKey(code, 'front'));

    expect(say('document_edges_not_visible')).toBe('Inquadra tutto il documento, con i quattro bordi visibili.');
    expect(say('document_glare')).toContain('Riflesso sulla foto');
    expect(say('document_glare')).toContain('inclina leggermente il documento');
    expect(say('document_format_unsupported')).toBe('Documento non supportato: continua con una persona.');
    expect(say('document_side_duplicate')).toContain('due volte lo stesso lato');
  });

  it('IdentityDocumentCapture_AWrongSide_SaysWhichSideToPhotographInsteadOfBlamingTheGuest', () => {
    const view = render(
      <IdentityDocumentCapture refused guidanceCodes={['document_wrong_side']} side="front" twoSided frontReceived={false} busy={false} onPhoto={vi.fn()} onRequestOperator={vi.fn()} />,
    );
    expect(screen.getByTestId('checkin-identity-document-guidance-document_wrong_side')).toHaveTextContent('Questo è il retro: fotografa il fronte');

    view.rerender(
      <IdentityDocumentCapture refused guidanceCodes={['document_wrong_side']} side="back" twoSided frontReceived busy={false} onPhoto={vi.fn()} onRequestOperator={vi.fn()} />,
    );
    expect(screen.getByTestId('checkin-identity-document-guidance-document_wrong_side')).toHaveTextContent('Questo è il fronte');
    expect(screen.getByTestId('checkin-identity-document-guidance-document_wrong_side')).toHaveTextContent('fotografa il retro');
  });

  it('IdentityDocumentCapture_ACodeTheCodeDoesNotKnow_FallsBackToTheGenericSentenceAndNeverABlankScreen', () => {
    render(
      <IdentityDocumentCapture refused guidanceCodes={['a_code_of_the_future']} side="front" twoSided={false} frontReceived={false} busy={false} onPhoto={vi.fn()} onRequestOperator={vi.fn()} />,
    );

    expect(screen.getByTestId('checkin-identity-document-guidance')).toHaveTextContent(text('checkin.identity.guidance.other'));
    expect(guidanceKey('a_code_of_the_future')).toBe('checkin.identity.guidance.other');
    expect(guidanceKey('')).toBe('checkin.identity.guidance.other');
  });

  it('IdentityDocumentCapture_SeveralCodesAtOnce_ListsEachOfThem', () => {
    render(
      <IdentityDocumentCapture
        refused
        guidanceCodes={['document_glare', 'document_blur', 'more_light']}
        side="front"
        twoSided
        frontReceived={false}
        busy={false}
        onPhoto={vi.fn()}
        onRequestOperator={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('checkin-identity-document-operator')).toBeEnabled();
  });

  it('IdentityDocumentCapture_ATargetedCodeAndTheOlderCodeThatSaysTheSame_AreOneLineAndAnOlderCodeOnItsOwnStillIsAline', () => {
    // The server sends the targeted codes first and then the codes of the capture checks of before: a reflection or a blur found by both is said once.
    const { rerender } = render(
      <IdentityDocumentCapture
        refused
        guidanceCodes={['document_glare', 'document_blur', 'avoid_glare', 'hold_still', 'more_light']}
        side="front"
        twoSided
        frontReceived={false}
        busy={false}
        onPhoto={vi.fn()}
        onRequestOperator={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByTestId('checkin-identity-document-guidance-avoid_glare')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-document-guidance-hold_still')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-document-guidance-document_glare')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-document-guidance-document_blur')).toBeInTheDocument();

    rerender(
      <IdentityDocumentCapture refused guidanceCodes={['avoid_glare', 'hold_still']} side="front" twoSided frontReceived={false} busy={false} onPhoto={vi.fn()} onRequestOperator={vi.fn()} />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('IdentityDocumentCapture_ARefusal_IsHeardByAScreenReaderAndHasNoAccessibilityViolations', async () => {
    const { container } = render(
      <IdentityDocumentCapture refused guidanceCodes={[...NEW_CODES]} side="back" twoSided frontReceived busy={false} onPhoto={vi.fn()} onRequestOperator={vi.fn()} />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('IdentityDocumentCapture_ALegacyCode_IsTheLineItAlwaysWasWithNoPictureAndTheSameText', () => {
    render(
      <IdentityDocumentCapture refused guidanceCodes={['avoid_glare']} side="front" twoSided={false} frontReceived={false} busy={false} onPhoto={vi.fn()} onRequestOperator={vi.fn()} />,
    );

    const line = screen.getByTestId('checkin-identity-document-guidance-avoid_glare');
    expect(line).toHaveTextContent(text('checkin.identity.guidance.avoid_glare'));
    expect(line.querySelector('svg')).toBeNull();
  });

  it('guidanceCodes_EveryCodeAndEverySideSpecificWords_ExistInTheFiveGuestLanguages', () => {
    const bundles = {
      it: APP_RESOURCES.it.translation as unknown as Record<string, unknown>,
      en: APP_RESOURCES.en.translation as unknown as Record<string, unknown>,
      de: guestDe as unknown as Record<string, unknown>,
      fr: guestFr as unknown as Record<string, unknown>,
      es: guestEs as unknown as Record<string, unknown>,
    };
    const keys = [
      ...GUIDANCE_CODES.map((code) => guidanceKey(code)),
      guidanceKey('document_wrong_side', 'front'),
      guidanceKey('document_wrong_side', 'back'),
      'checkin.identity.guidance.other',
    ];
    const read = (bundle: Record<string, unknown>, key: string): unknown => key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);

    for (const [language, bundle] of Object.entries(bundles)) {
      const missing = keys.filter((key) => {
        const value = read(bundle, key);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(missing, `${language}: guidance without words`).toEqual([]);
    }
    // The new codes are translated, not copied from English, in every language that is not English.
    for (const language of ['it', 'de', 'fr', 'es'] as const) {
      const same = NEW_CODES.filter((code) => read(bundles[language], guidanceKey(code)) === read(bundles.en, guidanceKey(code)));
      expect(same, `${language}: left in English`).toEqual([]);
    }
  });
});

describe('identity-document-retry: the codes that end with a person (AC2)', () => {
  it('assistedReasonOf_ThePersonCodes_AreTheTwoThatCloseTheVerification', () => {
    expect([...ASSISTED_GUIDANCE_CODES]).toEqual(['document_format_unsupported', 'document_unreadable']);
    expect(assistedReasonOf(['document_glare', 'document_unreadable'])).toBe('document_unreadable');
    expect(assistedReasonOf(['document_glare'])).toBeNull();
    expect(assistedReasonOf([])).toBeNull();
  });

  it.each(ASSISTED_GUIDANCE_CODES)('afterDocument_%s_IsAPersonAlreadyAndNotAnotherCapture', (code) => {
    const next = afterDocument(progressFromState(state()), refusal(code), 'front');

    expect(next).toMatchObject({ stage: 'operator', operatorRequested: true, guidanceCodes: [code], documentRefused: false, documentSidesTaken: [], lockCode: null });
  });

  it('listedGuidance_OnlyTheOlderCodeThatATargetedCodeSaysAgain_IsLeftOut', () => {
    expect(listedGuidance(['document_glare', 'avoid_glare', 'more_light'])).toEqual(['document_glare', 'more_light']);
    expect(listedGuidance(['document_blur', 'hold_still'])).toEqual(['document_blur']);
    expect(listedGuidance(['avoid_glare', 'hold_still', 'document_edges_not_visible'])).toEqual(['avoid_glare', 'hold_still', 'document_edges_not_visible']);
    expect(listedGuidance([])).toEqual([]);
  });

  it('afterDocument_ATargetedCodeThatIsNotFinal_KeepsTheGuestAtTheDocumentWithTheReason', () => {
    const next = afterDocument(progressFromState(state()), refusal('document_glare'), 'front');

    expect(next).toMatchObject({ stage: 'document', documentRefused: true, guidanceCodes: ['document_glare'], documentSideNeeded: 'front' });
  });

  it('afterDocument_AWrongSideOfTheBack_AsksTheSameSideAgain', () => {
    const progress = { ...progressFromState(state({ documentSideNeeded: 'back', documentSides: ['front'] })), documentTwoSided: true };
    const next = afterDocument(progress, refusal('document_wrong_side'), 'back');

    expect(next).toMatchObject({ stage: 'document', documentRefused: true, documentSideNeeded: 'back' });
  });

  it('retakeTargetOf_TheTargetedCodes_SendTheGuestBackToTheDocument', () => {
    for (const code of NEW_CODES) expect(retakeTargetOf([code]), code).toBe('document');
    expect(retakeTargetOf(['retake_selfie'])).toBe('selfie');
    expect(retakeTargetOf(['document_not_recognized'])).toBe('selfie');
  });

  it.each(ASSISTED_GUIDANCE_CODES)('IdentityStep_TheServerAnswers%s_ShowsTheMessageOfAPersonWithItsReasonAndAsksNothingMore', async (code) => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue(refusal(code));
    const { container } = renderStep();

    fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [photo()] } });

    await waitFor(() => expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'operator'));
    expect(screen.getByTestId('identity-operator-reason')).toHaveTextContent(text(guidanceKey(code)));
    expect(screen.getByTestId('identity-operator-text')).toHaveTextContent(text('checkin.identity.result.operator.text'));
    expect(screen.getByTestId('identity-operator-requested')).toBeInTheDocument();
    // The server has the verification closed with a person: no capture, no file, no second call to ask for one.
    expect(screen.queryByTestId('checkin-identity-document')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(publicCheckinApi.requestOperator).not.toHaveBeenCalled();
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('true');
    await expectNoAxeViolations(container);
  });

  it('IdentityStep_ATargetedCodeThatIsNotFinal_ShowsItsMessageAndTheGuestTakesThePhotoAgain', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue(refusal('document_edges_not_visible'));
    renderStep();

    fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [photo()] } });

    const line = await screen.findByTestId('checkin-identity-document-guidance-document_edges_not_visible');
    expect(line).toHaveTextContent('Inquadra tutto il documento, con i quattro bordi visibili.');
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'document');
    expect(screen.getByTestId('checkin-identity-document-file')).toBeEnabled();
    expect(screen.getByTestId('harness-concluded')).toHaveTextContent('false');
  });
});

describe('identity-document-retry: the difference hash of a side (AC3)', () => {
  /** The pixels of an image of `cell` by `cell` pixels for each of the 9 by 8 cells, each cell as bright as `grayOf(row, column)`. */
  function cells(grayOf: (row: number, column: number) => number, cell = 1) {
    const width = 9 * cell;
    const height = 8 * cell;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const gray = grayOf(Math.floor(y / cell), Math.floor(x / cell));
        const at = (y * width + x) * 4;
        data.set([gray, gray, gray, 255], at);
      }
    }
    return { width, height, data };
  }

  const ROW = [10, 20, 15, 15, 30, 5, 5, 6, 1];

  it('differenceHash_ARowOfCells_GivesOneBitForEachPairInReadingOrderTheFirstBeingTheMostSignificant', () => {
    // 10>20 no, 20>15 yes, 15>15 no (a tie is 0), 15>30 no, 30>5 yes, 5>5 no, 5>6 no, 6>1 yes: 01001001 = 0x49 in each of the 8 rows.
    expect(differenceHash(cells((_row, column) => ROW[column]))).toBe('4949494949494949');
  });

  it('differenceHash_TheSameCellsOnABiggerImage_IsTheSameHashAsTheServerWouldComputeOnIt', () => {
    expect(differenceHash(cells((_row, column) => ROW[column], 2))).toBe('4949494949494949');
    expect(differenceHash(cells((_row, column) => ROW[column], 10))).toBe('4949494949494949');
  });

  it('differenceHash_APlainPicture_IsAllZerosAndABrightnessThatFallsToTheRightIsAllOnes', () => {
    expect(differenceHash(cells(() => 128))).toBe('0000000000000000');
    expect(differenceHash(cells((_row, column) => 250 - column * 20))).toBe('ffffffffffffffff');
    expect(differenceHash(cells((_row, column) => 10 + column * 20))).toBe('0000000000000000');
  });

  it('differenceHash_TheFirstPairOfTheTopRow_IsTheMostSignificantBit', () => {
    const hash = differenceHash(cells((row, column) => (row === 0 && column === 0 ? 200 : 100)));

    expect(hash).toBe('8000000000000000');
  });

  it('differenceHash_NothingToHash_IsNullAndNeverAHashOfAPlainPicture', () => {
    expect(differenceHash({ width: 0, height: 0, data: new Uint8ClampedArray(0) })).toBeNull();
    expect(differenceHash({ width: 90, height: 80, data: new Uint8ClampedArray(12) })).toBeNull();
  });

  it('hashDistance_CountsTheBitsThatDifferAndNeverCompareAnythingThatIsNotAHash', () => {
    expect(hashDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hashDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hashDistance('4949494949494949', '4949494949494948')).toBe(1);
    expect(hashDistance('FFFFFFFFFFFFFFFF', 'ffffffffffffffff')).toBe(0);
    expect(hashDistance('abc', '4949494949494949')).toBe(Number.POSITIVE_INFINITY);
    expect(hashDistance('4949494949494949', 'zzzzzzzzzzzzzzzz')).toBe(Number.POSITIVE_INFINITY);
  });

  it('looksLikeTheSameSide_UpToSixBitsApart_IsAHintAndSevenIsNot', () => {
    expect(SAME_SIDE_MAX_DISTANCE).toBe(6);
    expect(looksLikeTheSameSide('0000000000000000', '000000000000003f')).toBe(true);
    expect(looksLikeTheSameSide('0000000000000000', '000000000000007f')).toBe(false);
    expect(looksLikeTheSameSide('4949494949494949', '4949494949494949')).toBe(true);
  });

  it('looksLikeTheSameSide_TheFrontAndTheBackOfACard_AreFarApart', () => {
    const front = differenceHash(cells((_row, column) => ROW[column]));
    const back = differenceHash(cells((row, column) => ROW[(column + row) % 9]));

    expect(front).not.toBeNull();
    expect(back).not.toBeNull();
    expect(looksLikeTheSameSide(front!, back!)).toBe(false);
  });

  it('fingerprintOfCanvas_ACanvas_IsHashedOnASmallCopyThatIsLetGoBeforeItReturns', () => {
    const copies: HTMLCanvasElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const element = realCreate(tag);
      if (tag === 'canvas') copies.push(element as HTMLCanvasElement);
      return element;
    }) as typeof document.createElement);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ drawImage: vi.fn(), getImageData: vi.fn(() => cells((_row, column) => ROW[column], 10)) }) as unknown as CanvasRenderingContext2D,
    );
    const source = document.createElement('canvas');
    source.width = 1280;
    source.height = 720;

    expect(fingerprintOfCanvas(source)).toBe('4949494949494949');
    // The copy of 90 by 80 pixels is emptied; the canvas it was given is the caller's and is left as it was.
    expect(copies.at(-1)?.width).toBe(0);
    expect(source.width).toBe(1280);
  });

  it('fingerprintOfCanvas_AnEmptyCanvasOrOneTheBrowserCannotRead_HasNoHash', () => {
    const empty = document.createElement('canvas');
    expect(fingerprintOfCanvas(empty)).toBeNull();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('tainted');
    });
    const source = document.createElement('canvas');
    source.width = 100;
    source.height = 100;
    expect(fingerprintOfCanvas(source)).toBeNull();
  });
});

describe('identity-document-retry: the front that was taken is remembered for the step only (T02)', () => {
  const frontHash = '4949494949494949';
  const closeToIt = '494949494949494b';
  const farFromIt = 'b6b6b6b6b6b6b6b6';

  it('useIdentityVerification_TheFrontWasGoodAndCameWithAHash_TheBackThatLooksLikeItIsFlaggedAndOneThatDoesNotIsNot', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue(refusal('document_back_needed'));
    const initial = state();
    const { result } = renderHook(() => useIdentityVerification(TOKEN, initial));

    await act(async () => {
      await result.current.sendDocument(photo(), frontHash);
    });

    expect(frontWasTaken(refusal('document_back_needed'), 'front')).toBe(true);
    expect(result.current.looksLikeTheFront(frontHash)).toBe(true);
    expect(result.current.looksLikeTheFront(closeToIt)).toBe(true);
    expect(result.current.looksLikeTheFront(farFromIt)).toBe(false);
    // The hash is in a reference, never in what the page reads of the step.
    expect(JSON.stringify(result.current.progress)).not.toContain(frontHash);
  });

  it('useIdentityVerification_TheFrontWasRefused_NoHashIsKept', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue(refusal('document_glare'));
    const initial = state();
    const { result } = renderHook(() => useIdentityVerification(TOKEN, initial));

    await act(async () => {
      await result.current.sendDocument(photo(), frontHash);
    });

    expect(result.current.looksLikeTheFront(frontHash)).toBe(false);
  });

  it('useIdentityVerification_AFrontWithNoHash_LeavesNoneAndAHashWithNoFrontFlagsNothing', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({ ...refusal('document_back_needed'), side: 'front' });
    const initial = state();
    const { result } = renderHook(() => useIdentityVerification(TOKEN, initial));

    await act(async () => {
      await result.current.sendDocument(photo());
    });

    expect(result.current.looksLikeTheFront(frontHash)).toBe(false);
  });

  it('useIdentityVerification_TheVerificationEndsWithAPerson_TheHashIsLetGo', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce(refusal('document_back_needed'));
    vi.mocked(publicCheckinApi.requestOperator).mockResolvedValue({ result: 'operator', operatorPathOpen: true, state: state({ step: 'operator', operatorRequested: true, closed: true, outcome: 'operator' }) });
    const initial = state();
    const { result } = renderHook(() => useIdentityVerification(TOKEN, initial));
    await act(async () => {
      await result.current.sendDocument(photo(), frontHash);
    });
    expect(result.current.looksLikeTheFront(frontHash)).toBe(true);

    await act(async () => {
      await result.current.askOperator();
    });

    expect(result.current.looksLikeTheFront(frontHash)).toBe(false);
  });

  it('useIdentityVerification_AFinalCodeOnTheBack_LetsGoOfTheHash', async () => {
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce(refusal('document_back_needed')).mockResolvedValueOnce({ ...refusal('document_unreadable'), side: 'back' });
    const initial = state();
    const { result } = renderHook(() => useIdentityVerification(TOKEN, initial));
    await act(async () => {
      await result.current.sendDocument(photo(), frontHash);
    });
    await act(async () => {
      await result.current.sendDocument(photo(), farFromIt);
    });

    expect(result.current.progress?.stage).toBe('operator');
    expect(result.current.looksLikeTheFront(frontHash)).toBe(false);
  });
});
