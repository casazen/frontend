import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { OwnerReport, WeightedFigures } from '@/types/report.types';
import { OVERVIEW_METRICS, formatMetric, metricValue, overviewFormat } from './overview-model';
import { FigureCell, ReportTableFrame } from './performance-table';

interface OwnerTableProps {
  report: OwnerReport;
  testId?: string;
}

/**
 * The agency's view (NF-96): one row for each property owner with the number of its properties and the four numbers weighted by the
 * share it holds, then the properties nobody owns and the total, in the order and with the values the server sends. Owners and the
 * unassigned row add up to the total of the Home; the browser adds nothing up. Only the name of an owner is shown, nothing personal.
 */
export function OwnerTable({ report, testId = 'reports-owner-table' }: OwnerTableProps) {
  const { t, i18n } = useTranslation();
  const format = useMemo(() => overviewFormat(i18n.language, report.currency), [i18n.language, report.currency]);

  const cells = (figures: WeightedFigures) =>
    OVERVIEW_METRICS.map((metric) => {
      const value = metricValue(figures, metric);
      return <FigureCell key={metric} value={value === null ? null : formatMetric(format, metric, value)} />;
    });
  const names = {
    occupancy: t('reports.overview.tiles.occupancy'),
    revenue: t('reports.overview.tiles.revenue'),
    adr: t('reports.overview.tiles.adr'),
    revPar: t('reports.overview.tiles.revPar'),
  };

  return (
    <ReportTableFrame caption={t('reports.overview.owner.caption')} testId={testId}>
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="px-3 py-2 text-left font-medium">
            {t('reports.overview.owner.columns.name')}
          </th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            {t('reports.overview.owner.columns.properties')}
          </th>
          {OVERVIEW_METRICS.map((metric) => (
            <th key={metric} scope="col" className="px-3 py-2 text-right font-medium">
              {names[metric]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {report.rows.map((row) => (
          <tr key={row.ownerId ?? row.displayName} className="border-b border-border" data-testid={`${testId}-row`}>
            <th scope="row" className="px-3 py-2 text-left align-top font-medium">
              <span className="break-words">{row.displayName}</span>
            </th>
            <td className="px-3 py-2 text-right align-top tabular-nums">{row.propertyCount}</td>
            {cells(row.figures)}
          </tr>
        ))}
        <tr className="border-b border-border" data-testid={`${testId}-unassigned`}>
          <th scope="row" className="px-3 py-2 text-left align-top font-medium">
            {t('reports.overview.owner.unassigned')}
          </th>
          <td className="px-3 py-2 text-right align-top tabular-nums">{report.unassigned.propertyCount}</td>
          {cells(report.unassigned.figures)}
        </tr>
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border" data-testid={`${testId}-total`}>
          <th scope="row" className="px-3 py-2 text-left align-top font-semibold">
            {t('reports.overview.owner.total')}
          </th>
          <td className="px-3 py-2" />
          {cells(report.total)}
        </tr>
      </tfoot>
    </ReportTableFrame>
  );
}
