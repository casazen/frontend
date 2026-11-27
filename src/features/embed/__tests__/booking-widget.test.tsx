import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { publicOrgApi } from '@/api/public-org.api';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import type { EmbedMessage } from '@/embed/protocol';
import type { RegionMapProps } from '@/features/site-maps';
import { HouseCard } from '@/features/public-site/cards/house-card';
import { setHostSite } from '@/lib/host-site';
import { freezeClock, NOON_UTC } from '@/test/clock';
import { stubViewportWidth } from '@/test/viewport';
import type { PublicOrgDto } from '@/types';
import type { PublicStaysQuery, PublicStaysResult } from '@/types/public-stays.types';
import { FRAME_QUERY, PARENT, frameInsideAPage, renderWidgets, spyOnTheBrowserMemory, type FramingPage, type MemorySpies } from './embed-test-kit';
import { DESTINATIONS, ORG_SLUG, siteCalendar, stayCard, staysResult } from './stays-fixtures';

/**
 * The booking widget in the frame (E41/F01/US02/T01, NF-144): the results of the booking site, inside the frame of another site. What costs something
 * when it is wrong is held here: nothing kept in the browser, only the org of the frame searched, the price and the currency of each home as the server says
 * them, no personal data in what is told to the page, and no way out of the frame but the property widget.
 */
// A card of the results leads to the property widget: its home never answers here, this file is about the results.
vi.mock('@/api/public-org.api', () => ({ publicOrgApi: { getPublicOrg: vi.fn(), getOrgProperty: vi.fn(() => new Promise(() => undefined)) } }));
vi.mock('@/api/public-site-search.api', () => ({
  publicSiteSearchApi: { getStays: vi.fn(), getSiteCalendar: vi.fn(), getDestinations: vi.fn() },
}));

// The map draws SVG from data loaded on demand: here a stand-in that keeps what the page gave it and lets a test select a pin.
const map = vi.hoisted(() => ({ props: null as RegionMapProps | null }));
vi.mock('@/features/site-maps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/site-maps')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    RegionMap: (props: RegionMapProps) => {
      map.props = props;
      return createElement(
        'div',
        { 'data-testid': 'region-map-stub', 'data-pins': String(props.pins.length) },
        props.pins.slice(0, 3).map((pin) => createElement('button', { key: pin.id, type: 'button', 'data-testid': `pin-${pin.id}`, onClick: () => props.onSelect?.(pin.id) }, pin.name)),
      );
    },
  };
});

const ORG: PublicOrgDto = { slug: ORG_SLUG, displayName: 'Villa Rossi', logoUrl: null, themeColor: null, contactEmail: 'ciao@villa-rossi.example', hostName: 'Giulia' };
const getPublicOrg = vi.mocked(publicOrgApi.getPublicOrg);
const getStays = vi.mocked(publicSiteSearchApi.getStays);
const getSiteCalendar = vi.mocked(publicSiteSearchApi.getSiteCalendar);
const getDestinations = vi.mocked(publicSiteSearchApi.getDestinations);

const DATES = 'checkin=2026-12-10&checkout=2026-12-13&guests=2';
const ENTRY = `/embed/${ORG_SLUG}/booking`;
const THREE = [stayCard(1), stayCard(2), stayCard(3)];

/** The answer for a stay of three nights: every home with the total of its quote, in its own currency. */
function withTotals(cards = THREE): PublicStaysResult {
  return staysResult(
    cards.map((card) => ({ ...card, price: { ...card.price, totalCents: card.price.perNightCents * 3 } })),
    { checkIn: '2026-12-10', checkOut: '2026-12-13', nights: 3 },
  );
}

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: {} });
}

let page: FramingPage;
let spies: MemorySpies | undefined;

/** Opens the widget on the CasaZen domain: `search` is the state of the address, the frame's own parameters follow. */
function open(search = '', options?: Parameters<typeof renderWidgets>[1]) {
  return renderWidgets(`${ENTRY}?${search ? `${search}&` : ''}${FRAME_QUERY}`, options);
}

const cards = () => screen.queryAllByTestId('house-card');

/** What the frame told the page with `event`, by the name of the GA4 event. */
const events = (name: string) => page.sent('event').filter((message): message is EmbedMessage<'event'> => message.type === 'event' && message.name === name);
const lists = () => events('view_item_list');
const searches = () => events('search');
const itemsOf = (message: EmbedMessage<'event'>) => message.params.items as { item_id: string; index: number; price?: number }[];

// The routes load the shell and the widget when they are first needed: here they are loaded before the first test, so that none of them has to wait for it.
beforeAll(async () => {
  await Promise.all([import('../embed-shell'), import('../booking-widget'), import('../property-widget')]);
}, 120_000);

beforeEach(async () => {
  freezeClock(NOON_UTC);
  getPublicOrg.mockReset().mockResolvedValue(ORG);
  getStays.mockReset().mockResolvedValue(staysResult(THREE));
  getSiteCalendar.mockReset().mockResolvedValue(siteCalendar('2026-09-24'));
  getDestinations.mockReset().mockResolvedValue(DESTINATIONS);
  map.props = null;
  page = frameInsideAPage();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  spies?.restore();
  spies = undefined;
  page.restore();
  setHostSite(null);
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the results in the frame (AC1)', () => {
  it('embedBooking_Renders_TheBarTheFiltersTheCardsAndTheMap_FromTheOneStaysCallOfTheSite', async () => {
    stubViewportWidth(1280);
    getStays.mockResolvedValue(withTotals());
    open(`${DATES}&bedrooms=2&where=lugano`);

    expect(await screen.findAllByTestId('house-card')).toHaveLength(3);
    expect(screen.getByTestId('embed-widget-booking')).toBeInTheDocument();
    // The bar (destination, arrival, departure and guests: the three fields and the button), the filters, the sort, the map with the pins.
    const bar = screen.getByTestId('search-bar');
    expect(within(bar).getByRole('button', { name: 'Cerca' })).toBeInTheDocument();
    await waitFor(() => expect(bar.querySelector('[data-field="where"]')).not.toBeNull());
    expect(bar.querySelector('[data-field="when"]')).toHaveTextContent('10 dic – 13 dic');
    expect(bar.querySelector('[data-field="who"]')).toHaveTextContent('2 ospiti');
    expect(screen.getByTestId('search-filters-open')).toBeInTheDocument();
    expect(screen.getByTestId('search-sort')).toBeInTheDocument();
    expect(screen.getByTestId('region-map-stub')).toHaveAttribute('data-pins', '3');
    // The state of the address, with the query of the site, asks the one call of the site: the search of this org with the stay and the filters.
    expect(getStays).toHaveBeenCalledWith(ORG_SLUG, expect.objectContaining({ checkIn: '2026-12-10', checkOut: '2026-12-13', adults: 2, bedrooms: 2, where: 'lugano' }));
  });

  it('embedBooking_EveryControlOfTheSite_IsThere_PriceBedroomsBathroomsAreaAmenitiesRulesAndTheTags', async () => {
    // Homes that differ in price and size (a slider needs a range), with labels: the controls the site offers for them.
    getStays.mockResolvedValue(
      staysResult([
        stayCard(1, { price: { currency: 'EUR', perNightCents: 9000, totalCents: null }, areaSqm: 40, tags: ['mare', 'piscina'] }),
        stayCard(2, { price: { currency: 'EUR', perNightCents: 21000, totalCents: null }, areaSqm: 120, tags: ['mare'] }),
      ]),
    );
    open(DATES);
    await screen.findAllByTestId('house-card');

    // The labels of the homes are chips of the bar, with the sort.
    const categories = await screen.findByRole('list', { name: 'Categorie' });
    expect(within(categories).getByRole('button', { name: 'Mare' })).toBeInTheDocument();
    expect(within(categories).getByRole('button', { name: 'Con piscina' })).toBeInTheDocument();
    expect(screen.getByTestId('search-sort')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('search-filters-open'));
    const panel = await screen.findByTestId('search-filters-panel');
    for (const legend of ['Prezzo a notte', 'Camere', 'Bagni', 'Superficie', 'Servizi', 'Regole della casa']) {
      expect(within(panel).getByText(legend, { selector: 'legend span' })).toBeInTheDocument();
    }
    // The ranges are the ones of the homes: the euros of the cheapest and of the dearest night, and the metres of the smallest and of the largest.
    const sliders = within(panel).getAllByRole('slider') as HTMLInputElement[];
    expect(sliders.map((slider) => [slider.min, slider.max])).toEqual([
      ['90', '210'],
      ['90', '210'],
      ['40', '120'],
    ]);
  });

  it('embedBooking_AChangeOfTheSearch_IsWrittenInTheAddressOfTheFrameWithTheKeysOfTheSite', async () => {
    const { router } = open(DATES);
    await screen.findAllByTestId('house-card');

    fireEvent.change(screen.getByTestId('search-sort'), { target: { value: 'priceAsc' } });

    await waitFor(() => expect(router.state.location.search).toContain('sort=priceAsc'));
    const address = new URLSearchParams(router.state.location.search);
    // The stay and the frame's own parameters are still there: a reload of the frame finds the same page.
    expect(address.get('checkin')).toBe('2026-12-10');
    expect(address.get('checkout')).toBe('2026-12-13');
    expect(address.get('guests')).toBe('2');
    expect(address.get('v')).toBe('1');
    expect(address.get('parent')).toBe(PARENT);
  });

  it('embedBooking_FiltersOpenAsAPanelInTheFlow_AndApplyingThemWritesTheAddress', async () => {
    const { router } = open(DATES);
    await screen.findAllByTestId('house-card');
    const open_ = screen.getByTestId('search-filters-open');
    expect(open_).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(open_);

    const panel = await screen.findByTestId('search-filters-panel');
    expect(open_).toHaveAttribute('aria-expanded', 'true');
    // A panel of the page, not a dialog: it is in the results, under the bar, and the form is the one of the sheet of the site.
    expect(panel.closest('[data-testid="site-search"]')).not.toBeNull();
    expect(panel.closest('[role="dialog"]')).toBeNull();
    expect(within(panel).getByRole('heading', { name: 'Filtri' })).toBeInTheDocument();
    expect(within(panel).getByTestId('search-filters-form')).toBeInTheDocument();

    fireEvent.click(within(panel).getByLabelText('2 o più', { selector: 'input[name="bedrooms"]' }));
    fireEvent.click(within(panel).getByTestId('search-filters-apply'));

    await waitFor(() => expect(router.state.location.search).toContain('bedrooms=2'));
    expect(screen.queryByTestId('search-filters-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-filters-open')).toHaveAttribute('aria-expanded', 'false');
    // The focus goes back to the button that opened the panel (the one it was on is gone).
    expect(document.activeElement).toBe(screen.getByTestId('search-filters-open'));
    expect(screen.getByTestId('search-active-filters')).toBeInTheDocument();
  });
});

describe('the links of the frame (AC2)', () => {
  it('embedBooking_CardsAndPins_LeadToThePropertyWidgetOfTheSameFrame_KeepingTheStayTheLanguageTheParentAndTheVersion', async () => {
    stubViewportWidth(1280);
    getStays.mockResolvedValue(withTotals());
    open(`${DATES}&lang=en`);

    const links = await screen.findAllByTestId('house-card-link');
    expect(links).toHaveLength(3);
    const href = links[0].getAttribute('href') ?? '';
    const url = new URL(href, 'https://frame.example');
    expect(url.pathname).toBe(`/embed/${ORG_SLUG}/property/casa-001`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      checkin: '2026-12-10',
      checkout: '2026-12-13',
      guests: '2',
      from: 'booking',
      lang: 'en',
      parent: PARENT,
      v: '1',
    });

    // The same link on the pin of the map.
    const pin = map.props?.pins[0];
    expect(pin?.href).toBe(href);

    // No link of the frame leads to the booking site, to a checkout or out of `/embed`, and there is no way to book in it.
    const everyLink = [...document.querySelectorAll('a[href]')].map((anchor) => anchor.getAttribute('href') ?? '');
    for (const link of everyLink) expect(link).not.toMatch(/^\/book\/|\/checkout|^https?:\/\/(?!localhost)/);
    expect(everyLink.filter((link) => link.startsWith('/embed/')).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole('button', { name: /^prenota$/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
  });

  it('embedBooking_WithoutDates_TheLinkCarriesNoStayButStillSaysWhereTheGuestCameFrom', async () => {
    open();

    const [link] = await screen.findAllByTestId('house-card-link');
    const url = new URL(link.getAttribute('href') ?? '', 'https://frame.example');
    expect([...url.searchParams.keys()].sort()).toEqual(['from', 'lang', 'parent', 'v']);
  });

  it('embedBooking_TheCampaignOfThePage_GoesOnToTheHomeOnlyWhenItIsAPlainName', async () => {
    open(`${DATES}&utm_campaign=Estate-2026`);
    const [link] = await screen.findAllByTestId('house-card-link');
    expect(new URL(link.getAttribute('href') ?? '', 'https://frame.example').searchParams.get('utm_campaign')).toBe('estate-2026');
    cleanup();

    // An address of e-mail typed as a campaign never goes on.
    open(`${DATES}&utm_campaign=mario.rossi%40example.com`);
    const [other] = await screen.findAllByTestId('house-card-link');
    expect(new URL(other.getAttribute('href') ?? '', 'https://frame.example').searchParams.has('utm_campaign')).toBe(false);
  });

  it('embedBooking_ClickingACard_MovesTheFrameToThePropertyWidget', async () => {
    const { router } = open(DATES);
    const [link] = await screen.findAllByTestId('house-card-link');

    fireEvent.click(link);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/embed/${ORG_SLUG}/property/casa-001`));
  });

  it('embedBooking_OnAnAgencyDomain_TheLinksStartAtEmbedAndTheOrgIsTheOneOfTheHost', async () => {
    setHostSite({ host: 'prenota.villa-rossi.example.test', slug: ORG_SLUG, displayName: 'Villa Rossi', embedEnabled: true });
    renderWidgets(`/embed/booking?${DATES}&${FRAME_QUERY}`, { mode: 'host' });

    const [link] = await screen.findAllByTestId('house-card-link');
    expect(new URL(link.getAttribute('href') ?? '', 'https://frame.example').pathname).toBe('/embed/property/casa-001');
  });

  it('embedBooking_ANotFreeHome_LeadsToThePropertyWidgetToo', async () => {
    getStays.mockResolvedValue(
      withTotals([stayCard(1), stayCard(2, { availability: { available: false, reason: 'busy', firstFreeCheckIn: '2026-12-20' } })]),
    );
    open(DATES);

    const list = await screen.findByTestId('search-unavailable');
    expect(within(list).getByRole('link')).toHaveAttribute('href', expect.stringContaining(`/embed/${ORG_SLUG}/property/casa-002?`));
  });
});

describe('no hearts, no storage, no fixed elements (AC3)', () => {
  it('embedBooking_noStorageOrCookies', async () => {
    stubViewportWidth(1280);
    // What a guest saved with the hearts of the site, and asked for in the address: the frame neither reads it nor writes anything.
    localStorage.setItem(`casazen.favorites.${ORG_SLUG}`, JSON.stringify(['home-001']));
    localStorage.setItem('casazen.locale', 'en');

    open(`${DATES}&favorites=1`, { afterRouter: () => (spies = spyOnTheBrowserMemory()) });
    await screen.findAllByTestId('house-card');
    // Everything a guest does on the page: the filters, the sort, the stay pickers, a pin, one more card.
    fireEvent.click(screen.getByTestId('search-filters-open'));
    await screen.findByTestId('search-filters-panel');
    fireEvent.click(screen.getByTestId('search-filters-apply'));
    fireEvent.change(screen.getByTestId('search-sort'), { target: { value: 'priceAsc' } });
    fireEvent.click(screen.getByTestId('search-bar').querySelector('[data-field="when"]') as HTMLElement);
    await screen.findByTestId('stay-popover');
    fireEvent.keyDown(screen.getByTestId('stay-popover'), { key: 'Escape' });
    fireEvent.click(screen.getByTestId('pin-home-001'));

    expect(spies?.calls()).toEqual([]);
  });

  it('embedBooking_NoHearts_NoCounterAndNoOnlyFavouritesFilter_EvenWhenTheAddressAsksForThem', async () => {
    localStorage.setItem(`casazen.favorites.${ORG_SLUG}`, JSON.stringify(['home-001']));
    open(`${DATES}&favorites=1`);

    // The address asks for the hearts; the frame does not hear it: every home is listed.
    expect(await screen.findAllByTestId('house-card')).toHaveLength(3);
    expect(screen.queryByTestId('favorite-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-only-favorites')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /preferiti/i })).not.toBeInTheDocument();
  });

  it('embedBooking_OnAPhone_NoSheetNoDialogAndNoFixedElement_TheStayIsAPopoverAndTheFiltersAPanel', async () => {
    stubViewportWidth(390);
    open(DATES);
    await screen.findAllByTestId('house-card');

    // The three fields of the bar stay, one under the other: the field that opens a sheet is the phone of the site, not of a frame.
    const bar = screen.getByTestId('search-bar');
    expect(bar).toHaveAttribute('data-stacked');
    expect(screen.queryByTestId('search-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-sheet')).not.toBeInTheDocument();

    // The stay: a popover at every width.
    fireEvent.click(bar.querySelector('[data-field="when"]') as HTMLElement);
    const popover = await screen.findByTestId('stay-popover');
    expect(popover).toHaveAttribute('data-embed');
    expect(screen.queryByTestId('stay-sheet')).not.toBeInTheDocument();
    fireEvent.keyDown(popover, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('stay-popover')).not.toBeInTheDocument());

    // The filters: a panel. With nothing open there is no dialog at all, and no element is fixed to the window.
    fireEvent.click(screen.getByTestId('search-filters-open'));
    await screen.findByTestId('search-filters-panel');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const fixed = [...document.body.querySelectorAll<HTMLElement>('*')].filter(
      (element) => (element.classList.contains('fixed') || element.style.position === 'fixed') && !element.closest('[data-radix-popper-content-wrapper]'),
    );
    expect(fixed).toEqual([]);
    // The button between the list and the map is a block of the page (the style of the frame makes it static), not under the portals.
    expect(screen.getByTestId('search-view-toggle').closest('.sr--embed')).not.toBeNull();
  });

  it('embedBooking_OnAPhone_TheHelpOfTheEstimatedTax_IsABubbleBesideTheButton_NeverASheetFixedToTheFrame', async () => {
    stubViewportWidth(390);
    // A stay with a child: the tourist tax of the total is an estimate until the ages are known, and the card says so with a «?» (a sheet from the bottom on a phone of the site).
    getStays.mockResolvedValue(
      staysResult([stayCard(1, { price: { currency: 'EUR', perNightCents: 14500, totalCents: 43500, includesTouristTax: 'estimated' } })], {
        checkIn: '2026-12-10',
        checkOut: '2026-12-13',
        nights: 3,
        children: 1,
      }),
    );
    open(`${DATES}&children=1`);
    await screen.findAllByTestId('house-card');

    fireEvent.click(await screen.findByRole('button', { name: /imposta è stimata/ }));

    // The explanation is the bubble of a tablet, at the width of a phone too: a sheet would be fixed to the window of the frame, which is as tall as the whole list.
    expect(await screen.findByTestId('help-tip-popover')).toHaveTextContent('Per ora contiamo tutti i bambini come se la pagassero');
    expect(screen.queryByTestId('help-tip-sheet')).not.toBeInTheDocument();
    // Nothing is fixed to the window but what a popover is made of: the box the library places beside the button, and its two invisible focus guards (no size, no pointer).
    const fixed = [...document.body.querySelectorAll<HTMLElement>('*')].filter(
      (element) =>
        (element.classList.contains('fixed') || element.style.position === 'fixed') &&
        !element.closest('[data-radix-popper-content-wrapper]') &&
        !element.hasAttribute('data-radix-focus-guard'),
    );
    expect(fixed).toEqual([]);
  });

  it('houseCard_OutsideAFrame_OnAPhone_TheHelpOfTheEstimatedTax_IsStillASheet', async () => {
    stubViewportWidth(390);
    const card = stayCard(1, { price: { currency: 'EUR', perNightCents: 14500, totalCents: 43500, includesTouristTax: 'estimated' } });
    render(
      <MemoryRouter initialEntries={[`/book/${ORG_SLUG}/search`]}>
        <HouseCard card={card} orgSlug={ORG_SLUG} variant="row" nights={3} stay={null} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /imposta è stimata/ }));

    expect(await screen.findByTestId('help-tip-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('help-tip-popover')).not.toBeInTheDocument();
  });

  it('embedBooking_ThePinCard_IsInTheFlowUnderTheMapAndTheMapDrawsNoCardOfItsOwn', async () => {
    stubViewportWidth(1280);
    getStays.mockResolvedValue(withTotals());
    open(DATES);
    await screen.findAllByTestId('house-card');
    expect(screen.queryByTestId('map-card')).not.toBeInTheDocument();
    expect(map.props?.hideCard).toBe(true);

    fireEvent.click(screen.getByTestId('pin-home-002'));

    const card = await screen.findByTestId('map-card');
    // Under the map, in the pane: not over the map (`absolute`) and not a sheet.
    const pane = screen.getByTestId('results-map');
    expect(card.parentElement).toBe(pane);
    expect(card.className).not.toMatch(/absolute|fixed/);
    expect(within(card).getByTestId('map-card-link')).toHaveAttribute('href', expect.stringContaining(`/embed/${ORG_SLUG}/property/casa-002?`));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    fireEvent.click(within(card).getByRole('button', { name: 'Chiudi la scheda' }));
    expect(screen.queryByTestId('map-card')).not.toBeInTheDocument();
  });

  it('embedBooking_NoWayToWriteToTheHost_WhenThereIsNothingToShow', async () => {
    getStays.mockResolvedValue(staysResult([]));
    open();

    const none = await screen.findByTestId('search-no-results');
    expect(none).toHaveAttribute('data-reason', 'none');
    expect(screen.queryByTestId('search-write')).not.toBeInTheDocument();
    // The sentence does not send the guest to a host they cannot write to from here: it says the fact and stops.
    expect(none).toHaveTextContent('In questo momento nessuna casa è prenotabile online.');
    expect(none).not.toHaveTextContent(/scrivi/i);
    expect(none).not.toHaveTextContent('Giulia');
  });

  it('embedBooking_NoResultsForTheParty_SaysHowManyTheHomesTake_WithNoInvitationToWriteToTheHost', async () => {
    getStays.mockResolvedValue(staysResult([stayCard(1, { availability: { available: false, reason: 'guests' } })]));
    open(DATES);

    const none = await screen.findByTestId('search-no-results');
    expect(none).toHaveAttribute('data-reason', 'capacity');
    expect(none).toHaveTextContent('Le case di questo sito ospitano fino a 4 persone.');
    expect(none).not.toHaveTextContent(/scrivi/i);
    expect(screen.queryByTestId('search-write')).not.toBeInTheDocument();
  });

  it('embedBooking_NoResults_InEnglish_HaveTheSameSentencesWithNoInvitationToWriteToTheHost', async () => {
    getStays.mockResolvedValue(staysResult([]));
    open('lang=en');

    const none = await screen.findByTestId('search-no-results');
    expect(none).toHaveTextContent('No home can be booked online right now.');
    expect(none).not.toHaveTextContent(/write to/i);
  });

  it('embedSources_NeverTouchTheStorageTheCookiesNorTheSessionOfTheGuest', () => {
    // The code of the frame (the widgets and what they are made of in this folder) names none of the ways to keep something in the browser, nor the module of the guest session.
    const root = resolve(process.cwd(), 'src/features/embed');
    const files = (folder: string): string[] =>
      readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(folder, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : files(path);
        return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
      });
    const sources = files(root);
    expect(sources.length).toBeGreaterThanOrEqual(14);
    for (const file of sources) {
      // The code, not the comments that say what it avoids.
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code, file).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB|guest-session/);
    }
  });

  it('embedBooking_Styles_NeverFollowTheHeightOfTheWindow', () => {
    // A frame is as tall as its content: a box as tall as the window of the frame grows with it, without end. The rules of the frame use no unit of the window.
    const css = readFileSync(resolve(process.cwd(), 'src/features/public-site/search/search.css'), 'utf8');
    const start = css.indexOf('The results inside the frame of an embeddable widget');
    expect(start).toBeGreaterThan(0);
    const rules = css.slice(start);
    expect(rules.length).toBeGreaterThan(200);
    expect(rules).not.toMatch(/\d(d|s|l)?vh\b/);
    expect(rules).toMatch(/\.sr--embed \.sr-toggle \{[^}]*position: static/);
    expect(rules).toMatch(/\.sr--embed \.sr-body--map \.sr-side \{[^}]*position: static/);

    // A popover is drawn over the frame, outside the wrapper whose height is the one of the frame: while one is open the wrapper makes room for it.
    const shell = readFileSync(resolve(process.cwd(), 'src/features/embed/embed.css'), 'utf8');
    expect(shell).toMatch(/\.embed-frame:has\(\[aria-haspopup='dialog'\]\[aria-expanded='true'\]\) \{\s*min-height: 46rem/);
  });
});

describe('what is told to the page (AC5)', () => {
  it('embedBooking_ViewItemList_IsSentOnceForTheListOfTheAnswer_WithTheFirstTwentyHomes_ToTheOriginOfThePage', async () => {
    getStays.mockResolvedValue(withTotals(Array.from({ length: 30 }, (_, index) => stayCard(index + 1))));
    open(DATES);
    await screen.findAllByTestId('house-card');

    await waitFor(() => expect(lists()).toHaveLength(1));
    const [message] = lists();
    expect(message.params).toMatchObject({ item_list_id: 'search_results', item_list_name: 'Search results', currency: 'EUR' });
    const items = itemsOf(message);
    expect(items).toHaveLength(20);
    expect(items.map((item) => item.item_id)).toEqual(Array.from({ length: 20 }, (_, index) => `home-${String(index + 1).padStart(3, '0')}`));
    expect(items.map((item) => item.index)).toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect(items[0].price).toBe(435);
    // Addressed to the origin of the page, never to every window.
    const posted = page.posts().filter(([post]) => post.type === 'event');
    expect(posted.every(([, target]) => target === PARENT)).toBe(true);
  });

  it('embedBooking_ViewItemList_ASecondReadOfTheSameHomes_SaysNothingAgain_AndAnotherListSaysItOnce', async () => {
    const { client } = open(DATES);
    await screen.findAllByTestId('house-card');
    await waitFor(() => expect(lists()).toHaveLength(1));

    // The server answers again with the same homes (a refetch, the focus of the window): the same list.
    await act(async () => {
      await client.refetchQueries({ queryKey: ['public-stays'] });
    });
    expect(lists()).toHaveLength(1);

    // Another order of the homes is another list.
    getStays.mockResolvedValue(staysResult([stayCard(3), stayCard(2), stayCard(1)]));
    fireEvent.change(screen.getByTestId('search-sort'), { target: { value: 'priceDesc' } });
    await waitFor(() => expect(lists()).toHaveLength(2));
    expect(itemsOf(lists()[1])[0].item_id).toBe('home-003');
  });

  it('embedBooking_ViewItemList_NeverWhileTheAnswerIsOnItsWay_NorForTheAnswerThatIsKeptInSightMeanwhile', async () => {
    const pending: ((result: PublicStaysResult) => void)[] = [];
    getStays.mockImplementation((_slug: string, query?: PublicStaysQuery) =>
      query?.sort === 'priceDesc'
        ? new Promise<PublicStaysResult>((resolveStays) => pending.push(resolveStays))
        : Promise.resolve(staysResult(THREE)),
    );
    open(DATES);
    await screen.findAllByTestId('house-card');
    await waitFor(() => expect(lists()).toHaveLength(1));

    // The next answer is on its way: the list of before stays on the screen (quieter), and it is not told again.
    fireEvent.change(screen.getByTestId('search-sort'), { target: { value: 'priceDesc' } });
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(document.querySelector('[data-stale]')).not.toBeNull();
    expect(lists()).toHaveLength(1);

    await act(async () => {
      pending[0](staysResult([stayCard(3), stayCard(1)]));
    });
    await waitFor(() => expect(lists()).toHaveLength(2));
  });

  it('embedBooking_ViewItemList_WhileTheFirstAnswerIsOnItsWay_IsNotSentAndNothingIsListed', async () => {
    const pending: ((result: PublicStaysResult) => void)[] = [];
    getStays.mockImplementation(() => new Promise<PublicStaysResult>((resolveStays) => pending.push(resolveStays)));
    open(DATES);

    expect(await screen.findByTestId('search-loading')).toBeInTheDocument();
    expect(lists()).toHaveLength(0);

    await act(async () => {
      for (const answer of pending) answer(staysResult(THREE));
    });
    await screen.findAllByTestId('house-card');
    await waitFor(() => expect(lists()).toHaveLength(1));
  });

  it('embedBooking_WithoutAPageThatFramesIt_NothingIsPosted', async () => {
    // The page was opened on its own: its window is its own parent.
    page.restore();
    open(DATES);
    await screen.findAllByTestId('house-card');
    fireEvent.click(screen.getByTestId('search-bar').querySelector('button[type="submit"]') as HTMLElement);

    expect(page.window.postMessage).not.toHaveBeenCalled();
  });

  it('embedBooking_Search_IsSentWhenTheBarIsSent_WithThePlaceTheDatesAndTheGuests_OnceForTheSameSearch', async () => {
    stubViewportWidth(1280);
    open(`${DATES}&where=lugano`);
    await screen.findAllByTestId('house-card');
    await waitFor(() => expect(lists()).toHaveLength(1));
    // The places of the site are there (the field «Dove» shows with them): the place of the search is said by its name.
    await waitFor(() => expect(screen.getByTestId('search-bar').querySelector('[data-field="where"]')).not.toBeNull());
    expect(searches()).toHaveLength(0);

    const send = () => fireEvent.click(within(screen.getByTestId('search-bar')).getByRole('button', { name: 'Cerca' }));
    send();

    await waitFor(() => expect(searches()).toHaveLength(1));
    expect(searches()[0]).toMatchObject({
      type: 'event',
      name: 'search',
      params: { search_term: 'Lugano', start_date: '2026-12-10', end_date: '2026-12-13', number_of_travelers: 2 },
    });
    // The same search sent again is the same search.
    send();
    expect(searches()).toHaveLength(1);
  });

  it('embedBooking_Search_WithoutDates_IsNotASearch_AndSendsNothing', async () => {
    stubViewportWidth(1280);
    open();
    await screen.findAllByTestId('house-card');

    fireEvent.click(within(screen.getByTestId('search-bar')).getByRole('button', { name: 'Cerca' }));

    expect(screen.getByText('Scegli il giorno di arrivo e quello di partenza per cercare.')).toBeInTheDocument();
    expect(searches()).toHaveLength(0);
  });

  it('embedBooking_events_carryNoPersonalData', async () => {
    stubViewportWidth(1280);
    // What anyone can put in the address of a page: an e-mail, a phone, a booking code, a token, a typed place. None of it is a place of the site.
    const noise = 'email=mario%40rossi.it&phone=%2B393331234567&code=ABCDE-12345&token=gs1.secret&surname=Rossi';
    open(`${DATES}&where=mario%40rossi.it&${noise}`);
    await screen.findAllByTestId('house-card');
    fireEvent.click(within(screen.getByTestId('search-bar')).getByRole('button', { name: 'Cerca' }));
    await waitFor(() => expect(lists()).toHaveLength(1));
    await waitFor(() => expect(searches()).toHaveLength(1));

    const said = JSON.stringify(page.posts());
    for (const secret of ['mario@rossi.it', 'mario%40', '393331234567', 'ABCDE-12345', 'gs1.secret', 'Rossi', 'email', 'phone', 'surname', 'token']) {
      expect(said).not.toContain(secret);
    }
    // A search says the dates and the guests; the place only when it is a place of the site.
    expect(searches()[0].params).toEqual({ start_date: '2026-12-10', end_date: '2026-12-13', number_of_travelers: 2 });
    // A list says the homes: ids, names, places, prices and the list. Nothing else.
    for (const item of itemsOf(lists()[0])) {
      expect(Object.keys(item).sort()).toEqual(['index', 'item_category', 'item_id', 'item_list_id', 'item_list_name', 'item_name', 'quantity']);
    }
  });
});

describe('states and money (AC6)', () => {
  it('embedBooking_Loading_IsASkeletonAnnouncedAndNothingElse', async () => {
    getStays.mockImplementation(() => new Promise<PublicStaysResult>(() => undefined));
    open(DATES);

    const loading = await screen.findByTestId('search-loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('search-no-results')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-error')).not.toBeInTheDocument();
    expect(cards()).toHaveLength(0);
  });

  it('embedBooking_AnAnswerThatFailed_IsAnErrorWithARetry_NeverAnEmptyListAsIfThereWereNoHomes', async () => {
    getStays.mockRejectedValue(httpError(400));
    open(DATES);

    const error = await screen.findByTestId('search-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('search-no-results')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();

    getStays.mockResolvedValue(staysResult(THREE));
    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findAllByTestId('house-card')).toHaveLength(3);
    expect(screen.queryByTestId('search-error')).not.toBeInTheDocument();
  });

  it('embedBooking_NothingFreeOnTheDates_SaysWhyAndOffersTheNearbyDates_WithNoWayToWriteToTheHost', async () => {
    getStays.mockResolvedValue(
      staysResult([stayCard(1, { availability: { available: false, reason: 'busy' } })], {
        checkIn: '2026-12-10',
        checkOut: '2026-12-13',
        nights: 3,
        alternatives: [{ checkIn: '2026-12-14', checkOut: '2026-12-17', availableCount: 2, fromPerNightCents: 14500 }],
      }),
    );
    open(DATES);

    const none = await screen.findByTestId('search-no-results');
    expect(none).toHaveAttribute('data-reason', 'dates');
    expect(within(none).getByRole('heading', { name: 'Nessuna casa libera per queste date' })).toBeInTheDocument();
    const alternative = within(none).getByTestId('search-alternative');
    // The nearby dates keep the rest of the address of the frame.
    expect(alternative.getAttribute('href')).toContain('checkin=2026-12-14');
    expect(alternative.getAttribute('href')).toContain('parent=');
    expect(screen.queryByTestId('search-write')).not.toBeInTheDocument();
    // «Try other dates» without «or write to the host»: there is no way to do it in the frame.
    expect(none).toHaveTextContent('In queste date le case sono già prenotate. Prova altre date, anche vicine.');
    expect(none).not.toHaveTextContent(/scrivi/i);
  });

  it('embedBooking_prices_useEachPropertyCurrency', async () => {
    // One list of two currencies: each home says the total of its own quote in its own currency; nothing is converted, added up or made the same.
    stubViewportWidth(1280);
    getStays.mockResolvedValue(
      staysResult(
        [
          stayCard(1, { name: 'Casa Lago', price: { currency: 'EUR', perNightCents: 14500, totalCents: 43500 } }),
          stayCard(2, { name: 'Chalet Ticino', price: { currency: 'CHF', perNightCents: 12000, totalCents: 36000 } }),
        ],
        { checkIn: '2026-12-10', checkOut: '2026-12-13', nights: 3 },
      ),
    );
    open(DATES);

    const [euro, franc] = await screen.findAllByTestId('house-card-price');
    expect(euro).toHaveTextContent('435');
    expect(euro).toHaveTextContent('€');
    expect(euro).not.toHaveTextContent('CHF');
    expect(franc).toHaveTextContent('360');
    expect(franc).toHaveTextContent('CHF');
    expect(franc).not.toHaveTextContent('€');
    // The pins of the map say the same.
    const labels = map.props?.pins.map((pin) => pin.label) ?? [];
    expect(labels[0]).toContain('€');
    expect(labels[1]).toContain('CHF');
    expect(labels[1]).toContain('360');
    // The event of the list sends no price at all for a list that mixes currencies: a number without its currency would be a wrong one.
    await waitFor(() => expect(page.sent('event')).toHaveLength(1));
    const [list] = events('view_item_list');
    expect(list.params.currency).toBeUndefined();
    expect(itemsOf(list).every((item) => item.price === undefined)).toBe(true);
  });

  it('embedBooking_prices_ofAHomeThatSaysNoCurrency_haveNoSymbolAndSayTheCurrencyIsNotAvailable', async () => {
    // CHF-MONEY: a home whose data carries no currency (an empty one, or none at all) is drawn with its amount only and the phrase that says so, never in a euro nobody said;
    // the home that says its currency keeps it, and the pins say the same as the cards.
    stubViewportWidth(1280);
    getStays.mockResolvedValue(
      staysResult(
        [
          stayCard(1, { name: 'Casa Lago', price: { currency: 'EUR', perNightCents: 14500, totalCents: 43500 } }),
          stayCard(2, { name: 'Casa Muta', price: { currency: '', perNightCents: 12000, totalCents: 36000 } }),
          stayCard(3, { name: 'Casa Senza', price: { currency: undefined as unknown as string, perNightCents: 11000, totalCents: 33000 } }),
        ],
        { checkIn: '2026-12-10', checkOut: '2026-12-13', nights: 3 },
      ),
    );
    open(DATES);

    const [euro, empty, missing] = await screen.findAllByTestId('house-card-price');
    expect(euro).toHaveTextContent('€');
    expect(euro).not.toHaveTextContent('valuta non disponibile');
    expect(empty).toHaveTextContent('360 (valuta non disponibile)');
    expect(missing).toHaveTextContent('330 (valuta non disponibile)');
    expect(empty).not.toHaveTextContent(/EUR|€/);
    expect(missing).not.toHaveTextContent(/EUR|€/);
    const labels = map.props?.pins.map((pin) => pin.label) ?? [];
    expect(labels[1]).toBe('360 (valuta non disponibile)');
    expect(labels[2]).toBe('330 (valuta non disponibile)');
  });

  it('embedBooking_searchesOnlyTheFrameOrg', async () => {
    // Whatever the address says, the org is the one of the frame: no parameter names another.
    setHostSite({ host: 'prenota.villa-rossi.example.test', slug: ORG_SLUG, displayName: 'Villa Rossi', embedEnabled: true });
    renderWidgets(`/embed/booking?${DATES}&org=other-org&orgSlug=other-org&slug=other-org&${FRAME_QUERY}`, { mode: 'host' });
    await screen.findAllByTestId('house-card');
    fireEvent.click(screen.getByTestId('search-filters-open'));
    await screen.findByTestId('search-filters-panel');

    const asked = [getPublicOrg, getStays, getSiteCalendar, getDestinations].flatMap((spy) => spy.mock.calls.map((call) => call[0]));
    expect(asked.length).toBeGreaterThan(4);
    expect(new Set(asked)).toEqual(new Set([ORG_SLUG]));
  });

  it('embedBooking_OnTheCasazenDomain_TheOrgIsTheSlugOfThePathAndNoParameterOfTheAddressChangesIt', async () => {
    renderWidgets(`/embed/other-site/booking?${DATES}&org=${ORG_SLUG}&orgSlug=${ORG_SLUG}&${FRAME_QUERY}`);
    await screen.findAllByTestId('house-card');

    expect(getStays.mock.calls.length).toBeGreaterThan(0);
    expect(new Set(getStays.mock.calls.map((call) => call[0]))).toEqual(new Set(['other-site']));
  });
});

describe('the pages of the site stay as they were (AC7)', () => {
  const card = stayCard(1);

  function renderCard() {
    return render(
      <MemoryRouter initialEntries={[`/book/${ORG_SLUG}/search`]}>
        <HouseCard card={card} orgSlug={ORG_SLUG} variant="row" nights={null} stay={null} />
      </MemoryRouter>,
    );
  }

  it('houseCard_OutsideAFrame_KeepsItsHeartAndLeadsToThePageOfTheSite', () => {
    renderCard();

    expect(screen.getByTestId('favorite-button')).toBeInTheDocument();
    expect(screen.getByTestId('house-card-link')).toHaveAttribute('href', `/book/${ORG_SLUG}/property/casa-001`);
  });

  it('favoriteButton_OutsideAFrame_StillSavesTheHomeOnTheDevice', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('favorite-button'));

    expect(JSON.parse(localStorage.getItem(`casazen.favorites.${ORG_SLUG}`) ?? '[]')).toEqual(['home-001']);
  });
});
