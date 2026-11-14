import { useState } from 'react';
import { FileDown, Lock, RefreshCw, Send, Trash2, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { FeatureFlags } from '@/config/feature-flags';
import { useDocumentsBusy, useDownloadFiscalDocument, useRefreshFiscalDocument } from '@/queries/use-fiscal-documents';
import type { FiscalDocumentEntry } from '@/types';
import { CreditNoteDialog, DiscardDraftDialog, IssueDocumentDialog } from './document-dialogs';
import { documentActionsOf, documentNameOf, documentWriteActionsOf, unavailabilityOf, type Unavailable } from './document-model';

/** What happened to the document of a bar, for the screen that keeps something about it (a selection, an open detail). */
export type DocumentChange = 'issued' | 'discarded' | 'credited';

interface DocumentActionBarProps {
  document: FiscalDocumentEntry;
  /** The flags of the backend, which say whether the PDF of an imported document can be asked. */
  flags: Partial<FeatureFlags>;
  /** The person may change documents: the right to write payments (`payment.write`) AND the flag of the issuance of CasaZen. Without both, no button that changes a document is drawn. */
  canWrite: boolean;
  onChanged?: (id: string, change: DocumentChange) => void;
}

/**
 * What can be done with a document, in a row, in a card and in the detail (FIS-04, FIS-07, E12/F02/US01/T01): its PDF and, for a document CasaZen issued, its XML; and, for who may write
 * payments with the issuance on, the actions of its state: a draft is issued (after a confirmation that says the series, the number and the total), made again from its booking or
 * discarded; an invoice or a receipt that was issued is credited, in whole or in part. A document of the channel manager is «sola lettura»: it has a PDF button only when the channel manager
 * holds one and the endpoint exists here, and nothing can be done to it.
 *
 * The buttons of a document wait for each other: while any write or download of this document runs, wherever it was started (this row, its detail, the card of its booking), every one of them
 * is disabled, so a second click cannot start a second write. A document that is not found any more (404) is told as such and has no button left; an XML that the server says it does not have
 * is told next to the PDF. A PDF the channel manager could not give (`octorate_pdf_unavailable`, which the server also sends for a read that failed just now) keeps its button: the message says
 * why and the person may ask again.
 */
export function DocumentActionBar({ document, flags, canWrite, onChanged }: DocumentActionBarProps) {
  const { t } = useTranslation();
  const { mutate, isPending, variables } = useDownloadFiscalDocument();
  const refresh = useRefreshFiscalDocument();
  const busy = useDocumentsBusy({ documentIds: [document.id] });
  const [dialog, setDialog] = useState<'issue' | 'credit' | 'discard' | null>(null);
  const [gone, setGone] = useState<ReadonlySet<Unavailable>>(() => new Set());
  const actions = documentActionsOf(document, flags);
  const write = documentWriteActionsOf(document, canWrite);
  const name = documentNameOf(t, document);

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

  const showPdf = actions.pdf;
  const xmlGone = gone.has('xml');
  const showXml = actions.xml && !xmlGone;
  const close = () => setDialog(null);
  const dialogDocument = { id: document.id, kind: document.kind, number: document.number, total: document.total, currency: document.currency };

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5 sm:items-end" data-testid="fiscal-document-actions">
      <div className="flex flex-wrap items-center gap-2">
        {write.issue ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => setDialog('issue')}
            aria-label={t('fiscalDocuments.list.actions.issueLabel', { document: name })}
            data-testid="fiscal-document-issue"
          >
            <Send className="size-4" aria-hidden="true" />
            {t('fiscalDocuments.list.actions.issue')}
          </Button>
        ) : null}
        {write.refresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            loading={refresh.isPending}
            onClick={() => refresh.mutate({ documentId: document.id })}
            aria-label={t('fiscalDocuments.list.actions.refreshLabel', { document: name })}
            data-testid="fiscal-document-refresh"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t('fiscalDocuments.list.actions.refresh')}
          </Button>
        ) : null}
        {write.discard ? (
          <Button
            type="button"
            variant="danger-outline"
            size="sm"
            disabled={busy}
            onClick={() => setDialog('discard')}
            aria-label={t('fiscalDocuments.list.actions.discardLabel', { document: name })}
            data-testid="fiscal-document-discard"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t('fiscalDocuments.list.actions.discard')}
          </Button>
        ) : null}
        {write.credit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setDialog('credit')}
            aria-label={t('fiscalDocuments.list.actions.creditLabel', { document: name })}
            data-testid="fiscal-document-credit"
          >
            <Undo2 className="size-4" aria-hidden="true" />
            {t('fiscalDocuments.list.actions.credit')}
          </Button>
        ) : null}
        {showPdf ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
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
            disabled={busy}
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
      {actions.pdfUnavailable ? (
        <span className="text-xs text-foreground/70" data-testid="fiscal-document-pdf-unavailable">
          {t('fiscalDocuments.list.pdfUnavailable')}
        </span>
      ) : null}
      {xmlGone ? (
        <span className="text-xs text-foreground/70" data-testid="fiscal-document-xml-unavailable">
          {t('fiscalDocuments.list.xmlUnavailable')}
        </span>
      ) : null}

      {dialog === 'issue' ? <IssueDocumentDialog document={dialogDocument} onClose={close} onIssued={(id) => onChanged?.(id, 'issued')} /> : null}
      {dialog === 'discard' ? <DiscardDraftDialog document={dialogDocument} onClose={close} onDiscarded={(id) => onChanged?.(id, 'discarded')} /> : null}
      {dialog === 'credit' ? <CreditNoteDialog document={dialogDocument} onClose={close} onCredited={(id) => onChanged?.(id, 'credited')} /> : null}
    </div>
  );
}
