import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ReportTableFrame } from '@/features/reports/overview/performance-table';
import { channelLabel, formatCents, shortDay } from '@/features/reports/money-reports/money-model';
import type { ChannelCredits, CollectionsCredits, StripeCredits } from '@/types';

const HEAD = 'px-3 py-2 font-medium';
const FIGURE = 'px-3 py-2 text-right align-top tabular-nums';

function StripeBlock({ stripe }: { stripe: StripeCredits }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const na = t('reports.money.notAvailable');

  return (
    <div className="space-y-2" data-testid="collections-credits-stripe">
      <h3 className="text-sm font-semibold">{t('reports.collections.credits.stripe')}</h3>

      {stripe.available ? (
        <>
          <ReportTableFrame caption={t('reports.collections.credits.stripeCaption')} testId="collections-credits-stripe-table">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={`${HEAD} text-left`}>
                  {t('reports.collections.credits.columns.arrival')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.collections.credits.columns.amount')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.collections.credits.columns.payments')}
                </th>
                <th scope="col" className={`${HEAD} text-left`}>
                  {t('reports.collections.credits.columns.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {stripe.payouts.map((row) => (
                <tr key={`${row.arrivalDate}-${row.currency}`} className="border-b border-border" data-testid="collections-credits-stripe-row">
                  <th scope="row" className="whitespace-nowrap px-3 py-2 text-left align-top font-medium">
                    {shortDay(row.arrivalDate, locale)}
                  </th>
                  <td className={FIGURE}>{formatCents(row.amountCents, row.currency, locale) ?? na}</td>
                  <td className={FIGURE}>{row.paymentCount}</td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant={row.status === 'Credited' ? 'success' : 'outline'} data-testid="collections-credits-stripe-status">
                      {row.status === 'Credited' || row.status === 'Expected' ? t(`reports.collections.credits.status.${row.status}`) : row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </ReportTableFrame>
          <p className="text-sm text-foreground/70">{t('reports.collections.credits.stripeNote')}</p>
        </>
      ) : (
        // Nothing is stored for the period: one sentence, and no figure at all (a zero would say that nothing was credited).
        <p className="text-sm text-foreground/70" data-testid="collections-credits-stripe-unavailable">
          {t('reports.collections.credits.unavailable')}
        </p>
      )}

      {stripe.paymentsWithoutFigures > 0 ? (
        <Alert variant="warning" data-testid="collections-credits-stripe-partial">
          {t('reports.collections.credits.withoutFigures', { count: stripe.paymentsWithoutFigures, total: stripe.cardPaymentCount })}
        </Alert>
      ) : null}
    </div>
  );
}

function ChannelsBlock({ channels }: { channels: ChannelCredits }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const na = t('reports.money.notAvailable');

  return (
    <div className="space-y-2" data-testid="collections-credits-channels">
      <h3 className="text-sm font-semibold">{t('reports.collections.credits.channels')}</h3>

      {channels.available ? (
        <>
          <p className="text-sm text-foreground/70" data-testid="collections-credits-reported">
            {t('reports.collections.credits.reported')}
          </p>
          <ReportTableFrame caption={t('reports.collections.credits.channelsCaption')} testId="collections-credits-channels-table">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={`${HEAD} text-left`}>
                  {t('reports.collections.credits.columns.channel')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.collections.credits.columns.amount')}
                </th>
                <th scope="col" className={`${HEAD} text-right`}>
                  {t('reports.collections.credits.columns.stays')}
                </th>
              </tr>
            </thead>
            <tbody>
              {channels.rows.map((row) => (
                <tr key={`${row.source}-${row.currency}`} className="border-b border-border" data-testid="collections-credits-channel-row">
                  <th scope="row" className="px-3 py-2 text-left align-top font-medium">
                    {channelLabel(row.source, t)}
                  </th>
                  <td className={FIGURE}>{formatCents(row.amountCents, row.currency, locale) ?? na}</td>
                  <td className={FIGURE}>{row.stayCount}</td>
                </tr>
              ))}
            </tbody>
          </ReportTableFrame>
        </>
      ) : (
        <p className="text-sm text-foreground/70" data-testid="collections-credits-channels-unavailable">
          {t('reports.collections.credits.unavailable')}
        </p>
      )}

      {channels.staysWithoutNet > 0 ? (
        <Alert variant="warning" data-testid="collections-credits-channels-partial">
          {t('reports.collections.credits.staysWithoutNet', { count: channels.staysWithoutNet })}
        </Alert>
      ) : null}
    </div>
  );
}

interface CreditsSectionProps {
  credits: CollectionsCredits;
}

/**
 * What reached the account (NF-97), in the period of the report: the credits of the card payments (the day they are credited, the
 * amount, the payments and whether the day has come) and the credits of the channels, which are only what the channel manager reports
 * (the net amount of the stays a channel collected itself), labelled as such and never a bank credit. Every figure is the server's. Where
 * the server says `available: false` the section says so in one sentence and shows no figure at all, never a zero; the payments and the
 * stays whose figures are missing are counted apart in a note, so a total that is partly unknown is never taken as complete. Two
 * currencies are never put together: a row has its own currency and the page adds nothing up.
 */
export function CreditsSection({ credits }: CreditsSectionProps) {
  const { t } = useTranslation();
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="min-w-0 space-y-4" data-testid="collections-credits">
      <h2 id={headingId} className="text-lg font-semibold">
        {t('reports.collections.credits.title')}
      </h2>
      <StripeBlock stripe={credits.stripe} />
      <ChannelsBlock channels={credits.channels} />
    </section>
  );
}
