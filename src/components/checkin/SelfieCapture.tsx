import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { canvasToJpeg, SELFIE_JPEG_QUALITY, SELFIE_MAX_WIDTH } from '@/lib/image-capture';

interface SelfieCaptureProps {
  /**
   * Sends the picture. Resolves `true` when the API answered (the picture is let go at once) and `false` when the call failed (the picture stays on
   * the screen, to be sent again without taking it again).
   */
  onCapture: (image: Blob) => Promise<boolean>;
  /** Attempts left before a person takes over; shown when known. */
  attemptsRemaining?: number | null;
  /** A call of the step is in flight (this one or another): the buttons stay disabled. */
  isProcessing?: boolean;
  /** The guest asks for a person: the way out of a camera that does not work, never a file picker. */
  onRequestOperator: () => void;
}

/** Why the camera is not there: the browser blocked it, there is none, this page cannot use one (no secure connection, an old browser), or anything else. */
type CameraProblem = 'denied' | 'not_found' | 'unsupported' | 'unknown';

const CAMERA_TEXT: Record<CameraProblem, string> = {
  denied: 'checkin.biometric.capture.cameraDenied',
  not_found: 'checkin.biometric.capture.cameraNotFound',
  unsupported: 'checkin.biometric.capture.cameraUnsupported',
  unknown: 'checkin.biometric.capture.cameraUnknown',
};

function cameraProblemOf(error: unknown): CameraProblem {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'not_found';
  return 'unknown';
}

/** The browser can open a camera at all (it cannot on a page without a secure connection). */
function canOpenCamera(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

/**
 * The selfie, taken with the camera only (ADR-013-R11): there is no file input anywhere, so a picture cannot be chosen from the files or the gallery.
 * When the browser blocks the camera the screen says how to allow it and offers a person; it never offers a file picker. The picture is drawn at most
 * 1920 px wide as a JPEG at 80 % (ADR-013-R12), held in memory for the request only and let go once the API has answered.
 */
export function SelfieCapture({ onCapture, attemptsRemaining = null, isProcessing = false, onRequestOperator }: SelfieCaptureProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mounted = useRef(false);
  const submitting = useRef(false);
  const [camera, setCamera] = useState<'starting' | 'ready' | CameraProblem>('starting');
  const [hasCapture, setHasCapture] = useState(false);
  const [notPrepared, setNotPrepared] = useState(false);

  const supported = canOpenCamera();
  const state: 'starting' | 'ready' | CameraProblem = supported ? camera : 'unsupported';

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  /** Opens the camera of the front; `isCurrent` says whether the screen is still the one that asked (it may have been left while the browser asked the guest). */
  const startCamera = useCallback(async (isCurrent: () => boolean = () => mounted.current) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamera('ready');
    } catch (error) {
      if (isCurrent()) setCamera(cameraProblemOf(error));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!canOpenCamera()) {
      return () => {
        mounted.current = false;
      };
    }
    let current = true;
    void startCamera(() => current);
    return () => {
      current = false;
      mounted.current = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const restartCamera = () => {
    setCamera('starting');
    void startCamera();
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    // A video that has not started has no picture yet: nothing is drawn, nothing is sent.
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    setNotPrepared(false);
    setHasCapture(true);
  };

  /** Lets the picture go: the pixels of the canvas are emptied (the canvas of the screen, or the one that was sent when the answer has ended the screen). */
  const clearCapture = (canvas: HTMLCanvasElement | null = canvasRef.current) => {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  };

  const retakePhoto = () => {
    clearCapture();
    setHasCapture(false);
    setNotPrepared(false);
    restartCamera();
  };

  const submitPhoto = async () => {
    const canvas = canvasRef.current;
    if (!canvas || submitting.current) return;
    submitting.current = true;
    try {
      let image: Blob;
      try {
        image = await canvasToJpeg(canvas, SELFIE_MAX_WIDTH, SELFIE_JPEG_QUALITY);
      } catch {
        setNotPrepared(true);
        return;
      }
      // The picture is a local of this call: once the API has answered nothing refers to it.
      const answered = await onCapture(image);
      if (answered) {
        // The canvas that was sent, not whatever the screen holds now: the answer may have ended the screen (a pass, a person), and the pixels go all the same.
        clearCapture(canvas);
        setHasCapture(false);
      }
    } finally {
      submitting.current = false;
    }
  };

  const problem = state === 'starting' || state === 'ready' ? null : state;

  return (
    <section className="space-y-4" aria-labelledby={titleId} data-testid="checkin-selfie-capture">
      <div className="space-y-1">
        <h4 id={titleId} className="text-base font-semibold">
          {t('checkin.biometric.capture.title')}
        </h4>
        <p className="text-sm text-muted-foreground">{t('checkin.biometric.capture.instructions')}</p>
      </div>

      <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
        <li>{t('checkin.identity.guidance.tip_remove_glasses')}</li>
        <li>{t('checkin.identity.guidance.tip_remove_mask')}</li>
      </ul>

      {problem ? (
        <div className="space-y-3" data-testid="selfie-camera-problem">
          <Alert variant="warning" role="alert" title={t('checkin.biometric.capture.cameraTitle')}>
            <p>{t(CAMERA_TEXT[problem])}</p>
            <p className="mt-1">{t('checkin.biometric.capture.noFile')}</p>
          </Alert>
          <div className="flex flex-col gap-3 sm:flex-row">
            {problem !== 'unsupported' && (
              <Button type="button" size="lg" onClick={restartCamera} disabled={isProcessing} data-testid="selfie-camera-retry">
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('checkin.biometric.capture.retryCamera')}
              </Button>
            )}
            <Button type="button" size="lg" variant="outline" onClick={onRequestOperator} disabled={isProcessing} data-testid="selfie-ask-operator">
              {t('checkin.identity.operator.ask')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label={t('checkin.biometric.capture.previewLabel')}
              className={`h-full w-full object-cover ${hasCapture ? 'hidden' : ''}`}
            />
            <canvas
              ref={canvasRef}
              aria-label={t('checkin.biometric.capture.capturedLabel')}
              role="img"
              className={`h-full w-full object-cover ${!hasCapture ? 'hidden' : ''}`}
            />
          </div>

          {attemptsRemaining !== null && (
            <p className="text-sm text-muted-foreground" data-testid="selfie-attempts-left">
              {t('checkin.biometric.capture.attemptsRemaining', { count: attemptsRemaining })}
            </p>
          )}

          {notPrepared && (
            <p role="alert" className="text-sm text-destructive" data-testid="selfie-not-prepared">
              {t('checkin.biometric.capture.notPrepared')}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {!hasCapture ? (
              <Button type="button" size="lg" onClick={capturePhoto} disabled={state !== 'ready' || isProcessing} className="flex-1" data-testid="selfie-take">
                <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('checkin.biometric.capture.takePhoto')}
              </Button>
            ) : (
              <>
                <Button type="button" size="lg" variant="outline" onClick={retakePhoto} disabled={isProcessing} className="flex-1" data-testid="selfie-retake">
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t('checkin.biometric.capture.retake')}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={() => void submitPhoto()}
                  disabled={isProcessing}
                  loading={isProcessing}
                  className="flex-1"
                  data-testid="selfie-send"
                >
                  {isProcessing ? t('checkin.biometric.capture.sending') : t('checkin.biometric.capture.submit')}
                </Button>
              </>
            )}
          </div>

          <div>
            <Button type="button" variant="ghost" onClick={onRequestOperator} disabled={isProcessing} data-testid="selfie-ask-operator">
              {t('checkin.identity.operator.ask')}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
