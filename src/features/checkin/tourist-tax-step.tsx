import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { nextPollDelay, type ClientPaymentStatus } from '@/features/public-booking/checkout-outcome';
import { StripeIntentPayment } from '@/features/public-booking/components/stripe-intent-payment';
import { getHttpStatus } from '@/lib/api-errors';
import { useCreateTouristTaxPaymentIntent } from '@/queries/use-checkin';
import type { PublicTouristTax } from '@/types/public-checkin.types';
import {
  TOURIST_TAX_IN_PROGRESS_CODE,
  TOURIST_TAX_MAX_POLLS,
  blocksNextStep,
  formatTaxMoney,
  guestTaxOutlook,
  hasTaxCurrency,
  isShownOnCompletedCheckIn,
  moneyLocaleOf,
  paymentElementLocaleOf,
  paymentReturnUrlOf,
  problemCodeOf,
  refusalLeavesPaymentOpen,
  type GuestTaxOutlook,
} from './lib/tourist-tax-model';

type Money = (amount: number) => string;

/** What a new read of the tax answers (`refetch` of the query): the tax as the server says it now, or the failure of the read. */
interface TaxRead {
  data?: PublicTouristTax;
  isError?: boolean;
}

interface TouristTaxStepProps {
  /** The check-in link: the only access check of the page. */
  token: string;
  /** What the API says now; `null` when it could not be read (the step says so and offers to try again). */
  view: PublicTouristTax | null;
  /** Reads the tax again: after a payment the state comes from the server, never from the browser's own result. The answer says what the server says now. */
  refetch: () => Promise<TaxRead | undefined>;
  /** A read is under way. */
  fetching: boolean;
  /**
   * Under the card of a check-in that is already completed (the server lets a completed check-in still pay its tax): the card says only what can still be paid and what was paid,
   * and there is no step to leave.
   */
  completed?: boolean;
  /** Told when the guest's confirmation of the payment starts and ends: the page holds its own buttons («Indietro», «Avanti») while the money moves. */
  onPayingChange?: (paying: boolean) => void;
}

/** The tax of each guest by position (no name, never why one is exempt) and what is paid now: the figures are the API's, nothing is added up or taken away here. */
function TaxFigures({ view, money }: { view: PublicTouristTax; money: Money }) {
  const { t } = useTranslation();
  // The tax of the stay differs from what can be paid now when the price of the booking already included a part of it: both figures are said, the page works out neither.
  const partIncluded = view.amountDue !== null && view.amountDue !== view.payable;

  return (
    <div className="space-y-3" data-testid="tourist-tax-figures">
      {view.guests.length > 0 && (
        <ul className="divide-y rounded-md border text-sm" data-testid="tourist-tax-lines">
          {view.guests.map((guest) => (
            <li key={guest.position} className="flex items-baseline justify-between gap-3 px-3 py-2" data-testid={`tourist-tax-line-${guest.position}`}>
              <span>
                {guest.exempt
                  ? t('checkin.guestHeading', { index: guest.position + 1 })
                  : t('checkin.touristTax.guestLine', { index: guest.position + 1, count: guest.taxableNights })}
              </span>
              <span className="tabular-nums" data-testid={`tourist-tax-line-${guest.position}-amount`}>
                {guest.exempt ? t('checkin.touristTax.exempt') : guest.amount === null ? '' : money(guest.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <dl className="space-y-1 text-sm">
        {partIncluded && view.amountDue !== null && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t('checkin.touristTax.amountDue')}</dt>
            <dd className="tabular-nums" data-testid="tourist-tax-amount-due">
              {money(view.amountDue)}
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 font-semibold">
          <dt>{partIncluded ? t('checkin.touristTax.payNowLabel') : t('checkin.touristTax.total')}</dt>
          <dd className="tabular-nums" data-testid="tourist-tax-total">
            {money(view.payable)}
          </dd>
        </div>
      </dl>
      {partIncluded && <p className="text-sm text-muted-foreground">{t('checkin.touristTax.partIncluded')}</p>}
      {!hasTaxCurrency(view.currency) && (
        <p className="text-sm text-muted-foreground" data-testid="tourist-tax-currency-missing">
          {t('checkin.touristTax.currencyMissing')}
        </p>
      )}
    </div>
  );
}

interface PaymentAreaProps {
  token: string;
  view: PublicTouristTax;
  refetch: () => Promise<TaxRead | undefined>;
  fetching: boolean;
  onPayingChange?: (paying: boolean) => void;
}

/**
 * The payment of what the API says can be paid now: the PaymentIntent of the stay on the organization's account (asked once for each amount: the same call again gives the same
 * intent), the Payment Element, and what follows a payment. «Pagata» is never said because the browser got a result: after a confirmation the page says the payment is being
 * confirmed and reads the tax again, with backoff, until the server (which learns it from the payment provider) says it is paid. While a payment is under way the form is not shown,
 * so the guest cannot pay twice. An outcome the page cannot be sure of (a refusal that leaves the payment open, a payment not confirmed for long, an intent that could not be had) is
 * settled with the server (`settle`): the tax is read again and only a tax that still has something to pay asks for the intent once more.
 */
function PaymentArea({ token, view, refetch, fetching, onPayingChange }: PaymentAreaProps) {
  const { t, i18n } = useTranslation();
  const intent = useCreateTouristTaxPaymentIntent(token);
  const { mutate } = intent;
  const [clientStatus, setClientStatus] = useState<ClientPaymentStatus | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The server is being asked again: the buttons wait, and a second ask does not start while one is under way.
  const [checking, setChecking] = useState(false);
  const settling = useRef(false);
  const failure = intent.error;
  // A payment is under way when the guest confirmed one, or the server says one of the stay is (another tab, a method that redirected the guest and brought them back).
  const awaiting = clientStatus === 'succeeded' || clientStatus === 'processing' || problemCodeOf(failure) === TOURIST_TAX_IN_PROGRESS_CODE;
  const stopped = awaiting && attempt >= TOURIST_TAX_MAX_POLLS;

  // The intent is asked for once for each amount the server says can be paid now (a different amount is a new intent: the server cancels the old one).
  const asked = useRef<string | null>(null);
  const amountKey = `${view.payable}|${view.currency}`;
  useEffect(() => {
    if (awaiting || asked.current === amountKey) return;
    asked.current = amountKey;
    mutate();
  }, [awaiting, amountKey, mutate]);

  /**
   * Back to what the server says after an outcome the page cannot be sure of. The tax is read first: when the server now says nothing is left to pay (paid online, paid at the property, a
   * payment recorded since) or the read failed, no intent is asked for (never a second charge: the page does not offer a form for a stay that is paid). Otherwise the intent is asked for
   * again: the server answers 409 while a payment of the stay is under way (the page then waits for it), and gives a valid intent when none is (the payment that went wrong gives the form
   * back). `clientStatus` goes only when the server gave an intent, so «in conferma» stays up for as long as a payment may be moving.
   */
  const settle = useCallback(async () => {
    if (settling.current) return;
    settling.current = true;
    setChecking(true);
    try {
      const read = await refetch();
      if (read?.isError || (read?.data !== undefined && read.data.payable <= 0)) return;
      mutate(undefined, {
        onSuccess: () => {
          setClientStatus(null);
          setAttempt(0);
        },
      });
    } finally {
      settling.current = false;
      setChecking(false);
    }
  }, [mutate, refetch]);

  // A 404 or a 409 says the tax moved (the payment is not offered any more or the link is gone, nothing left to pay, one is under way): the page reads it again and shows what it says.
  useEffect(() => {
    const status = failure === null ? undefined : getHttpStatus(failure);
    if (status === 404 || status === 409) void refetch();
  }, [failure, refetch]);

  // Backoff while the server has not recorded the payment yet; after a number of reads the guest is offered «Aggiorna lo stato» instead of waiting for ever. The last read also asks for the
  // intent again (`settle`): a payment that went wrong after «in conferma» gives the form back, one that is still under way answers 409.
  useEffect(() => {
    if (!awaiting || stopped || fetching) return undefined;
    const timer = window.setTimeout(() => {
      setAttempt((current) => current + 1);
      if (attempt + 1 >= TOURIST_TAX_MAX_POLLS) void settle();
      else void refetch();
    }, nextPollDelay(attempt));
    return () => window.clearTimeout(timer);
  }, [awaiting, stopped, fetching, attempt, refetch, settle]);

  if (awaiting) {
    return (
      <div className="space-y-3" data-testid="tourist-tax-processing">
        <Alert variant="info" title={stopped ? t('checkin.touristTax.stalledTitle') : t('checkin.touristTax.processingTitle')}>
          {stopped ? t('checkin.touristTax.stalledText') : t('checkin.touristTax.processingText')}
        </Alert>
        {stopped && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fetching || checking}
            onClick={() => {
              setAttempt(0);
              void settle();
            }}
            data-testid="tourist-tax-refresh"
          >
            {t('checkin.touristTax.refresh')}
          </Button>
        )}
      </div>
    );
  }

  if (intent.isError) {
    return (
      <div className="space-y-2" data-testid="tourist-tax-session-failed">
        <p role="alert" className="text-sm text-destructive">
          {t('checkin.touristTax.sessionFailed')}
        </p>
        <Button type="button" variant="outline" size="sm" disabled={checking} onClick={() => void settle()} data-testid="tourist-tax-retry">
          {t('checkin.touristTax.retry')}
        </Button>
      </div>
    );
  }

  const session = intent.data;
  if (!session) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="tourist-tax-preparing">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('checkin.touristTax.preparing')}
      </p>
    );
  }

  // What the button says is what will be charged: the amount and the currency of the intent, as the server made it.
  const charged = formatTaxMoney(session.amount, session.currency, moneyLocaleOf(i18n.language));
  const elementLocale = paymentElementLocaleOf(i18n.language);
  return (
    <div className="space-y-3" data-testid="tourist-tax-payment">
      {paymentError && (
        <p role="alert" className="text-sm text-destructive" data-testid="tourist-tax-payment-error">
          {paymentError}
        </p>
      )}
      <StripeIntentPayment
        // A new intent (another amount) or another language is a new element: the secret and the language of an element cannot change.
        key={`${session.paymentIntentId || session.clientSecret}:${elementLocale}`}
        mode="payment"
        publishableKey={session.publishableKey}
        // The intent is on the connected account of the organization: Stripe.js is opened with it.
        stripeAccountId={session.stripeAccountId}
        clientSecret={session.clientSecret}
        locale={elementLocale}
        returnUrl={paymentReturnUrlOf(window.location)}
        submitLabel={t('checkin.touristTax.payAmount', { amount: charged })}
        busyLabel={t('checkin.touristTax.paying')}
        onProcessingChange={onPayingChange}
        onSubmitted={(status) => {
          setPaymentError(status === 'failed' ? t('checkin.touristTax.paymentFailed') : null);
          setClientStatus(status);
        }}
        onError={setPaymentError}
        // A declined card leaves the intent as it was; any other refusal may leave the server in another state (cancelled by the host, paid with the answer lost): it is asked.
        onRefusal={(refusal) => {
          if (refusalLeavesPaymentOpen(refusal)) void settle();
        }}
      />
    </div>
  );
}

/** One sentence for a tax that needs nothing from the guest here (the outlooks that are not «payable»), and the confirmation of one that was paid. */
function OutcomeNotice({ outlook, view, money }: { outlook: Exclude<GuestTaxOutlook, 'payable'>; view: PublicTouristTax; money: Money }) {
  const { t } = useTranslation();

  if (outlook === 'paid') {
    return (
      <Alert variant="success" title={t('checkin.touristTax.paidTitle')} data-testid="tourist-tax-paid">
        {t('checkin.touristTax.paidText', { amount: money(view.collectedAmount) })}
      </Alert>
    );
  }

  const sentence: Record<Exclude<GuestTaxOutlook, 'payable' | 'paid'>, string> = {
    paidPartly: t('checkin.touristTax.paidPartly', { amount: money(view.collectedAmount) }),
    atProperty: t('checkin.touristTax.atProperty'),
    paidAtProperty: t('checkin.touristTax.paidAtProperty'),
    channelCollects: t('checkin.touristTax.channelCollects'),
    included: t('checkin.touristTax.included'),
    nothingDue: t('checkin.touristTax.nothingDue'),
    hostWillTell: t('checkin.touristTax.hostWillTell'),
  };
  return (
    <Alert variant="info" data-testid={`tourist-tax-${outlook}`}>
      {sentence[outlook]}
    </Alert>
  );
}

function TouristTaxContent({ token, view, refetch, fetching, completed = false, onPayingChange }: TouristTaxStepProps & { view: PublicTouristTax }) {
  const { t, i18n } = useTranslation();
  const money: Money = (amount) => formatTaxMoney(amount, view.currency, moneyLocaleOf(i18n.language));
  const outlook = guestTaxOutlook(view);
  if (completed && !isShownOnCompletedCheckIn(outlook)) return null;

  return (
    <div className="space-y-4" data-testid="checkin-tourist-tax-step" data-outlook={outlook}>
      {outlook === 'payable' ? (
        <>
          <p className="text-sm text-muted-foreground">{t('checkin.touristTax.intro')}</p>
          <TaxFigures view={view} money={money} />
          {blocksNextStep(view) && (
            <Alert variant="warning" data-testid="tourist-tax-required">
              {t('checkin.touristTax.requiredBeforeCode')}
            </Alert>
          )}
          <PaymentArea token={token} view={view} refetch={refetch} fetching={fetching} onPayingChange={onPayingChange} />
        </>
      ) : (
        <OutcomeNotice outlook={outlook} view={view} money={money} />
      )}
    </div>
  );
}

/**
 * The step «Tassa di soggiorno» of the guest check-in (E25/F01/US02/T01, NF-119, decision O12): the tax of the stay guest by guest by position (no names), what can be paid now, and the
 * Payment Element of the organization's own account; or one sentence when there is nothing to pay here (the channel collects it, the price of the booking included it, the host tells the
 * amount, it was paid). The step exists only when the API offers the payment (the flag on, the organization offering it, its account ready): the page decides that, this draws what the API
 * says. The guest may leave it without paying, except when the organization asks for the tax before the lock code (`requiredBeforeAccessCode`): the page then keeps the step until the
 * server records the payment.
 */
export function TouristTaxStep({ token, view, refetch, fetching, completed = false, onPayingChange }: TouristTaxStepProps) {
  const { t } = useTranslation();

  if (!view) {
    return (
      <div className="space-y-3" data-testid="checkin-tourist-tax-failed">
        <p role="alert" className="text-sm text-destructive">
          {t('checkin.touristTax.loadFailed')}
        </p>
        <Button type="button" variant="outline" size="sm" disabled={fetching} onClick={() => void refetch()} data-testid="tourist-tax-load-retry">
          {t('checkin.touristTax.retry')}
        </Button>
      </div>
    );
  }

  return <TouristTaxContent token={token} view={view} refetch={refetch} fetching={fetching} completed={completed} onPayingChange={onPayingChange} />;
}
