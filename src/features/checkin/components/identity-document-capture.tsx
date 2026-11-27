import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DocumentSide } from '@/types/public-checkin.types';
import { guidanceKey } from '../lib/identity-model';
import { MrzPositionIllustration } from './mrz-position-illustration';

interface IdentityDocumentCaptureProps {
  /** The last photo could not be compared: the guest takes it again. */
  refused: boolean;
  /** What to change in the photo, as codes of the API (empty when it gave none). */
  guidanceCodes: readonly string[];
  /** The side of the document the next photo is of: the front first (a passport is complete with it), the back when the answer said the document has two sides. */
  side: DocumentSide;
  /** The document has two sides (the Italian electronic identity card): the page says which photo of the two this is. */
  twoSided: boolean;
  /** The side with the face was received and is good: the back is what is asked now. */
  frontReceived: boolean;
  /** A call of the step is in flight, or the photo for one is being made ready (this one or another): the buttons and the file input stay disabled. */
  busy: boolean;
  /** The guest took or chose a photo. */
  onPhoto: (file: File) => void;
  /** The guest asks for a person: the way out of a document that cannot be read (GDPR art. 22). */
  onRequestOperator: () => void;
}

/**
 * The photo of the identity document of the guest who verifies (CHK-14, E22/F02/US01/T01): after each photo the page says, in plain words from the guidance codes,
 * what to change, and asks to take it again before the selfie (a photo that cannot be compared never goes on). A document of two sides is asked one side at a time: the side with the
 * photo first, then, when the answer says so, the back with the lines of letters, with a drawing of where they are on the Italian electronic identity card. It is a photo of a document,
 * not a selfie: a file or the camera of the phone is fine (the camera-only rule is the selfie's, ADR-013-R11). The page keeps no picture: each is sent and let go.
 */
export function IdentityDocumentCapture({ refused, guidanceCodes, side, twoSided, frontReceived, busy, onPhoto, onRequestOperator }: IdentityDocumentCaptureProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isBack = side === 'back';

  let pickLabel = refused ? 'checkin.identity.document.pickAgain' : 'checkin.identity.document.pick';
  if (isBack) pickLabel = refused ? 'checkin.identity.document.back.pickAgain' : 'checkin.identity.document.back.pick';

  return (
    <section className="space-y-4" aria-labelledby={titleId} data-testid="checkin-identity-document" data-side={side}>
      <div className="space-y-1">
        <h4 id={titleId} className="text-base font-semibold">
          {t('checkin.identity.document.title')}
        </h4>
        {twoSided && (
          <p className="text-xs font-medium text-muted-foreground" data-testid="checkin-identity-document-progress">
            {t('checkin.identity.document.sideProgress', { current: isBack ? 2 : 1, total: 2 })}
          </p>
        )}
        <p className="text-sm text-muted-foreground">{t(isBack ? 'checkin.identity.document.back.instructions' : 'checkin.identity.document.instructions')}</p>
      </div>

      {isBack && <MrzPositionIllustration />}

      {isBack && frontReceived && !refused && (
        <p role="status" className="text-sm font-medium" data-testid="checkin-identity-document-front-received">
          {t('checkin.identity.document.frontReceived')}
        </p>
      )}

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
          disabled={busy}
          aria-label={t(isBack ? 'checkin.identity.document.back.fileLabel' : 'checkin.identity.document.fileLabel')}
          data-testid="checkin-identity-document-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // The file input is emptied at once: the page keeps nothing of the picture it was given.
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
          {busy ? t('checkin.identity.document.sending') : t(pickLabel)}
        </Button>
      </div>

      {refused && <div>
        <Button type="button" variant="ghost" disabled={busy} onClick={onRequestOperator} data-testid="checkin-identity-document-operator">
          {t('checkin.identity.operator.ask')}
        </Button>
      </div>}
    </section>
  );
}
