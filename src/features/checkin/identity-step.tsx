import { useTranslation } from 'react-i18next';
import { BiometricConsent, SelfieCapture } from '@/components/checkin';
import { IdentityDocumentCapture } from './components/identity-document-capture';
import { IdentityResult } from './identity-result';
import { BIOMETRIC_CONSENT_VERSION, problemKey } from './lib/identity-model';
import type { IdentityVerificationController } from './use-identity-verification';

interface IdentityStepProps {
  identity: IdentityVerificationController;
}

/**
 * The identity step of the guest check-in (CHK-11, CHK-14, NF-50, NF-51), shown only to the guest who leaves the document and only while the API
 * offers the verification: the separate biometric consent (refusable, a refusal leads to a person), the photo of the document with the guidance of
 * what to change, the selfie with the camera only, and the answer. One topic at a time, one stay one selfie: the other adults of the stay are
 * never asked for one. Whatever is typed in the other steps of the page is untouched by anything that happens here.
 */
export function IdentityStep({ identity }: IdentityStepProps) {
  const { t } = useTranslation();
  const { progress } = identity;
  if (!progress) return null;

  const { stage } = progress;

  return (
    <div className="space-y-4" data-testid="checkin-identity-step" data-stage={stage}>
      <p className="text-sm text-muted-foreground">{t('checkin.identity.intro')}</p>

      {progress.documentNotArchived && (
        <p className="rounded-md border p-3 text-sm" data-testid="checkin-document-not-archived">
          {t('checkin.identity.documentNotArchived')}
        </p>
      )}

      {stage === 'consent' && (
        <BiometricConsent
          onConsent={() => void identity.agree()}
          onDecline={() => void identity.refuse()}
          isLoading={identity.busy}
          consentVersion={BIOMETRIC_CONSENT_VERSION}
          documentNotArchived={progress.documentNotArchived}
        />
      )}

      {stage === 'document' && (
        <IdentityDocumentCapture
          refused={progress.documentRefused}
          guidanceCodes={progress.guidanceCodes}
          busy={identity.busy}
          onPhoto={(file) => void identity.sendDocument(file)}
          onRequestOperator={() => void identity.askOperator()}
        />
      )}

      {stage === 'selfie' && (
        <SelfieCapture
          onCapture={identity.sendSelfie}
          attemptsRemaining={progress.attemptsRemaining}
          isProcessing={identity.busy}
          onRequestOperator={() => void identity.askOperator()}
        />
      )}

      {(stage === 'retry' || stage === 'operator' || stage === 'done') && (
        <IdentityResult
          kind={stage === 'done' ? 'ok' : stage}
          lockCode={progress.lockCode}
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
