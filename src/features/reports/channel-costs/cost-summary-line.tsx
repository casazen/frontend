import { useId } from 'react';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { channelLabel, formatRate, formatSummedCents } from '@/features/reports/money-reports/money-model';
import type { ChannelCostRow } from '@/types';

interface CostSummaryLineProps {
  /** The rows in the order the server sent them: the highest cost rate first. */
  rows: readonly ChannelCostRow[];
}

/**
 * "How much each channel costs", in one line first (NF-98): a sentence for each channel written from the cost rate and the commission
 * the server gives (the name of the channel, the percentage of the gross and the amount), the most expensive first as the server orders
 * them. The row the server flags `mostExpensive` is marked with a word and an icon, never by colour alone. A cost the channel did not
 * report is said to be not available, never as a cost of zero; the stays without a reported commission are counted apart in the same
 * line. Nothing is computed here: the rate and the amount are the server's, only written in words.
 */
export function CostSummaryLine({ rows }: CostSummaryLineProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const headingId = useId();

  const sentence = (row: ChannelCostRow): string => {
    const channel = channelLabel(row.source, t);
    // The amount carries no currency (the server adds every property in its own, with no conversion): the number alone.
    const amount = formatSummedCents(row.commissionCents, locale);
    const rate = formatRate(row.costRate, locale);

    if (row.kind === 'NoCost') return t('reports.channelCosts.summary.free', { channel });
    if (row.kind === 'PaymentFee') {
      if (amount === null) return t('reports.channelCosts.summary.cardUnavailable', { channel });
      if (rate === null) return t('reports.channelCosts.summary.cardAmount', { channel, amount });
      return t('reports.channelCosts.summary.cardLine', { channel, rate, amount });
    }
    if (amount === null) return t('reports.channelCosts.summary.unavailable', { channel });
    if (rate === null) return t('reports.channelCosts.summary.amount', { channel, amount });
    return t('reports.channelCosts.summary.line', { channel, rate, amount });
  };

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4" data-testid="channel-costs-summary">
      <h2 id={headingId} className="text-lg font-semibold">
        {t('reports.channelCosts.summary.title')}
      </h2>
      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={`${row.source ?? 'none'}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="channel-costs-summary-row">
            <span data-testid="channel-costs-summary-line">{sentence(row)}</span>
            {row.mostExpensive ? (
              <Badge variant="warning" className="gap-1" data-testid="channel-costs-most-expensive">
                <TrendingUp aria-hidden="true" className="size-3" />
                {t('reports.channelCosts.summary.mostExpensive')}
              </Badge>
            ) : null}
            {row.staysWithoutCommission > 0 ? (
              <span className="text-sm text-foreground/70" data-testid="channel-costs-summary-without">
                {t('reports.channelCosts.summary.without', { count: row.staysWithoutCommission })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
