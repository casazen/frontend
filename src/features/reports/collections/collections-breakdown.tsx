import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { ReportTableFrame } from '@/features/reports/overview/performance-table';
import { bucketName, channelLabel, formatCents, formatRate, isPartialMonth, paymentMethodLabel, shortDay } from '@/features/reports/money-reports/money-model';
import type { CollectionsReport, CollectionsTotal } from '@/types';

/** The collections are in euros as the Home counts them: the server converts nothing, and its figures carry no currency of their own. */
const COLLECTIONS_CURRENCY = 'EUR';

const VIEWS = ['date', 'method', 'channel'] as const;
type CollectionsView = (typeof VIEWS)[number];

const HEAD = 'px-3 py-2 font-medium';
const FIGURE = 'px-3 py-2 text-right align-top tabular-nums';

/** One row of a cut: its name, the amount in cents and the payments the server sent, and its share when the cut has one. */
interface CutRow {
  key: string;
  name: ReactNode;
  amountCents: number;
  paymentCount: number;
  share?: number | null;
}

interface CutTableProps {
  caption: string;
  nameHeader: string;
  rows: CutRow[];
  /** The cut has a share of the total for each row (by method and by channel). */
  withShare: boolean;
  /** The server's total: every cut adds up to it, so the last row says it as the server does. */
  total: CollectionsTotal;
  testId: string;
}

function CutTable({ caption, nameHeader, rows, withShare, total, testId }: CutTableProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const na = t('reports.money.notAvailable');
  const money = (cents: number) => formatCents(cents, COLLECTIONS_CURRENCY, locale) ?? na;

  return (
    <ReportTableFrame caption={caption} testId={testId}>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className={`${HEAD} text-left`}>
            {nameHeader}
          </th>
          <th scope="col" className={`${HEAD} text-right`}>
            {t('reports.collections.columns.amount')}
          </th>
          <th scope="col" className={`${HEAD} text-right`}>
            {t('reports.collections.columns.payments')}
          </th>
          {withShare ? (
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.collections.columns.share')}
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-border" data-testid={`${testId}-row`}>
            <th scope="row" className="px-3 py-2 text-left align-top font-medium">
              {row.name}
            </th>
            <td className={FIGURE}>{money(row.amountCents)}</td>
            <td className={FIGURE}>{row.paymentCount}</td>
            {withShare ? <td className={FIGURE}>{formatRate(row.share, locale) ?? na}</td> : null}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border" data-testid={`${testId}-total`}>
          <th scope="row" className="px-3 py-2 text-left align-top font-semibold">
            {t('reports.collections.total')}
          </th>
          <td className={`${FIGURE} font-semibold`}>{money(total.amountCents)}</td>
          <td className={`${FIGURE} font-semibold`}>{total.paymentCount}</td>
          {withShare ? <td /> : null}
        </tr>
      </tfoot>
    </ReportTableFrame>
  );
}

interface CollectionsBreakdownProps {
  report: CollectionsReport;
}

/**
 * What came in over the period (NF-97): the total as the server sends it (the Home's "incassato" for the same days), and the three views
 * of the same data as tabs: by date (a day for each day of a period of up to 92 days, a month for each month beyond), by payment method
 * and by channel, each row with its amount, its payments and, by method and by channel, its share. Every figure is the server's: the page
 * adds up nothing, so the total of a view is the server's total, and a share is the one the server gives (a missing one is "not
 * available", never zero). A period with no payment says so instead of showing a wall of zeros.
 */
export function CollectionsBreakdown({ report }: CollectionsBreakdownProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('vista');
  const view: CollectionsView = VIEWS.find((candidate) => candidate === requested) ?? 'date';
  const { total } = report;
  const na = t('reports.money.notAvailable');

  const tabs: TabItem<CollectionsView>[] = VIEWS.map((id) => ({ value: id, label: t(`reports.collections.views.${id}`), testId: `collections-view-${id}` }));

  return (
    <section aria-label={t('reports.collections.sectionLabel')} className="min-w-0 space-y-4" data-testid="collections-breakdown">
      <div className="rounded-xl border border-border bg-card p-4" data-testid="collections-total">
        <p className="text-sm text-foreground/70">
          {t('reports.collections.totalCaption', { from: shortDay(report.period.from, locale), to: shortDay(report.period.to, locale) })}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums" data-testid="collections-total-amount">
          {formatCents(total.amountCents, COLLECTIONS_CURRENCY, locale) ?? na}
        </p>
        <p className="mt-1 text-sm text-foreground/70" data-testid="collections-total-count">
          {t('reports.collections.paymentCount', { count: total.paymentCount })}
        </p>
      </div>

      {total.paymentCount === 0 ? (
        <p className="text-sm text-foreground/70" data-testid="collections-empty">
          {t('reports.collections.empty')}
        </p>
      ) : (
        <Tabs<CollectionsView> label={t('reports.collections.views.label')} param="vista" items={tabs} value={view} panelTestId="collections-view-panel">
          {view === 'date' ? (
            <CutTable
              caption={t('reports.collections.captions.date')}
              nameHeader={report.byDate[0]?.unit === 'month' ? t('reports.collections.columns.month') : t('reports.collections.columns.day')}
              withShare={false}
              total={total}
              testId="collections-by-date"
              rows={report.byDate.map((bucket) => ({
                key: bucket.label,
                name: (
                  <>
                    <span className="break-words">{bucketName(bucket, locale)}</span>
                    {isPartialMonth(bucket) ? (
                      <span className="mt-0.5 block text-xs font-normal text-foreground/70">
                        {t('reports.dialog.range', { from: shortDay(bucket.from, locale), to: shortDay(bucket.to, locale) })}
                      </span>
                    ) : null}
                  </>
                ),
                amountCents: bucket.amountCents,
                paymentCount: bucket.paymentCount,
              }))}
            />
          ) : view === 'method' ? (
            <CutTable
              caption={t('reports.collections.captions.method')}
              nameHeader={t('reports.collections.columns.method')}
              withShare
              total={total}
              testId="collections-by-method"
              rows={report.byMethod.map((row) => ({
                key: row.method,
                name: <span className="break-words">{paymentMethodLabel(row.method, t)}</span>,
                amountCents: row.amountCents,
                paymentCount: row.paymentCount,
                share: row.share,
              }))}
            />
          ) : (
            <CutTable
              caption={t('reports.collections.captions.channel')}
              nameHeader={t('reports.collections.columns.channel')}
              withShare
              total={total}
              testId="collections-by-channel"
              rows={report.byChannel.map((row) => ({
                key: row.source,
                name: <span className="break-words">{channelLabel(row.source, t)}</span>,
                amountCents: row.amountCents,
                paymentCount: row.paymentCount,
                share: row.share,
              }))}
            />
          )}
        </Tabs>
      )}

      <p className="text-sm text-foreground/70" data-testid="collections-basis">
        {t('reports.collections.basis')}
      </p>
    </section>
  );
}
