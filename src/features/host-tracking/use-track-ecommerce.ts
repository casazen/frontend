import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { CONSENT_CHANGED_EVENT, hasConsent } from '@/lib/cookie-consent';
import { beginCheckoutEvent, purchaseEvent, viewItemEvent, viewItemListEvent } from '@/lib/ga4-ecommerce';
import { getHostSite } from '@/lib/host-site';
import type { CheckoutOutcome } from '@/types';
import type { PublicStayCard } from '@/types/public-stays.types';
import { dataLayerOf, gtmContainerOf, loadGtm } from './gtm-loader';
import { purchaseOnce } from './purchase-once';

/**
 * The GA4 e-commerce events of the booking funnel on the pages of the agency's own domain (NF-149), pushed to `window.dataLayer` for the agency's Tag Manager
 * container. An event is pushed only when ALL of these hold, checked at the moment of the push: the page is on an agency domain whose pages may load a
 * container (`gtmContainerOf`), it is not a widget (`/embed/*` reports to the page that frames it), and the visitor allowed statistics. A visitor who
 * withdraws the choice stops every later push at once, though a container already loaded stays until the next load of the page (a script cannot be unloaded).
 * The payloads are those of `src/lib/ga4-ecommerce.ts`: a home, its place and its price, never a guest.
 */

type EcommerceEventName = 'view_item_list' | 'view_item' | 'begin_checkout' | 'purchase';

type Track = (name: EcommerceEventName, params: object, onceKey?: string) => boolean;

/** The list of the results of the search of a booking site: constant, so that the agency's reports count one list whatever the language of the visitor. */
const SEARCH_RESULTS_LIST = { listId: 'search_results', listName: 'Search results' } as const;

const LISTED_HOMES = 20;

function pageContainer(): string | null {
  return typeof window === 'undefined' ? null : gtmContainerOf(getHostSite(), window.location.pathname);
}

function subscribeToConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The container this page measures with right now: the agency's, when the page is on its own domain (see `gtmContainerOf`) AND the visitor allowed statistics;
 * null otherwise, and it follows the visitor's choice (a visitor who accepts later, or withdraws, is heard at once). Where the page may not measure at all (the CasaZen
 * domain, a widget, an agency without a container) the choice is not even read from the browser.
 */
export function useTrackingContainer(): string | null {
  const container = pageContainer();
  const allowed = useSyncExternalStore(
    subscribeToConsent,
    () => container !== null && hasConsent('statistics'),
    () => false,
  );
  return allowed ? container : null;
}

/**
 * What a page needs to measure: `active` (the page is measuring, see `useTrackingContainer`) and `track`, which never pushes without checking the same things again at
 * the moment of the push. `track` also makes sure the container is loading before the first push (it does nothing when it is), so that an event never comes before
 * `gtm.js` whatever the order of the effects.
 */
export function useTrackEcommerce(): { active: boolean; track: Track } {
  const active = useTrackingContainer() !== null;
  const sent = useRef<Set<string>>(new Set());

  const track = useCallback<Track>((name, params, onceKey) => {
    const containerId = pageContainer();
    if (containerId === null || !hasConsent('statistics')) return false;

    const key = onceKey === undefined ? null : `${name}:${onceKey}`;
    if (key !== null && sent.current.has(key)) return false;

    loadGtm(containerId);
    if (key !== null) sent.current.add(key);
    const layer = dataLayerOf();
    layer.push({ ecommerce: null });
    layer.push({ event: name, ecommerce: params });
    return true;
  }, []);

  return { active, track };
}

function useEcommerceEvent(
  name: EcommerceEventName,
  key: string | null,
  build: () => object | null,
  once?: (key: string, push: () => void) => boolean,
): void {
  const { active, track } = useTrackEcommerce();
  const latest = useRef(build);
  useEffect(() => {
    latest.current = build;
  });

  useEffect(() => {
    if (!active || key === null) return;
    const params = latest.current();
    if (!params) return;
    const push = () => {
      track(name, params, key);
    };
    if (once) once(key, push);
    else push();
  }, [active, key, name, once, track]);
}

interface TrackedHome {
  propertyId: string;
  propertyName: string;
  place?: string | null;
}

interface StayTotal {
  currency?: string | null;
  total?: number | null;
}

export function useTrackViewItemList(cards: readonly PublicStayCard[] | null): void {
  const homes = cards && cards.length > 0 ? cards : null;
  const key = homes
    ? homes
        .slice(0, LISTED_HOMES)
        .map((card) => `${card.id}:${card.price?.currency ?? ''}:${card.price?.totalCents ?? ''}`)
        .join('|')
    : null;
  useEcommerceEvent('view_item_list', key, () => (homes ? viewItemListEvent(homes, SEARCH_RESULTS_LIST, { asEmbedMessage: false }) : null));
}

export function useTrackViewItem(view: (TrackedHome & StayTotal) | null): void {
  useEcommerceEvent('view_item', view ? view.propertyId : null, () => (view ? viewItemEvent(view) : null));
}

interface CheckoutStart extends TrackedHome, StayTotal {
  stay: { checkIn: string; checkOut: string; adults: number; children: number };
}

export function useTrackBeginCheckout(checkout: CheckoutStart | null): void {
  const key = checkout
    ? [checkout.propertyId, checkout.stay.checkIn, checkout.stay.checkOut, checkout.stay.adults, checkout.stay.children].join('|')
    : null;
  useEcommerceEvent('begin_checkout', key, () => (checkout ? beginCheckoutEvent(checkout) : null));
}

/**
 * `purchase`: the confirmation page of a booking that is `Confirmed`, ONCE per booking from this browser (`purchaseOnce`): `transaction_id` is the id of the
 * booking, the value is its `totalPrice` and the currency the one of the booking, with one item. Any other state of the outcome (waiting, failed, expired)
 * is no purchase. Nothing else of the outcome is read: not the code the guest is shown, not the name or the e-mail they typed.
 */
export function useTrackPurchase(
  outcome: Pick<CheckoutOutcome, 'state' | 'bookingId' | 'currency' | 'totalPrice' | 'propertyId' | 'propertyName'> | null | undefined,
): void {
  const confirmed = outcome?.state === 'Confirmed' ? outcome : null;
  useEcommerceEvent(
    'purchase',
    confirmed ? confirmed.bookingId : null,
    () =>
      confirmed
        ? purchaseEvent({
            bookingId: confirmed.bookingId,
            currency: confirmed.currency,
            total: confirmed.totalPrice,
            propertyId: confirmed.propertyId,
            propertyName: confirmed.propertyName,
          })
        : null,
    purchaseOnce,
  );
}
