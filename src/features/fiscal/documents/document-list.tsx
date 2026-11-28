import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/shared/empty-state';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import type { FeatureFlags } from '@/config/feature-flags';
import { cn } from '@/lib/utils';
import type { FiscalDocumentEntry } from '@/types';
import { DocumentActionBar, type DocumentChange } from './document-actions';
import {
  bookingLinkOf,
  documentLabelOf,
  documentNameOf,
  documentPurposeKey,
  documentSourceKey,
  formatDocumentAmount,
  formatDocumentDay,
  isBatchDraft,
  isPeriodDraft,
} from './document-model';
import { DocumentStateBadge } from './document-state-badge';
import { MissingValue } from '@/components/shared/missing-value';

const LINK = 'rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export interface DocumentSelection {
  selected: ReadonlySet<string>;
  disabled: boolean;
  onToggle: (document: FiscalDocumentEntry) => void;
  onTogglePage: (documents: readonly FiscalDocumentEntry[], select: boolean) => void;
}

function SelectBox({ checked, indeterminate = false, disabled, label, onChange, testId }: { checked: boolean; indeterminate?: boolean; disabled: boolean; label: string; onChange: () => void; testId?: string }) {
  return (
    <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        className="h-4 w-4 cursor-pointer accent-primary"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        ref={(input) => {
          if (input) input.indeterminate = indeterminate && !checked;
        }}
        data-testid={testId}
      />
    </label>
  );
}

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
        <MissingValue label={t('fiscalDocuments.list.noRecipient')} testId="fiscal-document-recipient" />
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

function DocumentCell({ document, language, onOpen }: { document: FiscalDocumentEntry; language: string; onOpen?: (document: FiscalDocumentEntry) => void }) {
  const { t } = useTranslation();
  const sourceKey = documentSourceKey(document.source);
  const purposeKey = documentPurposeKey(document.purpose);
  const name = documentNameOf(t, document);

  return (
    <div className="min-w-0">
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(document)}
          className={cn(LINK, 'block max-w-full break-words text-left')}
          aria-label={t('fiscalDocuments.list.actions.openLabel', { document: name })}
          data-testid="fiscal-document-open"
        >
          <span data-testid="fiscal-document-name">{name}</span>
        </button>
      ) : (
        <span className="block break-words" data-testid="fiscal-document-name">
          {name}
        </span>
      )}
      <span className="mt-0.5 block text-sm font-normal text-foreground/70" data-testid="fiscal-document-date">
        {document.issueDate ? formatDocumentDay(document.issueDate, language) : t('fiscalDocuments.list.noDate')}
      </span>
      <span className="mt-0.5 block text-xs font-normal text-foreground/70" data-testid="fiscal-document-source">
        {sourceKey ? t(sourceKey) : document.source}
      </span>
      {purposeKey || document.issuerName ? (
        <span className="mt-0.5 block text-xs font-normal text-foreground/70" data-testid="fiscal-document-purpose" data-purpose={document.purpose}>
          {[purposeKey ? t(purposeKey) : null, document.issuerName ? t('fiscalDocuments.list.issuedBy', { issuer: document.issuerName }) : null].filter((part) => part !== null).join(' · ')}
        </span>
      ) : null}
    </div>
  );
}

interface DocumentListProps {
  documents: readonly FiscalDocumentEntry[];
  label: string;
  canReadBookings: boolean;
  flags: Partial<FeatureFlags>;
  canWrite?: boolean;
  onOpen?: (document: FiscalDocumentEntry) => void;
  selection?: DocumentSelection;
  onChanged?: (id: string, change: DocumentChange) => void;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  errorTitle?: string;
  onRetry?: () => void;
  isRefreshing?: boolean;
  empty: ComponentProps<typeof EmptyState>;
  footer?: ReactNode;
  testId?: string;
}

/**
 * The fiscal documents (FIS-04, NF-84, E06/F03/US04/T01, E12/F02/US01/T01): one table with one row for each document, the ones CasaZen issued and the ones imported from the channel manager, with
 * the kind and the number, the day, the recipient and the booking, the total, the state in words with a color and an icon, and the actions of the document: the PDF and the XML to download and, for
 * who may change documents, the ones of its state (issue, make again, discard, credit). A draft CasaZen issues has a box, to be ticked for a bulk issue. On a phone each row is a card with the same things.
 *
 * Everything is shown as the server wrote it: the number and the day of the document, the total in the currency of its own document (nothing is added up, rounded to another unit or converted, and two
 * currencies are never in one figure). The table adds no total: the server gives none. A read that failed is a failed read, with a retry, and is never an empty list.
 */
export function DocumentList({
  documents,
  label,
  canReadBookings,
  flags,
  canWrite = false,
  onOpen,
  selection,
  onChanged,
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
  const drafts = useMemo(() => documents.filter(isBatchDraft), [documents]);
  const stayDrafts = useMemo(() => drafts.filter(isPeriodDraft), [drafts]);
  const allDrafts = selection !== undefined && stayDrafts.length > 0 && stayDrafts.every((draft) => selection.selected.has(draft.id));
  const someDrafts = selection !== undefined && drafts.some((draft) => selection.selected.has(draft.id));

  const columns = useMemo(
    (): DataColumn<FiscalDocumentEntry>[] => [
      ...(selection
        ? [
            {
              key: 'select',
              header: (
                <SelectBox
                  checked={allDrafts}
                  indeterminate={someDrafts}
                  disabled={selection.disabled || stayDrafts.length === 0}
                  label={t('fiscalDocuments.batch.selectPage')}
                  onChange={() => selection.onTogglePage(allDrafts ? drafts : stayDrafts, !allDrafts)}
                  testId="fiscal-documents-select-page"
                />
              ),
              className: 'w-11 px-1 py-0',
              cell: (document: FiscalDocumentEntry) =>
                isBatchDraft(document) ? (
                  <SelectBox
                    checked={selection.selected.has(document.id)}
                    disabled={selection.disabled}
                    label={t('fiscalDocuments.batch.selectBox', { document: documentLabelOf(t, document) })}
                    onChange={() => selection.onToggle(document)}
                    testId="fiscal-document-select"
                  />
                ) : null,
            } satisfies DataColumn<FiscalDocumentEntry>,
          ]
        : []),
      {
        key: 'document',
        header: t('fiscalDocuments.list.columns.document'),
        rowHeader: true,
        cell: (document) => <DocumentCell document={document} language={language} onOpen={onOpen} />,
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
    [t, language, canReadBookings, onOpen, selection, allDrafts, someDrafts, drafts, stayDrafts],
  );

  const renderCard = (document: FiscalDocumentEntry) => (
    <div className="space-y-3" data-testid="fiscal-document-card">
      {selection && isBatchDraft(document) ? (
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-primary"
            checked={selection.selected.has(document.id)}
            disabled={selection.disabled}
            onChange={() => selection.onToggle(document)}
          />
          {t('fiscalDocuments.batch.selectCard')}
        </label>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 font-medium text-foreground">
          <DocumentCell document={document} language={language} onOpen={onOpen} />
        </div>
        <TotalFigure document={document} language={language} />
      </div>
      <RecipientCell document={document} canReadBookings={canReadBookings} />
      <DocumentStateBadge document={document} />
      <DocumentActionBar document={document} flags={flags} canWrite={canWrite} onChanged={onChanged} />
    </div>
  );

  return (
    <div aria-busy={isRefreshing || undefined} className={cn('transition-opacity', isRefreshing && 'opacity-60')} data-testid={testId}>
      <DataView<FiscalDocumentEntry>
        label={label}
        rows={documents}
        columns={columns}
        rowKey={(document) => document.id}
        rowActions={(document) => <DocumentActionBar document={document} flags={flags} canWrite={canWrite} onChanged={onChanged} />}
        renderCard={renderCard}
        isLoading={isLoading}
        isError={isError}
        error={error}
        errorTitle={errorTitle}
        onRetry={onRetry}
        empty={empty}
        cardsUntil="xl"
        footer={footer}
        onRowClick={onOpen ? (document) => onOpen(document) : undefined}
        rowClassName={(document) => (document.sdiStatus === 'rejected' && document.source === 'CasaZen' ? 'bg-danger-soft/40' : undefined)}
        rowTestId={() => 'fiscal-document-row'}
      />
    </div>
  );
}
