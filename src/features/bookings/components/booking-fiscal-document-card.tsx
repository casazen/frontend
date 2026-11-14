import { useState } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { isFeatureEnabled } from '@/config/feature-flags';
import { IssueDocumentDialog } from '@/features/fiscal/documents/document-dialogs';
import {
  bookingDocumentPaymentOf,
  bookingDocumentStateOf,
  documentNameOf,
  documentsReadOf,
  formatDocumentAmount,
  formatDocumentDay,
} from '@/features/fiscal/documents/document-model';
import { FISCAL_DOCUMENTS_PATH } from '@/features/fiscal/documents/document-paths';
import { StatePill } from '@/features/fiscal/documents/document-state-badge';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { useBookingFiscalDocuments, useCreateFiscalDraft, useDocumentsBusy } from '@/queries/use-fiscal-documents';
import type { BookingFiscalDocument } from '@/types';

const NO_DOCUMENTS: readonly BookingFiscalDocument[] = [];

/**
 * «Documento fiscale» in the tab Pagamento of a booking (E12/F02/US01/T01, NF-83, NF-112): the documents CasaZen has for the booking, each with its kind and number, its state, its total in its own
 * currency and, for an invoice or a receipt that was issued, whether the money was collected; and what the host does next: «Crea bozza» when the booking has no document yet, «Emetti» on a draft (the
 * confirmation says the series, the number and the total). CasaZen issues the document of every booking, a booking of a portal included.
 *
 * It is there only while the issuance of CasaZen is on (the flag `fiscalDocumentIssuance`: with it off the tab is as it always was) and for who may read payments; the buttons that change a document
 * are for who may write them. A booking the caller does not reach is told as not found, whatever an earlier read left in the cache; a read that failed is told as failed, with a retry, and is never
 * an empty card. The buttons wait while any write on the documents of this booking runs. The server says why a draft cannot be made (the data of the invoice missing, the rules of the document not
 * configured, the issuer's data incomplete) and the card tells it in words.
 */
export function BookingFiscalDocumentCard({ bookingId }: { bookingId: string }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const canRead = hasPermission('short-rent', 'payment.read') && isFeatureEnabled(flags, 'fiscalDocumentIssuance');
  const canWrite = canRead && hasPermission('short-rent', 'payment.write');
  const canOpenPage = canRead && hasPermission('short-rent', 'property.read');
  const documents = useBookingFiscalDocuments(bookingId, { enabled: canRead });
  const create = useCreateFiscalDraft();
  const [issuing, setIssuing] = useState<BookingFiscalDocument | null>(null);
  const ids = (documents.data ?? NO_DOCUMENTS).map((document) => document.id);
  const busy = useDocumentsBusy({ documentIds: ids, bookingId });

  if (!canRead) return null;

  const read = documentsReadOf({ enabled: canRead, isError: documents.isError, status: getHttpStatus(documents.error), hasData: documents.data !== undefined });
  const rows = read === 'ok' ? (documents.data ?? NO_DOCUMENTS) : NO_DOCUMENTS;
  const language = i18n.language;
  const pageLink = canOpenPage ? { actionLabel: t('fiscalDocuments.bookingCard.open'), href: FISCAL_DOCUMENTS_PATH } : {};

  return (
    <PlainSection title={t('fiscalDocuments.bookingCard.title')} data-testid="booking-fiscal-document" {...pageLink}>
      <div className="max-w-xl space-y-3">
        {read === 'loading' || read === 'idle' ? (
          <p role="status" className="text-sm text-foreground/70" data-testid="booking-fiscal-document-loading">
            {t('fiscalDocuments.bookingCard.loading')}
          </p>
        ) : read === 'notFound' ? (
          <p className="text-sm text-foreground/70" data-testid="booking-fiscal-document-not-found">
            {t('fiscalDocuments.bookingCard.notFound')}
          </p>
        ) : read === 'forbidden' ? (
          <p className="text-sm text-foreground/70" data-testid="booking-fiscal-document-forbidden">
            {t('fiscalDocuments.list.forbidden')}
          </p>
        ) : read === 'failed' ? (
          <ErrorState title={t('fiscalDocuments.bookingCard.loadError')} error={documents.error} onRetry={() => void documents.refetch()} testId="booking-fiscal-document-failed" />
        ) : rows.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-foreground/70" data-testid="booking-fiscal-document-empty">
              {t(canWrite ? 'fiscalDocuments.bookingCard.emptyWrite' : 'fiscalDocuments.bookingCard.empty')}
            </p>
            {canWrite ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                loading={create.isPending}
                onClick={() => create.mutate({ bookingId })}
                data-testid="booking-fiscal-document-create"
              >
                {t('fiscalDocuments.bookingCard.createDraft')}
              </Button>
            ) : null}
          </div>
        ) : (
          <ul role="list" className="divide-y divide-border" data-testid="booking-fiscal-documents">
            {rows.map((document) => {
              const payment = bookingDocumentPaymentOf(document);
              const name = documentNameOf(t, document);
              return (
                <li key={document.id} className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0" data-testid="booking-fiscal-document-row">
                  <div className="min-w-0 space-y-1.5">
                    <p className="break-words font-medium" data-testid="booking-fiscal-document-name">
                      {name}
                    </p>
                    <p className="text-sm text-foreground/70" data-testid="booking-fiscal-document-date">
                      {document.issueDate ? t('fiscalDocuments.bookingCard.issuedOn', { date: formatDocumentDay(document.issueDate, language) }) : t('fiscalDocuments.list.noDate')}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatePill state={bookingDocumentStateOf(document)} testId="booking-fiscal-document-state" />
                      {payment ? <StatePill state={payment} testId="booking-fiscal-document-payment" /> : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="whitespace-nowrap text-lg font-semibold tabular-nums" data-testid="booking-fiscal-document-total">
                      {formatDocumentAmount(document.total, document.currency, language)}
                    </span>
                    {canWrite && document.status === 'Draft' && document.kind !== 'Proforma' ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => setIssuing(document)}
                        aria-label={t('fiscalDocuments.list.actions.issueLabel', { document: name })}
                        data-testid="booking-fiscal-document-issue"
                      >
                        <Send className="size-4" aria-hidden="true" />
                        {t('fiscalDocuments.list.actions.issue')}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {issuing ? <IssueDocumentDialog document={issuing} onClose={() => setIssuing(null)} /> : null}
      </div>
    </PlainSection>
  );
}
