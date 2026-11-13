import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { guidanceKey } from '../lib/identity-model';

interface IdentityDocumentCaptureProps {
  /** The last photo could not be compared: the guest takes it again. */
  refused: boolean;
  /** What to change in the photo, as codes of the API (empty when it gave none). */
  guidanceCodes: readonly string[];
  /** A call of the step is in flight (this one or another): the buttons stay disabled. */
  busy: boolean;
  /** The guest took or chose a photo. */
  onPhoto: (file: File) => void;
  /** The guest asks for a person: the way out of a document that cannot be read (GDPR art. 22). */
  onRequestOperator: () => void;
}

/**
 * The photo of the identity document of the guest who verifies (CHK-14): after each photo the page says, in plain words from the guidance codes,
 * what to change, and asks to take it again before the selfie (a photo that cannot be compared never goes on). It is a photo of a document, not a
 * selfie: a file or the camera of the phone is fine (the camera-only rule is the selfie's, ADR-013-R11).
 */
export function IdentityDocumentCapture({ refused, guidanceCodes, busy, onPhoto, onRequestOperator }: IdentityDocumentCaptureProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="space-y-4" aria-labelledby={titleId} data-testid="checkin-identity-document">
      <div className="space-y-1">
        <h4 id={titleId} className="text-base font-semibold">
          {t('checkin.identity.document.title')}
        </h4>
        <p className="text-sm text-muted-foreground">{t('checkin.identity.document.instructions')}</p>
      </div>

      {refused && (
        <Alert variant="warning" role="alert" title={t('checkin.identity.document.notAcceptable')} data-testid="checkin-identity-document-guidance">
          {guidanceCodes.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {guidanceCodes.map((code) => (
                <li key={code}>{t(guidanceKey(code))}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <div className="rounded-md border border-dashed p-6 text-center space-y-3">
        <Camera className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          tabIndex={-1}
          aria-label={t('checkin.identity.document.fileLabel')}
          data-testid="checkin-identity-document-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onPhoto(file);
          }}
        />
        <Button
          type="button"
          size="lg"
          disabled={busy}
          loading={busy}
          onClick={() => inputRef.current?.click()}
          data-testid="checkin-identity-document-pick"
        >
          {busy ? t('checkin.identity.document.sending') : refused ? t('checkin.identity.document.pickAgain') : t('checkin.identity.document.pick')}
        </Button>
      </div>

      <div>
        <Button type="button" variant="ghost" disabled={busy} onClick={onRequestOperator} data-testid="checkin-identity-document-operator">
          {t('checkin.identity.operator.ask')}
        </Button>
      </div>
    </section>
  );
}
