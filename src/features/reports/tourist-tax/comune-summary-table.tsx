import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReportTableFrame } from '@/features/reports/overview/performance-table';
import { formatStayDate } from '@/lib/stay-dates';
import type { TouristTaxComuneSummary, TouristTaxRemittance, TouristTaxSummary, TouristTaxSummaryStatus } from '@/types';
import { RemittanceList } from './remittance-list';
import { formatCents } from './tourist-tax-model';

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The state of a comune is always said in words in its badge; the tone only helps the eye (what is still to pay is the one that asks). */
const STATUS_VARIANTS: Record<TouristTaxSummaryStatus, NonNullable<BadgeProps['variant']>> = {
  NothingOwed: 'outline',
  ToPay: 'warning',
  Paid: 'success',
  Overpaid: 'secondary',
};

// The first column stays in sight while the table scrolls sideways on a phone, so every figure keeps the name of its comune.
const STICKY = 'sticky left-0 z-10 bg-background';
const HEAD = 'px-3 py-2 font-medium';
const FIGURE = 'px-3 py-2 text-right align-top tabular-nums';

interface ComuneSummaryTableProps {
  summary: TouristTaxSummary;
  /** The person may record and delete payments (`payment.write`); the server decides again. */
  canWrite: boolean;
  /** The payment whose receipt is on its way. */
  downloadingId: string | null;
  /** The person chose "Record payment" on a comune. */
  onRecord: (comune: TouristTaxComuneSummary) => void;
  onDownloadReceipt: (remittance: TouristTaxRemittance) => void;
  onDeleteRemittance: (remittance: TouristTaxRemittance) => void;
}

/** The short sentence that says an owed amount may be incomplete: next to the amount and next to the state, whatever the state. */
function IncompleteNote({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={className ?? 'mt-0.5 block text-xs text-foreground/70'} data-testid="tourist-tax-incomplete">
      {t('reports.touristTax.incomplete')}
    </span>
  );
}

/**
 * The tourist tax of the period, comune by comune (NF-100): the stays, the tax owed, the tax paid, the balance and where the comune
 * stands, then the payments of the comune with their receipts, and the total. Every figure is the server's; the browser adds nothing
 * up. A stay with no recorded tax is never a tax of zero: the owed amount and the state of a comune that counts such stays say that
 * the amount is incomplete. When the caller reaches only some of the properties the payments are not part of the summary: the table
 * has the owed side alone, and no button to record or delete a payment.
 */
export function ComuneSummaryTable({ summary, canWrite, downloadingId, onRecord, onDownloadReceipt, onDeleteRemittance }: ComuneSummaryTableProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const money = (cents: number | null) => (cents === null ? '—' : formatCents(cents, locale));
  const showPayments = !summary.paymentsHidden;
  const mayWrite = canWrite && showPayments;
  const columns = 3 + (showPayments ? 3 : 0) + (mayWrite ? 1 : 0);
  const { total } = summary;

  return (
    <ReportTableFrame
      caption={t('reports.touristTax.caption', {
        from: formatStayDate(summary.period.from, locale, SHORT_DATE),
        to: formatStayDate(summary.period.to, locale, SHORT_DATE),
      })}
      testId="tourist-tax-table"
    >
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className={`${STICKY} ${HEAD} text-left`}>
            {t('reports.touristTax.columns.comune')}
          </th>
          <th scope="col" className={`${HEAD} text-right`}>
            {t('reports.touristTax.columns.stays')}
          </th>
          <th scope="col" className={`${HEAD} text-right`}>
            {t('reports.touristTax.columns.owed')}
          </th>
          {showPayments ? (
            <>
              <th scope="col" className={`${HEAD} text-right`}>
                {t('reports.touristTax.columns.paid')}
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                {t('reports.touristTax.columns.balance')}
              </th>
              <th scope="col" className={`${HEAD} text-left`}>
                {t('reports.touristTax.columns.status')}
              </th>
            </>
          ) : null}
          {mayWrite ? (
            <th scope="col" className={`${HEAD} text-right`}>
              <span className="sr-only">{t('reports.touristTax.columns.actions')}</span>
            </th>
          ) : null}
        </tr>
      </thead>

      {summary.comuni.map((row) => (
        <tbody key={row.comune} className="border-b border-border" data-testid="tourist-tax-comune">
          <tr data-testid="tourist-tax-row">
            <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top font-medium`}>
              <span className="break-words">{row.comune}</span>
            </th>
            <td className={FIGURE}>{row.stays}</td>
            <td className={FIGURE}>
              <div className="font-medium">{money(row.owedCents)}</div>
              {row.staysWithoutAmount > 0 ? <IncompleteNote /> : null}
            </td>
            {showPayments ? (
              <>
                <td className={FIGURE}>{money(row.paidCents)}</td>
                <td className={FIGURE}>{money(row.balanceCents)}</td>
                <td className="px-3 py-2 align-top">
                  {row.status ? (
                    <Badge variant={STATUS_VARIANTS[row.status]} data-testid="tourist-tax-status">
                      {t(`reports.touristTax.status.${row.status}`)}
                    </Badge>
                  ) : (
                    '—'
                  )}
                  {row.staysWithoutAmount > 0 ? <IncompleteNote className="mt-1 block text-xs text-foreground/70" /> : null}
                </td>
              </>
            ) : null}
            {mayWrite ? (
              <td className="px-3 py-2 text-right align-top">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t('reports.touristTax.record.buttonFor', { comune: row.comune })}
                  onClick={() => onRecord(row)}
                  data-testid="tourist-tax-record"
                >
                  {t('reports.touristTax.record.button')}
                </Button>
              </td>
            ) : null}
          </tr>

          {showPayments && row.remittances && row.remittances.length > 0 ? (
            <tr data-testid="tourist-tax-remittances-row">
              <td colSpan={columns} className="px-3 pb-3 pt-0">
                {/* On a phone the list stays where the first column is, as wide as the screen, while the table scrolls under it. */}
                <div className="sticky left-0 w-[min(100%,calc(100vw-3rem))]">
                  <RemittanceList
                    comune={row.comune}
                    remittances={row.remittances}
                    canWrite={mayWrite}
                    downloadingId={downloadingId}
                    onDownloadReceipt={onDownloadReceipt}
                    onDelete={onDeleteRemittance}
                  />
                </div>
              </td>
            </tr>
          ) : null}
        </tbody>
      ))}

      <tfoot>
        <tr className="border-t-2 border-border" data-testid="tourist-tax-total">
          <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top font-semibold`}>
            {t('reports.touristTax.total')}
          </th>
          <td className={`${FIGURE} font-semibold`}>{total.stays}</td>
          <td className={`${FIGURE} font-semibold`}>
            <div>{money(total.owedCents)}</div>
            {total.staysWithoutAmount > 0 ? <IncompleteNote className="mt-0.5 block text-xs font-normal text-foreground/70" /> : null}
          </td>
          {showPayments ? (
            <>
              <td className={`${FIGURE} font-semibold`}>{money(total.paidCents)}</td>
              <td className={`${FIGURE} font-semibold`}>{money(total.balanceCents)}</td>
              <td />
            </>
          ) : null}
          {mayWrite ? <td /> : null}
        </tr>
      </tfoot>
    </ReportTableFrame>
  );
}
