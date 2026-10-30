import { useTranslation } from 'react-i18next';
import { ConsentForm } from './components/ConsentForm';

interface ConsentStepProps {
  /** Privacy notice version shown to the guest. */
  privacyNoticeVersion?: string;
  /** Marketing consent version; when absent, no consent is offered. */
  marketingConsentVersion?: string;
}

/**
 * Consent step of the check-in flow (NF-05). Appears after mandatory check-in steps.
 * Shows the privacy notice (legal obligation, no checkbox) and the optional marketing consent
 * (email/WhatsApp channels with separate marketing email input). Checkboxes are unchecked by default.
 * Check-in can complete without consent (skip allowed).
 */
export function ConsentStep({ privacyNoticeVersion, marketingConsentVersion }: ConsentStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Privacy notice: legal obligation (CO-15, A5-15), no checkbox required */}
      <section
        className="rounded-md border p-4 space-y-2 text-sm"
        aria-labelledby="checkin-privacy-notice-title"
        data-testid="checkin-privacy-notice"
      >
        <h2 id="checkin-privacy-notice-title" className="font-medium">
          {t('checkin.privacyNotice.title')}
        </h2>
        <p>{t('checkin.privacyNotice.legalObligation')}</p>
        <p className="text-muted-foreground">{t('checkin.privacyNotice.body')}</p>
        {privacyNoticeVersion && (
          <p className="text-xs text-muted-foreground">
            {t('checkin.privacyNotice.version', { version: privacyNoticeVersion })}
          </p>
        )}
      </section>

      {/* Marketing consent: optional, offered only when context has marketingConsentVersion */}
      {marketingConsentVersion && (
        <section
          className="rounded-md border p-4 space-y-4"
          aria-labelledby="checkin-marketing-consent-title"
          data-testid="checkin-marketing-consent"
        >
          <div className="space-y-1">
            <h2 id="checkin-marketing-consent-title" className="font-medium text-sm">
              {t('checkin.consent.title')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('checkin.marketingConsentVersion', { version: marketingConsentVersion })}
            </p>
          </div>
          <ConsentForm />
        </section>
      )}
    </div>
  );
}
