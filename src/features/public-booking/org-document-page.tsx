import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileQuestion, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatLegalDate } from '@/features/legal/legal-paths';
import { useSeoMeta } from '@/lib/seo-meta';
import { sanitizeHtml } from '@/lib/sanitize-html';
import { useOrgDocument } from '@/queries/use-public-org';
import type { OrgSiteDocumentKind, PublicOrgDto } from '@/types';
import '@/styles/public-document.css';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/** The host of an https address, for the guest to see where the link goes; null when it cannot be read. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Page of an operator document on the public site (BK-14, A3-21): `/book/{slug}/privacy` and `/book/{slug}/termini`. It
 * shows the host's own text (versioned), or a link to the document the host hosts elsewhere, or says plainly that the
 * operator has not published it yet. A failed request is an error with a retry, never "not published". CasaZen supplies
 * no text of its own here.
 */
export function OrgDocumentPage({ kind }: { kind: OrgSiteDocumentKind }) {
  const { t, i18n } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const { data: document, isLoading, isError, refetch, isFetching } = useOrgDocument(orgSlug, kind);
  const title = t(`publicSite.documents.${kind}.title`);

  useSeoMeta({
    title: `${title} · ${org.displayName}`,
    description: t('publicSite.documents.seoDescription', { title, name: org.displayName }),
  });

  const backLink = (
    <p className="text-sm">
      <Link to={`/book/${orgSlug}`} className="public-site-link" data-testid="org-document-back">
        {t('publicSite.documents.backToSite', { name: org.displayName })}
      </Link>
    </p>
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center" role="status" data-testid="org-document-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cz-public-primary-text)]" aria-hidden />
        <span className="sr-only">{t('publicSite.documents.loading')}</span>
      </div>
    );
  }

  if (isError || !document) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="org-document-error">
        {backLink}
        <h1 className="public-display text-3xl">{title}</h1>
        <p role="alert" className="text-[var(--cz-public-muted)]">
          {t('publicSite.documents.loadError')}
        </p>
        <Button type="button" className="public-site-cta border-0" onClick={() => void refetch()} disabled={isFetching}>
          {t('shared.errorFallback.tryAgain')}
        </Button>
      </div>
    );
  }

  if (!document.published) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" data-testid="org-document-not-published">
        {backLink}
        <h1 className="public-display text-3xl">{title}</h1>
        <div className="public-site-card flex items-start gap-3 p-6">
          <FileQuestion className="mt-0.5 h-6 w-6 shrink-0 text-[var(--cz-public-muted)]" aria-hidden />
          <div className="space-y-2">
            <p className="font-medium">{t(`publicSite.documents.${kind}.notPublishedTitle`)}</p>
            <p className="text-[var(--cz-public-muted)]">
              {t(`publicSite.documents.${kind}.notPublished`, { name: org.displayName })}
            </p>
            {org.contactEmail ? (
              <p>
                <a href={`mailto:${org.contactEmail}`} className="public-site-link" data-testid="org-document-contact">
                  {t('publicSite.documents.contact', { email: org.contactEmail })}
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const textHtml = document.source === 'Text' ? document.contentHtml : null;
  const hasBody = sanitizeHtml(textHtml) !== '';
  const externalHost = document.source === 'ExternalUrl' && document.externalUrl ? hostOf(document.externalUrl) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid={`org-document-${kind}`}>
      {backLink}
      <header className="space-y-1">
        <h1 className="public-display text-3xl">{title}</h1>
        <p className="text-sm text-[var(--cz-public-muted)]" data-testid="org-document-meta">
          {t('publicSite.documents.publishedBy', { name: org.displayName })}
          {document.version != null && document.publishedAt
            ? ` · ${t('publicSite.documents.version', {
                version: document.version,
                date: formatLegalDate(document.publishedAt, i18n.language),
              })}`
            : ''}
        </p>
      </header>

      {hasBody ? (
        <article
          className="public-document"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(textHtml) }}
          data-testid="org-document-body"
        />
      ) : null}

      {document.source === 'ExternalUrl' && document.externalUrl ? (
        <div className="public-site-card space-y-3 p-6" data-testid="org-document-external">
          <p>{t('publicSite.documents.externalIntro', { name: org.displayName })}</p>
          <a
            href={document.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="public-site-cta inline-flex items-center gap-2 px-4 py-2 text-sm"
            data-testid="org-document-external-link"
          >
            {externalHost
              ? t('publicSite.documents.externalOpenAt', { host: externalHost })
              : t('publicSite.documents.externalOpen')}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <p className="text-sm text-[var(--cz-public-muted)]">{t('publicSite.documents.externalHint')}</p>
        </div>
      ) : null}
    </div>
  );
}

export function OrgPrivacyPage() {
  return <OrgDocumentPage kind="privacy" />;
}

export function OrgTermsPage() {
  return <OrgDocumentPage kind="terms" />;
}
