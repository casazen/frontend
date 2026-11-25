import { FileStack } from 'lucide-react';
import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ownerPortalApi } from '@/api/ownerPortal.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { isFeatureEnabled } from '@/config/feature-flags';
import { IssuedDocumentsExport } from '@/features/owners/components/issued-documents-export';
import { currentData, ownerReadStateOf, safeDownloadName } from '@/features/owner-portal/owner-portal-model';
import { currencyCode, formatMoney, invoiceKindOf } from '@/features/owner-portal/owner-statement-model';
import { PortalLoading, PortalNotice, PortalPageHeading, PortalReadProblem, StatusPill, TOUCH, type PillTone } from '@/features/owner-portal/portal-parts';
import { MoneyNote, PdfButton } from '@/features/owner-portal/statement-parts';
import { useOwnerDownload } from '@/features/owner-portal/use-owner-download';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { useOwnerIssuedDocuments, useOwnerIssuedDocumentsExport } from '@/queries/ownerPortal';
import type { OwnerPortalIssuedDocument } from '@/types';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The documents drawn before «Mostra tutti»: an owner with several flats has hundreds of them in a year, and the ZIP for the accountant is the way to have them all. */
const VISIBLE = 30;

/** The colour of each state towards the SDI that has words; any other state is neutral and is shown as it came. */
const SDI_TONE: Readonly<Record<string, PillTone>> = {
  not_applicable: 'neutral',
  to_send: 'warning',
  submitted: 'info',
  delivered: 'success',
  rejected: 'danger',
  manual_declared: 'info',
};

/** What a failed export says, in words: the permission the owner did not give, a part that is not open, and the sentence of the code of any other (a period that is not one, a ZIP that would be too large). */
function exportProblemOf(error: unknown, t: TFunction): string {
  const state = ownerReadStateOf(error);
  if (state === 'permission') return t('ownerPortal.states.permission.description');
  if (getHttpStatus(error) === 404) return t('ownerPortal.issued.export.unavailable');
  return getProblemMessage(error, t) ?? t('ownerPortal.issued.export.failed');
}

/**
 * «Documenti emessi a tuo nome» (E17/F03/US01/T03, NF-116): the receipts of a private owner and the invoices of a company that CasaZen issued in the owner's name, with their credit notes: the number, the day, the
 * kind, the total in its own currency and where the document stands with the SDI, the PDF and the XML to download, and «Scarica per il tuo commercialista», one ZIP of a month or of a year with the documents, their
 * register and the index of their files. Mobile first: a card for each document, buttons that are at least 44 px high, nothing that scrolls sideways. NOTHING of a guest is here: the list carries no name and no contact,
 * and the PDF and the XML hold only what the document itself says. It exists while the issuance of fiscal documents and the agency plan are on (off: nothing is asked and the page says it is not open); an amount
 * with no currency is written without a symbol and the page says so.
 */
export function OwnerIssuedDocuments() {
  const { t } = useTranslation();
  const { flags, isLoading } = useFeatureFlags();
  const open = isFeatureEnabled(flags, 'fiscalDocumentIssuance') && isFeatureEnabled(flags, 'agencyTier');

  return (
    <div className="space-y-6">
      <PortalPageHeading icon={FileStack} title={t('ownerPortal.issued.title')} description={t('ownerPortal.issued.description')} />
      {isLoading ? <PortalLoading label={t('ownerPortal.issued.loading')} /> : open ? <IssuedDocumentsBody /> : <PortalNotice state="unavailable" testId="owner-issued-not-open" />}
    </div>
  );
}

function IssuedDocumentsBody() {
  const { t } = useTranslation();
  const documents = useOwnerIssuedDocuments();
  const exporter = useOwnerIssuedDocumentsExport();
  const downloads = useOwnerDownload();
  const [showAll, setShowAll] = useState(false);
  // Drawn only while the last answer is good: after a refusal nothing of the answer before it stays under the notice.
  const list = currentData(documents) ?? [];
  const shown = showAll ? list : list.slice(0, VISIBLE);
  // The part that says no (the permission the owner did not give, a part that is not open) offers no file either: the notice of the list says why, and a button that can only be refused is not drawn. A list that
  // merely failed to load (no answer, a server error) leaves the export, which is a call of its own.
  const refusal = documents.isError ? ownerReadStateOf(documents.error) : null;
  const filesOpen = refusal === null || refusal === 'failed';

  return (
    <>
      <p className="text-sm text-muted-foreground" data-testid="owner-issued-privacy">
        {t('ownerPortal.issued.privacy')}
      </p>

      {filesOpen ? (
        <section aria-labelledby="owner-issued-export-title" className="space-y-3">
          <h2 id="owner-issued-export-title" className="text-xl font-semibold text-[#1f3a3d]">
            {t('ownerPortal.issued.export.title')}
          </h2>
          <IssuedDocumentsExport
            testId="owner-issued-export"
            download={({ period, signal }) => exporter.mutateAsync({ period, signal })}
            problemOf={(error) => exportProblemOf(error, t)}
            downloadLabel={t('ownerPortal.issued.export.download')}
          />
        </section>
      ) : null}

      <section aria-labelledby="owner-issued-list-title" className="space-y-3">
        <h2 id="owner-issued-list-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.issued.listTitle')}
        </h2>
        {documents.isLoading ? (
          <PortalLoading label={t('ownerPortal.issued.loading')} />
        ) : documents.isError ? (
          <PortalReadProblem error={documents.error} failedTitle={t('ownerPortal.issued.error')} onRetry={() => void documents.refetch()} testId="owner-issued-error" />
        ) : list.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-issued-empty">
            {t('ownerPortal.issued.empty')}
          </p>
        ) : (
          <>
            <ul className="space-y-3" data-testid="owner-issued-list">
              {shown.map((document) => (
                <IssuedDocumentCard key={document.documentId} document={document} downloads={downloads} />
              ))}
            </ul>
            {list.length > VISIBLE ? (
              <Button type="button" variant="outline" className={TOUCH} onClick={() => setShowAll((current) => !current)} data-testid="owner-issued-show-all">
                {showAll ? t('ownerPortal.issued.showLess') : t('ownerPortal.issued.showAll', { count: list.length })}
              </Button>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}

/** One document issued in the name of the owner: its kind and number, its day, the agency that issues it for the owner, its total in its own currency, where it stands with the SDI and its files. */
function IssuedDocumentCard({ document, downloads }: { document: OwnerPortalIssuedDocument; downloads: ReturnType<typeof useOwnerDownload> }) {
  const { t, i18n } = useTranslation();
  const { download, busyKey, failure } = downloads;
  const language = i18n.language;
  const kind = invoiceKindOf(document.kind);
  const title = t('ownerPortal.issued.cardTitle', { kind: t(`ownerPortal.accounting.pmInvoices.kind.${kind}`), number: document.number, date: formatStayDate(document.issueDate, language, DATE) });
  const stem = document.number.replace(/[^A-Za-z0-9_-]+/g, '-');
  const pdfKey = `issued:${document.documentId}:pdf`;
  const xmlKey = `issued:${document.documentId}:xml`;
  const failed = failure !== null && (failure.key === pdfKey || failure.key === xmlKey) ? failure : null;
  const sdiKnown = Object.hasOwn(SDI_TONE, document.sdiStatus);

  return (
    <li className="min-w-0 space-y-3 rounded-md border bg-card p-4" data-testid="owner-issued-document" data-kind={kind} data-sdi={document.sdiStatus}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{title}</h3>
          {document.agencyName ? <p className="break-words text-sm text-muted-foreground">{document.agencyName}</p> : null}
        </div>
        <StatusPill tone={sdiKnown ? SDI_TONE[document.sdiStatus] : 'neutral'} data-testid="owner-issued-sdi">
          {sdiKnown ? t(`ownerPortal.issued.sdi.${document.sdiStatus}`) : t('ownerPortal.issued.sdi.other', { code: document.sdiStatus })}
        </StatusPill>
      </div>

      <div>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.issued.total')}</p>
        <p className="text-lg font-semibold tabular-nums" data-testid="owner-issued-total">
          {formatMoney(document.total, document.currency, language)}
        </p>
      </div>
      {currencyCode(document.currency) ? null : <MoneyNote testId="owner-issued-currency-missing">{t('ownerPortal.issued.currencyMissing')}</MoneyNote>}

      <div className="flex flex-wrap gap-2">
        <PdfButton
          label={t('ownerPortal.issued.pdf')}
          ariaLabel={t('ownerPortal.issued.pdfAria', { title })}
          disabled={busyKey !== null}
          loading={busyKey === pdfKey}
          onClick={() =>
            void download(pdfKey, () => ownerPortalApi.downloadIssuedDocumentPdf(document.documentId, language.toLowerCase().startsWith('en') ? 'en' : 'it'), safeDownloadName(`${t('ownerPortal.issued.file')}-${stem}`, 'application/pdf', t('ownerPortal.issued.file')))
          }
          testId="owner-issued-pdf"
        />
        {document.hasXml ? (
          <PdfButton
            label={t('ownerPortal.issued.xml')}
            ariaLabel={t('ownerPortal.issued.xmlAria', { title })}
            disabled={busyKey !== null}
            loading={busyKey === xmlKey}
            onClick={() => void download(xmlKey, () => ownerPortalApi.downloadIssuedDocumentXml(document.documentId), safeDownloadName(`${t('ownerPortal.issued.file')}-${stem}`, 'application/xml', t('ownerPortal.issued.file')))}
            testId="owner-issued-xml"
          />
        ) : null}
      </div>
      {failed ? (
        <Alert variant="danger" data-testid="owner-issued-download-failed">
          {failed.message}
        </Alert>
      ) : null}
    </li>
  );
}
