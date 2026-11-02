import { useTranslation } from 'react-i18next';
import { formatRomeDateTime } from '@/lib/stay-dates';
import type { ServiceRequestQuote } from '@/types/service-request';
import { formatMoney } from '../services/lib/service-money';
import { requestWhen } from './request-model';

const T = 'supplier.requests.quote.summary';

/**
 * The quote as the customer reads it, to read and not to change (SP-04b): the lines and the total, the time (the request's own, or the
 * other one the quote offers, which is not held), the note, when it was sent and until when the customer can answer. It says what the
 * server says: the total is the one it added up. The host and the customer of the showcase reuse it for their answer (SR-08, LR-08, SP-12c).
 */
export function QuoteSummary({ quote, showcase }: { quote: ServiceRequestQuote; showcase: boolean }) {
  const { t, i18n } = useTranslation();
  const money = (cents: number) => formatMoney(cents, i18n.language);
  const other = quote.scheduledStart && quote.scheduledEnd ? requestWhen({ scheduledStart: quote.scheduledStart, scheduledEnd: quote.scheduledEnd }, i18n.language) : null;
  const otherText = other ? [other.day, other.time].filter(Boolean).join(', ') : null;

  return (
    <div className="space-y-3" data-testid="supplier-request-quote">
      <ul role="list" className="divide-y rounded-lg bg-background ring-1 ring-inset ring-border" aria-label={t(`${T}.lines`)}>
        {quote.lines.map((line, index) => (
          <li key={`${index}-${line.label}`} className="flex items-baseline justify-between gap-3 px-3 py-2" data-testid="supplier-request-quote-line">
            <span className="min-w-0 break-words">{line.label}</span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">{money(line.amountCents)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 px-3 py-2 font-semibold">
          <span>{t(`${T}.total`)}</span>
          <span className="whitespace-nowrap tabular-nums" data-testid="supplier-request-quote-total">
            {money(quote.totalCents)}
          </span>
        </li>
      </ul>

      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-foreground/70">{t(`${T}.when`)}</dt>
        <dd className="min-w-0 break-words font-medium" data-testid="supplier-request-quote-when">
          {otherText ? t(`${T}.otherTime`, { when: otherText }) : t(`${T}.sameTime`)}
        </dd>
        {quote.note ? (
          <>
            <dt className="text-foreground/70">{t(`${T}.note`)}</dt>
            <dd className="min-w-0 whitespace-pre-line break-words font-medium">{quote.note}</dd>
          </>
        ) : null}
        <dt className="text-foreground/70">{t(`${T}.sentAt`)}</dt>
        <dd className="min-w-0 break-words font-medium">{formatRomeDateTime(quote.sentAt, i18n.language)}</dd>
        <dt className="text-foreground/70">{t(`${T}.answer`)}</dt>
        <dd className="min-w-0 break-words font-medium" data-testid="supplier-request-quote-deadline">
          {quote.answerBy
            ? t(`${T}.answerBy`, { when: formatRomeDateTime(quote.answerBy, i18n.language) })
            : t(showcase ? `${T}.answerNoDate` : `${T}.answerHost`)}
        </dd>
      </dl>
    </div>
  );
}
