import { isAxiosError } from 'axios';
import type { StripeElementLocale } from '@stripe/stripe-js';
import type { PaymentRefusal } from '@/features/public-booking/components/stripe-intent-payment';
import { UnexpectedApiResponseError, getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { formatCurrency } from '@/lib/utils';
import type { TouristTaxCollection } from '@/types/checkin-wizard.types';
import type { PublicTouristTax, PublicTouristTaxGuest, TouristTaxPaymentIntent } from '@/types/public-checkin.types';

/**
 * The tourist tax paid online in the guest check-in and its state on the host's side (E25/F01/US02/T01, NF-119, decision O12). Everything here is pure: the page and the host's step
 * decide what to show from what the API says, and the browser works out no amount (no sum, no difference, no tax): every figure it shows comes from the answer, in the currency
 * of the answer.
 */

/** Problem code of `POST …/tourist-tax/payment-intent` while a payment of the stay is under way: the page waits for it to be recorded instead of asking for another. */
export const TOURIST_TAX_IN_PROGRESS_CODE = 'tourist_tax_payment_in_progress';

/** Problem code of `POST …/tourist-tax/payment-intent` while the payment is not offered (the organization does not offer it, or its account or the platform key is not ready). */
const TOURIST_TAX_NOT_AVAILABLE_CODE = 'tourist_tax_payment_not_available';

/** How many times the guest page asks again, with backoff, for a payment the guest has made: after them it offers «Aggiorna lo stato» instead of asking for ever. */
export const TOURIST_TAX_MAX_POLLS = 10;

/** The words of the query string a payment method that redirects adds when it sends the guest back to the page (`return_url`): the secret of the intent is one of them. */
const PAYMENT_RETURN_PARAMS = ['payment_intent', 'payment_intent_client_secret', 'redirect_status', 'setup_intent', 'setup_intent_client_secret'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** An amount of the API that may be missing: a number, or null (never turned into 0). */
function amountOrNull(value: unknown): number | null {
  return isAmount(value) ? value : null;
}

function guestOf(value: unknown): PublicTouristTaxGuest | null {
  if (!isRecord(value) || typeof value.position !== 'number' || !Number.isInteger(value.position) || value.position < 0) return null;
  const nights = typeof value.taxableNights === 'number' && Number.isInteger(value.taxableNights) && value.taxableNights >= 0 ? value.taxableNights : 0;
  return { position: value.position, taxableNights: nights, amount: amountOrNull(value.amount), exempt: value.exempt === true };
}

/**
 * The tax of the stay as the guest page reads it, or `null` for an answer that is not one (a page served in place of the JSON, a mock that answers every address with the
 * context): the page then treats the step as one it could not load, and never invents a figure. A state or a reason the app does not know is kept as the API wrote it: a newer
 * server must not break an older app, and the page says «ti comunicherà l'host» for it.
 */
export function readPublicTouristTax(data: unknown): PublicTouristTax | null {
  if (!isRecord(data) || typeof data.status !== 'string' || typeof data.reason !== 'string') return null;
  if (!isAmount(data.payable) || !isAmount(data.collectedAmount) || !Array.isArray(data.guests)) return null;
  const guests = data.guests.map(guestOf).filter((guest): guest is PublicTouristTaxGuest => guest !== null);
  return {
    status: data.status as PublicTouristTax['status'],
    reason: data.reason as PublicTouristTax['reason'],
    payable: data.payable,
    amountDue: amountOrNull(data.amountDue),
    collectedAmount: data.collectedAmount,
    currency: typeof data.currency === 'string' ? data.currency.trim() : '',
    guests: guests.sort((a, b) => a.position - b.position),
    requiredBeforeAccessCode: data.requiredBeforeAccessCode === true,
  };
}

/** What the Payment Element needs, or `null` when the answer lacks the secret, the key or the amount: nothing is then charged. */
export function readTouristTaxPaymentIntent(data: unknown): TouristTaxPaymentIntent | null {
  if (!isRecord(data)) return null;
  const { paymentIntentId, clientSecret, publishableKey, stripeAccountId, amount, currency } = data;
  if (typeof clientSecret !== 'string' || !clientSecret || typeof publishableKey !== 'string' || !publishableKey) return null;
  if (typeof stripeAccountId !== 'string' || !stripeAccountId || !isAmount(amount) || amount <= 0) return null;
  return {
    paymentIntentId: typeof paymentIntentId === 'string' ? paymentIntentId : '',
    clientSecret,
    publishableKey,
    stripeAccountId,
    amount,
    currency: typeof currency === 'string' ? currency.trim() : '',
  };
}

/** The `code` of the problem a failed call answered (`tourist_tax_payment_in_progress`…), or `undefined`. */
export function problemCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * Whether a refusal of the confirmation leaves the payment of the stay open. A declined card, or a form that is not complete, leave the intent as it was: it can be paid again at once and
 * nothing is asked of the server. Any other refusal (the intent cancelled by the host's «Pagata in struttura», one paid whose answer was lost, a connection that dropped) may leave the
 * server in another state than the page has: the page asks the server, never the result the browser got.
 */
export function refusalLeavesPaymentOpen(refusal: PaymentRefusal | undefined): boolean {
  return refusal?.type !== 'card_error' && refusal?.type !== 'validation_error';
}

/**
 * The server will not give an intent however often it is asked: the payment is not offered (409 `tourist_tax_payment_not_available`, e.g. the platform key is not there, which the read of
 * the tax does not see and the lock code does not wait for), or what it answered is no intent. A failure that may pass (connection, 5xx, 429) is not that: the guest tries again. The
 * backend never keeps a guest out for a payment that cannot be made, so the page does not either: «Avanti» is let go and the guest is told the tax is paid at the property.
 */
export function paymentCannotBeMade(error: unknown): boolean {
  return error instanceof UnexpectedApiResponseError || problemCodeOf(error) === TOURIST_TAX_NOT_AVAILABLE_CODE;
}

/**
 * Whether the guest page has a tourist tax step, from the read of `GET …/tourist-tax`:
 * - `off`: the flag is off, or the link is not read yet: nothing asks and nothing changes on the page;
 * - `loading`: asked, no answer yet: no step is shown (it appears when the answer says there is one);
 * - `unavailable`: 404 or 409, whatever an earlier answer left in the cache (the data of a query is kept on an error): the flag went off, the organization does not offer the
 *   payment, its account does not take payments, or the link reaches no stay. No step: the host collects the tax as it always did;
 * - `failed`: the read failed for another reason and there is nothing to show: the step says so and offers to try again;
 * - `ready`: the tax is there. A later read that failed for a passing reason keeps what was read.
 */
export type GuestTaxAvailability = 'off' | 'loading' | 'unavailable' | 'failed' | 'ready';

export function guestTaxAvailability(read: { enabled: boolean; isPending: boolean; isError: boolean; error: unknown; hasData: boolean }): GuestTaxAvailability {
  if (!read.enabled) return 'off';
  if (read.isError) {
    const status = getHttpStatus(read.error);
    if (status === 404 || status === 409) return 'unavailable';
    return read.hasData ? 'ready' : 'failed';
  }
  if (read.hasData) return 'ready';
  return read.isPending ? 'loading' : 'off';
}

/** What the guest is told about the tax of the stay. */
export type GuestTaxOutlook =
  /** Something can be paid online now. */
  | 'payable'
  /** Paid online, nothing is left. */
  | 'paid'
  /** Paid online once; the rest of the tax is paid at the property. */
  | 'paidPartly'
  /** Nothing more online: the tax is paid at the property. */
  | 'atProperty'
  /** The host recorded that it was paid at the property. */
  | 'paidAtProperty'
  /** The channel collects it: nothing to pay here. */
  | 'channelCollects'
  /** The price of the booking included it. */
  | 'included'
  /** Nothing is due for the stay. */
  | 'nothingDue'
  /** The amount cannot be told yet: the host tells it. */
  | 'hostWillTell';

/** The outlook of a tax the API read: from the state and the reason of the API, never from a figure the browser works out. */
export function guestTaxOutlook(view: PublicTouristTax): GuestTaxOutlook {
  if (view.payable > 0) return 'payable';
  if (view.status === 'PaidAtProperty') return 'paidAtProperty';
  if (view.status === 'CollectedByChannel') return 'channelCollects';
  if (view.status === 'IncludedInBookingPayment') return 'included';
  if (view.reason === 'AlreadyPaidOnline') return view.collectedAmount > 0 ? 'paidPartly' : 'atProperty';
  if (view.status === 'PaidOnline') return 'paid';
  if (view.status === 'NotDue' || view.reason === 'NothingDue') return 'nothingDue';
  return 'hostWillTell';
}

/** The outlooks a completed check-in still says something about: what can still be paid and what was paid (the others have nothing new to tell). */
export function isShownOnCompletedCheckIn(outlook: GuestTaxOutlook): boolean {
  return outlook === 'payable' || outlook === 'paid' || outlook === 'paidPartly';
}

/**
 * The step cannot be left while the organization asks for the tax before the lock code and something can still be paid online: the server holds the code back until it is
 * recorded, so the page does not let the guest move on without it. It never blocks what is not payable (the host's «Pagata in struttura» lifts it too).
 */
export function blocksNextStep(view: PublicTouristTax): boolean {
  return view.requiredBeforeAccessCode && view.payable > 0;
}

/** The language of the number formats for a language of the page (`it`, `en`, `de`, `fr`, `es`); Italian for any other. */
export function moneyLocaleOf(language: string | null | undefined): string {
  switch (language?.trim().toLowerCase().split(/[-_]/)[0]) {
    case 'en':
      return 'en-GB';
    case 'de':
      return 'de-DE';
    case 'fr':
      return 'fr-FR';
    case 'es':
      return 'es-ES';
    default:
      return 'it-IT';
  }
}

/** The language of the Payment Element for the language of the page: the five the page offers, Italian for any other. */
export function paymentElementLocaleOf(language: string | null | undefined): StripeElementLocale {
  const primary = language?.trim().toLowerCase().split(/[-_]/)[0];
  return primary === 'en' || primary === 'de' || primary === 'fr' || primary === 'es' ? primary : 'it';
}

/** A currency code of the API: three letters. Anything else (empty, a word) is no currency. */
function currencyCodeOf(currency: string | null | undefined): string | null {
  const code = currency?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
}

/** Whether the API said in what currency an amount is: without it the page shows the number with no symbol and says so. */
export function hasTaxCurrency(currency: string | null | undefined): boolean {
  return currencyCodeOf(currency) !== null;
}

/**
 * An amount of the tax in the currency the API gave («9,00 CHF»). With no currency (the API did not say) the number alone, never an euro sign the code assumed: the caller says
 * that the currency is not known (`hasTaxCurrency`).
 */
export function formatTaxMoney(amount: number, currency: string | null | undefined, locale: string): string {
  const code = currencyCodeOf(currency);
  if (code) return formatCurrency(amount, code, locale);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

/** The address Stripe sends the guest back to after a method that redirects: the page itself, with no query and no secret. */
export function paymentReturnUrlOf(location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}`;
}

/**
 * The query string of a page a payment method that redirects sent the guest back to, without what Stripe adds (the secret of the intent among it): `null` when there is nothing to
 * take away. The page replaces its address with it, so the secret stays neither in the address bar nor in the history.
 */
export function withoutPaymentReturn(params: URLSearchParams): URLSearchParams | null {
  if (!PAYMENT_RETURN_PARAMS.some((name) => params.has(name))) return null;
  const cleaned = new URLSearchParams(params);
  PAYMENT_RETURN_PARAMS.forEach((name) => cleaned.delete(name));
  return cleaned;
}

/** What the host reads of the collection of the tax of a stay. */
export type CollectionOutlook =
  /** Nothing is paid and something is due: the host collects it (the guest may pay it online). */
  | 'toCollect'
  /** The guest paid online (and what was refunded is said apart). */
  | 'paidOnline'
  /** The guest paid online once and the rest is collected at the property. */
  | 'paidOnlinePartly'
  | 'paidAtProperty'
  | 'collectedByChannel'
  | 'includedInBooking'
  | 'notDue';

/** The outlook of the collection the API sent: `null` for a state the app does not know (nothing is shown for it, never a guess). */
export function collectionOutlook(collection: TouristTaxCollection): CollectionOutlook | null {
  switch (collection.status) {
    case 'PaidAtProperty':
      return 'paidAtProperty';
    case 'CollectedByChannel':
      return 'collectedByChannel';
    case 'IncludedInBookingPayment':
      return 'includedInBooking';
    case 'NotDue':
      return 'notDue';
    case 'PaidOnline':
      return 'paidOnline';
    case 'ToCollect':
      return collection.reason === 'AlreadyPaidOnline' && keepsOnlinePayment(collection) ? 'paidOnlinePartly' : 'toCollect';
    default:
      return null;
  }
}

/** Something of what the guest paid online was not given back (a comparison of the two figures of the API, never shown). */
function keepsOnlinePayment(collection: TouristTaxCollection): boolean {
  return collection.collectedAmount > collection.refundedAmount;
}

/**
 * Whether the host may record «Pagata in struttura»: the tax is still to collect, nothing of what the guest paid online is left (or nothing was paid), the stay is active and the
 * channel does not collect it. The server decides again (422 `tourist_tax_collection_not_applicable`, 409 `tourist_tax_paid_online`, 409 `tourist_tax_payment_in_progress`); this
 * only keeps the button out of the cases it answers no to. The permission (`payment.write`) is asked apart.
 */
export function canRecordPaidAtProperty(collection: TouristTaxCollection): boolean {
  return collection.status === 'ToCollect' && collection.reason !== 'StayNotActive' && !keepsOnlinePayment(collection);
}
