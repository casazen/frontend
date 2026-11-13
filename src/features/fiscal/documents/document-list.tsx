import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { FileDown, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import type { FeatureFlags } from '@/config/feature-flags';
import { useDownloadFiscalDocument } from '@/queries/use-fiscal-documents';
import { cn } from '@/lib/utils';
import type { FiscalDocumentEntry } from '@/types';
import {
  bookingLinkOf,
  documentActionsOf,
  documentKindKey,
  documentSourceKey,
  formatDocumentAmount,
  formatDocumentDay,
  unavailabilityOf,
  type Unavailable,
} from './document-model';
import { DocumentStateBadge } from './document-state-badge';

const LINK = 'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** A figure the server did not give: a dash for the eye and the words for a screen reader. */
function Missing({ label, testId }: { label: string; testId?: string }) {
  return (
    <span data-missing="true" data-testid={testId}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** The words of the kind of a document; a kind this client has no words for (the server is newer) is shown as it came. */
function kindWords(t: TFunction, document: FiscalDocumentEntry): string {
  const key = documentKindKey(document.kind);
  return key ? t(key) : document.kind;
}

/** What names a document: its kind and the number the server gave it (a draft has none, and says so). */
function documentName(t: TFunction, document: FiscalDocumentEntry): string {
  const kind = kindWords(t, document);
  return document.number ? t('fiscalDocuments.list.named', { kind, number: document.number }) : t('fiscalDocuments.list.unnumbered', { kind });
}

/**
 * The buttons of a document: its PDF and, for a document CasaZen issued, its XML. A document of the channel manager is «sola lettura», and has a PDF button only when the
 * channel manager holds one and the endpoint exists here. The buttons of a card wait for each other: while any download of this document is on the way every one of them is
 * disabled, so a second click cannot start a second download. A document that is not found any more (404) is told as such and has no button left; a PDF or an XML that the server
 * says it does not have is told next to the other button.
 */
function DocumentActions({ document, flags }: { document: FiscalDocumentEntry; flags: Partial<FeatureFlags> }) {
  const { t } = useTranslation();
  const { mutate, isPending, variables } = useDownloadFiscalDocument();
  const [gone, setGone] = useState<ReadonlySet<Unavailable>>(() => new Set());
  const actions = documentActionsOf(document, flags);
  const name = documentName(t, document);

  const download = (format: 'pdf' | 'xml') =>
    mutate(
      { document, format },
      {
        onError: (error) => {
          const missing = unavailabilityOf(error);
          if (missing) setGone((current) => new Set(current).add(missing));
        },
      },
    );

  if (gone.has('document')) {
    return (
      <p className="text-sm text-foreground/70" data-testid="fiscal-document-gone">
        {t('fiscalDocuments.list.gone')}
      </p>
    );
  }

  const showPdf = actions.pdf && !gone.has('pdf');
  const showXml = actions.xml && !gone.has('xml');

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 sm:items-end" data-testid="fiscal-document-actions">
      <div className="flex flex-wrap items-center gap-2">
        {showPdf ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            loading={isPending && variables?.format === 'pdf'}
            onClick={() => download('pdf')}
            aria-label={t('fiscalDocuments.list.actions.pdfLabel', { document: name })}
            data-testid="fiscal-document-pdf"
          >
            <FileDown className="size-4" aria-hidden="true" />
            {t('fiscalDocuments.list.actions.pdf')}
          </Button>
        ) : null}
        {showXml ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            loading={isPending && variables?.format === 'xml'}
            onClick={() => download('xml')}
            aria-label={t('fiscalDocuments.list.actions.xmlLabel', { document: name })}
            data-testid="fiscal-document-xml"
          >
            <FileDown className="size-4" aria-hidden="true" />
            {t('fiscalDocuments.list.actions.xml')}
          </Button>
        ) : null}
      </div>
      {actions.readOnly ? (
        <span className="inline-flex items-center gap-1 text-xs text-foreground/70" data-testid="fiscal-document-readonly">
          <Lock className="size-3" aria-hidden="true" />
          {t('fiscalDocuments.list.readOnly')}
        </span>
      ) : null}
      {actions.pdfUnavailable || gone.has('pdf') ? (
        <span className="text-xs text-foreground/70" data-testid="fiscal-document-pdf-unavailable">
          {t('fiscalDocuments.list.pdfUnavailable')}
        </span>
      ) : null}
      {gone.has('xml') ? (
        <span className="text-xs text-foreground/70" data-testid="fiscal-document-xml-unavailable">
          {t('fiscalDocuments.list.xmlUnavailable')}
        </span>
      ) : null}
    </div>
  );
}

/** The booking of the document: a link to it for who may read bookings, the words alone for who may not, and a note for a document that belongs to no booking. */
function BookingCell({ document, canReadBookings }: { document: FiscalDocumentEntry; canReadBookings: boolean }) {
  const { t } = useTranslation();
  const href = bookingLinkOf(document, canReadBookings);

  if (!document.bookingId) {
    return (
      <span className="text-sm text-foreground/70" data-testid="fiscal-document-no-booking">
        {t('fiscalDocuments.list.noBooking')}
      </span>
    );
  }
  return href ? (
    <Link to={href} className={cn(LINK, 'text-sm')} data-testid="fiscal-document-booking">
      {t('fiscalDocuments.list.booking')}
    </Link>
  ) : (
    <span className="text-sm text-foreground/70" data-testid="fiscal-document-booking-text">
      {t('fiscalDocuments.list.bookingLinked')}
    </span>
  );
}

function RecipientCell({ document, canReadBookings }: { document: FiscalDocumentEntry; canReadBookings: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0">
      {document.recipientName ? (
        <span className="block break-words text-foreground" data-testid="fiscal-document-recipient">
          {document.recipientName}
        </span>
      ) : (
        <Missing label={t('fiscalDocuments.list.noRecipient')} testId="fiscal-document-recipient" />
      )}
      <div className="mt-0.5">
        <BookingCell document={document} canReadBookings={canReadBookings} />
      </div>
    </div>
  );
}

function TotalFigure({ document, language }: { document: FiscalDocumentEntry; language: string }) {
  return (
    <span className="whitespace-nowrap tabular-nums" data-testid="fiscal-document-total">
      {formatDocumentAmount(document.total, document.currency, language)}
    </span>
  );
}

/** The kind and the number, the day of the issue and who issued it: the number and the day are the ones of the server. */
function DocumentCell({ document, language }: { document: FiscalDocumentEntry; language: string }) {
  const { t } = useTranslation();
  const sourceKey = documentSourceKey(document.source);

  return (
    <div className="min-w-0">
      <span className="block break-words" data-testid="fiscal-document-name">
        {documentName(t, document)}
      </span>
      <span className="mt-0.5 block text-sm font-normal text-foreground/70" data-testid="fiscal-document-date">
        {document.issueDate ? formatDocumentDay(document.issueDate, language) : t('fiscalDocuments.list.noDate')}
      </span>
      <span className="mt-0.5 block text-xs font-normal text-foreground/70" data-testid="fiscal-document-source">
        {sourceKey ? t(sourceKey) : document.source}
      </span>
    </div>
  );
}

interface DocumentListProps {
  /** The documents, as the server sent them and in its order (newest first). */
  documents: readonly FiscalDocumentEntry[];
  /** The name of the table for a screen reader. */
  label: string;
  /** Whether the caller may read bookings: without it the booking is told in words and is not a link. */
  canReadBookings: boolean;
  /** The flags of the backend, which say whether the PDF of an imported document can be asked. */
  flags: Partial<FeatureFlags>;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  /** What failed to load, already translated. */
  errorTitle?: string;
  onRetry?: () => void;
  /** The rows on screen are being read again (the next page, a document just issued): they stay, quieter, until the new ones are there. */
  isRefreshing?: boolean;
  /** What the list says when it has no document: the props of an `EmptyState`. */
  empty: ComponentProps<typeof EmptyState>;
  /** Under the list: the count and the pages. */
  footer?: ReactNode;
  testId?: string;
}

/**
 * The fiscal documents (FIS-04, NF-84, E06/F03/US04/T01): one table with one row for each document, the ones CasaZen issued and the ones imported from the channel manager, with
 * the kind and the number, the day, the recipient and the booking, the total, the state in words with a color and an icon, and the PDF and the XML to download. On a phone each
 * row is a card with the same things.
 *
 * Everything is shown as the server wrote it: the number and the day of the document, the total in the currency of its own document (nothing is added up, rounded to another unit
 * or converted, and two currencies are never in one figure). The table adds no total: the server gives none. A read that failed is a failed read, with a retry, and is never an
 * empty list.
 */
export function DocumentList({
  documents,
  label,
  canReadBookings,
  flags,
  isLoading = false,
  isError = false,
  error,
  errorTitle,
  onRetry,
  isRefreshing = false,
  empty,
  footer,
  testId = 'fiscal-documents-list',
}: DocumentListProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const columns = useMemo(
    (): DataColumn<FiscalDocumentEntry>[] => [
      {
        key: 'document',
        header: t('fiscalDocuments.list.columns.document'),
        rowHeader: true,
        cell: (document) => <DocumentCell document={document} language={language} />,
      },
      {
        key: 'recipient',
        header: t('fiscalDocuments.list.columns.recipient'),
        cell: (document) => <RecipientCell document={document} canReadBookings={canReadBookings} />,
      },
      {
        key: 'total',
        header: t('fiscalDocuments.list.columns.total'),
        align: 'end',
        cell: (document) => <TotalFigure document={document} language={language} />,
      },
      {
        key: 'state',
        header: t('fiscalDocuments.list.columns.state'),
        cell: (document) => <DocumentStateBadge document={document} />,
      },
    ],
    [t, language, canReadBookings],
  );

  const renderCard = (document: FiscalDocumentEntry) => (
    <div className="space-y-3" data-testid="fiscal-document-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 font-medium text-foreground">
          <DocumentCell document={document} language={language} />
        </div>
        <TotalFigure document={document} language={language} />
      </div>
      <RecipientCell document={document} canReadBookings={canReadBookings} />
      <DocumentStateBadge document={document} />
      <DocumentActions document={document} flags={flags} />
    </div>
  );

  return (
    <div aria-busy={isRefreshing || undefined} className={cn('transition-opacity', isRefreshing && 'opacity-60')} data-testid={testId}>
      <DataView<FiscalDocumentEntry>
        label={label}
        rows={documents}
        columns={columns}
        rowKey={(document) => document.id}
        rowActions={(document) => <DocumentActions document={document} flags={flags} />}
        renderCard={renderCard}
        isLoading={isLoading}
        isError={isError}
        error={error}
        errorTitle={errorTitle}
        onRetry={onRetry}
        empty={empty}
        cardsUntil="xl"
        footer={footer}
        rowClassName={(document) => (document.sdiStatus === 'rejected' && document.source === 'CasaZen' ? 'bg-danger-soft/40' : undefined)}
        rowTestId={() => 'fiscal-document-row'}
      />
    </div>
  );
}
