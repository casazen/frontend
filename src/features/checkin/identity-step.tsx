import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BiometricConsent, SelfieCapture } from '@/components/checkin';
import { useGuestLegalTexts } from '@/queries/use-checkin';
import { IdentityDocumentCapture } from './components/identity-document-capture';
import { IdentityResult } from './identity-result';
import { resolveGuestLocale } from './lib/guest-locale';
import { BIOMETRIC_CONSENT_KIND, TICINO_NOTICE_KIND, classifyIdentityError, legalTextOf, problemKey } from './lib/identity-model';
import type { IdentityVerificationController } from './use-identity-verification';

interface IdentityStepProps {
  identity: IdentityVerificationController;
  /** The token of the check-in link: the legal texts of the stay are asked with it. */
  token: string;
  takeFront?: () => File | null;
}

/**
 * The identity step of the guest check-in (CHK-11, CHK-14, NF-50, NF-51), shown only to the guest who leaves the document and only while the API
 * offers the verification: the separate biometric consent (refusable, a refusal leads to a person) with the text the registry serves, the photo of the document (one picture, or both
 * sides of a card) with the guidance of what to change, the selfie with the camera only, and the answer. One topic at a time, one stay one selfie: the other adults of the stay are
 * never asked for one. Whatever is typed in the other steps of the page is untouched by anything that happens here.
 */
export function IdentityStep({ identity, token, takeFront }: IdentityStepProps) {
  const { t, i18n } = useTranslation();
  const { progress } = identity;
  const stage = progress?.stage;
  const language = resolveGuestLocale(i18n.language);

  // The legal texts are asked while the guest is at the consent: it is the text on the screen that is agreed to, and its version is what is sent back.
  const texts = useGuestLegalTexts(token, language, stage === 'consent');
  const readTextsAgain = texts.refetch;
  const textsChanged = identity.problem === 'consent_text_changed';
  useEffect(() => {
    // The registry no longer serves the version that was on the screen: the guest reads what it serves now before answering.
    if (textsChanged) void readTextsAgain();
  }, [textsChanged, readTextsAgain]);

  useEffect(() => {
    if (stage !== 'document' || progress?.documentSideNeeded !== 'front' || identity.busy) return;
    const front = takeFront?.();
    if (front) void identity.sendDocument(front);
  }, [stage, progress?.documentSideNeeded, identity, takeFront]);

  const handoffStarted = useRef(false);
  useEffect(() => {
    if (stage !== 'operator' || progress?.operatorRequested || handoffStarted.current) return;
    handoffStarted.current = true;
    void identity.askOperator();
  }, [identity, progress?.operatorRequested, stage]);

  if (!progress) return null;

  // An error is an error even when an older answer is still in memory: the texts of a link that is no longer valid are never shown as if they were.
  const textsStatus = texts.isError ? 'error' : texts.isSuccess ? 'ready' : 'loading';
  const consentText = textsStatus === 'ready' ? legalTextOf(texts.data?.texts, BIOMETRIC_CONSENT_KIND) : null;
  const noticeText = textsStatus === 'ready' ? legalTextOf(texts.data?.texts, TICINO_NOTICE_KIND) : null;

  return (
    <div className="space-y-4" data-testid="checkin-identity-step" data-stage={progress.stage}>
      <p className="text-sm text-muted-foreground">{t('checkin.identity.intro')}</p>

      {progress.documentNotArchived && (
        <p className="rounded-md border p-3 text-sm" data-testid="checkin-document-not-archived">
          {t('checkin.identity.documentNotArchived')}
        </p>
      )}

      {progress.stage === 'consent' && (
        <BiometricConsent
          status={textsStatus}
          consent={consentText}
          notice={noticeText}
          errorMessage={texts.isError ? t(problemKey(classifyIdentityError(texts.error))) : undefined}
          onRetry={() => void readTextsAgain()}
          onConsent={(version) => void identity.agree(version)}
          onDecline={() => void identity.refuse()}
          isLoading={identity.busy}
          refreshing={texts.isFetching}
          pageLanguage={language}
        />
      )}

      {progress.stage === 'document' && (
        <IdentityDocumentCapture
          refused={progress.documentRefused}
          guidanceCodes={progress.guidanceCodes}
          side={progress.documentSideNeeded}
          twoSided={progress.documentTwoSided}
          frontReceived={progress.documentSidesTaken.includes('front')}
          busy={identity.busy}
          onPhoto={(file) => void identity.sendDocument(file)}
          onRequestOperator={() => void identity.askOperator()}
        />
      )}

      {progress.stage === 'selfie' && (
        <SelfieCapture
          onCapture={identity.sendSelfie}
          attemptsRemaining={progress.attemptsRemaining}
          isProcessing={identity.busy}
          onRequestOperator={() => void identity.askOperator()}
        />
      )}

      {(progress.stage === 'retry' || progress.stage === 'operator' || progress.stage === 'done') && (
        <IdentityResult
          kind={progress.stage === 'done' ? 'ok' : progress.stage}
          lockCode={progress.lockCode}
          lockCodeHeld={progress.lockCodeHeld ?? null}
          guidanceCodes={progress.guidanceCodes}
          attemptsRemaining={progress.attemptsRemaining}
          operatorRequested={progress.operatorRequested}
          busy={identity.busy}
          onRetake={identity.retake}
          onRequestOperator={() => void identity.askOperator()}
        />
      )}

      {identity.problem && (
        <p role="alert" className="text-sm text-destructive" data-testid="checkin-identity-problem">
          {t(problemKey(identity.problem))}
        </p>
      )}

      {!identity.concluded && <p className="text-xs text-muted-foreground">{t('checkin.identity.nextHint')}</p>}
    </div>
  );
}
