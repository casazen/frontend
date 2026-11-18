import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GUEST_LOCALES } from '@/features/checkin/lib/guest-locale';
import { sanitizeHtml } from '@/lib/sanitize-html';
import type { CheckInLegalText } from '@/types/public-checkin.types';

interface LegalTextBlockProps {
  text: CheckInLegalText;
  testId: string;
  /** The language the page is shown in: a text the registry has only in another language says so. */
  pageLanguage: string;
}

/**
 * One text of the registry as the guest reads it (E22/F02/US01/T01): the words are the registry's and come sanitized twice (by the server and here, with the same allowlist as the other
 * legal pages), in the language of the file served; a draft (outside production only) says so with a badge, and a text that is not in the language of the page says which one it is in.
 */
function LegalTextBlock({ text, testId, pageLanguage }: LegalTextBlockProps) {
  const { t } = useTranslation();
  const served = text.language.trim().toLowerCase();
  const servedLocale = GUEST_LOCALES.find((locale) => locale === served);
  // Only a language the page has a name for is named: the note is for the guest who reads English where the page is German, not for a file in a language nobody knows.
  const inOtherLanguage = servedLocale !== undefined && servedLocale !== pageLanguage.trim().toLowerCase().split(/[-_]/)[0];

  return (
    <div className="space-y-2 rounded-lg bg-muted p-4" data-testid={testId} data-version={text.version} data-draft={text.isDraft ? 'true' : 'false'}>
      <article
        lang={served || undefined}
        className="prose prose-sm prose-neutral max-w-none dark:prose-invert prose-p:text-muted-foreground prose-li:text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(text.contentHtml) }}
      />
      {inOtherLanguage && (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-language`}>
          {t('checkin.biometric.consent.servedIn', { language: t(`checkin.language.names.${servedLocale}`) })}
        </p>
      )}
    </div>
  );
}

interface BiometricConsentProps {
  /** `loading` while the texts are asked, `error` when they could not be read, `ready` with what the registry served. */
  status: 'loading' | 'error' | 'ready';
  /**
   * The text of the consent the registry served (in production only an approved one; none while there is none). The guest agrees to this text, and its `version` is what the consent
   * posts back (ADR-013-R9): the page has no wording and no version of its own.
   */
  consent: CheckInLegalText | null;
  /** The notice of a property that keeps no document (Ticino), when the registry served it for this stay. */
  notice: CheckInLegalText | null;
  /** The sentence that says why the texts are not there (`error` only), already in the words of the page. */
  errorMessage?: string;
  /** The guest asks to read the texts again. */
  onRetry: () => void;
  /** The guest agrees to the face check, to the text of this `version` that was on the screen. */
  onConsent: (version: string) => void;
  /** The guest refuses it: a person verifies the identity instead (never a dead end). */
  onDecline: () => void;
  /** An answer is being sent: both buttons stay disabled. */
  isLoading?: boolean;
  /** The texts are being read again (the registry published a new version, or the guest came back to the page): what is on the screen may be old, so only the way to a person stays open. */
  refreshing?: boolean;
  /** The language the page is shown in (`it`, `en`, `de`, `fr`, `es`). */
  pageLanguage: string;
}

/**
 * The biometric consent (ADR-013-R9, NF-50): its own screen, separate from the privacy notice and from the marketing consent, explicit and refusable. The text is the registry's
 * (E22/F01/US02/T02): what the guest agrees to is exactly what is on the screen, and it is the version of that text that is recorded with the answer. Refusing is as easy as agreeing and
 * leads to a person who verifies the identity, never to a dead end; agreeing is possible only while a text is on the screen (a consent to words nobody could read is no consent).
 */
export function BiometricConsent({
  status,
  consent,
  notice,
  errorMessage,
  onRetry,
  onConsent,
  onDecline,
  isLoading = false,
  refreshing = false,
  pageLanguage,
}: BiometricConsentProps) {
  const { t } = useTranslation();

  return (
    // The title of the text is the registry's own (its first heading); the section is named here so that a screen reader finds it by what it is for.
    <section className="space-y-4" aria-label={t('checkin.biometric.consent.title')} data-testid="checkin-biometric-consent">
      {status === 'loading' && (
        <p role="status" className="text-sm text-muted-foreground" data-testid="checkin-consent-loading">
          {t('checkin.biometric.consent.loading')}
        </p>
      )}

      {status === 'error' && (
        <Alert
          variant="warning"
          title={t('checkin.biometric.consent.loadFailed')}
          data-testid="checkin-consent-error"
          action={
            <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={isLoading} data-testid="checkin-consent-retry">
              {t('checkin.biometric.consent.retry')}
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      )}

      {status === 'ready' && !consent && (
        <Alert variant="info" data-testid="checkin-consent-unavailable">
          {t('checkin.biometric.consent.unavailable')}
        </Alert>
      )}

      {status === 'ready' && consent && <LegalTextBlock text={consent} testId="checkin-consent-text" pageLanguage={pageLanguage} />}
      {status === 'ready' && notice && <LegalTextBlock text={notice} testId="checkin-ticino-notice" pageLanguage={pageLanguage} />}

      <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Button
          type="button"
          size="lg"
          onClick={() => {
            if (consent) onConsent(consent.version);
          }}
          disabled={isLoading || refreshing || status !== 'ready' || !consent}
          data-testid="checkin-biometric-accept"
        >
          {t('checkin.biometric.consent.accept')}
        </Button>
        <Button type="button" size="lg" variant="outline" onClick={onDecline} disabled={isLoading} data-testid="checkin-biometric-decline">
          {t('checkin.biometric.consent.decline')}
        </Button>
      </div>

      {status === 'ready' && consent && (
        <p className="text-xs text-muted-foreground" data-testid="checkin-consent-version">
          {t('checkin.biometric.consent.version', { version: consent.version })}
        </p>
      )}
    </section>
  );
}
