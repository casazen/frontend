import { useMemo } from 'react';
import { Coins } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { getStatusDefinition, type StatusOf } from '@/lib/status-dictionary';
import type { SupplierEarning } from '@/types/supplier-earnings';
import { requestPath } from '../requests/request-model';
import { formatMoney } from '../services/lib/service-money';
import { daysLate, EARNINGS_PERIODS } from './earnings-model';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** What an amount that does not exist says: a dash, never a 0 (the server leaves it empty where there is none). */
const NO_VALUE = '—';
const money = (cents: number | null | undefined, locale: string) => (cents === null || cents === undefined ? NO_VALUE : formatMoney(cents, locale));

const jobTitle = (earning: SupplierEarning, t: Translate) => earning.serviceName?.trim() || getServiceCategoryLabel(earning.category, t);

/** The customer and the day, under the name of the job: "Casa Rossi · 12 ott 2026". A removed customer is not named. */
function jobSubline(earning: SupplierEarning, locale: string, t: Translate): string {
  const client = earning.clientAnonymized ? t('supplier.earnings.clientRemoved') : (earning.clientLabel?.trim() ?? '');
  const instant = earning.paidAt ?? earning.completedAt;
  const day = instant ? formatRomeDateTime(instant, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return [client, day].filter(Boolean).join(' · ');
}

/** The commission as the server made it: minus the amount and the percentage; "Nessuna" where none is charged (a job paid outside CasaZen). */
function commissionCell(earning: SupplierEarning, locale: string, t: Translate) {
  const cents = earning.commissionCents;
  if (cents === null || cents === undefined) return NO_VALUE;
  if (cents === 0) return t('supplier.earnings.noCommission');
  const percent = earning.commissionPercent;
  return (
    <>
      <span>{`−${formatMoney(cents, locale)}`}</span>
      {percent !== null && percent !== undefined ? (
        <span className="block text-sm text-foreground/70">{new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(percent)} %</span>
      ) : null}
    </>
  );
}

/**
 * The state of a payment: the shared badge, an icon and a word, never the colour alone. The tone and the icon are the dictionary's (`earning`); the words
 * are the page's (`supplier.earnings.state.*`), because a late payment says for how many days, and a state the app does not know (the open set of the
 * server) gets a generic word, neutral, with the raw state as its `data-status`.
 */
function stateBadge(earning: SupplierEarning, t: Translate) {
  const key = getStatusDefinition('earning', earning.state) ? earning.state : 'unknown';
  const days = daysLate(earning);
  const label = key === 'late' && days > 0 ? t('supplier.earnings.state.lateDays', { count: days }) : t(`supplier.earnings.state.${key}`);
  return <StatusBadge kind="earning" status={earning.state as StatusOf<'earning'>} label={label} />;
}

/**
 * The list of the earnings of the supplier (UI-14, `server` mode): the server picks the jobs of a tab, of a period and of a customer and
 * pages them. Five columns: the job, gross, commission, net and the state of the payment; every amount is the server's, in cents, and
 * what does not exist yet is a dash. A row opens the request. The file for the accountant is the button of the page (the server makes it).
 */
export function useSupplierEarningsList() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  return useMemo(
    () =>
      defineList<SupplierEarning>({
        key: 'supplier-earnings',
        title: t('supplier.earnings.title'),
        rowKey: (earning) => earning.requestId,
        rowLabel: (earning) => jobTitle(earning, t),
        columns: [
          {
            id: 'job',
            label: t('supplier.earnings.columns.job'),
            always: true,
            rowHeader: true,
            priority: 1,
            render: (earning, cell) => (
              <>
                {cell.open(jobTitle(earning, t))}
                <span className="mt-1 block break-words text-sm font-normal text-foreground/70">{jobSubline(earning, locale, t)}</span>
              </>
            ),
          },
          {
            id: 'gross',
            label: t('supplier.earnings.columns.gross'),
            default: true,
            align: 'end',
            priority: 2,
            render: (earning) => money(earning.grossCents, locale),
          },
          {
            id: 'commission',
            label: t('supplier.earnings.columns.commission'),
            default: true,
            align: 'end',
            priority: 3,
            render: (earning) => commissionCell(earning, locale, t),
          },
          {
            id: 'net',
            label: t('supplier.earnings.columns.net'),
            default: true,
            align: 'end',
            priority: 4,
            render: (earning) => <strong className="font-semibold">{money(earning.netCents, locale)}</strong>,
          },
          {
            id: 'state',
            label: t('supplier.earnings.columns.state'),
            default: true,
            cardStatus: true,
            render: (earning) => stateBadge(earning, t),
          },
        ],
        chips: [
          { id: 'tutti', label: t('supplier.earnings.chips.all') },
          { id: 'da-incassare', label: t('supplier.earnings.chips.toCollect'), hint: t('supplier.earnings.chips.toCollectHint') },
          { id: 'pagati', label: t('supplier.earnings.chips.paid') },
          { id: 'in-ritardo', label: t('supplier.earnings.chips.late'), hint: t('supplier.earnings.chips.lateHint'), urgent: true },
        ],
        filters: [
          {
            id: 'period',
            label: t('supplier.earnings.filters.period'),
            type: 'select',
            allLabel: t('supplier.earnings.filters.all'),
            options: EARNINGS_PERIODS.map((period) => ({ value: period, label: t(`supplier.earnings.filters.${period}`) })),
          },
        ],
        rowHref: (earning) => requestPath(earning.requestId),
        rowTone: (earning) => (earning.state === 'late' ? 'urgent' : undefined),
        csv: false,
        // Five columns and the amounts do not fit under 1280 px with the sidebar open: cards until then.
        cardsUntil: 'xl',
        empty: {
          icon: Coins,
          title: t('supplier.earnings.empty.title'),
          description: t('supplier.earnings.empty.description'),
        },
        noResults: { title: t('supplier.earnings.noResults.title'), description: t('supplier.earnings.noResults.description') },
        countLabel: (count) => t('supplier.earnings.count', { count }),
      }),
    [t, locale],
  );
}
