import { useTranslation } from 'react-i18next';
import { AiContentNotice } from '@/components/shared/ai-content-notice';

interface SeoDisclaimerFooterProps {
  /** Last approved text of the page (ISO instant): shown as a date in the language of the visitor. */
  lastRefreshedAt: string | null;
  /** The text was written by AI: shows the AI Act transparency notice (A8-27). */
  aiGenerated: boolean;
}

/**
 * Disclaimers of a public SEO page (#258 AC7, SE-05): last update, "not legal advice" and, only when the text is
 * AI-generated, the transparency notice. All texts are translated here (A8-19), not taken from the API.
 */
export function SeoDisclaimerFooter({ lastRefreshedAt, aiGenerated }: SeoDisclaimerFooterProps) {
  const { t, i18n } = useTranslation();
  const date = lastRefreshedAt
    ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(
        new Date(lastRefreshedAt),
      )
    : null;

  return (
    <footer className="mt-8 space-y-2 border-t pt-6 text-sm text-muted-foreground" data-testid="seo-disclaimer-footer">
      <p data-testid="seo-last-updated">
        {date ? t('publicSeo.disclaimers.lastUpdated', { date }) : t('publicSeo.disclaimers.lastUpdatedUnknown')}
      </p>
      <p>{t('publicSeo.disclaimers.notLegalAdvice')}</p>
      <AiContentNotice visible={aiGenerated} kind="seo" />
    </footer>
  );
}
