import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { ownerPortalApi } from '@/api/ownerPortal.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { ownerReadStateOf, safeDownloadName } from '@/features/owner-portal/owner-portal-model';
import { currencyCode, periodLabel, sectionsWithLines } from '@/features/owner-portal/owner-statement-model';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { PortalNotice, PortalPageHeading, PortalReadProblem, StatusPill, TOUCH } from '@/features/owner-portal/portal-parts';
import {
  MoneyNote,
  PdfButton,
  StatementBalances,
  StatementNet,
  StatementSectionBlock,
  StatementTotalsList,
  TouristTaxBox,
} from '@/features/owner-portal/statement-parts';
import { useOwnerDownload } from '@/features/owner-portal/use-owner-download';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import { useOwnerStatement } from '@/queries/ownerPortal';

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/**
 * One published statement of the owner (`/portale-proprietari/contabilita/:statementId`, E13/F02/US02/T01): its net and its totals in the currency of the statement, the lines grouped
 * as its PDF has them (stays, commissions of the portals, withholding, commission of the manager, charges, corrections, payments), the tourist tax box (for information, outside the net),
 * the invoice of the property manager when one is linked, and the PDF. A statement that is not one of the owner's own, or does not exist, is the same «not found» (the server answers 404 for
 * both and the page never says which): a 404 is «not found» even when an earlier answer is still in the cache, because the error is read before the data. Never a guest: a stay is told by
 * its property, its days, its channel and its booking code.
 */
export function OwnerStatementDetail() {
  const { t, i18n } = useTranslation();
  const { statementId } = useParams<{ statementId: string }>();
  const read = useOwnerStatement(statementId);
  const { download, busyKey, failure } = useOwnerDownload();
  const language = i18n.language;

  const back = (
    <Button asChild variant="ghost" className={`${TOUCH} -ml-3`}>
      <Link to={ownerPortalPaths.accounting}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t('ownerPortal.accounting.detail.back')}
      </Link>
    </Button>
  );

  if (!statementId) return <PortalNotice state="unavailable" testId="owner-statement-missing" />;

  if (read.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-8 w-64" />
        <SkeletonCard label={t('ownerPortal.accounting.loading')} />
        <SkeletonCard />
      </div>
    );
  }

  // The error comes before the data: TanStack Query keeps the answer of an earlier read when a later one fails, and a statement the server now refuses is not drawn.
  if (read.isError) {
    return (
      <div className="space-y-4">
        {back}
        {ownerReadStateOf(read.error) === 'unavailable' ? (
          <Alert variant="warning" title={t('ownerPortal.accounting.detail.notFound.title')} data-testid="owner-statement-not-found">
            {t('ownerPortal.accounting.detail.notFound.description')}
          </Alert>
        ) : (
          <PortalReadProblem error={read.error} failedTitle={t('ownerPortal.accounting.detail.error')} onRetry={() => void read.refetch()} testId="owner-statement-error" />
        )}
      </div>
    );
  }

  const detail = read.data;
  if (!detail) return null;

  const { statement } = detail;
  const currency = statement.currency;
  const period = periodLabel(statement.year, statement.month, language);
  const sections = sectionsWithLines(detail.sections);
  const key = `statement:${statement.statementId}`;
  const failed = failure?.key === key ? failure : null;
  const month = String(statement.month).padStart(2, '0');
  const invoiceNumber = detail.ownerInvoiceNumber?.trim();
  const subtitle = [
    t('ownerPortal.accounting.version', { number: statement.version }),
    t('ownerPortal.accounting.publishedOn', { date: formatStayDate(romeDateOf(statement.publishedAt), language, DATE) }),
  ].join(' · ');

  return (
    <div className="space-y-6" data-testid="owner-statement-detail" data-status={statement.superseded ? 'Superseded' : 'Published'}>
      <div className="space-y-2">
        {back}
        <PortalPageHeading
          title={t('ownerPortal.accounting.statementTitle', { period })}
          description={subtitle}
          actions={
            <>
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
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <StatusPill tone={statement.superseded ? 'neutral' : 'success'}>
            {statement.superseded ? t('ownerPortal.accounting.status.superseded') : t('ownerPortal.accounting.status.published')}
          </StatusPill>
          {statement.agencyName ? <span className="min-w-0 break-words">{statement.agencyName}</span> : null}
          {detail.ownerName ? <span className="min-w-0 break-words">{t('ownerPortal.accounting.detail.owner', { name: detail.ownerName })}</span> : null}
        </div>
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

      {statement.superseded ? (
        <Alert variant="info" data-testid="owner-statement-superseded">
          <p>{t('ownerPortal.accounting.supersededNote')}</p>
          {statement.supersededByStatementId ? (
            <Button asChild variant="outline" className={`${TOUCH} mt-2`}>
              <Link to={ownerPortalPaths.statement(statement.supersededByStatementId)} data-testid="owner-statement-newer">
                {t('ownerPortal.accounting.detail.openNewer')}
              </Link>
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <section aria-labelledby="owner-statement-summary-title" className="space-y-4 rounded-md border bg-card p-4">
        <h2 id="owner-statement-summary-title" className="text-lg font-semibold text-[#1f3a3d]">
          {t('ownerPortal.accounting.detail.summaryTitle')}
        </h2>
        <StatementNet net={statement.totals.net} currency={currency} />
        <StatementTotalsList totals={statement.totals} currency={currency} />
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{t('ownerPortal.accounting.detail.balancesTitle')}</h3>
          <StatementBalances totals={statement.totals} currency={currency} />
        </div>
        <p className="text-sm text-muted-foreground">{t('ownerPortal.accounting.detail.signHint')}</p>
        {currencyCode(currency) ? null : <MoneyNote testId="owner-statement-currency-missing">{t('ownerPortal.accounting.currencyMissing')}</MoneyNote>}
      </section>

      {invoiceNumber ? (
        <p className="text-sm" data-testid="owner-statement-invoice">
          <span className="font-medium">
            {detail.ownerInvoiceDate
              ? t('ownerPortal.accounting.detail.invoice', { number: invoiceNumber, date: formatStayDate(detail.ownerInvoiceDate, language, DATE) })
              : t('ownerPortal.accounting.detail.invoiceNoDate', { number: invoiceNumber })}
          </span>{' '}
          <span className="text-muted-foreground">{t('ownerPortal.accounting.detail.invoiceHint')}</span>
        </p>
      ) : null}

      <section aria-labelledby="owner-statement-lines-title" className="space-y-4">
        <h2 id="owner-statement-lines-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.accounting.detail.linesTitle')}
        </h2>
        {sections.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-statement-no-lines">
            {t('ownerPortal.accounting.detail.noLines')}
          </p>
        ) : (
          sections.map((section) => <StatementSectionBlock key={section.section} section={section} currency={currency} />)
        )}
      </section>

      <TouristTaxBox rows={detail.touristTax} />
    </div>
  );
}
