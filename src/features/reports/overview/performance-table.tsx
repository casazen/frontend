import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PerformanceGroupBy, PerformanceRow } from '@/types/report.types';
import { OVERVIEW_METRICS, formatMetric, labelOf, metricDelta, metricValue, overviewFormat, type OverviewMetric } from './overview-model';

interface ReportTableFrameProps {
  /** What the table is, for a screen reader (the caption) and for the keyboard (the name of the scrolling region). */
  caption: string;
  testId: string;
  children: ReactNode;
}

/**
 * A table of figures that scrolls sideways on a phone instead of squeezing its columns: the scrolling box is a region of its own, so
 * the keyboard can reach it.
 */
export function ReportTableFrame({ caption, testId, children }: ReportTableFrameProps) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={`${testId}-scroll`}
    >
      <table className="w-full min-w-[34rem] border-collapse text-sm" data-testid={testId}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

interface FigureCellProps {
  /** The number as it is shown, or null where the server has none ("n.d."). */
  value: string | null;
  /** Report compared: the number of the year before as it is shown, null when there is none. Undefined: no comparison was asked. */
  previous?: string | null;
  /** The difference from the year before as it is shown, null when the server has none. */
  delta?: string | null;
}

/** A number of a table, and under it, when the report compared, the same number a year earlier with the difference. */
export function FigureCell({ value, previous, delta }: FigureCellProps) {
  const { t } = useTranslation();
  const na = t('reports.overview.na');
  // A number that does not exist by design (a channel has no occupancy) and has no year before either says it once.
  const comparison = previous !== undefined && (value !== null || previous !== null || delta);

  return (
    <td className="px-3 py-2 text-right align-top tabular-nums">
      <div className="font-medium">{value ?? na}</div>
      {comparison ? (
        <div className="text-xs text-foreground/70">
          {t('reports.overview.table.previous', { value: previous ?? na })}
          {delta ? ` (${delta})` : ''}
        </div>
      ) : null}
    </td>
  );
}

interface PerformanceTableProps {
  /** The rows in the order the server sends them. */
  rows: readonly PerformanceRow[];
  total: PerformanceRow;
  groupBy: Exclude<PerformanceGroupBy, 'none'>;
  /** The report was asked next to the year before. */
  compared: boolean;
  currency: string;
  testId?: string;
}

/**
 * The grouped views of the overview: one row for each property or channel with the four numbers, the same numbers a year earlier and
 * the differences the server worked out, then the total. Per channel the occupancy and the RevPAR are "n.d." by design (the nights
 * belong to a property). The browser sorts nothing and adds nothing up.
 */
export function PerformanceTable({ rows, total, groupBy, compared, currency, testId = 'reports-performance-table' }: PerformanceTableProps) {
  const { t, i18n } = useTranslation();
  const format = useMemo(() => overviewFormat(i18n.language, currency), [i18n.language, currency]);
  const names: Record<OverviewMetric, string> = {
    occupancy: t('reports.overview.tiles.occupancy'),
    revenue: t('reports.overview.tiles.revenue'),
    adr: t('reports.overview.tiles.adr'),
    revPar: t('reports.overview.tiles.revPar'),
  };

  const deltaText = (metric: OverviewMetric, value: number | null) => {
    if (value === null) return null;
    return metric === 'occupancy' ? t('reports.overview.table.deltaPoints', { value: format.signedNumber(value) }) : format.signedPercent(value);
  };
  const cells = (row: PerformanceRow) =>
    OVERVIEW_METRICS.map((metric) => {
      const value = metricValue(row.figures, metric);
      const before = metricValue(row.previousYear, metric);
      return (
        <FigureCell
          key={metric}
          value={value === null ? null : formatMetric(format, metric, value)}
          previous={compared ? (before === null ? null : formatMetric(format, metric, before)) : undefined}
          delta={compared ? deltaText(metric, metricDelta(row, metric)) : undefined}
        />
      );
    });

  return (
    <ReportTableFrame caption={t(groupBy === 'channel' ? 'reports.overview.table.caption.channel' : 'reports.overview.table.caption.property')} testId={testId}>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="px-3 py-2 text-left font-medium">
            {t(groupBy === 'channel' ? 'reports.overview.table.name.channel' : 'reports.overview.table.name.property')}
          </th>
          {OVERVIEW_METRICS.map((metric) => (
            <th key={metric} scope="col" className="px-3 py-2 text-right font-medium">
              {names[metric]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-border" data-testid={`${testId}-row`}>
            <th scope="row" className="px-3 py-2 text-left align-top font-medium">
              <span className="break-words">{labelOf(row, groupBy, t)}</span>
            </th>
            {cells(row)}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border" data-testid={`${testId}-total`}>
          <th scope="row" className="px-3 py-2 text-left align-top font-semibold">
            {t('reports.overview.table.total')}
          </th>
          {cells(total)}
        </tr>
      </tfoot>
    </ReportTableFrame>
  );
}
