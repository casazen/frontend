import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { channelLabel, formatRate, formatSummedCents, shortDay } from '@/features/reports/money-reports/money-model';
import { ReportTableFrame } from '@/features/reports/overview/performance-table';
import type { ChannelCommissionMode, ChannelCostRow, ChannelCostsReport } from '@/types';
import { groupCostRows, modeOf } from './channel-costs-model';

const STICKY = 'sticky left-0 z-10 bg-background';
const HEAD = 'px-3 py-2 font-medium';
const FIGURE = 'px-3 py-2 text-right align-top tabular-nums';
const COLUMNS = 7;

/** How a commission is settled is always said in words in its badge; the tone only helps the eye. */
const MODE_VARIANTS: Record<ChannelCommissionMode, NonNullable<BadgeProps['variant']>> = {
  DeductedFromPayout: 'secondary',
  InvoicedSeparately: 'warning',
  Unknown: 'outline',
};

type Group = 'channels' | 'cardFees' | 'free';

/** The title of each group of rows: the commissions of the channels, the card fees of the direct stays (a line of their own) and the stays with no cost. */
const GROUP_TITLES: Record<Group, string> = {
  channels: 'reports.channelCosts.groups.channels',
  cardFees: 'reports.channelCosts.stripe.title',
  free: 'reports.channelCosts.groups.free',
};

interface RowProps {
  row: ChannelCostRow;
  group: Group;
}

function CostRow({ row, group }: RowProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const na = t('reports.money.notAvailable');
  // The figures carry no currency (the server adds every property in its own, with no conversion): the number alone.
  const money = (cents: number | null) => formatSummedCents(cents, locale) ?? na;
  const mode = modeOf(row);
  // A stay nobody charges the host for (entered by hand, a local one) is "no cost" in words, never "0,00" nor "0%" (the server says it with a
  // zero) and never "not available": only an exact zero is said so, any other figure of the server is shown as it is.
  const noCost = group === 'free' && row.commissionCents === 0;

  return (
    <tr className="border-b border-border" data-testid="channel-costs-row">
      <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top font-medium`}>
        <span className="break-words">{channelLabel(row.source, t)}</span>
      </th>
      <td className={FIGURE}>{row.stayCount}</td>
      <td className={FIGURE}>{money(row.grossCents)}</td>
      <td className={FIGURE}>
        {noCost ? (
          <div className="font-medium" data-testid="channel-costs-no-cost">
            {t('reports.channelCosts.noCost')}
          </div>
        ) : row.commissionCents === null ? (
          <div data-testid="channel-costs-unavailable">
            <div>{na}</div>
            {group === 'cardFees' ? <div className="mt-0.5 text-xs font-normal text-foreground/70">{t('reports.channelCosts.stripe.unavailable')}</div> : null}
          </div>
        ) : (
          <div className="font-medium">{money(row.commissionCents)}</div>
        )}
        {row.staysWithoutCommission > 0 ? (
          <div className="mt-0.5 text-xs font-normal text-foreground/70" data-testid="channel-costs-row-without">
            {t('reports.channelCosts.withoutCommissionRow', { count: row.staysWithoutCommission })}
          </div>
        ) : null}
      </td>
      <td className={FIGURE}>{money(row.netCents)}</td>
      <td className={FIGURE} data-testid="channel-costs-rate">
        {noCost ? t('reports.channelCosts.noCost') : (formatRate(row.costRate, locale) ?? na)}
      </td>
      <td className="px-3 py-2 align-top">
        {group === 'channels' ? (
          <div data-testid="channel-costs-mode">
            <Badge variant={MODE_VARIANTS[mode]}>{t(`reports.channelCosts.mode.${mode}`)}</Badge>
            <p className="mt-1 text-xs text-foreground/70">{t(`reports.channelCosts.mode.help.${mode}`)}</p>
          </div>
        ) : (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t('reports.channelCosts.mode.notApplicable')}</span>
          </>
        )}
      </td>
    </tr>
  );
}

function GroupRows({ group, rows }: { group: Group; rows: ChannelCostRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;

  return (
    <tbody data-testid={`channel-costs-group-${group}`}>
      <tr>
        <th scope="rowgroup" colSpan={COLUMNS} className={`${STICKY} px-3 pb-1 pt-4 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70`}>
          {t(GROUP_TITLES[group])}
        </th>
      </tr>
      {rows.map((row, index) => (
        <CostRow key={`${row.source ?? 'none'}-${index}`} row={row} group={group} />
      ))}
    </tbody>
  );
}

interface ChannelCostsTableProps {
  report: ChannelCostsReport;
}

/**
 * What each channel costs, in a table after the line (NF-98): for every channel the stays, the gross, the commission, the net, the cost
 * rate and how the commission is settled, as a text badge (deducted from the payout, invoiced separately, unknown) with a line that says
 * what it means. The card fees of the direct stays are a line of their own, apart from the commissions of the channels, and say "not
 * available" when the server has none. The total row is the server's. Every figure is the server's and a cost nobody reported is "not
 * available", never zero: the stays without a reported commission are counted apart in a note and are never presented as free.
 */
export function ChannelCostsTable({ report }: ChannelCostsTableProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const na = t('reports.money.notAvailable');
  const money = (cents: number | null) => formatSummedCents(cents, locale) ?? na;
  const groups = groupCostRows(report.rows);
  const { total } = report;

  return (
    <div className="min-w-0 space-y-3" data-testid="channel-costs-results">
      <ReportTableFrame
        caption={t('reports.channelCosts.caption', { from: shortDay(report.period.from, locale), to: shortDay(report.period.to, locale) })}
        testId="channel-costs-table"
      >
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={`${STICKY} ${HEAD} text-left`}>
              {t('reports.channelCosts.columns.channel')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.channelCosts.columns.stays')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.channelCosts.columns.gross')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.channelCosts.columns.commission')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.channelCosts.columns.net')}
            </th>
            <th scope="col" className={`${HEAD} text-right`}>
              {t('reports.channelCosts.columns.costRate')}
            </th>
            <th scope="col" className={`${HEAD} text-left`}>
              {t('reports.channelCosts.columns.mode')}
            </th>
          </tr>
        </thead>
        <GroupRows group="channels" rows={groups.channels} />
        <GroupRows group="cardFees" rows={groups.cardFees} />
        <GroupRows group="free" rows={groups.free} />
        <tfoot>
          <tr className="border-t-2 border-border" data-testid="channel-costs-total">
            <th scope="row" className={`${STICKY} px-3 py-2 text-left align-top font-semibold`}>
              {t('reports.channelCosts.total')}
            </th>
            <td className={`${FIGURE} font-semibold`}>{total.stayCount}</td>
            <td className={`${FIGURE} font-semibold`}>{money(total.grossCents)}</td>
            <td className={`${FIGURE} font-semibold`}>{money(total.commissionCents)}</td>
            <td className={`${FIGURE} font-semibold`}>{money(total.netCents)}</td>
            <td className={`${FIGURE} font-semibold`}>{formatRate(total.costRate, locale) ?? na}</td>
            <td />
          </tr>
        </tfoot>
      </ReportTableFrame>

      {total.staysWithoutCommission > 0 ? (
        <Alert variant="warning" data-testid="channel-costs-without-commission">
          {t('reports.channelCosts.withoutCommission', { count: total.staysWithoutCommission })}
        </Alert>
      ) : null}

      <p className="text-sm text-foreground/70" data-testid="channel-costs-basis">
        {t('reports.channelCosts.basis')}
      </p>
    </div>
  );
}
