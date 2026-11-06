import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { overviewFormat, type MetricDeltas, type MetricFigures } from './overview-model';

/** A row of the performance report (or of the owner's overview): its figures and the differences the server worked out. */
export interface TilesRow extends MetricDeltas {
  figures: MetricFigures;
}

/** The names of the four numbers: the Reports page and the owner portal each have their own words. */
export interface TileNames {
  occupancy: string;
  revenue: string;
  adr: string;
  revPar: string;
}

interface PerformanceTilesProps {
  row: TilesRow;
  currency: string;
  /** The report was asked next to the year before: a tile without a difference says there is no comparison. */
  compared: boolean;
  names: TileNames;
  /** The name of the group for a screen reader. */
  label: string;
  testId?: string;
}

/**
 * The four numbers of a period, each against the same days one year earlier: occupancy, revenue, ADR and RevPAR. Every number and
 * every difference is the server's, written in the language of the app; a number the server does not have is "n.d.", never 0.
 */
export function PerformanceTiles({ row, currency, compared, names, label, testId = 'reports-tiles' }: PerformanceTilesProps) {
  const { t, i18n } = useTranslation();
  const format = useMemo(() => overviewFormat(i18n.language, currency), [i18n.language, currency]);
  const na = t('reports.overview.na');
  const { figures } = row;

  const percentDelta = (value: number | null) => {
    if (!compared) return undefined;
    return value === null ? t('reports.overview.delta.none') : t('reports.overview.delta.percent', { value: format.signedPercent(value) });
  };
  const pointsDelta = (value: number | null) => {
    if (!compared) return undefined;
    return value === null
      ? t('reports.overview.delta.none')
      : t('reports.overview.delta.points', { count: Math.abs(value), value: format.signedNumber(value) });
  };

  return (
    <StatStrip label={label} data-testid={testId}>
      <StatTile
        label={names.occupancy}
        value={figures.occupancyRate === null ? na : format.rate(figures.occupancyRate)}
        delta={pointsDelta(row.occupancyDeltaPoints)}
        data-testid={`${testId}-occupancy`}
      />
      <StatTile
        label={names.revenue}
        value={format.money(figures.revenue)}
        delta={percentDelta(row.revenueDeltaPercent)}
        data-testid={`${testId}-revenue`}
      />
      <StatTile
        label={names.adr}
        value={figures.adr === null ? na : format.moneyExact(figures.adr)}
        delta={percentDelta(row.adrDeltaPercent)}
        data-testid={`${testId}-adr`}
      />
      <StatTile
        label={names.revPar}
        value={figures.revPar === null ? na : format.moneyExact(figures.revPar)}
        delta={percentDelta(row.revParDeltaPercent)}
        data-testid={`${testId}-revpar`}
      />
    </StatStrip>
  );
}
