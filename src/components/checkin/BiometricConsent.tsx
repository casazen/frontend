import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GUEST_LOCALES } from '@/features/checkin/lib/guest-locale';
import { sanitizeHtml } from '@/lib/sanitize-html';
import type { CheckInLegalText } from '@/types/public-checkin.types';

interface LegalTextBlockProps {
  text: CheckInLegalText;
  testId: string;
  pageLanguage: string;
}

function LegalTextBlock({ text, testId, pageLanguage }: LegalTextBlockProps) {
  const { t } = useTranslation();
  const served = text.language.trim().toLowerCase();
  const servedLocale = GUEST_LOCALES.find((locale) => locale === served);
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
  status: 'loading' | 'error' | 'ready';
  consent: CheckInLegalText | null;
  notice: CheckInLegalText | null;
  errorMessage?: string;
  onRetry: () => void;
  onConsent: (version: string) => void;
  onDecline: () => void;
  isLoading?: boolean;
  refreshing?: boolean;
  pageLanguage: string;
  /**
   * The answers are two ways to be verified, of equal weight (self-hosted verification, E70/F03/US01/T01): «Verifica automatica» (agreeing to the text) and «Verifica con una persona» (refusing it), side by side,
   * the same size and the same look, with a line each, instead of the button that agrees with the one that refuses beside it. What each does and its test id are the same either way.
   */
  choices?: boolean;
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
  choices = false,
}: BiometricConsentProps) {
  const { t } = useTranslation();
  const choiceId = useId();
  const agree = () => {
    if (consent) onConsent(consent.version);
  };
  const mayAgree = !(isLoading || refreshing || status !== 'ready' || !consent);

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

      {choices ? (
        // Two ways to be verified, neither one nudged: the same button for both (size, look, width), the same kind of line under each, the automatic one first because it is the one that needs the text above.
        <div role="group" aria-labelledby={`${choiceId}-title`} className="space-y-3" data-testid="checkin-identity-choices">
          <p id={`${choiceId}-title`} className="text-sm font-semibold">
            {t('checkin.identity.choice.title')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-auto min-h-11 w-full whitespace-normal py-2 text-center"
                onClick={agree}
                disabled={!mayAgree}
                aria-describedby={`${choiceId}-automatic`}
                data-testid="checkin-biometric-accept"
              >
                {t('checkin.identity.choice.automatic.label')}
              </Button>
              <p id={`${choiceId}-automatic`} className="text-sm text-foreground/70">
                {t('checkin.identity.choice.automatic.hint')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-auto min-h-11 w-full whitespace-normal py-2 text-center"
                onClick={onDecline}
                disabled={isLoading}
                aria-describedby={`${choiceId}-assisted`}
                data-testid="checkin-biometric-decline"
              >
                {t('checkin.identity.choice.assisted.label')}
              </Button>
              <p id={`${choiceId}-assisted`} className="text-sm text-foreground/70">
                {t('checkin.identity.choice.assisted.hint')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <Button type="button" size="lg" onClick={agree} disabled={!mayAgree} data-testid="checkin-biometric-accept">
            {t('checkin.biometric.consent.accept')}
          </Button>
          <Button type="button" size="lg" variant="outline" onClick={onDecline} disabled={isLoading} data-testid="checkin-biometric-decline">
            {t('checkin.biometric.consent.decline')}
          </Button>
        </div>
      )}

      {status === 'ready' && consent && (
        <p className="text-xs text-muted-foreground" data-testid="checkin-consent-version">
          {t('checkin.biometric.consent.version', { version: consent.version })}
        </p>
      )}
    </section>
  );
}
