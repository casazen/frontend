import { BedDouble, ChartNoAxesColumn, ReceiptText, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { overviewFormat, type MetricDeltas, type MetricFigures } from './overview-model';

export interface TilesRow extends MetricDeltas {
  figures: MetricFigures;
}

export interface TileNames {
  occupancy: string;
  revenue: string;
  adr: string;
  revPar: string;
}

interface PerformanceTilesProps {
  row: TilesRow;
  currency: string;
  compared: boolean;
  names: TileNames;
  label: string;
  testId?: string;
}

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
        icon={BedDouble}
        label={names.occupancy}
        value={figures.occupancyRate === null ? na : format.rate(figures.occupancyRate)}
        delta={pointsDelta(row.occupancyDeltaPoints)}
        data-testid={`${testId}-occupancy`}
      />
      <StatTile
        icon={Wallet}
        label={names.revenue}
        value={format.money(figures.revenue)}
        delta={percentDelta(row.revenueDeltaPercent)}
        data-testid={`${testId}-revenue`}
      />
      <StatTile
        icon={ReceiptText}
        label={names.adr}
        value={figures.adr === null ? na : format.moneyExact(figures.adr)}
        delta={percentDelta(row.adrDeltaPercent)}
        data-testid={`${testId}-adr`}
      />
      <StatTile
        icon={ChartNoAxesColumn}
        label={names.revPar}
        value={figures.revPar === null ? na : format.moneyExact(figures.revPar)}
        delta={percentDelta(row.revParDeltaPercent)}
        data-testid={`${testId}-revpar`}
      />
    </StatStrip>
  );
}
