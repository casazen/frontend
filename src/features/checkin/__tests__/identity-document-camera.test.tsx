import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { publicCheckinApi } from '@/api/checkin.api';
import { DOCUMENT_JPEG_QUALITY, DOCUMENT_MAX_WIDTH, frameToDocumentPhoto } from '@/lib/image-capture';
import { expectNoAxeViolations } from '@/test/axe';
import type { IdentityVerificationState } from '@/types/public-checkin.types';
import { IdentityDocumentCapture } from '../components/identity-document-capture';
import { IdentityStep } from '../identity-step';
import { useIdentityVerification } from '../use-identity-verification';
import { blurredFrame, brightFrame, darkFrame, farFrame, glareFrame, goodFrame, uprightFrame, type SyntheticFrame } from './document-frames';

vi.mock('@/api/checkin.api', () => ({
  publicCheckinApi: {
    getLegalTexts: vi.fn(),
    openIdentity: vi.fn(),
    postBiometricConsent: vi.fn(),
    postDocument: vi.fn(),
    postSelfie: vi.fn(),
    startSelfieChallenge: vi.fn(),
    startPresenceChallenge: vi.fn(),
    postPresence: vi.fn(),
    requestOperator: vi.fn(),
  },
}));

/** What the camera shows: the size of its frames and the pixels the checks get of them. */
const camera = {
  frame: goodFrame() as SyntheticFrame,
  size: { width: 1280, height: 720 },
};

/** What the canvases were asked to encode. */
let encoded: Array<{ width: number; height: number; type: string | undefined; quality: unknown }> = [];

const originalWidth = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoWidth');
const originalHeight = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoHeight');
const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');

/** A camera that works: a stream with one track that can be stopped and can end by itself. */
function stubCamera(rejectWith?: { name: string }) {
  const stop = vi.fn();
  const endedListeners: Array<() => void> = [];
  const track = {
    stop,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'ended') endedListeners.push(listener);
    },
  };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = rejectWith ? vi.fn().mockRejectedValue(rejectWith) : vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  return { stop, getUserMedia, endTheTrack: () => endedListeners.forEach((listener) => listener()) };
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** Lets what is waiting (the answer of the camera, a promise of the send) settle, with the clock where it is. */
const settle = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });

/** Moves the clock by `ms`, in the one hold React wants for what that sets in motion. */
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** Moves the clock in small steps until the condition holds (the screen is awaited, never a window of time guessed in advance). */
async function advanceUntil(done: () => boolean, step = 100, limit = 80) {
  for (let spent = 0; spent < limit && !done(); spent += 1) await advance(step);
  expect(done()).toBe(true);
}

const button = () => screen.getByTestId('checkin-identity-camera-capture') as HTMLButtonElement;
const hint = () => screen.getByTestId('checkin-identity-camera-hint');
const shot = () => screen.getByTestId('checkin-identity-camera-shot') as HTMLCanvasElement;
const text = (key: string) => i18n.t(key);

type CaptureProps = ComponentProps<typeof IdentityDocumentCapture>;

function renderCapture(overrides: Partial<CaptureProps> = {}) {
  const onPhoto = vi.fn<NonNullable<CaptureProps['onPhoto']>>().mockResolvedValue(true);
  const looksLikeTheFront = vi.fn<(fingerprint: string) => boolean>().mockReturnValue(false);
  const onRequestOperator = vi.fn();
  const props: CaptureProps = {
    refused: false,
    guidanceCodes: [],
    side: 'front',
    twoSided: true,
    frontReceived: false,
    busy: false,
    selfHosted: true,
    onPhoto,
    looksLikeTheFront,
    onRequestOperator,
    ...overrides,
  };
  const view = render(<IdentityDocumentCapture {...props} />);
  return { ...view, onPhoto, looksLikeTheFront, onRequestOperator, update: (next: Partial<CaptureProps>) => view.rerender(<IdentityDocumentCapture {...props} {...next} />) };
}

/** The camera is open and the checks pass for long enough: the button of the photo is awake. */
async function waitForTheButton() {
  await settle();
  await advanceUntil(() => !button().disabled);
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  camera.frame = goodFrame();
  camera.size = { width: 1280, height: 720 };
  encoded = [];
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => camera.size.width });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => camera.size.height });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ drawImage: vi.fn(), getImageData: vi.fn(() => camera.frame) }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (this: HTMLCanvasElement, callback, type, quality) {
    encoded.push({ width: this.width, height: this.height, type, quality });
    callback(new Blob(['jpeg'], { type }));
  });
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  if (originalWidth) Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', originalWidth);
  if (originalHeight) Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', originalHeight);
  if (originalHidden) Object.defineProperty(Document.prototype, 'hidden', originalHidden);
  Reflect.deleteProperty(document, 'hidden');
  localStorage.clear();
  sessionStorage.clear();
});

describe('identity-document-camera: the rear camera with the outline of the card (E71/F02/US01/T01, AC1)', () => {
  it('DocumentCameraGuide_SelfHosted_OpensTheRearCameraWithTheOutlineOfTheCardAndAHintLine', async () => {
    const rig = stubCamera();
    renderCapture();
    await settle();

    expect(rig.getUserMedia).toHaveBeenCalledTimes(1);
    expect(rig.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
    expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-camera', 'live');
    expect(screen.getByTestId('checkin-identity-camera-video')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-camera-overlay')).toHaveAttribute('aria-hidden', 'true');
    // The side that is asked is on the button: the front first.
    expect(button()).toHaveTextContent(text('checkin.identity.document.camera.captureFront'));
  });

  it('DocumentCameraGuide_TheSideAskedIsTheBack_TheButtonSaysTheBack', async () => {
    stubCamera();
    renderCapture({ side: 'back' });
    await settle();

    expect(button()).toHaveTextContent(text('checkin.identity.document.camera.captureBack'));
  });

  it('DocumentCameraGuide_WithoutSelfHosted_IsTheScreenItAlwaysWasAndNoCameraIsOpened', async () => {
    const rig = stubCamera();
    renderCapture({ selfHosted: false });
    await settle();

    expect(rig.getUserMedia).not.toHaveBeenCalled();
    expect(screen.queryByTestId('checkin-identity-camera')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-document-pick')).toHaveTextContent(text('checkin.identity.document.pick'));
    expect(screen.getByTestId('checkin-identity-document-file')).toHaveAttribute('accept', 'image/jpeg,image/png');
  });

  it('DocumentCameraGuide_TheHintLine_IsAPoliteLiveRegionThatIsThereBeforeItSaysAnything', async () => {
    stubCamera();
    renderCapture();

    expect(hint()).toHaveAttribute('aria-live', 'polite');
    await settle();
    expect(hint()).toHaveAttribute('aria-live', 'polite');
  });

  it('DocumentCameraGuide_ButtonsAndAnimation_AreAtLeast44PixelsAndRespectReducedMotion', async () => {
    stubCamera();
    renderCapture();
    await settle();

    // `size="lg"` is the 44 px of the buttons (h-11); the outline moves only for who accepts motion.
    expect(button().className).toContain('h-11');
    expect(screen.getByTestId('checkin-identity-document-pick').className).toContain('h-11');
    const overlay = screen.getByTestId('checkin-identity-camera-overlay').className;
    expect(overlay).toContain('motion-safe:transition-colors');
    expect(overlay).toContain('motion-reduce:transition-none');
    expect(overlay).not.toMatch(/(^|\s)animate-/);
  });
});

describe('identity-document-camera: the live checks and the button of the photo (AC1, AC4)', () => {
  it.each([
    ['dark', darkFrame, { width: 1280, height: 720 }],
    ['bright', brightFrame, { width: 1280, height: 720 }],
    ['glare', glareFrame, { width: 1280, height: 720 }],
    ['blur', blurredFrame, { width: 1280, height: 720 }],
    ['edges', farFrame, { width: 1280, height: 720 }],
    ['orientation', uprightFrame, { width: 720, height: 1280 }],
  ] as const)('DocumentCameraGuide_The%sCheckFails_ThePageSaysItAndTheButtonStaysAsleep', async (check, frame, size) => {
    stubCamera();
    camera.frame = frame();
    camera.size = { ...size };
    renderCapture();
    await settle();

    await advanceUntil(() => hint().getAttribute('data-hint') === check);
    expect(hint()).toHaveTextContent(text(`checkin.identity.document.camera.hint.${check}`));
    await advance(2_000);
    expect(button()).toBeDisabled();
    expect(screen.getByTestId('checkin-identity-camera-overlay')).toHaveAttribute('data-ready', 'false');
  });

  it('DocumentCameraGuide_TheChecksPass_TheButtonWakesUpOnlyAfterHalfASecondOfPasses', async () => {
    stubCamera();
    renderCapture();
    await settle();
    const opened = Date.now();

    // 300 ms of passes are not enough.
    await advance(300);
    expect(button()).toBeDisabled();

    await advanceUntil(() => !button().disabled);
    expect(Date.now() - opened).toBeGreaterThanOrEqual(500);
    expect(screen.getByTestId('checkin-identity-camera-overlay')).toHaveAttribute('data-ready', 'true');
    await advanceUntil(() => hint().getAttribute('data-hint') === 'ready');
    expect(hint()).toHaveTextContent(text('checkin.identity.document.camera.hint.ready'));
  });

  it('DocumentCameraGuide_AFrameThatFailsInTheMiddle_PutsTheButtonBackToSleepAndStartsTheWaitAgain', async () => {
    stubCamera();
    renderCapture();
    await settle();
    await advanceUntil(() => !button().disabled);

    camera.frame = darkFrame();
    await advanceUntil(() => button().disabled);

    camera.frame = goodFrame();
    await advance(200);
    // It has passed once, not for half a second: still asleep.
    expect(button()).toBeDisabled();
    await advanceUntil(() => !button().disabled);
  });

  it('DocumentCameraGuide_TheButtonIsAwakeButACallIsInFlight_StaysDisabled', async () => {
    stubCamera();
    const view = renderCapture();
    await waitForTheButton();

    view.update({ busy: true });

    expect(button()).toBeDisabled();
  });

  it('DocumentCameraGuide_TheScreenIsRotated_FollowsTheFrameWithoutOpeningTheCameraAgainOrLosingTheSide', async () => {
    const rig = stubCamera();
    renderCapture({ side: 'back' });
    await waitForTheButton();

    // The phone is turned upright: the frame is taller than wide.
    camera.frame = uprightFrame();
    camera.size = { width: 720, height: 1280 };
    await advanceUntil(() => hint().getAttribute('data-hint') === 'orientation');
    expect(button()).toBeDisabled();
    expect(screen.getByTestId('checkin-identity-document')).toHaveAttribute('data-side', 'back');

    // And back: the checks count half a second again, and the button wakes up.
    camera.frame = goodFrame();
    camera.size = { width: 1280, height: 720 };
    await advanceUntil(() => !button().disabled);
    expect(rig.getUserMedia).toHaveBeenCalledTimes(1);
    expect(rig.stop).not.toHaveBeenCalled();
    expect(button()).toHaveTextContent(text('checkin.identity.document.camera.captureBack'));
  });
});

describe('identity-document-camera: the photo (AC3)', () => {
  it('DocumentCameraGuide_TheGuestTakesThePhoto_IsAJpegWithTheLimitsOfTheDocumentSentOnceAndTheCanvasIsEmptiedAfterTheAnswer', async () => {
    const rig = stubCamera();
    const view = renderCapture();
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    expect(view.onPhoto).toHaveBeenCalledTimes(1);
    const [photo, fingerprint] = view.onPhoto.mock.calls[0];
    expect(photo).toBeInstanceOf(File);
    expect(photo.type).toBe('image/jpeg');
    // The frame of the camera, at the limits of the photo of a document: 1280 px wide stays 1280, at 85 %.
    expect(encoded).toEqual([{ width: 1280, height: 720, type: 'image/jpeg', quality: DOCUMENT_JPEG_QUALITY }]);
    expect(DOCUMENT_JPEG_QUALITY).toBe(0.85);
    expect(fingerprint).toMatch(/^[0-9a-f]{16}$/);
    // The camera was stopped at the shot, and the canvas that held the frame is emptied once the API has answered.
    expect(rig.stop).toHaveBeenCalled();
    expect(shot().width).toBe(0);
    expect(shot().height).toBe(0);
  });

  it('DocumentCameraGuide_TheCameraGivesMoreThan2560Pixels_TheJpegIsBroughtTo2560WideAtMost', async () => {
    stubCamera();
    camera.size = { width: 3840, height: 2160 };
    const view = renderCapture();
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    expect(view.onPhoto).toHaveBeenCalledTimes(1);
    expect(DOCUMENT_MAX_WIDTH).toBe(2560);
    expect(encoded).toEqual([{ width: 2560, height: 1440, type: 'image/jpeg', quality: 0.85 }]);
  });

  it('DocumentCameraGuide_TheGuestTapsTwice_TheSideIsSentOnceAndNeverTwice', async () => {
    stubCamera();
    const view = renderCapture();
    await waitForTheButton();

    // Two taps before the screen has drawn what the first one did (the button is still there for the second).
    const take = button();
    act(() => {
      fireEvent.click(take);
      fireEvent.click(take);
    });
    await settle();

    expect(view.onPhoto).toHaveBeenCalledTimes(1);
  });

  it('DocumentCameraGuide_TheApiAnswered_TheCameraOpensAgainForTheNextPhoto', async () => {
    const rig = stubCamera();
    renderCapture();
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    // The other side, or this one again with its guidance: either way a new photo is asked.
    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-held', 'none');
    expect(shot().width).toBe(0);
  });

  it('DocumentCameraGuide_TheCallFailed_KeepsTheFrameForTheSameAttemptAndSendsItAgainWithoutTakingItAgain', async () => {
    const rig = stubCamera();
    const view = renderCapture();
    view.onPhoto.mockResolvedValueOnce(false);
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    // Nothing was lost: the frame is still on the canvas and the guest can send it again.
    expect(screen.getByTestId('checkin-identity-camera-failed')).toBeInTheDocument();
    expect(shot().width).toBe(1280);
    expect(rig.getUserMedia).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('checkin-identity-camera-send-again'));
    await settle();

    expect(view.onPhoto).toHaveBeenCalledTimes(2);
    expect(shot().width).toBe(0);
    expect(screen.queryByTestId('checkin-identity-camera-failed')).not.toBeInTheDocument();
  });

  it('DocumentCameraGuide_TheCallFailedAndTheGuestTakesItAgain_NothingIsSentAndTheCameraOpens', async () => {
    const rig = stubCamera();
    const view = renderCapture();
    view.onPhoto.mockResolvedValueOnce(false);
    await waitForTheButton();
    fireEvent.click(button());
    await settle();

    fireEvent.click(screen.getByTestId('checkin-identity-camera-retake'));
    await settle();

    expect(view.onPhoto).toHaveBeenCalledTimes(1);
    expect(shot().width).toBe(0);
    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('DocumentCameraGuide_TheBrowserCannotEncodeTheFrame_SaysSoAndOffersOnlyToTakeItAgain', async () => {
    stubCamera();
    const view = renderCapture();
    await waitForTheButton();
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));

    fireEvent.click(button());
    await settle();

    expect(view.onPhoto).not.toHaveBeenCalled();
    expect(screen.getByTestId('checkin-identity-camera-not-prepared')).toHaveTextContent(text('checkin.biometric.capture.notPrepared'));
    expect(screen.queryByTestId('checkin-identity-camera-send-again')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-camera-retake')).toBeEnabled();
  });

  it('frameToDocumentPhoto_AFrame_IsAFileOfTheDocumentWithTheLimitsOfTheDocumentAndTheCanvasItDrewOnIsEmptied', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 5000;
    canvas.height = 3000;

    const photo = await frameToDocumentPhoto(canvas);

    expect(photo.type).toBe('image/jpeg');
    expect(photo.name).toBe('document.jpg');
    expect(encoded).toEqual([{ width: 2560, height: 1536, type: 'image/jpeg', quality: 0.85 }]);
  });
});

describe('identity-document-camera: the camera is stopped when it is not needed (AC3)', () => {
  it('DocumentCameraGuide_TheStepIsLeft_EveryTrackIsStopped', async () => {
    const rig = stubCamera();
    const view = renderCapture();
    await settle();
    expect(rig.stop).not.toHaveBeenCalled();

    view.unmount();

    expect(rig.stop).toHaveBeenCalledTimes(1);
  });

  it('DocumentCameraGuide_TheStepIsLeftBeforeTheBrowserAnswers_TheCameraThatComesLaterIsStoppedAtOnce', async () => {
    const rig = stubCamera();
    let grant: (stream: MediaStream) => void = () => undefined;
    const stop = vi.fn();
    rig.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => (grant = resolve)));
    const view = renderCapture();
    view.unmount();

    await act(async () => {
      grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('DocumentCameraGuide_ThePageIsHidden_TheCameraIsStoppedAndOpensAgainWhenThePageComesBack', async () => {
    const rig = stubCamera();
    renderCapture();
    await settle();

    setHidden(true);
    expect(rig.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-camera', 'paused');

    setHidden(false);
    await settle();

    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-camera', 'live');
  });

  it('DocumentCameraGuide_TheBrowserAnswersWhileThePageIsHidden_TheCameraIsNotKept', async () => {
    const rig = stubCamera();
    const stop = vi.fn();
    let grant: (stream: MediaStream) => void = () => undefined;
    rig.getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => (grant = resolve)));
    renderCapture();
    setHidden(true);

    await act(async () => {
      grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-camera', 'paused');
  });

  it('DocumentCameraGuide_TheCameraEndsByItself_IsStoppedAndSaysItCouldNotBeKept', async () => {
    const rig = stubCamera();
    renderCapture();
    await settle();

    act(() => rig.endTheTrack());

    expect(rig.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('checkin-identity-camera-problem')).toHaveAttribute('data-problem', 'unknown');
    expect(screen.getByTestId('checkin-identity-camera-retry')).toBeEnabled();
  });

  it('DocumentCameraGuide_TheFrameIsTaken_TheCameraIsStoppedBeforeTheSendIsAnswered', async () => {
    const rig = stubCamera();
    const view = renderCapture();
    let answer: (answered: boolean) => void = () => undefined;
    view.onPhoto.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    expect(rig.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-held', 'sending');
    expect(screen.queryByTestId('checkin-identity-camera-capture')).not.toBeInTheDocument();

    await act(async () => {
      answer(true);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(shot().width).toBe(0);
  });
});

describe('identity-document-camera: without a camera the file and the person are there, and the reason is said (AC1)', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'not_found'],
    ['NotReadableError', 'unknown'],
  ])('DocumentCameraGuide_The%sOfTheBrowser_SaysWhyAndKeepsTheFileOfThePhone', async (name, problem) => {
    stubCamera({ name });
    const view = renderCapture();
    await settle();

    const block = screen.getByTestId('checkin-identity-camera-problem');
    expect(block).toHaveAttribute('data-problem', problem);
    expect(block).toHaveTextContent(text(`checkin.identity.document.camera.problem.${problem}`));
    expect(block).toHaveTextContent(text('checkin.identity.document.camera.problem.fallback'));
    expect(screen.queryByTestId('checkin-identity-camera-capture')).not.toBeInTheDocument();

    // The file of the phone works as it does without the camera: the same input, the same types, the photo goes to the same call.
    const input = screen.getByTestId('checkin-identity-document-file');
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png');
    const file = new File(['document'], 'document.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(view.onPhoto).toHaveBeenCalledWith(file);
  });

  it('DocumentCameraGuide_TheBrowserBlockedTheCamera_TheGuestCanAllowItAndTryAgain', async () => {
    const rig = stubCamera({ name: 'NotAllowedError' });
    renderCapture();
    await settle();
    rig.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: rig.stop }] } as unknown as MediaStream);

    fireEvent.click(screen.getByTestId('checkin-identity-camera-retry'));
    await settle();

    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-camera', 'live');
    expect(screen.queryByTestId('checkin-identity-camera-problem')).not.toBeInTheDocument();
  });

  it('DocumentCameraGuide_ThePageCannotUseACamera_SaysSoWithNoButtonToTryAgain', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    renderCapture();
    await settle();

    expect(screen.getByTestId('checkin-identity-camera-problem')).toHaveAttribute('data-problem', 'unsupported');
    expect(screen.getByTestId('checkin-identity-camera-problem')).toHaveTextContent(text('checkin.identity.document.camera.problem.unsupported'));
    expect(screen.queryByTestId('checkin-identity-camera-retry')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-document-file')).toBeEnabled();
  });

  it('DocumentCameraGuide_TheCameraIsOpenAndTheGuestPrefersTheFile_TheFileGoesToTheSameCallWithTheSameChecks', async () => {
    stubCamera();
    const view = renderCapture();
    await settle();

    const file = new File(['document'], 'front.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [file] } });

    expect(view.onPhoto).toHaveBeenCalledWith(file);
    expect(screen.getByTestId('checkin-identity-document-pick')).toHaveTextContent(text('checkin.identity.document.camera.chooseFile'));
  });
});

describe('identity-document-camera: a back that looks like the front (T02, AC3)', () => {
  it('DocumentCameraGuide_TheBackLooksLikeTheFront_AsksBeforeSendingAndTheGuestCanTakeItAgain', async () => {
    const rig = stubCamera();
    const view = renderCapture({ side: 'back' });
    view.looksLikeTheFront.mockReturnValue(true);
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    expect(view.looksLikeTheFront).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{16}$/));
    expect(view.onPhoto).not.toHaveBeenCalled();
    const warning = screen.getByTestId('checkin-identity-camera-duplicate');
    expect(warning).toHaveTextContent(text('checkin.identity.document.camera.duplicate.title'));
    // The frame that was taken is what the guest sees, and the camera is off.
    expect(shot().width).toBe(1280);

    fireEvent.click(screen.getByTestId('checkin-identity-camera-duplicate-retake'));
    await settle();

    expect(screen.queryByTestId('checkin-identity-camera-duplicate')).not.toBeInTheDocument();
    expect(view.onPhoto).not.toHaveBeenCalled();
    expect(shot().width).toBe(0);
    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('DocumentCameraGuide_TheBackLooksLikeTheFront_TheGuestCanSendItAnywayAndTheServerDecides', async () => {
    stubCamera();
    const view = renderCapture({ side: 'back' });
    view.looksLikeTheFront.mockReturnValue(true);
    await waitForTheButton();
    fireEvent.click(button());
    await settle();

    fireEvent.click(screen.getByTestId('checkin-identity-camera-duplicate-send'));
    await settle();

    expect(view.onPhoto).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('checkin-identity-camera-duplicate')).not.toBeInTheDocument();
  });

  it('DocumentCameraGuide_TheFrontIsTaken_NoOneAsksWhetherItLooksLikeTheFront', async () => {
    stubCamera();
    const view = renderCapture({ side: 'front' });
    view.looksLikeTheFront.mockReturnValue(true);
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    expect(view.looksLikeTheFront).not.toHaveBeenCalled();
    expect(view.onPhoto).toHaveBeenCalledTimes(1);
  });

  it('DocumentCameraGuide_TheSideChangesWhileTheQuestionAboutAFrameIsOnTheScreen_TheFrameIsLetGoAndTheCameraOpensForTheNewSide', async () => {
    const rig = stubCamera();
    const view = renderCapture({ side: 'back' });
    view.looksLikeTheFront.mockReturnValue(true);
    await waitForTheButton();
    fireEvent.click(button());
    await settle();

    const heldFrame = shot();
    expect(screen.getByTestId('checkin-identity-camera-duplicate')).toBeInTheDocument();
    expect(heldFrame.width).toBe(1280);

    // The other way (the file of the phone) answered the side while the frame was held: the screen of that side goes, and its frame with it.
    view.update({ side: 'front' });
    await settle();

    expect(screen.queryByTestId('checkin-identity-camera-duplicate')).not.toBeInTheDocument();
    expect(heldFrame.isConnected).toBe(false);
    expect(heldFrame.width).toBe(0);
    expect(heldFrame.height).toBe(0);
    expect(view.onPhoto).not.toHaveBeenCalled();
    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
    await advanceUntil(() => !button().disabled);
    expect(button()).toHaveTextContent(text('checkin.identity.document.camera.captureFront'));
  });
});

describe('identity-document-camera: nothing of the frame is kept anywhere (privacy)', () => {
  it('DocumentCameraGuide_AFullShot_WritesNothingToAnyStorageAndLogsNothing', async () => {
    stubCamera();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const consoleCalls = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'debug'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    const view = renderCapture();
    await waitForTheButton();

    fireEvent.click(button());
    await settle();
    view.unmount();

    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
    for (const call of consoleCalls) expect(call).not.toHaveBeenCalled();
    expect(window.location.href).not.toMatch(/base64|data:|blob:/);
  });
});

describe('identity-document-camera: accessibility', () => {
  // axe-core waits on timers of its own: these tests run on the real clock, and wait for the screen, not for a window of time.
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('DocumentCameraGuide_TheCameraIsLive_HasNoAccessibilityViolations', async () => {
    stubCamera();
    const { container } = renderCapture();
    await waitFor(() => expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-camera', 'live'));

    await expectNoAxeViolations(container);
  });

  it('DocumentCameraGuide_TheCameraIsNotThere_HasNoAccessibilityViolations', async () => {
    stubCamera({ name: 'NotAllowedError' });
    const { container } = renderCapture();
    await waitFor(() => expect(screen.getByTestId('checkin-identity-camera-problem')).toBeInTheDocument());

    await expectNoAxeViolations(container);
  });

  it('DocumentCameraGuide_TheWarningBeforeTheBack_HasNoAccessibilityViolations', async () => {
    stubCamera();
    const view = renderCapture({ side: 'back' });
    view.looksLikeTheFront.mockReturnValue(true);
    await waitFor(() => expect(button()).toBeEnabled(), { timeout: 10_000 });
    fireEvent.click(button());
    await screen.findByTestId('checkin-identity-camera-duplicate');

    await expectNoAxeViolations(view.container);
  });
});

describe('identity-document-camera: inside the identity step of a self-hosted verification (T01 + T02)', () => {
  const TOKEN = 'tok-camera';

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

  function Harness({ initial }: { initial: IdentityVerificationState }) {
    const identity = useIdentityVerification(TOKEN, initial);
    return <IdentityStep identity={identity} token={TOKEN} />;
  }

  function renderStep(initial: IdentityVerificationState = state()) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <Harness initial={initial} />
      </QueryClientProvider>,
    );
  }

  it('IdentityStep_TheGuestTakesTheFront_SendsTheJpegOfTheCameraWithTheSideAskedAndGoesOnToTheBack', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValue({
      success: true,
      acceptable: false,
      guidanceCodes: ['document_back_needed'],
      documentStored: true,
      documentNotArchived: false,
      side: 'front',
      sides: ['front'],
    });
    renderStep();
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    expect(publicCheckinApi.postDocument).toHaveBeenCalledTimes(1);
    const [token, photo, side] = vi.mocked(publicCheckinApi.postDocument).mock.calls[0];
    expect(token).toBe(TOKEN);
    expect(side).toBe('front');
    expect((photo as Blob).type).toBe('image/jpeg');
    // The front was good and the card has its lines of letters on the back: the camera is asked for the back, with no word of refusal.
    expect(screen.getByTestId('checkin-identity-document')).toHaveAttribute('data-side', 'back');
    expect(screen.queryByTestId('checkin-identity-document-guidance')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-camera-capture')).toHaveTextContent(text('checkin.identity.document.camera.captureBack'));
  });

  it('IdentityStep_TheBackLooksLikeTheFrontJustTaken_TheGuestIsAskedBeforeItGoesUp', async () => {
    stubCamera();
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce({
      success: true,
      acceptable: false,
      guidanceCodes: ['document_back_needed'],
      documentStored: true,
      documentNotArchived: false,
      side: 'front',
      sides: ['front'],
    });
    renderStep();
    await waitForTheButton();
    fireEvent.click(button());
    await settle();
    expect(screen.getByTestId('checkin-identity-document')).toHaveAttribute('data-side', 'back');

    // The camera still shows the same card: the frame of the back has the same hash as the front.
    await advanceUntil(() => !button().disabled);
    fireEvent.click(button());
    await settle();

    expect(screen.getByTestId('checkin-identity-camera-duplicate')).toBeInTheDocument();
    expect(publicCheckinApi.postDocument).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('checkin-identity-camera-duplicate-send'));
    await settle();
    expect(publicCheckinApi.postDocument).toHaveBeenCalledTimes(2);
    expect(vi.mocked(publicCheckinApi.postDocument).mock.calls[1][2]).toBe('back');
  });

  it('IdentityStep_TheBrowserDeniesTheCamera_SaysWhyAndThePathOfAPersonIsOnTheScreen', async () => {
    stubCamera({ name: 'NotAllowedError' });
    renderStep();
    await settle();

    expect(screen.getByTestId('checkin-identity-camera-problem')).toHaveTextContent(text('checkin.identity.document.camera.problem.denied'));
    expect(screen.getByTestId('checkin-identity-assisted-path')).toBeEnabled();
    expect(screen.getByTestId('checkin-identity-document-pick')).toBeEnabled();
  });

  it('IdentityStep_TheNetworkFailsDuringTheSend_TheGuestSendsTheSameFrameAgainAndTheGoodSideIsNotAskedAgain', async () => {
    const rig = stubCamera();
    vi.mocked(publicCheckinApi.postDocument).mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK', isAxiosError: true }));
    renderStep();
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    expect(screen.getByTestId('checkin-identity-camera-failed')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-identity-problem')).toHaveTextContent(text('checkin.identity.problem.network'));
    expect(shot().width).toBe(1280);

    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce({
      success: true,
      acceptable: true,
      guidanceCodes: [],
      documentStored: true,
      documentNotArchived: false,
      side: 'single',
      sides: ['single'],
    });
    fireEvent.click(screen.getByTestId('checkin-identity-camera-send-again'));
    await settle();

    expect(publicCheckinApi.postDocument).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'presence');
    // The document is done: the rear camera was not opened once more for a photo nobody asks for (the front camera of the presence, which comes next, is another call), and the one that was open is stopped.
    const rearCameraCalls = rig.getUserMedia.mock.calls.filter(([constraints]) => (constraints as { video: { facingMode: string } }).video.facingMode === 'environment');
    expect(rearCameraCalls).toHaveLength(1);
    expect(screen.queryByTestId('checkin-identity-camera')).not.toBeInTheDocument();
    expect(rig.stop).toHaveBeenCalled();
  });

  it('IdentityStep_TheCameraSendFailedAndTheFileIsTakenAsTheFront_TheOldFrameIsLetGoAndNeverGoesUpAsTheBack', async () => {
    const rig = stubCamera();
    vi.mocked(publicCheckinApi.postDocument).mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK', isAxiosError: true }));
    renderStep();
    await waitForTheButton();

    fireEvent.click(button());
    await settle();

    // The send failed: the frame of the front waits on the screen to be sent again.
    const heldFrame = shot();
    expect(screen.getByTestId('checkin-identity-camera-failed')).toBeInTheDocument();
    expect(heldFrame.width).toBe(1280);
    expect(publicCheckinApi.postDocument).toHaveBeenCalledTimes(1);

    // The guest chooses the file of the phone instead: the server takes it as the front and asks for the back.
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce({
      success: true,
      acceptable: false,
      guidanceCodes: ['document_back_needed'],
      documentStored: true,
      documentNotArchived: false,
      side: 'front',
      sides: ['front'],
    });
    fireEvent.change(screen.getByTestId('checkin-identity-document-file'), { target: { files: [new File(['front'], 'front.jpg', { type: 'image/jpeg' })] } });
    await settle();

    expect(publicCheckinApi.postDocument).toHaveBeenCalledTimes(2);
    expect(vi.mocked(publicCheckinApi.postDocument).mock.calls[1][2]).toBe('front');
    expect(screen.getByTestId('checkin-identity-document')).toHaveAttribute('data-side', 'back');
    // The frame of the front goes with the screen of the front: nothing offers to send it again (as the back), and its pixels are let go.
    expect(screen.queryByTestId('checkin-identity-camera-failed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-identity-camera-send-again')).not.toBeInTheDocument();
    expect(heldFrame.isConnected).toBe(false);
    expect(heldFrame.width).toBe(0);
    expect(heldFrame.height).toBe(0);
    expect(screen.getByTestId('checkin-identity-camera')).toHaveAttribute('data-held', 'none');

    // The camera is open for the back, and the only photo that can go up as the back is a new one.
    await waitForTheButton();
    expect(rig.getUserMedia).toHaveBeenCalledTimes(2);
    expect(button()).toHaveTextContent(text('checkin.identity.document.camera.captureBack'));
    vi.mocked(publicCheckinApi.postDocument).mockResolvedValueOnce({
      success: true,
      acceptable: true,
      guidanceCodes: [],
      documentStored: true,
      documentNotArchived: false,
      side: 'back',
      sides: ['front', 'back'],
    });
    fireEvent.click(button());
    await settle();

    expect(publicCheckinApi.postDocument).toHaveBeenCalledTimes(3);
    expect(vi.mocked(publicCheckinApi.postDocument).mock.calls[2][2]).toBe('back');
    // Two frames were ever encoded: the one that failed, and the new one of the back.
    expect(encoded).toHaveLength(2);
    expect(screen.getByTestId('checkin-identity-step')).toHaveAttribute('data-stage', 'presence');
  });
});
