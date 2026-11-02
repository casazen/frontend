import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { formatPrice } from '@/features/public-site/stay/stay-format';
import { siteLocale } from '@/lib/site-language';
import type { DirectBookingQuote, QuoteLine } from '@/types';
import '@/features/public-booking/booking/booking.css';

interface PriceLinesProps {
  quote: DirectBookingQuote;
  /** The tax was worked out for the oldest age of a minor because the ages are not asked yet: it is called an estimate, and says so. */
  estimatedTax: boolean;
  /** The quote shown is the one of the previous stay while the new one comes: dimmed, and never offered for booking. */
  stale?: boolean;
  idPrefix?: string;
}

/** The tax a quote could not work out, as a note under the lines: the words are the ones the checkout always used. */
function MissingTaxNote({ quote }: { quote: DirectBookingQuote }) {
  const { t } = useTranslation();
  const status = quote.touristTax.status;
  if (status === 'Calculated') return null;
  const unavailable = status === 'RateUnavailable' || status === 'CategoryRequired' || status === 'NightlyPriceRequired';
  return (
    <div className="pp-line" data-testid="tourist-tax-line">
      <dt>{t('publicBooking.tassaSoggiorno')}</dt>
      <dd className="text-right text-[var(--cz-public-muted)]">
        {unavailable ? t('publicBooking.touristTaxUnavailable') : t('publicBooking.touristTaxAgesRequired')}
      </dd>
    </div>
  );
}

/** The `lines` of a quote as the server sends them, or those of its older numbers when the backend does not send lines yet. */
function linesOf(quote: DirectBookingQuote): QuoteLine[] {
  if (quote.lines && quote.lines.length > 0) return quote.lines;
  const cents = (amount: number) => Math.round(amount * 100);
  const lines: QuoteLine[] = [
    { kind: 'Nights', quantity: quote.nights, unitAmountCents: cents(quote.nightlyRate), amountCents: cents(quote.lodgingTotal) },
  ];
  if (quote.cleaningFee > 0) lines.push({ kind: 'CleaningFee', quantity: 1, unitAmountCents: cents(quote.cleaningFee), amountCents: cents(quote.cleaningFee) });
  if (quote.touristTax.status === 'Calculated' && quote.touristTax.amount !== null) {
    lines.push({ kind: 'TouristTax', quantity: null, unitAmountCents: null, amountCents: cents(quote.touristTax.amount) });
  }
  lines.push({ kind: 'Total', quantity: null, unitAmountCents: null, amountCents: cents(quote.totalPrice) });
  return lines;
}

/**
 * The price of a stay in lines (DB-04b), the lines of the quote of the server, in order, ending with the total: the nights (the
 * ordinary ones and, when the home asks more for them, the weekend ones), the cleaning, the tourist tax with its explanation and the
 * total. Nothing is added up here: the total is the one the server sends, and so the one the checkout charges.
 */
export function PriceLines({ quote, estimatedTax, stale = false, idPrefix }: PriceLinesProps) {
  const { t, i18n } = useTranslation();
  const uid = useId();
  const [taxOpen, setTaxOpen] = useState(false);
  const locale = siteLocale(i18n.language);
  const money = (cents: number) => formatPrice(cents, quote.currency || 'EUR', locale);
  const noteId = `${idPrefix ?? uid}-tax-note`;

  const label = (line: QuoteLine): string => {
    switch (line.kind) {
      case 'Nights':
        return t('propertyBooking.lines.nights', { count: line.quantity ?? 1, price: money(line.unitAmountCents ?? 0) });
      case 'WeekendNights':
        return t('propertyBooking.lines.weekendNights', { count: line.quantity ?? 1, price: money(line.unitAmountCents ?? 0) });
      case 'CleaningFee':
        return t('publicBooking.pulizia');
      case 'TouristTax':
        return estimatedTax ? t('propertyBooking.lines.touristTaxEstimated') : t('propertyBooking.lines.touristTax');
      case 'Discount':
        return t('propertyBooking.lines.discount');
      case 'Total':
        return t('publicBooking.totale');
    }
  };

  const lines = linesOf(quote);

  return (
    <div className="space-y-3" data-testid="price-breakdown">
      <dl className="pp-lines" data-stale={stale || undefined} aria-label={t('publicBooking.priceBreakdownTitle')}>
        {lines.map((line, index) => {
          if (line.kind === 'Total') {
            return (
              <div key={`${line.kind}-${index}`} className="pp-line pp-line--total">
                <dt>{label(line)}</dt>
                <dd data-testid="price-breakdown-total">{money(line.amountCents)}</dd>
              </div>
            );
          }
          return (
            <div key={`${line.kind}-${index}`} className="pp-line" data-testid={line.kind === 'TouristTax' ? 'tourist-tax-line' : undefined}>
              <dt>
                {label(line)}
                {line.kind === 'TouristTax' ? (
                  <button
                    type="button"
                    className="pp-tax"
                    aria-expanded={taxOpen}
                    aria-controls={noteId}
                    onClick={() => setTaxOpen((open) => !open)}
                  >
                    <Info aria-hidden />
                    <span className="sr-only">{t('propertyBooking.lines.touristTaxWhat')}</span>
                  </button>
                ) : null}
              </dt>
              <dd>{money(line.amountCents)}</dd>
            </div>
          );
        })}
        {quote.touristTax.status !== 'Calculated' && !lines.some((line) => line.kind === 'TouristTax') ? <MissingTaxNote quote={quote} /> : null}
      </dl>
      {taxOpen ? (
        <p className="pp-taxnote" id={noteId}>
          {t('propertyBooking.lines.touristTaxHelp')}
          {estimatedTax ? ` ${t('propertyBooking.lines.touristTaxEstimateHelp')}` : ''}
        </p>
      ) : null}
    </div>
  );
}
