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

/** Pushes `name` with `params`; with an `onceKey`, only the first time that key is given to this `track` (the page that made it). Returns whether it pushed. */
type Track = (name: EcommerceEventName, params: object, onceKey?: string) => boolean;

/** The list of the results of the search of a booking site: constant, so that the agency's reports count one list whatever the language of the visitor. */
const SEARCH_RESULTS_LIST = { listId: 'search_results', listName: 'Search results' } as const;

/** The homes of a list that an event reports (`viewItemListEvent` keeps the first 20): what tells one result set from another. */
const LISTED_HOMES = 20;

/** The container the page may load right now, or null: see `gtmContainerOf`. */
function pageContainer(): string | null {
  return typeof window === 'undefined' ? null : gtmContainerOf(getHostSite(), window.location.pathname);
}

/** The choice of the visitor changes in this tab (`CONSENT_CHANGED_EVENT`) or in another one of the same browser (`storage`). */
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
    // `{ ecommerce: null }` first, as GA4 asks: the object of the previous event does not leak into this one.
    const layer = dataLayerOf();
    layer.push({ ecommerce: null });
    layer.push({ event: name, ecommerce: params });
    return true;
  }, []);

  return { active, track };
}

/**
 * Pushes `name` once for each distinct `key` while the page is measuring (`null`: nothing to report). The event is built by `build` when the key (or the
 * permission to measure) changes, from the render that changed it: a re-render, a refetch or a toggle of the map that leaves the key alone pushes nothing.
 * `once` is a stricter guard that remembers beyond the page (`purchaseOnce`): it receives the key and the push, and decides whether the push runs.
 */
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

/** A home of the events: the id and the name that GA4 calls `item_id` and `item_name`, and its place (the comune). */
interface TrackedHome {
  propertyId: string;
  propertyName: string;
  place?: string | null;
}

/** What the server said the stay costs, in major units and in the currency of the home: absent when there is no quote (no dates), and then no money goes in the event. */
interface StayTotal {
  currency?: string | null;
  total?: number | null;
}

/**
 * `view_item_list`: the homes of the results of a booking site (the first 20), once per distinct result set: the same homes with the same prices in the
 * same order are one set, whatever the number of renders and refetches. `null` or an empty list: nothing to report.
 */
export function useTrackViewItemList(cards: readonly PublicStayCard[] | null): void {
  const homes = cards && cards.length > 0 ? cards : null;
  const key = homes
    ? homes
        .slice(0, LISTED_HOMES)
        .map((card) => `${card.id}:${card.price?.currency ?? ''}:${card.price?.totalCents ?? ''}`)
        .join('|')
    : null;
  // The page's own `dataLayer` has no limit of 4 KB (the one of the messages of the widgets): the first 20 homes go, with the ids and the names of a real site.
  useEcommerceEvent('view_item_list', key, () => (homes ? viewItemListEvent(homes, SEARCH_RESULTS_LIST, { asEmbedMessage: false }) : null));
}

/** `view_item`: the page of a home, once per home. `null`: nothing to report yet (the page waits for the quote of the stay of the address, if there is one). */
export function useTrackViewItem(view: (TrackedHome & StayTotal) | null): void {
  useEcommerceEvent('view_item', view ? view.propertyId : null, () => (view ? viewItemEvent(view) : null));
}

interface CheckoutStart extends TrackedHome, StayTotal {
  stay: { checkIn: string; checkOut: string; adults: number; children: number };
}

/** `begin_checkout`: the checkout of a stay with its quote ready, once per home and stay. `null`: the quote is not ready, there is nothing to report. */
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
