import { useTranslation } from 'react-i18next';
import { orgDocumentPath } from '@/lib/org-document-paths';
import { ConsentForm } from './components/ConsentForm';

interface ConsentStepProps {
  privacyRead: boolean;
  onPrivacyRead: (checked: boolean) => void;
  /** Privacy notice version shown to the guest. */
  privacyNoticeVersion?: string;
  privacyNoticeOrgSlug?: string;
  /** Marketing consent version; when absent, no consent is offered. */
  marketingConsentVersion?: string;
}

export function ConsentStep({ privacyRead, onPrivacyRead, privacyNoticeVersion, privacyNoticeOrgSlug, marketingConsentVersion }: ConsentStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
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
        {privacyNoticeOrgSlug && (
          <a href={orgDocumentPath(privacyNoticeOrgSlug, 'privacy')} target="_blank" rel="noopener noreferrer" className="block underline">
            {t('checkin.privacyOpen')}
          </a>
        )}
        {privacyNoticeVersion && (
          <p className="text-xs text-muted-foreground">
            {t('checkin.privacyNotice.version', { version: privacyNoticeVersion })}
          </p>
        )}
        <label className="flex items-center gap-2" htmlFor="privacy-read">
          <input id="privacy-read" type="checkbox" checked={privacyRead} onChange={event => onPrivacyRead(event.target.checked)} />
          {t('checkin.privacyRead')}
        </label>
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
