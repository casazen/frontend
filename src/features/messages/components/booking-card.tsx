import { useState } from 'react';
import { ChevronDown, ExternalLink, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FROM_DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { getBookingSourceLabel, getBookingStatusLabel } from '@/lib/i18n-labels';
import { formatStayDate, nightsBetween } from '@/lib/stay-dates';
import { cn, formatCurrency } from '@/lib/utils';
import type { BookingStatus, MessageBookingAmounts, MessageBookingCard } from '@/types';

const STATUS_VARIANT: Record<BookingStatus, BadgeProps['variant']> = {
  Pending: 'warning',
  Confirmed: 'success',
  CheckedIn: 'secondary',
  CheckedOut: 'secondary',
  Cancelled: 'destructive',
};

const STAY_DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** The five figures in simple words, in the order the host reads them; a figure the card does not have is left out, never shown as zero. */
const AMOUNTS: ReadonlyArray<{ field: keyof MessageBookingAmounts; labelKey: string }> = [
  { field: 'total', labelKey: 'messages.bookingCard.total' },
  { field: 'commission', labelKey: 'messages.bookingCard.commission' },
  { field: 'net', labelKey: 'messages.bookingCard.net' },
  { field: 'paid', labelKey: 'messages.bookingCard.paid' },
  { field: 'balance', labelKey: 'messages.bookingCard.balance' },
];

interface BookingCardProps {
  card: MessageBookingCard;
  /** The address of the page of the guest; `null` hides the link (the page is not there for this user). */
  profilePath: string | null;
  /** The address of the booking; `null` hides the link. */
  bookingPath: string | null;
}

/**
 * The booking beside a conversation (NF-61, ADR-032-R8): its code and state in words, the guest, the days of the stay, the people, where it
 * came from and, for who may read payments, the amounts in simple words (total, commission of the channel, what is left for the host, what
 * was paid, what is still to pay); a figure the channel has not given is left out, and when none is there it says so. The links lead to
 * the booking and to the guest. From a wide screen it is always open, beside the conversation; on a phone it is one line that opens, so
 * the conversation keeps the room.
 */
export function BookingCard({ card, profilePath, bookingPath }: BookingCardProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const beside = useMediaQuery(FROM_DESKTOP_QUERY);
  const [expanded, setExpanded] = useState(false);
  const open = beside || expanded;
  const money = (amount: number) => formatCurrency(amount, card.currency || 'EUR', locale === 'it' ? 'it-IT' : 'en-GB');
  const nights = nightsBetween(card.checkInDate, card.checkOutDate);
  const figures = AMOUNTS.filter(({ field }) => typeof card.amounts?.[field] === 'number');
  const source = card.source === 'OtherChannel' && card.channelLabel ? card.channelLabel : getBookingSourceLabel(card.source, t);
  const stay = `${formatStayDate(card.checkInDate, locale, STAY_DAY)} – ${formatStayDate(card.checkOutDate, locale, STAY_DAY)}`;

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4" aria-label={t('messages.bookingCard.title')} data-testid="booking-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('messages.bookingCard.title')}</h2>
          <p className="break-words font-semibold" data-testid="booking-card-code">
            {card.bookingCode}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[card.status] ?? 'secondary'} data-testid="booking-card-status">
          {getBookingStatusLabel(card.status, t)}
        </Badge>
      </div>

      {!beside ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 w-full justify-between"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          data-testid="booking-card-toggle"
        >
          <span className="min-w-0 truncate text-left">{`${card.guestName} · ${stay}`}</span>
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
          <span className="sr-only">{t(expanded ? 'messages.bookingCard.hide' : 'messages.bookingCard.show')}</span>
        </Button>
      ) : null}

      {open ? (
        <div className="space-y-3" data-testid="booking-card-details">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="sr-only">{t('messages.bookingCard.guest')}</dt>
              <dd className="font-medium">{card.guestName}</dd>
            </div>
            <div>
              <dt className="sr-only">{t('messages.bookingCard.stay')}</dt>
              <dd>
                {stay}
                {nights > 0 ? <span className="text-muted-foreground">{` · ${t('messages.bookingCard.nights', { count: nights })}`}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t('messages.bookingCard.people')}</dt>
              <dd>
                {t('messages.bookingCard.guests', { count: card.guests })}
                {card.children > 0 ? <span className="text-muted-foreground">{` · ${t('messages.bookingCard.children', { count: card.children })}`}</span> : null}
              </dd>
            </div>
            <div className="text-muted-foreground">
              <dt className="sr-only">{t('messages.bookingCard.sourceLabel')}</dt>
              <dd>{t('messages.bookingCard.source', { source })}</dd>
            </div>
          </dl>

          {card.amounts ? (
            figures.length > 0 ? (
              <dl className="space-y-1 border-t pt-3 text-sm" data-testid="booking-card-amounts">
                {figures.map(({ field, labelKey }) => (
                  <div key={field} className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">{t(labelKey)}</dt>
                    <dd className="font-medium tabular-nums">{money(card.amounts?.[field] as number)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="border-t pt-3 text-sm text-muted-foreground" data-testid="booking-card-no-amounts">
                {t('messages.bookingCard.noAmounts')}
              </p>
            )
          ) : null}

          <div className="flex flex-wrap gap-2">
            {bookingPath ? (
              <Button asChild variant="outline" size="sm">
                <Link to={bookingPath} data-testid="booking-card-open">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  {t('messages.bookingCard.open')}
                </Link>
              </Button>
            ) : null}
            {profilePath ? (
              <Button asChild variant="outline" size="sm">
                <Link to={profilePath} data-testid="booking-card-profile">
                  <UserRound className="size-4" aria-hidden="true" />
                  {t('messages.bookingCard.openProfile')}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
