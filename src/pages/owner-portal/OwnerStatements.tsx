import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { ownerPortalApi } from '@/api/ownerPortal.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DocumentsList } from '@/features/owner-portal/documents-list';
import { currentData, isAccountingDocument, safeDownloadName, safeExternalUrl } from '@/features/owner-portal/owner-portal-model';
import { currencyCode, formatMoney, invoiceKindOf, periodLabel, sortedInvoices, sortedStatements } from '@/features/owner-portal/owner-statement-model';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { PortalLoading, PortalPageHeading, PortalReadProblem, StatusPill, TOUCH } from '@/features/owner-portal/portal-parts';
import { MoneyNote, PdfButton, StatementNet, StatementTotalsList } from '@/features/owner-portal/statement-parts';
import { useOwnerDownload } from '@/features/owner-portal/use-owner-download';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { useOwnerDocuments, useOwnerExternalDocuments, useOwnerInvoices, useOwnerStatements } from '@/queries/ownerPortal';
import type { OwnerPortalExternalDocument, OwnerPortalInvoice, OwnerPortalStatement } from '@/types';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The downloads of the page: one at a time, whichever card asks (the buttons of every card wait for the one that works). */
type Downloads = ReturnType<typeof useOwnerDownload>;

/** A statement with its net and its totals in its own currency, the way to open its lines, its PDF and the way to ask the agency about it. */
function StatementCard({ statement, downloads }: { statement: OwnerPortalStatement; downloads: Downloads }) {
  const { t, i18n } = useTranslation();
  const { download, busyKey, failure } = downloads;
  const language = i18n.language;
  const period = periodLabel(statement.year, statement.month, language);
  const key = `statement:${statement.statementId}`;
  const failed = failure?.key === key ? failure : null;
  const month = String(statement.month).padStart(2, '0');

  return (
    <li className="min-w-0 space-y-4 rounded-md border bg-card p-4" data-testid="owner-statement" data-status={statement.superseded ? 'Superseded' : 'Published'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{t('ownerPortal.accounting.statementTitle', { period })}</h3>
          <p className="break-words text-sm text-muted-foreground">
            {t('ownerPortal.accounting.version', { number: statement.version })} ·{' '}
            {t('ownerPortal.accounting.publishedOn', { date: formatStayDate(romeDateOf(statement.publishedAt), language, DATE) })}
          </p>
          {statement.agencyName ? <p className="break-words text-sm text-muted-foreground">{statement.agencyName}</p> : null}
        </div>
        <StatusPill tone={statement.superseded ? 'neutral' : 'success'}>
          {statement.superseded ? t('ownerPortal.accounting.status.superseded') : t('ownerPortal.accounting.status.published')}
        </StatusPill>
      </div>

      <StatementNet net={statement.totals.net} currency={statement.currency} />
      <StatementTotalsList totals={statement.totals} currency={statement.currency} />
      {currencyCode(statement.currency) ? null : <MoneyNote testId="owner-statement-currency-missing">{t('ownerPortal.accounting.currencyMissing')}</MoneyNote>}
      {statement.superseded ? <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.supersededNote')}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild className={TOUCH}>
          <Link to={ownerPortalPaths.statement(statement.statementId)} aria-label={t('ownerPortal.accounting.openAria', { period, number: statement.version })} data-testid="owner-statement-open">
            {t('ownerPortal.accounting.open')}
          </Link>
        </Button>
        {statement.hasPdf ? (
          <PdfButton
            label={t('ownerPortal.accounting.pdf.download')}
            ariaLabel={t('ownerPortal.accounting.pdf.downloadStatementAria', { period, number: statement.version })}
            disabled={busyKey !== null}
            loading={busyKey === key}
            onClick={() =>
              void download(
                key,
                () => ownerPortalApi.downloadStatementPdf(statement.statementId),
                safeDownloadName(null, 'application/pdf', `${t('ownerPortal.accounting.pdf.statementFile')}-${statement.year}-${month}-v${statement.version}`),
              )
            }
            testId="owner-statement-pdf"
          />
        ) : null}
        <Button asChild variant="outline" className={TOUCH}>
          <Link to={`${ownerPortalPaths.messages}?topic=statementVersion&statementVersionId=${encodeURIComponent(statement.statementId)}`}>
            <MessageSquare aria-hidden="true" className="h-4 w-4" />
            {t('ownerPortal.accounting.ask')}
          </Link>
        </Button>
      </div>
      {statement.hasPdf ? null : (
        <p className="text-sm text-muted-foreground" data-testid="owner-statement-no-pdf">
          {t('ownerPortal.accounting.pdf.notAvailable')}
        </p>
      )}
      {failed ? (
        <Alert variant="danger" data-testid="owner-statement-download-failed">
          {failed.message}
        </Alert>
      ) : null}
    </li>
  );
}

/** An invoice of the property manager to the owner: its number, its day, its total in its own currency, and its PDF. */
function PmInvoiceCard({ invoice, statements, downloads }: { invoice: OwnerPortalInvoice; statements: readonly OwnerPortalStatement[]; downloads: Downloads }) {
  const { t, i18n } = useTranslation();
  const { download, busyKey, failure } = downloads;
  const language = i18n.language;
  const kind = invoiceKindOf(invoice.kind);
  const title = t('ownerPortal.accounting.pmInvoices.cardTitle', {
    kind: t(`ownerPortal.accounting.pmInvoices.kind.${kind}`),
    number: invoice.number,
    date: formatStayDate(invoice.issueDate, language, DATE),
  });
  const statement = invoice.statementId ? statements.find((item) => item.statementId === invoice.statementId) : undefined;
  const period =
    invoice.periodYear && invoice.periodMonth
      ? periodLabel(invoice.periodYear, invoice.periodMonth, language)
      : statement
        ? periodLabel(statement.year, statement.month, language)
        : null;
  const key = `invoice:${invoice.invoiceId}`;
  const failed = failure?.key === key ? failure : null;
  const file = t('ownerPortal.accounting.pdf.invoiceFile');

  return (
    <li className="min-w-0 space-y-3 rounded-md border bg-card p-4" data-testid="owner-pm-invoice">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{title}</h3>
          {period ? <p className="break-words text-sm text-muted-foreground">{t('ownerPortal.accounting.pmInvoices.of', { period })}</p> : null}
          {invoice.agencyName ? <p className="break-words text-sm text-muted-foreground">{invoice.agencyName}</p> : null}
        </div>
        {invoice.creditedInFull ? <StatusPill tone="neutral">{t('ownerPortal.accounting.pmInvoices.creditedInFull')}</StatusPill> : null}
      </div>

      <div>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.pmInvoices.total')}</p>
        <p className="text-lg font-semibold tabular-nums" data-testid="owner-pm-invoice-total">
          {formatMoney(invoice.total, invoice.currency, language)}
        </p>
      </div>
      {currencyCode(invoice.currency) ? null : <MoneyNote testId="owner-pm-invoice-currency-missing">{t('ownerPortal.accounting.pmInvoices.currencyMissing')}</MoneyNote>}

      <div className="flex flex-wrap gap-2">
        <PdfButton
          label={t('ownerPortal.accounting.pdf.download')}
          ariaLabel={t('ownerPortal.accounting.pdf.downloadInvoiceAria', { title })}
          disabled={busyKey !== null}
          loading={busyKey === key}
          onClick={() =>
            void download(
              key,
              () => ownerPortalApi.downloadInvoicePdf(invoice.invoiceId, language.toLowerCase().startsWith('en') ? 'en' : 'it'),
              safeDownloadName(`${file}-${invoice.number.replace(/[^A-Za-z0-9_-]+/g, '-')}`, 'application/pdf', file),
            )
          }
          testId="owner-pm-invoice-pdf"
        />
        {statement ? (
          <Button asChild variant="outline" className={TOUCH}>
            <Link
              to={ownerPortalPaths.statement(statement.statementId)}
              aria-label={t('ownerPortal.accounting.openAria', { period: periodLabel(statement.year, statement.month, language), number: statement.version })}
            >
              {t('ownerPortal.accounting.open')}
            </Link>
          </Button>
        ) : null}
      </div>
      {failed ? (
        <Alert variant="danger" data-testid="owner-pm-invoice-download-failed">
          {failed.message}
        </Alert>
      ) : null}
    </li>
  );
}

/** The link of an invoice the agency issued in a system of its own, kept for the owners that have one (a statement made before the invoices were issued in CasaZen). */
function LinkedInvoiceCard({ invoice, statements }: { invoice: OwnerPortalExternalDocument; statements: readonly OwnerPortalStatement[] }) {
  const { t, i18n } = useTranslation();
  const url = safeExternalUrl(invoice.documentUrl);
  const statement = statements.find((item) => item.statementId === invoice.statementVersionId);
  return (
    <li className="min-w-0 rounded-md border bg-card p-4" data-testid="owner-invoice">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">
            {t('ownerPortal.accounting.invoiceTitle', { number: invoice.externalNumber, date: formatStayDate(invoice.externalDate, i18n.language, DATE) })}
          </h3>
          {statement ? (
            <p className="text-sm text-muted-foreground">
              {t('ownerPortal.accounting.invoiceOf', { period: periodLabel(statement.year, statement.month, i18n.language) })}
            </p>
          ) : null}
        </div>
        <StatusPill tone="neutral">{t(`ownerPortal.accounting.invoiceStatus.${invoice.status}`)}</StatusPill>
      </div>
      <div className="mt-3">
        {url ? (
          <Button asChild variant="outline" className={TOUCH}>
            <a href={url} target="_blank" rel="noopener noreferrer" data-testid="owner-invoice-link">
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              {t('ownerPortal.accounting.openInvoice')}
              <span className="sr-only"> {t('ownerPortal.accounting.opensNewTab')}</span>
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.noInvoiceLink')}</p>
        )}
      </div>
    </li>
  );
}

/** The links of invoices issued elsewhere: a section only for the owner that has some (or whose read failed), nothing for the others. */
function LinkedInvoicesSection({ statements }: { statements: readonly OwnerPortalStatement[] }) {
  const { t } = useTranslation();
  const linked = useOwnerExternalDocuments();
  const list = linked.isError ? undefined : linked.data;
  if (linked.isLoading || (!linked.isError && (!list || list.length === 0))) return null;

  return (
    <section aria-labelledby="owner-invoices-title" className="space-y-3">
      <h2 id="owner-invoices-title" className="text-xl font-semibold text-[#1f3a3d]">
        {t('ownerPortal.accounting.invoicesTitle')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.invoicesNote')}</p>
      {linked.isError ? (
        <PortalReadProblem error={linked.error} failedTitle={t('ownerPortal.accounting.invoicesError')} onRetry={() => void linked.refetch()} testId="owner-invoices-error" />
      ) : (
        <ul className="space-y-3" data-testid="owner-invoices">
          {list?.map((invoice) => (
            <LinkedInvoiceCard key={invoice.id} invoice={invoice} statements={statements} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The accounting of the owner (E07/F07/US01/T03, E13/F02/US02/T01): the statements the agency PUBLISHED (and the ones a newer version superseded) each with its net and its totals
 * in the currency of the statement, the way to open its lines and to download its PDF, then the invoices of the property manager with their PDF, the links of the invoices
 * issued elsewhere (only for the owner that has some) and the accounting documents the agency shares. The amounts are the server's: the page writes them in the currency of the data (an
 * amount with no currency has no symbol, and the page says so) and never works one out. The portal has no payout state and no evidence of a payment or of a submission for the owner, so no
 * «paid», no «sent», no «accepted» appears here. Guests never appear: a statement tells its stays by property, days, channel and booking code.
 */
export function OwnerStatements() {
  const { t } = useTranslation();
  const statements = useOwnerStatements();
  const invoices = useOwnerInvoices();
  const documents = useOwnerDocuments();
  const downloads = useOwnerDownload();
  // Drawn only while the last answer is good: after a refusal nothing of the answer before it stays under the notice (the statements, the invoices, the documents).
  const statementList = sortedStatements(currentData(statements) ?? []);
  const invoiceList = sortedInvoices(currentData(invoices) ?? []);
  const documentsAnswer = currentData(documents);

  return (
    <div className="space-y-8">
      <PortalPageHeading title={t('ownerPortal.accounting.title')} description={t('ownerPortal.accounting.description')} />

      <section aria-labelledby="owner-statements-title" className="space-y-3">
        <h2 id="owner-statements-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.accounting.statementsTitle')}
        </h2>
        {statements.isLoading ? (
          <PortalLoading label={t('ownerPortal.accounting.loading')} />
        ) : statements.isError ? (
          <PortalReadProblem error={statements.error} failedTitle={t('ownerPortal.accounting.error')} onRetry={() => void statements.refetch()} testId="owner-accounting-error" />
        ) : statementList.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-statements-empty">
            {t('ownerPortal.accounting.noStatements')}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="owner-statements">
            {statementList.map((statement) => (
              <StatementCard key={statement.statementId} statement={statement} downloads={downloads} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="owner-pm-invoices-title" className="space-y-3">
        <h2 id="owner-pm-invoices-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.accounting.pmInvoices.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.pmInvoices.note')}</p>
        {invoices.isLoading ? (
          <PortalLoading label={t('ownerPortal.accounting.loading')} />
        ) : invoices.isError ? (
          <PortalReadProblem error={invoices.error} failedTitle={t('ownerPortal.accounting.pmInvoices.error')} onRetry={() => void invoices.refetch()} testId="owner-pm-invoices-error" />
        ) : invoiceList.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-pm-invoices-empty">
            {t('ownerPortal.accounting.pmInvoices.empty')}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="owner-pm-invoices">
            {invoiceList.map((invoice) => (
              <PmInvoiceCard key={invoice.invoiceId} invoice={invoice} statements={statementList} downloads={downloads} />
            ))}
          </ul>
        )}
      </section>

      <LinkedInvoicesSection statements={statementList} />

      <section aria-labelledby="owner-accounting-documents-title" className="space-y-3">
        <h2 id="owner-accounting-documents-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.accounting.documentsTitle')}
        </h2>
        {documents.isLoading ? (
          <PortalLoading label={t('ownerPortal.accounting.loading')} />
        ) : documents.isError ? (
          <PortalReadProblem error={documents.error} failedTitle={t('ownerPortal.documents.error')} onRetry={() => void documents.refetch()} testId="owner-accounting-documents-error" />
        ) : documentsAnswer ? (
          <DocumentsList documents={documentsAnswer.documents.filter(isAccountingDocument)} emptyText={t('ownerPortal.accounting.noDocuments')} testId="owner-accounting-documents" />
        ) : null}
      </section>
    </div>
  );
}
