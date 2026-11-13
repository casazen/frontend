import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface BiometricConsentProps {
  /** The guest agrees to the face check. */
  onConsent: () => void;
  /** The guest refuses it: a person verifies the identity instead (never a dead end). */
  onDecline: () => void;
  /** An answer is being sent: both buttons stay disabled. */
  isLoading?: boolean;
  /** The version of this text, sent with the consent so the text the guest agreed to can be told (ADR-013-R9). */
  consentVersion: string;
  /** The property keeps no document (Ticino, ADR-013-R15): the text does not say that the photo of the document is kept. */
  documentNotArchived?: boolean;
}

/**
 * The biometric consent (ADR-013-R9, NF-50): its own screen, separate from the privacy notice and from the marketing consent, explicit and refusable.
 * Refusing is as easy as agreeing and leads to a person who verifies the identity, never to a dead end. The text says what happens to the selfie
 * (compared in memory and deleted) and to the photo of the document (kept encrypted only until the check is over, never in Ticino).
 */
export function BiometricConsent({ onConsent, onDecline, isLoading = false, consentVersion, documentNotArchived = false }: BiometricConsentProps) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <section className="space-y-4" aria-labelledby={titleId} data-testid="checkin-biometric-consent">
      <div className="space-y-1">
        <h4 id={titleId} className="text-base font-semibold">
          {t('checkin.biometric.consent.title')}
        </h4>
        <p className="text-sm text-muted-foreground">{t('checkin.biometric.consent.description')}</p>
      </div>

      <div className="rounded-lg bg-muted p-4">
        <h5 className="mb-2 font-medium">{t('checkin.biometric.consent.purposeTitle')}</h5>
        <p className="text-sm text-muted-foreground">{t('checkin.biometric.consent.purpose')}</p>
        {!documentNotArchived && <p className="mt-2 text-sm text-muted-foreground">{t('checkin.biometric.consent.documentKept')}</p>}
      </div>

      <div className="rounded-lg bg-muted p-4">
        <h5 className="mb-2 font-medium">{t('checkin.biometric.consent.optionalTitle')}</h5>
        <p className="text-sm text-muted-foreground">{t('checkin.biometric.consent.optional')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Button type="button" size="lg" onClick={onConsent} disabled={isLoading} data-testid="checkin-biometric-accept">
          {t('checkin.biometric.consent.accept')}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={onDecline} disabled={isLoading} data-testid="checkin-biometric-decline">
          {t('checkin.biometric.consent.decline')}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{t('checkin.biometric.consent.version', { version: consentVersion })}</p>
    </section>
  );
}
