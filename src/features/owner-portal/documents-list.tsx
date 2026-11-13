import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Download, MessageSquare } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ownerPortalApi } from '@/api/ownerPortal.api';
import { formatStayDate } from '@/lib/stay-dates';
import type { OwnerDocument, OwnerDocumentExpiryState, OwnerDocumentVersion, OwnerDocumentVersionState } from '@/types';
import { formatBytes, otherVersions, primaryVersion, safeDownloadName } from './owner-portal-model';
import { ownerPortalPaths } from './paths';
import { StatusPill, type PillTone, TOUCH } from './portal-parts';
import { useOwnerDownload } from './use-owner-download';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

const EXPIRY_TONE: Record<Exclude<OwnerDocumentExpiryState, 'none'>, PillTone> = {
  valid: 'success',
  expiring: 'warning',
  expired: 'danger',
};

const VERSION_TONE: Record<OwnerDocumentVersionState, PillTone> = {
  current: 'success',
  upcoming: 'info',
  superseded: 'neutral',
  expired: 'danger',
};

interface DocumentsListProps {
  documents: readonly OwnerDocument[];
  /** Said when there is none: the list is the server's, so an empty one is a fact («the agency shared nothing yet»), never a failure. */
  emptyText: string;
  testId?: string;
  /** The level of the title of a document: one below the heading of the section it sits in (`h2` straight under the `h1` of a page, `h3` under an `h2`). */
  headingAs?: 'h2' | 'h3';
}

/**
 * The documents the agency shares with the owner (E07/F07/US01/T03, AC-NF111-3): each one with the version in force, its dates and its expiry, the older versions kept as they
 * were, and a download for every version (the audit is the server's). Cards that stack on a phone, no table to scroll sideways; every button is at least 44 px and says
 * which document it is for. One download at a time: the other buttons wait.
 */
export function DocumentsList({ documents, emptyText, testId = 'owner-documents', headingAs: Heading = 'h3' }: DocumentsListProps) {
  const { t, i18n } = useTranslation();
  const { download, busyKey, failure } = useOwnerDownload();

  if (documents.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid={`${testId}-empty`}>
        {emptyText}
      </p>
    );
  }

  const fetchVersion = (document: OwnerDocument, version: OwnerDocumentVersion) => {
    void download(
      version.id,
      () => ownerPortalApi.downloadDocument(document.id, version.id),
      safeDownloadName(version.fileName, version.contentType, document.title),
    );
  };

  const versionLine = (version: OwnerDocumentVersion) => {
    const parts: string[] = [t('ownerPortal.documents.version', { number: version.versionNumber })];
    if (version.effectiveFrom) parts.push(t('ownerPortal.documents.effectiveFrom', { date: formatStayDate(version.effectiveFrom, i18n.language, DATE) }));
    if (version.expiresOn) parts.push(t('ownerPortal.documents.expiresOn', { date: formatStayDate(version.expiresOn, i18n.language, DATE) }));
    parts.push(formatBytes(version.sizeBytes, i18n.language));
    return parts.filter(Boolean).join(' · ');
  };

  return (
    <ul className="space-y-3" data-testid={testId}>
      {documents.map((document) => {
        const primary = primaryVersion(document);
        const older = otherVersions(document);
        const failed = failure && document.versions.some((version) => version.id === failure.key) ? failure : null;
        return (
          <li key={document.id} className="min-w-0 rounded-md border bg-card p-4" data-testid="owner-document">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Heading className="break-words text-base font-semibold">{document.title}</Heading>
                <p className="text-sm text-muted-foreground">
                  {t(`ownerPortal.documents.type.${document.type}`)}
                  {document.propertyName ? ` · ${document.propertyName}` : ''}
                </p>
              </div>
              {document.expiryState !== 'none' ? (
                <StatusPill tone={EXPIRY_TONE[document.expiryState]} data-testid="owner-document-expiry">
                  {document.expiresOn
                    ? t(`ownerPortal.documents.expiry.${document.expiryState}`, { date: formatStayDate(document.expiresOn, i18n.language, DATE) })
                    : t(`ownerPortal.documents.expiryNoDate.${document.expiryState}`)}
                </StatusPill>
              ) : null}
            </div>

            {primary ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill tone={VERSION_TONE[primary.state]}>{t(`ownerPortal.documents.versionState.${primary.state}`)}</StatusPill>
                  <span className="min-w-0 break-words text-muted-foreground">{versionLine(primary)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className={TOUCH}
                    disabled={busyKey !== null}
                    loading={busyKey === primary.id}
                    onClick={() => fetchVersion(document, primary)}
                    aria-label={t('ownerPortal.documents.downloadAria', { title: document.title, number: primary.versionNumber })}
                    data-testid="owner-document-download"
                  >
                    <Download aria-hidden="true" className="h-4 w-4" />
                    {t('ownerPortal.documents.download')}
                  </Button>
                  <Button asChild variant="outline" className={TOUCH}>
                    <Link to={`${ownerPortalPaths.messages}?topic=document&documentId=${encodeURIComponent(document.id)}`}>
                      <MessageSquare aria-hidden="true" className="h-4 w-4" />
                      {t('ownerPortal.documents.ask')}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t('ownerPortal.documents.noVersion')}</p>
            )}

            {older.length > 0 ? (
              <details className="mt-3 rounded-md border bg-background">
                <summary className="flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {t('ownerPortal.documents.olderVersions', { count: older.length })}
                </summary>
                <ul className="space-y-2 border-t p-3">
                  {older.map((version) => (
                    <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 break-words">
                        <StatusPill tone={VERSION_TONE[version.state]} className="mr-2">
                          {t(`ownerPortal.documents.versionState.${version.state}`)}
                        </StatusPill>
                        {versionLine(version)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className={TOUCH}
                        disabled={busyKey !== null}
                        loading={busyKey === version.id}
                        onClick={() => fetchVersion(document, version)}
                        aria-label={t('ownerPortal.documents.downloadAria', { title: document.title, number: version.versionNumber })}
                      >
                        <Download aria-hidden="true" className="h-4 w-4" />
                        {t('ownerPortal.documents.download')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {failed ? (
              <Alert variant="danger" className="mt-3" data-testid="owner-document-download-failed">
                {failed.message}
              </Alert>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
