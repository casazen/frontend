import { useMemo, type ReactNode } from 'react';
import { CalendarRange, Euro, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import type { ListDefinition } from '@/components/shared/list-view/list-types';
import type { LongRentFiscalRow } from '@/api/long-rent-fiscal.api';
import { getLeaseContractTypeLabel, getLeaseTaxRegimeLabel } from '@/lib/i18n-labels';
import { formatCurrency } from '@/lib/utils';
import { fiscalMonthLabel, fiscalRateLabel, fiscalTenantName } from './long-rent-fiscal-format';

/** The page of a lease: the name of the tenant leads there. */
const leasePath = (row: LongRentFiscalRow) => `/app/long-rent/leases/${row.leaseId}`;

const SUB_LINE = 'mt-0.5 block break-words text-sm text-foreground/70';

const regimeText = (row: LongRentFiscalRow, t: TFunction) =>
  row.taxRegime ? getLeaseTaxRegimeLabel(row.taxRegime, t) : t('leases.taxRegimeUnknown');

const accrualDetail = (row: LongRentFiscalRow, t: TFunction) =>
  t('longRentFiscal.accrualDetail', { count: row.monthsInYear, rent: formatCurrency(row.monthlyRentEur) });

/** What the register holds for the year, in words: the amount, or that CasaZen tracks none of it. */
function collectedText(row: LongRentFiscalRow, t: TFunction): string {
  return row.collectedEur === null ? t('longRentFiscal.collectedNone') : formatCurrency(row.collectedEur);
}

/** The tax of a row in one line: the estimated amount, or that it is not estimated. */
function taxText(row: LongRentFiscalRow, t: TFunction): string {
  return row.tax.status === 'CedolareEstimated' && row.tax.amountEur !== null
    ? formatCurrency(row.tax.amountEur)
    : t('longRentFiscal.notEstimated');
}

/** Why a row has no figure, or the rate of the one it has: the line under the tax. */
function taxDetail(row: LongRentFiscalRow, t: TFunction, language: string): string {
  switch (row.tax.status) {
    case 'CedolareEstimated':
      return t('longRentFiscal.taxRate', { rate: row.tax.rate === null ? '' : fiscalRateLabel(row.tax.rate, language) });
    case 'OrdinaryNotEstimated':
      return t('longRentFiscal.notEstimatedOrdinary');
    default:
      return t('longRentFiscal.notEstimatedUnknown');
  }
}

/** An amount with its base under it. A plain function and not a component: this file exports functions, not components. */
function amountCell(main: ReactNode, detail?: ReactNode): ReactNode {
  return (
    <span className="block">
      <span className="block whitespace-nowrap font-medium">{main}</span>
      {detail ? <span className={SUB_LINE}>{detail}</span> : null}
    </span>
  );
}

/**
 * The list of the fiscal report (LR-11b) on the unified list (UI-14), in `client` mode: a year's leases, all of them, as the server
 * gives them (property, then start). Five columns: the lease, the regime, the rent accrued, the rent collected, the tax. Each number
 * has its base under it: the months and the rent the accrual is made of; since when the register holds the rent (or that it holds
 * none); the rate of the cedolare, or why there is no figure. No search, no filters, no CSV of its own: the file is the one the server
 * makes (the button of the page).
 */
export function buildLongRentFiscalList(t: TFunction, language: string, year: number): ListDefinition<LongRentFiscalRow> {
  return defineList<LongRentFiscalRow>({
    key: 'long-rent-fiscal',
    title: t('longRentFiscal.title'),
    rowKey: (row) => row.leaseId,
    rowLabel: (row) => `${fiscalTenantName(row, t)} · ${row.propertyName}`,
    columns: [
      {
        id: 'contract',
        label: t('longRentFiscal.columns.contract'),
        default: true,
        always: true,
        rowHeader: true,
        render: (row, cell) => (
          <span className="block min-w-0">
            {cell.open(fiscalTenantName(row, t))}
            <span className={SUB_LINE}>{row.propertyName}</span>
          </span>
        ),
      },
      {
        id: 'regime',
        label: t('longRentFiscal.columns.regime'),
        default: true,
        render: (row) => (
          <span className="block min-w-0">
            <span className="block break-words">{regimeText(row, t)}</span>
            <span className={SUB_LINE}>{getLeaseContractTypeLabel(row.contractType, t)}</span>
          </span>
        ),
      },
      {
        id: 'accrual',
        label: t('longRentFiscal.columns.accrual'),
        default: true,
        align: 'end',
        render: (row) => amountCell(formatCurrency(row.accrualEur), accrualDetail(row, t)),
      },
      {
        id: 'collected',
        label: t('longRentFiscal.columns.collected'),
        default: true,
        align: 'end',
        render: (row) =>
          row.collectedEur === null
            ? amountCell(<span aria-hidden="true">—</span>, t('longRentFiscal.collectedNone'))
            : amountCell(
                formatCurrency(row.collectedEur),
                row.collectedIsPartial && row.trackedFrom
                  ? t('longRentFiscal.collectedFrom', { month: fiscalMonthLabel(row.trackedFrom, language) })
                  : undefined,
              ),
      },
      {
        id: 'tax',
        label: t('longRentFiscal.columns.tax'),
        default: true,
        align: 'end',
        render: (row) => (
          <span className="block">
            <span className="block whitespace-nowrap font-medium">{taxText(row, t)}</span>
            <span className={SUB_LINE}>{taxDetail(row, t, language)}</span>
            {row.tax.status === 'CedolareEstimated' && row.notes.length > 0 ? (
              <span className={SUB_LINE}>{t('longRentFiscal.toCheck')}</span>
            ) : null}
          </span>
        ),
      },
    ],
    rowHref: leasePath,
    card: (row) => ({
      title: fiscalTenantName(row, t),
      sub: row.propertyName,
      status: <span className="whitespace-nowrap font-medium">{taxText(row, t)}</span>,
      meta: [
        { icon: CalendarRange, label: t('longRentFiscal.columns.accrual'), text: `${formatCurrency(row.accrualEur)} · ${accrualDetail(row, t)}` },
        { icon: Euro, label: t('longRentFiscal.columns.collected'), text: collectedText(row, t) },
      ],
      foot: (
        <p className="break-words text-sm text-foreground/70">
          {regimeText(row, t)} · {taxDetail(row, t, language)}
        </p>
      ),
    }),
    // Five columns and the sidebar do not fit before a wide screen: cards until then.
    cardsUntil: 'xl',
    csv: false,
    countLabel: (count) => t('leaseList.count', { count }),
    empty: {
      icon: FileText,
      title: t('longRentFiscal.empty.title', { year }),
      description: t('longRentFiscal.empty.description'),
      action: { label: t('longRentFiscal.empty.action'), href: '/app/long-rent/leases' },
    },
  });
}

/** The list of the fiscal report of a year in the words of the person; it follows the language. */
export function useLongRentFiscalList(year: number): ListDefinition<LongRentFiscalRow> {
  const { t, i18n } = useTranslation();
  return useMemo(() => buildLongRentFiscalList(t, i18n.language, year), [t, i18n.language, year]);
}
