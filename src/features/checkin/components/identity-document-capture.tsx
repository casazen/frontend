import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Copy, FileX, FlipHorizontal2, Focus, LayoutTemplate, Maximize, RotateCw, ScanLine, ScanText, Sun, UserRound, type LucideIcon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DocumentSide } from '@/types/public-checkin.types';
import { guidanceKey, listedGuidance } from '../lib/identity-model';
import { DocumentCameraGuide } from './document-camera-guide';
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
  /**
   * The state of the verification says `selfHosted` (E71/F02/US01/T01): the photo is taken with the guided camera, and the file or the camera of the phone is the second way. False on the legacy path,
   * where the page is the one it always was.
   */
  selfHosted?: boolean;
  /**
   * The guest took or chose a photo. The guided camera also hands in the difference hash of the frame (a hint for the warning before a back that looks like the front). Resolves `true` when the API
   * answered and `false` when the call failed; the screen of the legacy path does not wait for it.
   */
  onPhoto: (file: File, fingerprint?: string | null) => Promise<boolean> | void;
  /** The frame the guided camera took looks like the front taken before: a hint only. */
  looksLikeTheFront?: (fingerprint: string) => boolean;
  /** The guest asks for a person: the way out of a document that cannot be read (GDPR art. 22). */
  onRequestOperator: () => void;
}

/**
 * A picture for each of the targeted codes of the document step: what the code is about, in one drawing, next to the words (decorative: the words say it all). A code with no drawing (the older
 * ones) has none, and its line is the one it always was.
 */
const GUIDANCE_ICONS: Readonly<Record<string, LucideIcon>> = {
  document_not_found: ScanLine,
  document_edges_not_visible: Maximize,
  document_layout_mismatch: LayoutTemplate,
  document_orientation: RotateCw,
  document_portrait_missing: UserRound,
  document_side_duplicate: Copy,
  document_wrong_side: FlipHorizontal2,
  document_format_unsupported: FileX,
  document_glare: Sun,
  document_blur: Focus,
  document_unreadable: ScanText,
};

/**
 * The photo of the identity document of the guest who verifies (CHK-14, E22/F02/US01/T01): after each photo the page says, in plain words from the guidance codes,
 * what to change, and asks to take it again before the selfie (a photo that cannot be compared never goes on). A document of two sides is asked one side at a time: the side with the
 * photo first, then, when the answer says so, the back with the lines of letters, with a drawing of where they are on the Italian electronic identity card. It is a photo of a document,
 * not a selfie: a file or the camera of the phone is fine (the camera-only rule is the selfie's, ADR-013-R11). The page keeps no picture: each is sent and let go.
 *
 * On a self-hosted verification (E71/F02/US01/T01, NF-189) the photo is taken with the guided camera: the rear camera with the outline of the card and a line that says what to change; a guest
 * with no camera (denied, missing, not supported) is told why and has the file of the phone and the way to a person, with the same checks on the photo. The server stays the authority on the photo.
 */
export function IdentityDocumentCapture({ refused, guidanceCodes, side, twoSided, frontReceived, busy, selfHosted = false, onPhoto, looksLikeTheFront, onRequestOperator }: IdentityDocumentCaptureProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isBack = side === 'back';

  let pickLabel = refused ? 'checkin.identity.document.pickAgain' : 'checkin.identity.document.pick';
  if (isBack) pickLabel = refused ? 'checkin.identity.document.back.pickAgain' : 'checkin.identity.document.back.pick';

  const fileInput = (
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
        if (file) void onPhoto(file);
      }}
    />
  );

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
              {listedGuidance(guidanceCodes).map((code) => {
                const Icon = GUIDANCE_ICONS[code];
                const words = t(guidanceKey(code, side));
                return (
                  <li key={code} data-testid={`checkin-identity-document-guidance-${code}`}>
                    {Icon ? (
                      <span className="inline-flex items-start gap-2">
                        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>{words}</span>
                      </span>
                    ) : (
                      words
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Alert>
      )}

      {selfHosted && (
        <DocumentCameraGuide
          // One camera screen for each side: a frame held for one side (a send that failed, the question before a back that looks like the front) is let go when the side changes, so that it is never offered
          // again as the photo of the other one (the file of the phone can answer the side while the frame is still on the screen).
          key={side}
          side={side}
          busy={busy}
          onPhoto={async (photo, fingerprint) => (await onPhoto(photo, fingerprint)) !== false}
          looksLikeTheFront={looksLikeTheFront ?? (() => false)}
        />
      )}

      {selfHosted ? (
        <div className="rounded-md border border-dashed p-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">{t('checkin.identity.document.camera.chooseHint')}</p>
          {fileInput}
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={busy}
            loading={busy}
            onClick={() => inputRef.current?.click()}
            data-testid="checkin-identity-document-pick"
          >
            {busy ? t('checkin.identity.document.sending') : t('checkin.identity.document.camera.chooseFile')}
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center space-y-3">
          <Camera className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          {fileInput}
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
      )}

      {refused && <div>
        <Button type="button" variant="ghost" disabled={busy} onClick={onRequestOperator} data-testid="checkin-identity-document-operator">
          {t('checkin.identity.operator.ask')}
        </Button>
      </div>}
    </section>
  );
}
