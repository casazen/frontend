import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActiveSelfieCapture } from './components/active-selfie-capture';
import { BiometricConsent } from '@/components/checkin';
import { useGuestLegalTexts } from '@/queries/use-checkin';
import { AssistedPathButton, UnsupportedIdentityStep } from './components/identity-assisted-path';
import { IdentityDocumentCapture } from './components/identity-document-capture';
import { PresenceSequenceCapture } from './components/presence-sequence-capture';
import { IdentityResult } from './identity-result';
import { resolveGuestLocale } from './lib/guest-locale';
import { BIOMETRIC_CONSENT_KIND, TICINO_NOTICE_KIND, classifyIdentityError, legalTextOf, problemKey } from './lib/identity-model';
import type { IdentityVerificationController } from './use-identity-verification';

interface IdentityStepProps {
  identity: IdentityVerificationController;
  token: string;
  takeFront?: () => File | null;
}

/**
 * The identity step of the guest check-in (CHK-11, CHK-14, NF-50, NF-51), shown only to the guest who leaves the document and only while the API
 * offers the verification: the separate biometric consent (refusable, a refusal leads to a person) with the text the registry serves, the photo of the document (one picture, or both
 * sides of a card) with the guidance of what to change, the selfie with the camera only, and the answer. One topic at a time, one stay one selfie: the other adults of the stay are
 * never asked for one. Whatever is typed in the other steps of the page is untouched by anything that happens here.
 *
 * On a self-hosted verification (the state says `selfHosted`, E70/F03/US01/T01, NF-188) the step is opened with the text of the consent the guest reads, the answer is the choice between two ways to be verified of equal
 * weight (the automatic check, or a person), the way to a person stays on the screen under the document and under the recording of the presence, a verification that is closed shows where it ended without any capture, and a step this page has
 * no screen for shows the way to a person instead of a blank screen. With the state of the legacy path nothing of this is there.
 * The photo of the document is then taken with the guided camera (E71/F02/US01/T01, NF-189), and a photo the server refuses is answered with its targeted reason (E71/F02/US01/T02). The selfies give way to the
 * presence (E72/F02/US01/T01, NF-192): the guest follows the prompts of a challenge while the browser records a timestamped sequence of frames, sent once with a key made for the recording; the legacy selfie routes are never
 * called on this path.
 */
export function IdentityStep({ identity, token, takeFront }: IdentityStepProps) {
  const { t, i18n } = useTranslation();
  const { progress, openNotice } = identity;
  const stage = progress?.stage;
  const selfHosted = progress?.selfHosted === true;
  const language = resolveGuestLocale(i18n.language);

  const texts = useGuestLegalTexts(token, language, stage === 'consent');
  const readTextsAgain = texts.refetch;
  const textsChanged = identity.problem === 'consent_text_changed';
  useEffect(() => {
    if (textsChanged) void readTextsAgain();
  }, [textsChanged, readTextsAgain]);

  const shownConsentVersion = texts.isSuccess && !texts.isFetching ? (legalTextOf(texts.data?.texts, BIOMETRIC_CONSENT_KIND)?.version ?? null) : null;
  useEffect(() => {
    if (!selfHosted || stage !== 'consent' || shownConsentVersion === null) return;
    void openNotice(shownConsentVersion, async () => {
      const again = await readTextsAgain();
      if (!again.isSuccess || again.isFetching) throw new Error('The legal texts could not be read again');
      return legalTextOf(again.data.texts, BIOMETRIC_CONSENT_KIND)?.version ?? null;
    });
  }, [openNotice, readTextsAgain, selfHosted, shownConsentVersion, stage]);

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

  const textsStatus = texts.isError ? 'error' : texts.isSuccess ? 'ready' : 'loading';
  const consentText = textsStatus === 'ready' && !identity.automaticUnavailable ? legalTextOf(texts.data?.texts, BIOMETRIC_CONSENT_KIND) : null;
  const noticeText = textsStatus === 'ready' ? legalTextOf(texts.data?.texts, TICINO_NOTICE_KIND) : null;
  const assistedPathVisible = selfHosted && (progress.stage === 'selfie' || progress.stage === 'presence' || (progress.stage === 'document' && !progress.documentRefused));

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
          choices={selfHosted}
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
          selfHosted={selfHosted}
          onPhoto={(file, fingerprint) => identity.sendDocument(file, fingerprint)}
          looksLikeTheFront={identity.looksLikeTheFront}
          onRequestOperator={() => void identity.askOperator()}
        />
      )}

      {progress.stage === 'selfie' && (
        <ActiveSelfieCapture
          key={token}
          token={token}
          onCapture={identity.sendSelfie}
          attemptsRemaining={progress.attemptsRemaining}
          isProcessing={identity.busy}
          onRequestOperator={() => void identity.askOperator()}
        />
      )}

      {progress.stage === 'presence' && (
        <PresenceSequenceCapture
          key={token}
          startChallenge={identity.startPresence}
          sendSequence={identity.sendPresence}
          cancelSequence={identity.cancelPresence}
          busy={identity.busy}
        />
      )}

      {assistedPathVisible && <AssistedPathButton busy={identity.busy} onChoose={() => void identity.askOperator()} />}

      {progress.stage === 'unsupported' && <UnsupportedIdentityStep busy={identity.busy} onChoose={() => void identity.askOperator()} />}

      {(progress.stage === 'retry' || progress.stage === 'operator' || progress.stage === 'done') && (
        <IdentityResult
          kind={progress.stage === 'done' ? 'ok' : progress.stage}
          presence={selfHosted}
          closed={progress.closed}
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
