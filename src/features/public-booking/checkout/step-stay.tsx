import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronDown, Mail, MessageSquare, Moon, Pencil, ShieldCheck, Zap } from 'lucide-react';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { ChildrenAgesFields } from '@/features/tourist-tax/components/children-ages-fields';
import { GuestsPicker } from '@/features/public-site/stay/guests-picker';
import { StaySheet } from '@/features/public-site/stay/stay-sheet';
import { formatDayLong, formatDayMonth } from '@/features/public-site/stay/stay-format';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { StayProblem } from '@/features/public-booking/booking/stay-problem';
import { SPECIAL_REQUESTS_MAX, type CheckoutDraft } from '@/features/public-booking/checkout/checkout-model';
import { siteLocale } from '@/lib/site-language';
import { cn } from '@/lib/utils';
import '@/features/public-booking/checkout/checkout.css';

interface StepStayProps {
  draft: CheckoutDraft;
  onDraft: (patch: Partial<CheckoutDraft>) => void;
  /** One slot per child, as many as the stay has. */
  ages: (number | null)[];
  onNext: () => void;
}

/**
 * Step 1, «Il soggiorno» (DB-05): the dates and the guests of the stay (the same pickers as the property page, the stay in the
 * address), the age of each child when the tourist tax depends on it, how the guest wants to book, and a note for the host. One
 * decision here, one button: «Continua». What is wrong with the stay is said with its way out (`StayProblem`).
 */
export function StepStay({ draft, onDraft, ages, onNext }: StepStayProps) {
  const { t, i18n } = useTranslation();
  const model = useBooking();
  const { stay, setStay, calendar, property, petsAllowed, quote, nights, online, hostLabel } = model;
  const locale = siteLocale(i18n.language);
  const [datesOpen, setDatesOpen] = useState(false);

  const ageRulesApply = quote.status === 'ready' && quote.quote.touristTax.ageRulesApply;
  const askAges = stay.children > 0 && (ageRulesApply || ages.some((age) => age !== null));
  const agesMissing = askAges && ages.some((age) => age === null);
  const value = { checkIn: stay.checkIn, checkOut: stay.checkOut, adults: stay.adults, children: stay.children, pets: stay.pets };

  // Why the button waits, in words: the guest is never left with a button that does nothing and no reason.
  let waiting: string | null = null;
  if (!online) waiting = t('publicCheckout.offline');
  else if (quote.status === 'none') waiting = t('publicCheckout.stay.chooseDates');
  else if (quote.status === 'loading') waiting = t('propertyBooking.price.calculating');
  else if (quote.status === 'error') waiting = quote.message;
  else if (quote.status === 'problem') waiting = t('publicCheckout.stay.fixStay');
  else if (agesMissing) waiting = t('publicBooking.childrenAgesMissing');
  const ready = waiting === null;

  return (
    <div data-testid="checkout-step-stay">
      <section className="co-section" aria-labelledby="co-dates-title">
        <h2 id="co-dates-title">{t('publicCheckout.stay.datesTitle')}</h2>
        <StaySheet
          section="dates"
          open={datesOpen}
          onOpenChange={setDatesOpen}
          trigger={
            <button
              type="button"
              className="co-dates"
              aria-haspopup="dialog"
              aria-label={
                stay.checkIn && stay.checkOut
                  ? t('publicCheckout.stay.editDatesLabel', { checkIn: formatDayLong(stay.checkIn, locale), checkOut: formatDayLong(stay.checkOut, locale) })
                  : t('publicCheckout.stay.chooseDatesLabel')
              }
              data-testid="checkout-dates"
            >
              <span className="co-dates__part">
                <span className="co-dates__k">{t('propertyBooking.fields.arrival')}</span>
                <span className="co-dates__v">{stay.checkIn ? formatDayMonth(stay.checkIn, locale) : t('propertyBooking.fields.add')}</span>
                {property.checkInFrom ? <span className="co-dates__s">{t('publicCheckout.stay.from', { time: property.checkInFrom.slice(0, 5) })}</span> : null}
              </span>
              <span className="co-dates__arrow" aria-hidden="true">
                <ArrowRight />
              </span>
              <span className="co-dates__part">
                <span className="co-dates__k">{t('propertyBooking.fields.departure')}</span>
                <span className="co-dates__v">{stay.checkOut ? formatDayMonth(stay.checkOut, locale) : t('propertyBooking.fields.add')}</span>
                {property.checkOutBy ? <span className="co-dates__s">{t('publicCheckout.stay.by', { time: property.checkOutBy.slice(0, 5) })}</span> : null}
              </span>
              <span className="co-dates__edit" aria-hidden="true">
                <Pencil />
                <span>{t('publicCheckout.stay.edit')}</span>
              </span>
            </button>
          }
          value={value}
          onChange={setStay}
          calendar={calendar}
          maxGuests={property.maxGuests}
          petsAllowed={petsAllowed}
          title={t('propertyBooking.fields.datesTitle')}
        />
        {nights > 0 ? (
          <p className="co-note">
            <Moon aria-hidden />
            <span>
              {t('publicCheckout.summary.nights', { count: nights })}
              {property.minNights && property.minNights > 1 ? ` · ${t('propertyBooking.availability.minNights', { count: property.minNights })}` : ''}
            </span>
          </p>
        ) : null}
        <div role="status" aria-live="polite" className="mt-3.5">
          {quote.status === 'problem' ? <StayProblem problem={quote} /> : null}
        </div>
      </section>

      <section className="co-section" aria-labelledby="co-guests-title">
        <h2 id="co-guests-title">{t('publicCheckout.stay.guestsTitle')}</h2>
        <GuestsPicker value={stay} onChange={setStay} maxGuests={property.maxGuests} petsAllowed={petsAllowed} />
        {askAges ? (
          <div className="mt-3">
            <ChildrenAgesFields ages={ages} onChange={(next) => onDraft({ childrenAges: next })} idPrefix="checkout" showMissing />
          </div>
        ) : null}
      </section>

      <section className="co-section" aria-labelledby="co-mode-title">
        <h2 id="co-mode-title">{t('publicCheckout.stay.modeTitle')}</h2>
        <ChoiceGroup legend={t('publicCheckout.stay.modeTitle')} minCardWidth={14}>
          <ChoiceCard
            name="checkout-mode"
            value="instant"
            checked={draft.mode === 'instant'}
            onChange={() => onDraft({ mode: 'instant' })}
            icon={Zap}
            title={t('publicCheckout.stay.instant.title')}
            description={t('publicCheckout.stay.instant.text')}
          />
          <ChoiceCard
            name="checkout-mode"
            value="request"
            checked={draft.mode === 'request'}
            onChange={() => onDraft({ mode: 'request' })}
            icon={Mail}
            title={t('publicCheckout.stay.request.title')}
            description={t('publicCheckout.stay.request.text', { host: hostLabel })}
          />
        </ChoiceGroup>
      </section>

      <section className="co-section">
        <details open={draft.requests !== ''} className="group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 font-bold [&::-webkit-details-marker]:hidden">
            <MessageSquare className="h-5 w-5 shrink-0 text-[var(--cz-public-ink)]" aria-hidden />
            <span>
              {t('publicCheckout.stay.requestsTitle', { host: hostLabel })}{' '}
              <span className="font-medium text-[var(--cz-public-muted)]">{t('publicCheckout.optional')}</span>
            </span>
            <ChevronDown className="ml-auto h-[18px] w-[18px] shrink-0 text-[var(--cz-public-muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <div className="pt-1">
            <Field
              label={t('publicCheckout.stay.requestsLabel')}
              hint={t('publicCheckout.stay.requestsHint', { host: hostLabel })}
              counter={`${draft.requests.length}/${SPECIAL_REQUESTS_MAX}`}
            >
              <Textarea
                rows={3}
                maxLength={SPECIAL_REQUESTS_MAX}
                value={draft.requests}
                onChange={(event) => onDraft({ requests: event.target.value })}
                placeholder={t('publicCheckout.stay.requestsPlaceholder')}
                data-testid="checkout-requests"
              />
            </Field>
          </div>
        </details>
      </section>

      <div className="co-submit">
        <button
          type="button"
          className={cn('public-site-cta co-cta border-0')}
          aria-disabled={!ready || undefined}
          aria-describedby={waiting ? 'co-next-reason' : undefined}
          onClick={() => {
            if (ready) onNext();
          }}
          data-testid="checkout-next"
        >
          <span>{t('publicCheckout.stay.next')}</span>
          <ArrowRight aria-hidden />
        </button>
        <p className="co-submit__after" id="co-next-reason" role="status">
          <ShieldCheck aria-hidden />
          <span>{waiting ?? t('publicCheckout.payNothingYet')}</span>
        </p>
      </div>
    </div>
  );
}
