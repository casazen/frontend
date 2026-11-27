import { useId } from 'react';
import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { ReportTableFrame } from '@/features/reports/overview/performance-table';
import { balanceSections, channelLabel, formatCents, shortDay, type BalanceSection } from '@/features/reports/money-reports/money-model';
import type { BalancesToCollectReport } from '@/types';

const STICKY = 'sticky left-0 z-10 bg-background';
const HEAD = 'px-3 py-2 font-medium';
const FIGURE = 'px-3 py-2 text-right align-top tabular-nums';

interface SectionTableProps {
  section: BalanceSection;
  /** The caption of the table: with more than one currency it says which one. */
  caption: string;
  testId: string;
}

function SectionTable({ section, caption, testId }: SectionTableProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const na = t('reports.money.notAvailable');
  const money = (cents: number | null) => formatCents(cents, section.currency, locale) ?? na;
  const { total } = section;

  return (
    <ReportTableFrame caption={caption} testId={testId}>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className={`${STICKY} ${HEAD} text-left`}>
            {t('reports.collections.balances.columns.code')}
          </th>
          <th scope="col" className={`${HEAD} text-left`}>
            {t('reports.collections.balances.columns.property')}
          </th>
          <th scope="col" className={`${HEAD} text-left`}>
            {t('reports.collections.balances.columns.channel')}
          </th>
          <th scope="col" className={`${HEAD} text-left`}>
            {t('reports.collections.balances.columns.checkIn')}
          </th>
          <th scope="col" className={`${HEAD} text-right`}>
            {t('reports.collections.balances.columns.total')}
          </th>
          <th scope="col" className={`${HEAD} text-right`}>
            {t('reports.collections.balances.columns.collected')}
          </th>
          <th scope="col" className={`${HEAD} text-right`}>
            {t('reports.collections.balances.columns.toCollect')}
          </th>
        </tr>
      </thead>
      <tbody>
        {section.rows.map((row) => (
          <tr key={row.bookingId} className="border-b border-border" data-testid="collections-balance-row">
            <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top font-medium`}>
              <Link
                to={`/app/short-rent/bookings/${encodeURIComponent(row.bookingId)}`}
                className="inline-flex min-h-6 items-center underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                data-testid="collections-balance-link"
              >
                {row.bookingCode}
              </Link>
            </th>
            <td className="px-3 py-2 align-top">
              <span className="break-words">{row.propertyName}</span>
            </td>
            <td className="px-3 py-2 align-top">{channelLabel(row.source, t)}</td>
            <td className="whitespace-nowrap px-3 py-2 align-top">{shortDay(row.checkIn, locale)}</td>
            <td className={FIGURE}>{money(row.totalCents)}</td>
            <td className={FIGURE}>{money(row.collectedCents)}</td>
            <td className={FIGURE}>
              <div className="font-medium">{money(row.toCollectCents)}</div>
              {row.basis === 'ChannelManager' ? (
                <div className="mt-0.5 text-xs font-normal text-foreground/70" data-testid="collections-balance-reported">
                  {t('reports.collections.balances.reported')}
                </div>
              ) : null}
              {row.overdue ? (
                <Badge variant="warning" className="mt-1 gap-1" data-testid="collections-balance-overdue">
                  <Clock aria-hidden="true" className="size-3" />
                  {t('reports.collections.balances.overdue')}
                </Badge>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
      {total ? (
        <tfoot>
          <tr className="border-t-2 border-border" data-testid="collections-balance-total">
            <th scope="row" colSpan={6} className={`${STICKY} px-3 py-2 text-left align-top font-semibold`}>
              {t('reports.collections.balances.total', { count: total.stayCount })}
            </th>
            <td className={`${FIGURE} font-semibold`}>{money(total.amountCents)}</td>
          </tr>
        </tfoot>
      ) : null}
    </ReportTableFrame>
  );
}

interface BalancesTableProps {
  report: BalancesToCollectReport;
}

/**
 * What is still to collect (NF-97), stay by stay, as of today: the booking code as a link to the booking, the property, the channel, the
 * check-in, the total, what was collected and what is to collect, with a text badge "Scaduto" when the stay is over (the check-out day
 * is past), and the total the server gives for each currency. Every figure is the server's. A total or a collected amount the server does
 * not have (a channel reservation without a price or without a reported payment) is "not available", never zero. Two currencies are never
 * put in one table with one total: each has its own table and its own total. A stay carries no guest: no name and no contact exist in
 * the data. An empty list says there is nothing to collect.
 */
export function BalancesTable({ report }: BalancesTableProps) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const sections = balanceSections(report);
  const several = sections.length > 1;

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3" data-testid="collections-balances">
      <div>
        <h2 id={headingId} className="text-lg font-semibold">
          {t('reports.collections.balances.title')}
        </h2>
        <p className="mt-1 text-sm text-foreground/70" data-testid="collections-balances-asof">
          {t('reports.collections.balances.asOf', { date: shortDay(report.asOf, i18n.language) })}
        </p>
      </div>

      {report.rows.length === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="collections-balances-empty">
          {t('reports.collections.balances.empty')}
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.currency} className="space-y-2" data-testid="collections-balances-section">
              {several ? (
                <h3 className="text-sm font-semibold" data-testid="collections-balances-currency">
                  {t('reports.collections.balances.currency', { currency: section.currency })}
                </h3>
              ) : null}
              <SectionTable
                section={section}
                caption={several ? t('reports.collections.balances.captionCurrency', { currency: section.currency }) : t('reports.collections.balances.caption')}
                testId={`collections-balances-table-${section.currency}`}
              />
            </div>
          ))}
          <p className="text-sm text-foreground/70" data-testid="collections-balances-note">
            {report.since
              ? t('reports.collections.balances.noteSince', { date: shortDay(report.since, i18n.language) })
              : t('reports.collections.balances.note')}
          </p>
        </div>
      )}
    </section>
  );
}
