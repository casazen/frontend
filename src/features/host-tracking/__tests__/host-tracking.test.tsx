import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsent } from '@/hooks/use-consent';
import i18n from '@/i18n/config';
import { PublicSiteShell } from '@/layouts/PublicSiteShell';
import { CONSENT_STORAGE_KEY, writeConsentChoice } from '@/lib/cookie-consent';
import { setHostSite, type HostSite } from '@/lib/host-site';
import { usePublicOrg } from '@/queries/use-public-org';
import type { CheckoutOutcome, CheckoutOutcomeState } from '@/types';
import type { PublicStayCard } from '@/types/public-stays.types';
import type { DataLayerWindow } from '../gtm-loader';
import { HostTracking } from '../host-tracking';
import { PURCHASES_STORAGE_KEY } from '../purchase-once';
import { useTrackBeginCheckout, useTrackPurchase, useTrackViewItem, useTrackViewItemList } from '../use-track-ecommerce';

vi.mock('@/queries/use-public-org', () => ({ usePublicOrg: vi.fn(), useOrgProperties: () => ({ data: undefined }) }));
vi.mock('@/queries/use-public-stays', () => ({ useOrgStays: () => ({ data: undefined }) }));
vi.mock('@/components/shared/cookie-consent-banner', () => ({ CookieConsentBanner: () => null }));
vi.mock('@/features/public-site/components/Footer', () => ({ Footer: () => null }));

/**
 * The agency's Tag Manager and the GA4 events of its booking pages (E41/F04/US01/T01, NF-149). What these tests hold: PRIVACY (no script, no push, no cookie and
 * nothing in the storage before the visitor allowed statistics, never on the CasaZen domain or in a widget), DATA (a booking is one `purchase`, and nothing personal
 * is in any event) and MONEY (the currency is the one of the data, the amounts are the ones of the server).
 */

const HOST: HostSite = {
  host: 'prenota.quokka.example',
  slug: 'quokka',
  displayName: 'Quokka',
  embedEnabled: true,
  tracking: { gtmContainerId: 'GTM-ABC123' },
};

const GTM_SCRIPTS = 'script[src^="https://www.googletagmanager.com/gtm.js"]';
const BOOKING_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const OTHER_BOOKING_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const BOOKING_CODE = 'K7M4Q-9XP2H';

type Message = Record<string, unknown>;
const layer = (): Message[] => ((window as DataLayerWindow).dataLayer ?? []) as Message[];
/** What the pages of the funnel pushed: the messages that name an event, not the `gtm.js` one. */
const events = (): Message[] => layer().filter((message) => typeof message.event === 'string' && message.event !== 'gtm.js');
const scripts = () => document.head.querySelectorAll(GTM_SCRIPTS);
const accept = () => window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');

function card(position: number, overrides: Partial<PublicStayCard> = {}): PublicStayCard {
  return {
    id: `home-${position}`,
    name: `Casa ${position}`,
    comune: 'Lugano',
    latitude: 46,
    longitude: 8.95,
    photos: [],
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency: 'CHF', perNightCents: 24000, totalCents: 96050 },
    ...overrides,
  };
}

function outcome(overrides: Partial<CheckoutOutcome> = {}): CheckoutOutcome {
  return {
    bookingId: BOOKING_ID,
    state: 'Confirmed',
    paymentOption: 'Immediate',
    propertyId: 'home-0',
    propertySlug: 'casa-0',
    propertyName: 'Casa 0',
    checkInDate: '2026-10-24',
    checkOutDate: '2026-10-27',
    numberOfAdults: 2,
    numberOfChildren: 0,
    totalPrice: 550,
    currency: 'CHF',
    expiresAt: null,
    deferredChargeDate: null,
    bookingCode: BOOKING_CODE,
    ...overrides,
  };
}

type ViewInput = NonNullable<Parameters<typeof useTrackViewItem>[0]>;
type CheckoutInput = NonNullable<Parameters<typeof useTrackBeginCheckout>[0]>;

const CARDS = [card(0), card(1, { price: { currency: 'CHF', perNightCents: 10000, totalCents: 30000 } })];
const VIEW: ViewInput = { propertyId: 'home-0', propertyName: 'Casa 0', place: 'Lugano', currency: 'CHF', total: 480 };
const CHECKOUT: CheckoutInput = {
  propertyId: 'home-0',
  propertyName: 'Casa 0',
  place: 'Lugano',
  stay: { checkIn: '2026-10-24', checkOut: '2026-10-27', adults: 2, children: 0 },
  currency: 'CHF',
  total: 502.5,
};

/** What the four pages of the funnel call, in one place: each test gives each of them its data (null: that page has nothing to report). */
function Funnel({
  cards = null,
  view = null,
  checkout = null,
  confirmation = null,
}: {
  cards?: PublicStayCard[] | null;
  view?: ViewInput | null;
  checkout?: CheckoutInput | null;
  confirmation?: CheckoutOutcome | null;
}) {
  useTrackViewItemList(cards);
  useTrackViewItem(view);
  useTrackBeginCheckout(checkout);
  useTrackPurchase(confirmation);
  return null;
}

const EVERYTHING = <Funnel cards={CARDS} view={VIEW} checkout={CHECKOUT} confirmation={outcome()} />;

const LIST_EVENT = {
  item_list_id: 'search_results',
  item_list_name: 'Search results',
  currency: 'CHF',
  items: [
    { item_id: 'home-0', item_name: 'Casa 0', item_category: 'Lugano', item_list_id: 'search_results', item_list_name: 'Search results', index: 0, price: 960.5, quantity: 1 },
    { item_id: 'home-1', item_name: 'Casa 1', item_category: 'Lugano', item_list_id: 'search_results', item_list_name: 'Search results', index: 1, price: 300, quantity: 1 },
  ],
};
const VIEW_EVENT = { currency: 'CHF', value: 480, items: [{ item_id: 'home-0', item_name: 'Casa 0', item_category: 'Lugano', price: 480, quantity: 1 }] };
const CHECKOUT_EVENT = { currency: 'CHF', value: 502.5, items: [{ item_id: 'home-0', item_name: 'Casa 0', item_category: 'Lugano', price: 502.5, quantity: 1 }] };
const PURCHASE_EVENT = { transaction_id: BOOKING_ID, currency: 'CHF', value: 550, items: [{ item_id: 'home-0', item_name: 'Casa 0', price: 550, quantity: 1 }] };

function resetPage() {
  cleanup();
  vi.restoreAllMocks();
  setHostSite(null);
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
  document.head.querySelectorAll(GTM_SCRIPTS).forEach((script) => script.remove());
  delete (window as DataLayerWindow).dataLayer;
}

describe('HostTracking and the events of the funnel', () => {
  beforeEach(() => {
    resetPage();
    setHostSite(HOST);
  });
  afterEach(resetPage);

  describe('before the consent and where nothing may run', () => {
    it.each([
      ['no choice yet', null],
      ['a refusal', 'rejected'],
    ])('hostTracking_withoutConsent_loadsNothing (%s)', (_label, choice) => {
      if (choice) window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);

      render(
        <>
          <HostTracking />
          {EVERYTHING}
        </>,
      );

      // No script of the tag manager, no message in its queue (the queue is not even created), no cookie and nothing kept for the purchase.
      expect(scripts()).toHaveLength(0);
      expect((window as DataLayerWindow).dataLayer).toBeUndefined();
      expect(document.cookie).toBe('');
      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    });

    it('hostTracking_onPlatformDomain_doesNothing', () => {
      setHostSite(null);
      accept();
      const read = vi.spyOn(Storage.prototype, 'getItem');

      render(
        <>
          <HostTracking />
          {EVERYTHING}
        </>,
      );

      expect(scripts()).toHaveLength(0);
      expect((window as DataLayerWindow).dataLayer).toBeUndefined();
      // Where a page may not measure at all the choice of the visitor is not even read, and nothing is kept for the purchase.
      expect(read).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    });

    it.each([['/embed/booking'], ['/embed/property/casa-0'], ['/embed/quokka/guest-access']])('hostTracking_inEmbed_doesNothing (%s)', (path) => {
      window.history.pushState({}, '', path);
      accept();
      const read = vi.spyOn(Storage.prototype, 'getItem');

      render(
        <>
          <HostTracking />
          {EVERYTHING}
        </>,
      );

      expect(scripts()).toHaveLength(0);
      expect((window as DataLayerWindow).dataLayer).toBeUndefined();
      // A widget uses no storage of the agency's domain, not even to read: whatever of the funnel is shown in a frame measures nothing.
      expect(read).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    });

    it.each([
      ['/my-bookings?code=K7M4Q-9XP2H'],
      ['/requests/0f8fad5b-d9cb-469f-a165-70867728950e/confirm?token=tok_secret'],
      ['/booking/0f8fad5b-d9cb-469f-a165-70867728950e/review?token=tok_secret'],
      ['/book/quokka/bookings/0f8fad5b-d9cb-469f-a165-70867728950e/cancel?token=tok_secret'],
    ])('hostTracking_onAPageWhoseAddressIsTheKeyToABooking_doesNothing (%s)', (path) => {
      window.history.pushState({}, '', path);
      accept();
      const read = vi.spyOn(Storage.prototype, 'getItem');

      render(
        <>
          <HostTracking />
          {EVERYTHING}
        </>,
      );

      // A tag manager reads the whole address: the code or the token of the guest is never handed to the container, and the choice of the visitor is not even read there.
      expect(scripts()).toHaveLength(0);
      expect((window as DataLayerWindow).dataLayer).toBeUndefined();
      expect(read).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    });

    it.each([
      ['the widgets are off for the agency', { ...HOST, embedEnabled: false }],
      ['the agency set no container', { ...HOST, tracking: { gtmContainerId: null } }],
      ['the answer says nothing of tracking', { ...HOST, tracking: undefined }],
      ['the id is not a container id', { ...HOST, tracking: { gtmContainerId: 'GTM-"><script>alert(1)</script>' } }],
      ['the id is a GA4 id', { ...HOST, tracking: { gtmContainerId: 'G-ABCDE12345' } }],
    ])('hostTracking_whenAgencyHasNoUsableContainer_%s_doesNothingAndThrowsNothing', (_label, site) => {
      setHostSite(site);
      accept();

      expect(() =>
        render(
          <>
            <HostTracking />
            {EVERYTHING}
          </>,
        ),
      ).not.toThrow();

      expect(scripts()).toHaveLength(0);
      expect((window as DataLayerWindow).dataLayer).toBeUndefined();
      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    });
  });

  describe('the container', () => {
    it('hostTracking_afterTheConsent_loadsTheContainerOnceAcrossRendersAndRemounts', () => {
      const page = render(<HostTracking />);
      expect(scripts()).toHaveLength(0);

      act(() => writeConsentChoice('accepted'));

      expect(scripts()).toHaveLength(1);
      expect(layer()).toEqual([{ 'gtm.start': expect.any(Number), event: 'gtm.js' }]);

      // Re-renders, a route change that keeps the page, a layout that mounts it again: nothing more.
      page.rerender(<HostTracking />);
      page.rerender(<HostTracking />);
      page.unmount();
      render(<HostTracking />);

      expect(scripts()).toHaveLength(1);
      expect(layer()).toHaveLength(1);
      expect(document.cookie).toBe('');
    });

    it('hostTracking_theShellOfAnOrgSite_mountsItSoTheContainerLoadsAfterTheConsentOnly', () => {
      vi.mocked(usePublicOrg).mockReturnValue({
        data: { slug: 'quokka', displayName: 'Quokka', logoUrl: null, themeColor: null, contactEmail: null },
        isLoading: false,
        isError: false,
      } as unknown as ReturnType<typeof usePublicOrg>);

      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={['/book/quokka']}>
            <Routes>
              <Route path="/book/:orgSlug" element={<PublicSiteShell mode="org" />}>
                <Route index element={<div data-testid="page" />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect(scripts()).toHaveLength(0);
      expect((window as DataLayerWindow).dataLayer).toBeUndefined();

      act(() => writeConsentChoice('accepted'));

      expect(scripts()).toHaveLength(1);
    });

    it('hostTracking_afterTheConsentIsWithdrawn_pushesNothingMoreButTheLoadedContainerStays', () => {
      accept();
      const page = render(
        <>
          <HostTracking />
          <Funnel view={VIEW} />
        </>,
      );
      expect(scripts()).toHaveLength(1);
      expect(events()).toHaveLength(1);

      act(() => writeConsentChoice('rejected'));
      page.rerender(
        <>
          <HostTracking />
          <Funnel cards={CARDS} view={{ ...VIEW, propertyId: 'home-9' }} checkout={CHECKOUT} confirmation={outcome()} />
        </>,
      );

      // A script cannot be unloaded: it stays until the next load of the page. But nothing is pushed to it, and nothing is kept for the purchase.
      expect(scripts()).toHaveLength(1);
      expect(events()).toHaveLength(1);
      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    });
  });

  describe('the events', () => {
    it('hostTracking_events_comeAfterEcommerceNullWithTheShapeOfTheBuildersAndTheCurrencyOfTheData', () => {
      accept();

      render(EVERYTHING);

      // The container first (whatever the order of the effects), then each event preceded by the reset of `ecommerce`: a CHF home gives CHF.
      expect(layer()).toEqual([
        { 'gtm.start': expect.any(Number), event: 'gtm.js' },
        { ecommerce: null },
        { event: 'view_item_list', ecommerce: LIST_EVENT },
        { ecommerce: null },
        { event: 'view_item', ecommerce: VIEW_EVENT },
        { ecommerce: null },
        { event: 'begin_checkout', ecommerce: CHECKOUT_EVENT },
        { ecommerce: null },
        { event: 'purchase', ecommerce: PURCHASE_EVENT },
      ]);
    });

    it('hostTracking_anAmountWithoutTheCurrencyOfTheData_isLeftOutNeverAssumed', () => {
      accept();

      render(<Funnel view={{ ...VIEW, currency: undefined }} checkout={{ ...CHECKOUT, currency: '' }} />);

      expect(events().map((message) => message.ecommerce)).toEqual([
        { items: [{ item_id: 'home-0', item_name: 'Casa 0', item_category: 'Lugano', quantity: 1 }] },
        { items: [{ item_id: 'home-0', item_name: 'Casa 0', item_category: 'Lugano', quantity: 1 }] },
      ]);
    });

    it('hostTracking_whenTheVisitorAcceptsLater_theEventsOfThePageGoThenAfterTheContainer', () => {
      // The page that holds the events comes BEFORE the one that loads the container: the container still goes first.
      render(
        <>
          <Funnel cards={CARDS} view={VIEW} />
          <HostTracking />
        </>,
      );
      expect((window as DataLayerWindow).dataLayer).toBeUndefined();

      act(() => writeConsentChoice('accepted'));

      expect(events().map((message) => message.event)).toEqual(['view_item_list', 'view_item']);
      expect(layer()[0]).toEqual({ 'gtm.start': expect.any(Number), event: 'gtm.js' });
      expect(scripts()).toHaveLength(1);
    });

    it('hostTracking_viewItemList_isPushedOncePerDistinctResultSet', () => {
      accept();
      const page = render(<Funnel cards={CARDS} />);
      expect(events()).toHaveLength(1);

      // A refetch hands the same homes in a new array, a toggle of the map renders again: the same set.
      page.rerender(<Funnel cards={[...CARDS]} />);
      page.rerender(<Funnel cards={CARDS.map((home) => ({ ...home }))} />);
      expect(events()).toHaveLength(1);

      // Other homes are another set; the first one, shown again, was already counted; an empty list says nothing.
      page.rerender(<Funnel cards={[card(7)]} />);
      expect(events()).toHaveLength(2);
      page.rerender(<Funnel cards={CARDS} />);
      page.rerender(<Funnel cards={[]} />);
      page.rerender(<Funnel cards={null} />);
      expect(events()).toHaveLength(2);

      // The same homes for other dates are priced differently: another set.
      page.rerender(<Funnel cards={[card(0, { price: { currency: 'CHF', perNightCents: 24000, totalCents: 120000 } })]} />);
      expect(events()).toHaveLength(3);
    });

    it('hostTracking_viewItemList_reportsTheFirst20Homes', () => {
      accept();

      render(<Funnel cards={Array.from({ length: 35 }, (_, position) => card(position))} />);

      const [listed] = events();
      const items = (listed.ecommerce as { items: { item_id: string; index: number }[] }).items;
      expect(items).toHaveLength(20);
      expect(items.map((item) => item.index)).toEqual(Array.from({ length: 20 }, (_, position) => position));
    });

    it('hostTracking_viewItem_isPushedOncePerHomeAndWaitsWhileTheQuoteIsOnItsWay', () => {
      accept();
      const page = render(<Funnel view={null} />);
      expect(events()).toHaveLength(0);

      page.rerender(<Funnel view={VIEW} />);
      expect(events()).toHaveLength(1);

      // The guest changes the dates: the same home, the same visit.
      page.rerender(<Funnel view={null} />);
      page.rerender(<Funnel view={{ ...VIEW, total: 510 }} />);
      expect(events()).toHaveLength(1);

      page.rerender(<Funnel view={{ ...VIEW, propertyId: 'home-9', propertyName: 'Casa 9' }} />);
      expect(events()).toHaveLength(2);
    });

    it('hostTracking_beginCheckout_isPushedOncePerHomeAndStayOnceTheQuoteIsReady', () => {
      accept();
      const page = render(<Funnel checkout={null} />);
      expect(events()).toHaveLength(0);

      page.rerender(<Funnel checkout={CHECKOUT} />);
      expect(events()).toHaveLength(1);

      // The steps of the checkout draw the page again and the quote of the same stay can come again (the ages of the children): the same checkout.
      page.rerender(<Funnel checkout={{ ...CHECKOUT, total: 505 }} />);
      expect(events()).toHaveLength(1);

      // Another stay of the same home is another checkout, with its own total.
      page.rerender(<Funnel checkout={{ ...CHECKOUT, stay: { ...CHECKOUT.stay, checkOut: '2026-10-28' }, total: 670 }} />);
      expect(events()).toHaveLength(2);
      expect(events()[1].ecommerce).toMatchObject({ currency: 'CHF', value: 670 });
    });

    it('hostTracking_underStrictMode_pushesEachEventOnce', () => {
      accept();

      render(
        <StrictMode>
          <HostTracking />
          {EVERYTHING}
        </StrictMode>,
      );

      expect(events().map((message) => message.event)).toEqual(['view_item_list', 'view_item', 'begin_checkout', 'purchase']);
      expect(scripts()).toHaveLength(1);
    });
  });

  describe('the purchase', () => {
    it('hostTracking_purchase_carriesNoPersonalData', () => {
      accept();
      // What the page knows of the guest (the code they are shown, what they typed) is not in the outcome the hook reads, and would not be read if it were.
      const known = { ...outcome(), guestEmail: 'mario.rossi@example.com', guestFirstName: 'Mario', token: 'tok_checkout_secret', phone: '+39 333 1234567' } as unknown as CheckoutOutcome;

      render(<Funnel confirmation={known} />);

      const [purchase] = events();
      expect(purchase).toEqual({ event: 'purchase', ecommerce: PURCHASE_EVENT });
      const everything = JSON.stringify(layer());
      expect(everything).toContain(BOOKING_ID);
      for (const personal of [BOOKING_CODE, 'K7M4Q', 'mario', 'Mario', 'rossi', '@', 'tok_checkout_secret', '+39', 'example.com']) {
        expect(everything).not.toContain(personal);
      }
    });

    it.each<CheckoutOutcomeState>([
      'AwaitingPayment',
      'PaymentProcessing',
      'PaymentFailed',
      'AwaitingGuestEmail',
      'AwaitingHostApproval',
      'Expired',
      'Declined',
      'DatesUnavailable',
      'Cancelled',
    ])('hostTracking_purchase_isNotPushedFor_%s', (state) => {
      accept();

      render(<Funnel confirmation={outcome({ state })} />);

      expect(events()).toHaveLength(0);
      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
    });

    it('hostTracking_purchase_isStillReportedOnTheOutcomePageWhoseAddressKeepsTheToken', () => {
      window.history.pushState({}, '', `/booking/${BOOKING_ID}?token=tok_checkout_secret`);
      accept();

      render(
        <>
          <HostTracking />
          <Funnel confirmation={outcome()} />
        </>,
      );

      expect(scripts()).toHaveLength(1);
      expect(events().map((message) => message.event)).toEqual(['purchase']);
    });

    it('hostTracking_purchase_isPushedOncePerBookingAcrossReloadsAndTabs', () => {
      accept();
      const page = render(<Funnel confirmation={outcome({ state: 'AwaitingHostApproval' })} />);
      expect(events()).toHaveLength(0);

      // The host approves: the page, polling, now says `Confirmed`.
      page.rerender(<Funnel confirmation={outcome()} />);
      page.rerender(<Funnel confirmation={outcome()} />);
      expect(events()).toHaveLength(1);

      // A reload, a second tab and the link of the e-mail opened a week later are the page mounted again, with the memory of the browser and none of the page.
      page.unmount();
      render(<Funnel confirmation={outcome()} />);
      expect(events()).toHaveLength(1);

      // Another booking is another purchase.
      cleanup();
      render(<Funnel confirmation={outcome({ bookingId: OTHER_BOOKING_ID })} />);
      expect(events()).toHaveLength(2);
      expect((events()[1].ecommerce as { transaction_id: string }).transaction_id).toBe(OTHER_BOOKING_ID);
      expect(JSON.parse(window.localStorage.getItem(PURCHASES_STORAGE_KEY) ?? '[]')).toEqual([BOOKING_ID, OTHER_BOOKING_ID]);
    });

    it('hostTracking_purchase_theListOfBookingsIsForgottenWhenTheVisitorWithdrawsTheChoice', () => {
      accept();
      render(<Funnel confirmation={outcome()} />);
      expect(JSON.parse(window.localStorage.getItem(PURCHASES_STORAGE_KEY) ?? '[]')).toEqual([BOOKING_ID]);

      // The visitor says no in the notice (or in the panel of the choices): what the statistics kept goes with the choice, as the source of the visit does.
      const consent = renderHook(() => useConsent());
      act(() => consent.result.current.choose('rejected'));

      expect(window.localStorage.getItem(PURCHASES_STORAGE_KEY)).toBeNull();
      expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe('rejected');
      expect(events()).toHaveLength(1);
    });
  });
});
