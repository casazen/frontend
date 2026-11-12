import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentReadStepProps {
  reading: boolean;
  message: string | null;
  readCount: number;
  onFile: (file: File) => void;
  onManual: () => void;
  onContinue: () => void;
}

/** First step of check-in: a photo of the identity document, read before the guest confirms the fields. */
export function DocumentReadStep({ reading, message, readCount, onFile, onManual, onContinue }: DocumentReadStepProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4" data-testid="checkin-document-step">
      <p className="text-sm text-muted-foreground">{t('checkin.scanIntro')}</p>
      <div className="rounded-md border border-dashed p-6 text-center space-y-3">
        <Camera className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm">{t('checkin.scanHint')}</p>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          data-testid="checkin-document-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onFile(file);
          }}
        />
        <Button type="button" disabled={reading} onClick={() => inputRef.current?.click()} data-testid="checkin-document-pick">
          {reading ? t('checkin.scanReading') : readCount > 0 ? t('checkin.scanAnother') : t('checkin.scanButton')}
        </Button>
      </div>
      {message && (
        <p className="text-sm" role="status" data-testid="checkin-document-message">
          {message}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onManual} data-testid="checkin-enter-manually">
          {t('checkin.scanManual')}
        </Button>
        {readCount > 0 && (
          <Button type="button" onClick={onContinue} data-testid="checkin-scan-continue">
            {t('checkin.next')}
          </Button>
        )}
      </div>
    </div>
  );
}
