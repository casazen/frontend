import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import type { BiometricOutcome } from '@/types/public-checkin.types';

interface SelfieCaptureProps {
  onCapture: (imageBlob: Blob) => Promise<void>;
  attemptsUsed: number;
  maxAttempts: number;
  outcome?: BiometricOutcome | null;
  isProcessing?: boolean;
}

/**
 * Selfie capture component using camera only (no file upload) per ADR-013-R11.
 * Resizes to max 1920px width, 80% JPEG quality before upload per ADR-013-R12.
 * Shows attempt counter and three-level outcome (Accept/Escalate/Reject).
 */
export function SelfieCapture({
  onCapture,
  attemptsUsed,
  maxAttempts,
  outcome,
  isProcessing = false,
}: SelfieCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasCapture, setHasCapture] = useState(false);

  const attemptsRemaining = maxAttempts - attemptsUsed;

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError(t('checkin.biometric.capture.cameraError'));
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  /**
   * Resize image to max 1920px width, maintaining aspect ratio.
   * Compress to 80% JPEG quality per ADR-013-R12.
   */
  const resizeAndCompressImage = (
    sourceCanvas: HTMLCanvasElement,
    maxWidth: number = 1920,
    quality: number = 0.8
  ): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const width = sourceCanvas.width;
      const height = sourceCanvas.height;

      let targetWidth = width;
      let targetHeight = height;

      if (width > maxWidth) {
        targetWidth = maxWidth;
        targetHeight = (height * maxWidth) / width;
      }

      const resizeCanvas = document.createElement('canvas');
      resizeCanvas.width = targetWidth;
      resizeCanvas.height = targetHeight;

      const ctx = resizeCanvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

      resizeCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        quality
      );
    });
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    setHasCapture(true);
    stopCamera();
  };

  const retakePhoto = () => {
    setHasCapture(false);
    startCamera();
  };

  const submitPhoto = async () => {
    if (!canvasRef.current) return;

    try {
      const blob = await resizeAndCompressImage(canvasRef.current);
      await onCapture(blob);
      setHasCapture(false);
    } catch (err) {
      console.error('Failed to process image:', err);
    }
  };

  const getOutcomeVariant = (
    outcomeType: BiometricOutcome
  ): 'default' | 'destructive' => {
    switch (outcomeType) {
      case 'Accept':
        return 'default';
      case 'Escalate':
      case 'Reject':
        return 'destructive';
    }
  };

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{t('checkin.biometric.capture.title')}</CardTitle>
        <CardDescription>
          {t('checkin.biometric.capture.instructions')}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {cameraError ? (
          <Alert variant="destructive">
            <p>{cameraError}</p>
          </Alert>
        ) : null}

        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover ${hasCapture ? 'hidden' : ''}`}
          />
          <canvas
            ref={canvasRef}
            className={`h-full w-full object-cover ${!hasCapture ? 'hidden' : ''}`}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('checkin.biometric.capture.attemptsRemaining', {
              count: attemptsRemaining,
            })}
          </p>
          {outcome ? (
            <Alert
              variant={getOutcomeVariant(outcome)}
              className="inline-flex items-center gap-2 px-3 py-1"
            >
              <span className="text-sm font-medium">
                {t(`checkin.biometric.outcome.${outcome.toLowerCase()}`)}
              </span>
            </Alert>
          ) : null}
        </div>

        <div className="flex gap-3">
          {!hasCapture ? (
            <Button
              onClick={capturePhoto}
              disabled={!stream || isProcessing || attemptsRemaining === 0}
              className="flex-1"
            >
              <Camera className="mr-2 h-4 w-4" />
              {t('checkin.biometric.capture.takePhoto')}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={retakePhoto}
                disabled={isProcessing}
                className="flex-1"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('checkin.biometric.capture.retake')}
              </Button>
              <Button
                onClick={submitPhoto}
                disabled={isProcessing || attemptsRemaining === 0}
                className="flex-1"
              >
                {t('checkin.biometric.capture.submit')}
              </Button>
            </>
          )}
        </div>

        {outcome === 'Accept' ? (
          <Alert>
            <p className="text-sm">
              {t('checkin.biometric.outcome.acceptMessage')}
            </p>
          </Alert>
        ) : null}

        {outcome === 'Escalate' ? (
          <Alert>
            <p className="text-sm">
              {t('checkin.biometric.outcome.escalateMessage')}
            </p>
          </Alert>
        ) : null}

        {outcome === 'Reject' ? (
          <Alert variant="destructive">
            <p className="text-sm">
              {t('checkin.biometric.outcome.rejectMessage')}
            </p>
          </Alert>
        ) : null}

        {attemptsRemaining === 0 ? (
          <Alert>
            <p className="text-sm">
              {t('checkin.biometric.capture.maxAttemptsReached')}
            </p>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
