import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { frameToDocumentPhoto } from '@/lib/image-capture';
import { cn } from '@/lib/utils';
import type { DocumentSide } from '@/types/public-checkin.types';
import { fingerprintOfCanvas } from '../lib/document-fingerprint';
import { assessFrame, FIRST_HINT, isSteady, nextHint, overlayOf, steadySince, workingSizeOf, type GuideHint, type HintState } from '../lib/document-guidance';

interface DocumentCameraGuideProps {
  side: DocumentSide;
  busy: boolean;
  onPhoto: (photo: File, fingerprint: string | null) => Promise<boolean>;
  looksLikeTheFront: (fingerprint: string) => boolean;
}

type CameraProblem = 'denied' | 'not_found' | 'unsupported' | 'unknown';

/** Where the camera is: opening, running, stopped because a frame was taken, stopped because the page is hidden, or the reason it is not there. */
type CameraState = 'starting' | 'live' | 'stopped' | 'paused' | CameraProblem;

/** What is done with the frame that was taken: nothing (the camera is live), a warning that it looks like the front, the send, or a send that failed. */
type Held = 'none' | 'warning' | 'sending' | 'failed';

const PROBLEM_TEXT: Record<CameraProblem, string> = {
  denied: 'checkin.identity.document.camera.problem.denied',
  not_found: 'checkin.identity.document.camera.problem.not_found',
  unsupported: 'checkin.identity.document.camera.problem.unsupported',
  unknown: 'checkin.identity.document.camera.problem.unknown',
};

const HINT_TEXT: Record<GuideHint, string> = {
  waiting: 'checkin.identity.document.camera.hint.waiting',
  settling: 'checkin.identity.document.camera.hint.settling',
  ready: 'checkin.identity.document.camera.hint.ready',
  orientation: 'checkin.identity.document.camera.hint.orientation',
  dark: 'checkin.identity.document.camera.hint.dark',
  bright: 'checkin.identity.document.camera.hint.bright',
  edges: 'checkin.identity.document.camera.hint.edges',
  glare: 'checkin.identity.document.camera.hint.glare',
  blur: 'checkin.identity.document.camera.hint.blur',
};

const SAMPLE_INTERVAL_MS = 200;

const DEFAULT_FRAME = { width: 16, height: 9 };

function cameraProblemOf(error: unknown): CameraProblem {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'not_found';
  return 'unknown';
}

function canOpenCamera(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

function emptyCanvas(canvas: HTMLCanvasElement | null) {
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function watchForTheEnd(stream: MediaStream, onEnd: () => void) {
  for (const track of stream.getTracks()) {
    if (typeof track.addEventListener === 'function') track.addEventListener('ended', onEnd);
  }
}

/**
 * The rear camera that guides the photo of a side of the identity document (E71/F02/US01/T01, NF-189): the live picture with the outline of an ID-1 card on it and one line that says what to
 * change (the first thing that fails: the phone is upright, too little or too much light, the card is not on the outline, a reflection, a blurred picture). The button of the photo wakes up
 * when everything has held for half a second; there is no automatic shutter. The checks are a GUIDE: the server decides on the photo that is sent, and its codes come back after the upload.
 *
 * The frame is drawn on a canvas, encoded as a JPEG with the limits of the document photo and sent through `onPhoto`; the canvas is emptied once the API has answered, and nothing of the frame
 * is kept anywhere else (no storage, no address, no log). Every stream is stopped when the frame is taken, when the page is hidden, when the camera fails and when this screen goes. Without a
 * camera (denied, not found, not supported) it says why and the screen around it keeps the file of the phone and the way to a person. A back that looks like the front just taken is held for a
 * question first: take it again, or send it anyway.
 */
export function DocumentCameraGuide({ side, busy, onPhoto, looksLikeTheFront }: DocumentCameraGuideProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const shotRef = useRef<HTMLCanvasElement>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const submitting = useRef(false);
  const fingerprint = useRef<string | null>(null);
  const steady = useRef<number | null>(null);
  const hintState = useRef<HintState>(FIRST_HINT);
  const latestCamera = useRef<CameraState>('starting');

  const [attempt, setAttempt] = useState(0);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [held, setHeld] = useState<Held>('none');
  const [hint, setHint] = useState<GuideHint>('waiting');
  const [ready, setReady] = useState(false);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [notPrepared, setNotPrepared] = useState(false);

  const state: CameraState = canOpenCamera() ? camera : 'unsupported';
  const problem = state === 'denied' || state === 'not_found' || state === 'unsupported' || state === 'unknown' ? state : null;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const restart = useCallback(() => {
    steady.current = null;
    hintState.current = FIRST_HINT;
    setHint('waiting');
    setReady(false);
    setCamera('starting');
    setAttempt((value) => value + 1);
  }, []);

  const openCamera = useCallback(
    async (isCurrent: () => boolean) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false });
        if (!isCurrent() || document.hidden) {
          stream.getTracks().forEach((track) => track.stop());
          if (isCurrent()) setCamera('paused');
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        watchForTheEnd(stream, () => {
          if (!isCurrent()) return;
          stopCamera();
          setCamera('unknown');
        });
        setCamera('live');
      } catch (error) {
        if (isCurrent()) setCamera(cameraProblemOf(error));
      }
    },
    [stopCamera],
  );

  useEffect(() => {
    if (!canOpenCamera()) return undefined;
    let current = true;
    void openCamera(() => current);
    const shot = shotRef.current;
    return () => {
      current = false;
      stopCamera();
      emptyCanvas(shot);
      emptyCanvas(sampleRef.current);
    };
  }, [attempt, openCamera, stopCamera]);

  useEffect(() => {
    latestCamera.current = camera;
  }, [camera]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stopCamera();
        setCamera((now) => (now === 'live' || now === 'starting' ? 'paused' : now));
      } else if (latestCamera.current === 'paused') {
        restart();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [restart, stopCamera]);

  useEffect(() => {
    if (camera !== 'live') return undefined;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const { videoWidth, videoHeight } = video;
      if (!videoWidth || !videoHeight) {
        steady.current = null;
        hintState.current = nextHint(hintState.current, 'waiting');
        setHint(hintState.current.shown);
        setReady(false);
        return;
      }
      setFrame((previous) => (previous && previous.width === videoWidth && previous.height === videoHeight ? previous : { width: videoWidth, height: videoHeight }));

      const size = workingSizeOf(videoWidth, videoHeight);
      sampleRef.current ??= document.createElement('canvas');
      const canvas = sampleRef.current;
      if (canvas.width !== size.width) canvas.width = size.width;
      if (canvas.height !== size.height) canvas.height = size.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, size.width, size.height);
      const report = assessFrame(context.getImageData(0, 0, size.width, size.height));

      const now = Date.now();
      const passing = report.first === null;
      steady.current = steadySince(steady.current, passing, now);
      const holding = passing && isSteady(steady.current, now);
      hintState.current = nextHint(hintState.current, report.first ?? (holding ? 'ready' : 'settling'));
      setHint(hintState.current.shown);
      setReady(holding);
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [camera]);

  const letGoOfTheShot = (canvas: HTMLCanvasElement | null = shotRef.current) => {
    emptyCanvas(canvas);
    fingerprint.current = null;
  };

  const sendShot = async () => {
    const shot = shotRef.current;
    if (!shot || submitting.current) return;
    submitting.current = true;
    setHeld('sending');
    try {
      let photo: File;
      try {
        photo = await frameToDocumentPhoto(shot);
      } catch {
        setNotPrepared(true);
        setHeld('failed');
        return;
      }
      const answered = await onPhoto(photo, fingerprint.current);
      if (answered) {
        letGoOfTheShot(shot);
        setHeld('none');
        restart();
      } else {
        setHeld('failed');
      }
    } finally {
      submitting.current = false;
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const shot = shotRef.current;
    if (!video || !shot || state !== 'live' || !ready || busy || held !== 'none' || submitting.current) return;
    if (!video.videoWidth || !video.videoHeight) return;
    const context = shot.getContext('2d');
    if (!context) return;

    shot.width = video.videoWidth;
    shot.height = video.videoHeight;
    context.drawImage(video, 0, 0, shot.width, shot.height);
    stopCamera();
    setCamera('stopped');
    setNotPrepared(false);

    fingerprint.current = fingerprintOfCanvas(shot);
    if (side === 'back' && fingerprint.current !== null && looksLikeTheFront(fingerprint.current)) {
      setHeld('warning');
      return;
    }
    void sendShot();
  };

  const takeItAgain = () => {
    if (submitting.current) return;
    letGoOfTheShot();
    setNotPrepared(false);
    setHeld('none');
    restart();
  };

  const view = frame ?? DEFAULT_FRAME;
  const outline = overlayOf(view.width, view.height);
  const canTake = state === 'live' && ready && held === 'none' && !busy;

  if (problem) {
    return (
      <div className="space-y-3" data-testid="checkin-identity-camera">
        <div className="space-y-3" data-testid="checkin-identity-camera-problem" data-problem={problem}>
          <Alert variant="warning" role="alert" title={t('checkin.identity.document.camera.problem.title')}>
            <p>{t(PROBLEM_TEXT[problem])}</p>
            <p className="mt-1">{t('checkin.identity.document.camera.problem.fallback')}</p>
          </Alert>
          {problem !== 'unsupported' && (
            <Button type="button" size="lg" variant="outline" disabled={busy} onClick={restart} data-testid="checkin-identity-camera-retry">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('checkin.identity.document.camera.retryCamera')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const hintText = held === 'sending' ? t('checkin.identity.document.sending') : held === 'none' ? t(HINT_TEXT[state === 'paused' ? 'waiting' : hint]) : '';

  return (
    <div className="space-y-3" data-testid="checkin-identity-camera" data-camera={state} data-held={held}>
      <div
        className="relative mx-auto w-full overflow-hidden rounded-lg bg-black"
        style={{ aspectRatio: `${view.width} / ${view.height}`, maxWidth: `calc(70vh * ${view.width / view.height})` }}
        data-testid="checkin-identity-camera-view"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label={t('checkin.identity.document.camera.previewLabel')}
          className={cn('h-full w-full object-contain', held !== 'none' && 'hidden')}
          data-testid="checkin-identity-camera-video"
        />
        <canvas
          ref={shotRef}
          role="img"
          aria-label={t('checkin.identity.document.camera.heldLabel')}
          className={cn('h-full w-full object-contain', held === 'none' && 'hidden')}
          data-testid="checkin-identity-camera-shot"
        />
        {held === 'none' && (
          <div
            aria-hidden="true"
            data-testid="checkin-identity-camera-overlay"
            data-ready={ready}
            className={cn(
              'pointer-events-none absolute rounded-lg border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] motion-safe:transition-colors motion-reduce:transition-none',
              ready ? 'border-green-400' : 'border-white/90',
            )}
            style={{
              left: `${(outline.left / view.width) * 100}%`,
              top: `${(outline.top / view.height) * 100}%`,
              width: `${(outline.width / view.width) * 100}%`,
              height: `${(outline.height / view.height) * 100}%`,
            }}
          />
        )}
      </div>

      <p id={hintId} aria-live="polite" aria-atomic="true" className="min-h-6 text-sm font-medium" data-testid="checkin-identity-camera-hint" data-hint={held === 'none' ? hint : held}>
        {hintText}
      </p>

      {notPrepared && (
        <p role="alert" className="text-sm text-destructive" data-testid="checkin-identity-camera-not-prepared">
          {t('checkin.biometric.capture.notPrepared')}
        </p>
      )}

      {held === 'warning' && (
        <Alert variant="warning" role="alert" title={t('checkin.identity.document.camera.duplicate.title')} data-testid="checkin-identity-camera-duplicate">
          <p>{t('checkin.identity.document.camera.duplicate.text')}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Button type="button" size="lg" disabled={busy} onClick={takeItAgain} autoFocus data-testid="checkin-identity-camera-duplicate-retake">
              {t('checkin.identity.document.camera.retake')}
            </Button>
            <Button type="button" size="lg" variant="outline" disabled={busy} onClick={() => void sendShot()} data-testid="checkin-identity-camera-duplicate-send">
              {t('checkin.identity.document.camera.duplicate.send')}
            </Button>
          </div>
        </Alert>
      )}

      {held === 'failed' && (
        <div className="flex flex-col gap-3 sm:flex-row" data-testid="checkin-identity-camera-failed">
          {!notPrepared && (
            <Button type="button" size="lg" disabled={busy} onClick={() => void sendShot()} autoFocus data-testid="checkin-identity-camera-send-again">
              {t('checkin.identity.document.camera.sendAgain')}
            </Button>
          )}
          <Button type="button" size="lg" variant="outline" disabled={busy} onClick={takeItAgain} data-testid="checkin-identity-camera-retake">
            {t('checkin.identity.document.camera.retake')}
          </Button>
        </div>
      )}

      {held === 'none' && (
        <Button
          type="button"
          size="lg"
          disabled={!canTake}
          onClick={takePhoto}
          aria-describedby={hintId}
          className="w-full sm:w-auto"
          data-testid="checkin-identity-camera-capture"
        >
          <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
          {t(side === 'back' ? 'checkin.identity.document.camera.captureBack' : 'checkin.identity.document.camera.captureFront')}
        </Button>
      )}
    </div>
  );
}
