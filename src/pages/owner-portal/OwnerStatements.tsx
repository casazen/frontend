import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DocumentsList } from '@/features/owner-portal/documents-list';
import { currentData, isAccountingDocument, safeExternalUrl, visibleStatements } from '@/features/owner-portal/owner-portal-model';
import { PortalLoading, PortalPageHeading, PortalReadProblem, StatusPill, TOUCH } from '@/features/owner-portal/portal-parts';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { useOwnerDocuments, useOwnerExternalDocuments } from '@/queries/ownerPortal';
import type { OwnerPortalExternalDocument, OwnerStatementReference } from '@/types';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** «Novembre 2026» in the language of the person: never a month name written in one language into a page of another. */
function periodLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function StatementCard({ statement }: { statement: OwnerStatementReference }) {
  const { t, i18n } = useTranslation();
  const superseded = statement.status === 'Superseded';
  return (
    <li className="min-w-0 rounded-md border bg-card p-4" data-testid="owner-statement" data-status={statement.status}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{t('ownerPortal.accounting.statementTitle', { period: periodLabel(statement.periodYear, statement.periodMonth, i18n.language) })}</h3>
          <p className="text-sm text-muted-foreground">
            {t('ownerPortal.accounting.version', { number: statement.versionNumber })} ·{' '}
            {t('ownerPortal.accounting.publishedOn', { date: formatStayDate(romeDateOf(statement.publishedAt), i18n.language, DATE) })}
          </p>
        </div>
        <StatusPill tone={superseded ? 'neutral' : 'success'}>{superseded ? t('ownerPortal.accounting.status.superseded') : t('ownerPortal.accounting.status.published')}</StatusPill>
      </div>
      {superseded ? <p className="mt-2 text-sm text-muted-foreground">{t('ownerPortal.accounting.supersededNote')}</p> : null}
      <div className="mt-3">
        <Button asChild variant="outline" className={TOUCH}>
          <Link to={`${ownerPortalPaths.messages}?topic=statementVersion&statementVersionId=${encodeURIComponent(statement.statementVersionId)}`}>
            <MessageSquare aria-hidden="true" className="h-4 w-4" />
            {t('ownerPortal.accounting.ask')}
          </Link>
        </Button>
      </div>
    </li>
  );
}

function InvoiceCard({ invoice, statements }: { invoice: OwnerPortalExternalDocument; statements: readonly OwnerStatementReference[] }) {
  const { t, i18n } = useTranslation();
  const url = safeExternalUrl(invoice.documentUrl);
  const statement = statements.find((item) => item.statementVersionId === invoice.statementVersionId);
  return (
    <li className="min-w-0 rounded-md border bg-card p-4" data-testid="owner-invoice">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">
            {t('ownerPortal.accounting.invoiceTitle', { number: invoice.externalNumber, date: formatStayDate(invoice.externalDate, i18n.language, DATE) })}
          </h3>
          {statement ? (
            <p className="text-sm text-muted-foreground">
              {t('ownerPortal.accounting.invoiceOf', { period: periodLabel(statement.periodYear, statement.periodMonth, i18n.language) })}
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

/**
 * The accounting of the owner (E07/F07/US01/T03, E06): the statement versions the agency PUBLISHED (and the ones a newer version superseded: nothing that is a draft, flagged
 * or only approved is ever drawn, whatever an answer carries), the links of the invoices the agency issued in its own system, and the accounting documents it shares. The portal has no
 * amount, no payout state and no evidence of a payment or of a submission for the owner, so the page says none of them: no «paid», no «sent», no «accepted» appears here. The
 * page says so in words, and sends the owner to the inbox for what it asks.
 */
export function OwnerStatements() {
  const { t } = useTranslation();
  const documents = useOwnerDocuments();
  const invoices = useOwnerExternalDocuments();
  // Drawn only while the last answer is good: after a refusal nothing of the answer before it stays under the notice (the documents, the statements the invoices are named after).
  const answer = currentData(documents);
  const statements = answer ? visibleStatements(answer.statements) : [];

  return (
    <div className="space-y-8">
      <PortalPageHeading title={t('ownerPortal.accounting.title')} description={t('ownerPortal.accounting.description')} />
      <Alert variant="info" data-testid="owner-accounting-note">
        {t('ownerPortal.accounting.noPaymentNote')}
      </Alert>

      <section aria-labelledby="owner-statements-title" className="space-y-3">
        <h2 id="owner-statements-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.accounting.statementsTitle')}
        </h2>
        {documents.isLoading ? (
          <PortalLoading label={t('ownerPortal.accounting.loading')} />
        ) : documents.isError ? (
          <PortalReadProblem
            error={documents.error}
            failedTitle={t('ownerPortal.accounting.error')}
            onRetry={() => void documents.refetch()}
            testId="owner-accounting-error"
          />
        ) : statements.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-statements-empty">
            {t('ownerPortal.accounting.noStatements')}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="owner-statements">
            {statements.map((statement) => (
              <StatementCard key={statement.statementVersionId} statement={statement} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="owner-invoices-title" className="space-y-3">
        <h2 id="owner-invoices-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.accounting.invoicesTitle')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.invoicesNote')}</p>
        {invoices.isLoading ? (
          <PortalLoading label={t('ownerPortal.accounting.loading')} />
        ) : invoices.isError ? (
          <PortalReadProblem
            error={invoices.error}
            failedTitle={t('ownerPortal.accounting.invoicesError')}
            onRetry={() => void invoices.refetch()}
            testId="owner-invoices-error"
          />
        ) : invoices.data && invoices.data.length > 0 ? (
          <ul className="space-y-3" data-testid="owner-invoices">
            {invoices.data.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} statements={statements} />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-invoices-empty">
            {t('ownerPortal.accounting.noInvoices')}
          </p>
        )}
      </section>

      {answer ? (
        <section aria-labelledby="owner-accounting-documents-title" className="space-y-3">
          <h2 id="owner-accounting-documents-title" className="text-xl font-semibold text-[#1f3a3d]">
            {t('ownerPortal.accounting.documentsTitle')}
          </h2>
          <DocumentsList
            documents={answer.documents.filter(isAccountingDocument)}
            emptyText={t('ownerPortal.accounting.noDocuments')}
            testId="owner-accounting-documents"
          />
        </section>
      ) : null}
    </div>
  );
}
