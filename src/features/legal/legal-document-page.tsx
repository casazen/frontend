import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLegalDocument, useLegalLanguage } from '@/queries/use-legal';
import { useSeoMeta } from '@/lib/seo-meta';
import { sanitizeHtml } from '@/lib/sanitize-html';
import type { LegalDocumentKey } from '@/types/onboarding.types';
import { formatLegalDate, LEGAL_INDEX_PATH } from './legal-paths';

/**
 * Public page of a legal document (PL-14, A1-06): version and date in force from the backend, and the text provided by
 * the product owner (D14). While the text is missing the page says it is being prepared: never an invented text.
 */
export function LegalDocumentPage({ documentKey }: { documentKey: LegalDocumentKey }) {
  const { t } = useTranslation();
  const language = useLegalLanguage();
  const { data: document, isLoading, isError, refetch, isFetching } = useLegalDocument(documentKey);
  const title = t(`legal.documents.${documentKey}.title`);

  useSeoMeta({ title: `${title} · CasaZen`, description: t(`legal.documents.${documentKey}.summary`) });

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="legal-document-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label={t('legal.loading')} />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center" data-testid="legal-document-error">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p role="alert" className="mt-2 text-muted-foreground">
          {t('legal.loadError')}
        </p>
        <Button type="button" className="mt-4" onClick={() => void refetch()} disabled={isFetching}>
          {t('legal.retry')}
        </Button>
      </main>
    );
  }

  const body = sanitizeHtml(document.contentHtml);
  const showTranslationNotice = body !== '' && document.contentLanguage != null && document.contentLanguage !== language;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8" data-testid={`legal-document-${documentKey}`}>
      <p className="text-sm">
        <Link to={LEGAL_INDEX_PATH} className="underline hover:text-[var(--cz-public-primary-text)]">
          {t('legal.backToIndex')}
        </Link>
      </p>
      <header className="mb-6 mt-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="legal-document-version">
          {t('legal.version', { version: document.version })}
          {' · '}
          {document.effectiveAt
            ? t('legal.effectiveAt', { date: formatLegalDate(document.effectiveAt, language) })
            : t('legal.effectiveAtPending')}
        </p>
      </header>

      {showTranslationNotice ? (
        <p className="mb-4 rounded-md border p-3 text-sm" data-testid="legal-document-translation-notice">
          {t('legal.onlyItalian')}
        </p>
      ) : null}

      {body ? (
        <article
          className="prose prose-neutral max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(document.contentHtml) }}
          data-testid="legal-document-body"
        />
      ) : null}

      {document.documentUrl ? (
        <p className="mt-6">
          <a
            href={document.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--cz-public-primary-text)]"
            data-testid="legal-document-external"
          >
            {t('legal.openOfficialCopy')}
          </a>
        </p>
      ) : null}

      {!body && !document.documentUrl ? (
        <p className="rounded-md border p-4 text-muted-foreground" data-testid="legal-document-in-preparation">
          {t('legal.inPreparation')}
        </p>
      ) : null}
    </main>
  );
}

export function TermsPage() {
  return <LegalDocumentPage documentKey="tos" />;
}

export function PrivacyPage() {
  return <LegalDocumentPage documentKey="privacy" />;
}

export function DpaPage() {
  return <LegalDocumentPage documentKey="dpa" />;
}
