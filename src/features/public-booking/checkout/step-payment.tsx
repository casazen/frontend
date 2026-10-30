import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { AlertTriangle, ArrowLeft, CalendarClock, CreditCard, Hourglass, Info, Lock, Mail, Receipt, Send, ShieldCheck, User, WifiOff } from 'lucide-react';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { useCreateDirectBooking } from '@/queries/use-public-booking';
import { ConsentCheckbox } from '@/features/public-booking/components/consent-checkbox';
import type { ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import type { CheckoutOutcomeLocationState } from '@/features/public-booking/checkout-outcome-page';
import { useBooking } from '@/features/public-booking/booking/booking-context';
import { quoteTotalCents } from '@/features/public-booking/booking/quote-helpers';
import { PaymentPanel } from '@/features/public-booking/checkout/payment-panel';
import { buildBookingPayload, type CheckoutDraft } from '@/features/public-booking/checkout/checkout-model';
import { detailsSchema } from '@/features/public-booking/checkout/details-schema';
import { formatDayMonth, formatPrice } from '@/features/public-site/stay/stay-format';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { buildCheckoutOutcomePath } from '@/lib/booking-url';
import { findPendingCheckout, savePendingCheckout, type PendingCheckout } from '@/lib/pending-checkout';
import { siteLocale } from '@/lib/site-language';
import { completeChildrenAges } from '@/lib/tourist-tax';
import type { DirectBookingResponse, PublicOrgDto } from '@/types';
import '@/features/public-booking/checkout/checkout.css';

interface StepPaymentProps {
  org: PublicOrgDto;
  orgSlug: string;
  draft: CheckoutDraft;
  onDraft: (patch: Partial<CheckoutDraft>) => void;
  ages: (number | null)[];
  onBack: () => void;
  onEditDetails: () => void;
  onEditStay: () => void;
  /** The booking, once it exists: the stay and the data are fixed until it is paid or let go. It lives in the flow, so going back and forth does not make another. */
  booking: DirectBookingResponse | null;
  onBooked: (booking: DirectBookingResponse) => void;
}

/**
 * Step 3, «Pagamento» (DB-05): the data to check, how to pay (or what happens next for a request), the consent, and one button that says
 * what it does and for how much. Pressing it makes the booking (the hold of the dates starts here) and the Payment Element of Stripe
 * appears under the same summary, in the colors of the site, with its own button; then the guest lands on the outcome page. A request
 * takes no card: it goes straight to the outcome page that says it is not confirmed.
 */
export function StepPayment({ org, orgSlug, draft, onDraft, ages, onBack, onEditDetails, onEditStay, booking, onBooked }: StepPaymentProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const model = useBooking();
  const { property, stay, quote, online, currency, hostLabel } = model;
  const createBooking = useCreateDirectBooking();
  const locale = siteLocale(i18n.language);

  // The booking is made once: a second press (a double tap, a slow connection) before the answer comes does nothing.
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // A 409 on dates this tab has already booked: the guest's own hold (A3-15), offered back instead of a dead end.
  const [ownPending, setOwnPending] = useState<PendingCheckout | null>(null);

  const ready = quote.status === 'ready' ? quote : null;
  const paymentOptions = ready?.quote.paymentOptions;
  const deferredDate = paymentOptions?.deferredPaymentAvailable === true ? paymentOptions.deferredChargeDate : null;
  const total = ready ? formatPrice(quoteTotalCents(ready.quote), currency, locale) : '';
  const request = draft.mode === 'request';
  const pay = !request && draft.pay === 'deadline' && deferredDate ? 'deadline' : 'now';
  const detailsOk = detailsSchema.safeParse(draft.details).success;
  const details = draft.details;

  // The stay changed and "Paga alla scadenza" no longer applies: the guest pays now.
  useEffect(() => {
    if (draft.pay === 'deadline' && ready && !deferredDate) onDraft({ pay: 'now' });
  }, [draft.pay, ready, deferredDate, onDraft]);

  const outcomePath = (result: DirectBookingResponse) => buildCheckoutOutcomePath(orgSlug, result.bookingId, result.checkoutToken);
  // The page that follows greets the guest by their first name and says which address the confirmation went to. Both travel in the history
  // state of this navigation, for that page only: never in the address, never stored.
  const goToOutcome = (result: DirectBookingResponse, state: CheckoutOutcomeLocationState) =>
    navigate(outcomePath(result), { state: { guestEmail: details.email.trim(), guestFirstName: details.firstName.trim(), ...state } });

  let blocked: string | null = null;
  if (!online) blocked = t('publicCheckout.offline');
  else if (!ready) blocked = quote.status === 'loading' ? t('propertyBooking.price.calculating') : t('publicCheckout.pay.fixStay');
  else if (!detailsOk) blocked = t('publicCheckout.pay.missingDetails');
  else if (!draft.consent) blocked = t('publicCheckout.pay.needConsent');
  const canSubmit = blocked === null && !createBooking.isPending;

  const submit = async () => {
    if (!canSubmit || !ready || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setOwnPending(null);
    try {
      const result = await createBooking.mutateAsync(
        buildBookingPayload({
          propertyId: property.id,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: stay.adults,
          children: stay.children,
          // The ages go only when the tax depends on them and every child has one.
          childrenAges: ready.quote.touristTax.ageRulesApply ? completeChildrenAges(ages) : undefined,
          draft: { ...draft, pay },
          marketingConsentVersion: org.marketingConsentVersion,
        }),
      );
      savePendingCheckout({
        bookingId: result.bookingId,
        token: result.checkoutToken,
        orgSlug,
        propertyId: property.id,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
      });
      // "Pay at the property" is a request waiting for the email confirmation and the host (D5): nothing to pay here.
      if (result.paymentOption === 'OnSite') {
        goToOutcome(result, {});
        return;
      }
      onBooked(result);
    } catch (failure) {
      // Every checkout error has its own message (the code of the ProblemDetails of the backend).
      setError(getProblemMessage(failure, t) ?? t('publicBooking.checkoutError'));
      if (isAxiosError(failure) && getProblemCode(failure.response?.data) === 'booking_dates_unavailable') {
        setOwnPending(findPendingCheckout(property.id, stay.checkIn, stay.checkOut));
      }
    } finally {
      inFlight.current = false;
    }
  };

  if (booking) {
    return (
      <PaymentPanel
        booking={booking}
        returnUrl={`${window.location.origin}${outcomePath(booking)}`}
        error={error}
        onError={setError}
        onSubmitted={(status: ClientPaymentStatus) => goToOutcome(booking, { clientStatus: status })}
      />
    );
  }

  const label = request
    ? t('publicCheckout.pay.ctaRequest', { host: hostLabel })
    : pay === 'deadline' && deferredDate
      ? t('publicCheckout.pay.ctaLater', { date: formatDayMonth(deferredDate, locale) })
      : t('publicCheckout.pay.ctaNow', { total });
  const after = request
    ? t('publicCheckout.pay.afterRequest', { host: hostLabel })
    : pay === 'deadline' && deferredDate
      ? t('publicCheckout.pay.afterLater', { date: formatDayMonth(deferredDate, locale), total })
      : t('publicCheckout.pay.afterNow');

  return (
    <div data-testid="checkout-step-payment">
      <section className={`co-review mb-2${detailsOk ? '' : ' is-missing'}`} aria-labelledby="co-review-title" data-testid="checkout-review">
        <span className="co-review__icon" aria-hidden="true">
          {detailsOk ? <User /> : <Info />}
        </span>
        <div className="min-w-0">
          <h2 id="co-review-title" className="mb-0.5 font-[family-name:var(--cz-public-font-body)] text-xs font-bold uppercase tracking-[0.13em] text-[var(--cz-public-muted)]">
            {t('publicCheckout.steps.step2')}
          </h2>
          <p>
            {detailsOk
              ? [`${details.firstName.trim()} ${details.lastName.trim()}`, details.email.trim(), details.phone.trim()].filter(Boolean).join(' · ')
              : t('publicCheckout.pay.missingDetails')}
          </p>
        </div>
        <button type="button" className="min-h-11 font-semibold underline underline-offset-4" onClick={onEditDetails} data-testid="checkout-edit-details">
          {detailsOk ? t('publicCheckout.pay.edit') : t('publicCheckout.pay.addDetails')}
        </button>
      </section>

      {request ? (
        <section className="co-section" aria-labelledby="co-next-title">
          <h2 id="co-next-title">{t('publicCheckout.pay.nextTitle')}</h2>
          <ol className="co-next">
            <li>
              <span className="co-next__n" aria-hidden="true">
                <Mail />
              </span>
              <div>
                <strong>{t('publicCheckout.pay.nextEmail')}</strong>
                <p>{t('publicCheckout.pay.nextEmailText')}</p>
              </div>
            </li>
            <li>
              <span className="co-next__n" aria-hidden="true">
                <Hourglass />
              </span>
              <div>
                <strong>{t('publicCheckout.pay.nextHost', { host: hostLabel })}</strong>
                <p>{t('publicCheckout.pay.nextHostText')}</p>
              </div>
            </li>
            <li>
              <span className="co-next__n" aria-hidden="true">
                <Lock />
              </span>
              <div>
                <strong>{t('publicCheckout.pay.nextPay')}</strong>
                <p>{t('publicCheckout.pay.nextPayText', { host: hostLabel, total })}</p>
              </div>
            </li>
          </ol>
        </section>
      ) : (
        <section className="co-section" aria-labelledby="co-pay-title">
          <h2 id="co-pay-title">{t('publicCheckout.pay.howTitle')}</h2>
          <ChoiceGroup legend={t('publicCheckout.pay.howTitle')} minCardWidth={14}>
            <ChoiceCard
              name="checkout-pay"
              value="now"
              checked={pay === 'now'}
              onChange={() => onDraft({ pay: 'now' })}
              icon={CreditCard}
              title={t('publicCheckout.pay.nowTitle')}
              description={t('publicCheckout.pay.nowText', { total })}
            />
            <ChoiceCard
              name="checkout-pay"
              value="deadline"
              checked={pay === 'deadline'}
              disabled={!deferredDate}
              onChange={() => onDraft({ pay: 'deadline' })}
              icon={CalendarClock}
              title={t('publicCheckout.pay.laterTitle')}
              description={
                deferredDate
                  ? t('publicCheckout.pay.laterText', { date: formatDayMonth(deferredDate, locale) })
                  : t('publicCheckout.pay.laterUnavailable')
              }
            />
          </ChoiceGroup>
        </section>
      )}

      <section className="co-section" aria-label={t('publicCheckout.pay.consentTitle')}>
        <ConsentCheckbox checked={draft.consent} onCheckedChange={(consent) => onDraft({ consent })} orgSlug={orgSlug} />
      </section>

      {error ? (
        <div className="co-issue mb-5" role="alert" data-testid="checkout-error-box">
          <p className="co-issue__title">
            <AlertTriangle aria-hidden />
            <span data-testid="checkout-error">{error}</span>
          </p>
          <div className="co-issue__actions">
            <button type="button" className="min-h-11 font-semibold underline underline-offset-4" onClick={onEditStay}>
              {t('publicCheckout.pay.otherDates')}
            </button>
            {ownPending ? (
              <Link
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                to={buildCheckoutOutcomePath(ownPending.orgSlug, ownPending.bookingId, ownPending.token)}
                data-testid="checkout-resume-own-booking"
              >
                {t('publicBooking.outcome.resumeOwnBookingAction')}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="co-submit">
        <button
          type="button"
          className="public-site-cta co-cta border-0"
          aria-disabled={!canSubmit || undefined}
          aria-describedby="co-pay-after"
          aria-busy={createBooking.isPending || undefined}
          onClick={() => void submit()}
          data-testid="checkout-submit"
        >
          {request ? <Send aria-hidden /> : <Lock aria-hidden />}
          <span>{createBooking.isPending ? t('publicBooking.preparingPayment') : label}</span>
        </button>
        <p className="co-submit__after" id="co-pay-after" role="status">
          {!online ? <WifiOff aria-hidden /> : <Info aria-hidden />}
          <span>{blocked ?? after}</span>
        </p>
      </div>

      <ul className="co-trust" aria-label={t('publicCheckout.pay.trustTitle')}>
        {request ? (
          <li>
            <ShieldCheck aria-hidden />
            <span>{t('publicCheckout.pay.trustRequest', { host: hostLabel })}</span>
          </li>
        ) : (
          <>
            <li>
              <ShieldCheck aria-hidden />
              <span>{t('publicCheckout.pay.trustStripe')}</span>
            </li>
            <li>
              <Lock aria-hidden />
              <span>{t('publicCheckout.pay.trustCard', { name: org.displayName })}</span>
            </li>
          </>
        )}
        {ready?.quote.touristTax.status === 'Calculated' ? (
          <li>
            <Receipt aria-hidden />
            <span>{t('publicCheckout.pay.trustNoHidden', { total })}</span>
          </li>
        ) : null}
      </ul>

      <button type="button" className="co-backlink" onClick={onBack} data-testid="checkout-back">
        <ArrowLeft aria-hidden />
        <span>{t('publicCheckout.pay.back')}</span>
      </button>
    </div>
  );
}
