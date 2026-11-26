import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { publicBookingApi } from '@/api/public-booking.api';
import { publicOrgApi } from '@/api/public-org.api';
import { publicSiteSearchApi } from '@/api/public-site-search.api';
import type { EmbedMessage } from '@/embed/protocol';
import { addDays } from '@/lib/stay-dates';
import { freezeClock } from '@/test/clock';
import type { DirectBookingQuote, PublicCalendarDto, PublicOrgDto, PublicPropertyDetailDto } from '@/types';
import { APP_QUERY_DEFAULTS, FRAME_QUERY, PARENT, frameInsideAPage, newQueryClient, renderWidgets, spyOnTheBrowserMemory, type FramingPage, type MemorySpies } from './embed-test-kit';
import { DESTINATIONS, siteCalendar, stayCard, staysResult } from './stays-fixtures';

/**
 * The property widget in the frame (E41/F01/US02/T02, NF-144): one home with its availability and the quote of the stay of the address. «Book» is the ONLY
 * way out to the checkout of the three widgets, and it takes the whole page: a payment is never made inside a frame. What costs something when it is wrong is
 * held here: the total and the currency of the server's quote (shown and told to the page), no payment and no booking request in the frame, the exit only to
 * the origin of the frame, nothing kept in the browser, and nothing about the guest in what is told to the page.
 */
vi.mock('@/api/public-org.api', () => ({
  publicOrgApi: { getPublicOrg: vi.fn(), getOrgProperty: vi.fn(), getOrgPropertyCalendar: vi.fn() },
}));
vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: {
    quoteDirectBooking: vi.fn(),
    createDirectBooking: vi.fn(),
    resumeCheckoutPayment: vi.fn(),
    getCheckoutOutcome: vi.fn(),
    getPropertyAvailability: vi.fn(),
  },
}));
// The booking widget (a card of it leads here) asks the search of the site.
vi.mock('@/api/public-site-search.api', () => ({
  publicSiteSearchApi: { getStays: vi.fn(), getSiteCalendar: vi.fn(), getDestinations: vi.fn() },
}));

const TODAY = '2026-10-05';
const PROPERTY_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';
const ENTRY = '/embed/villa-rossi/property/villa-mare';
const STAY = 'checkin=2026-10-16&checkout=2026-10-19&guests=2';

const ORG: PublicOrgDto = { slug: 'villa-rossi', displayName: 'Villa Rossi', logoUrl: null, themeColor: null, contactEmail: 'ciao@villa-rossi.example', hostName: 'Giulia', canContactHost: true };

const property = {
  id: PROPERTY_ID,
  slug: 'villa-mare',
  name: 'Villa Mare',
  description: 'Vista mare, a due passi dalla spiaggia.',
  city: 'Napoli',
  postalCode: '80100',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 150,
  cleaningFee: 40,
  amenities: ['WiFi', 'Pool'],
  photoUrls: ['https://cdn.example.test/1.jpg', 'https://cdn.example.test/2.jpg', 'https://cdn.example.test/3.jpg'],
  cinCode: null,
  cinStatus: 'Missing',
  timezone: 'Europe/Rome',
  houseRules: 'Niente feste.',
  cancellationPolicySummary: 'Rimborso totale fino a 7 giorni prima.',
  minNights: null,
  currency: 'EUR',
  acceptsBookings: true,
  hostName: 'Giulia',
  publicPhone: '+390612345678',
  // A home with reviews: the frame does not show them, and the mark of the title is no link to them.
  ratingSummary: { count: 12, average: 4.8 },
} as PublicPropertyDetailDto;

const calendar: PublicCalendarDto = {
  propertyId: PROPERTY_ID,
  startDate: TODAY,
  endDate: addDays(TODAY, 90),
  today: TODAY,
  currency: 'EUR',
  generatedAt: `${TODAY}T08:00:00Z`,
  days: Array.from({ length: 90 }, (_, offset) => ({ date: addDays(TODAY, offset), available: true, nightlyPriceCents: 15000, minNights: 1 })),
};

const quote: DirectBookingQuote = {
  propertyId: PROPERTY_ID,
  checkInDate: '2026-10-16',
  checkOutDate: '2026-10-19',
  nights: 3,
  nightlyRate: 150,
  lodgingTotal: 467,
  cleaningFee: 40,
  basePrice: 507,
  touristTax: { status: 'Calculated', amount: 12.5, taxableNights: 3, ageRulesApply: false, categories: [] },
  totalPrice: 519.5,
  currency: 'EUR',
  paymentOptions: { deferredPaymentAvailable: false, deferredChargeDate: null, freeCancellationUntil: null },
  lines: [
    { kind: 'Nights', quantity: 2, unitAmountCents: 15000, amountCents: 30000 },
    { kind: 'WeekendNights', quantity: 1, unitAmountCents: 16700, amountCents: 16700 },
    { kind: 'CleaningFee', quantity: 1, unitAmountCents: 4000, amountCents: 4000 },
    { kind: 'TouristTax', quantity: null, unitAmountCents: null, amountCents: 1250 },
    { kind: 'Total', quantity: null, unitAmountCents: null, amountCents: 51950 },
  ],
};

/** The same home as a Swiss one, with the quote of the server in francs. */
const franc = { ...property, currency: 'CHF' } as PublicPropertyDetailDto;
const francQuote: DirectBookingQuote = { ...quote, currency: 'CHF' };

const getPublicOrg = vi.mocked(publicOrgApi.getPublicOrg);
const getOrgProperty = vi.mocked(publicOrgApi.getOrgProperty);
const getCalendar = vi.mocked(publicOrgApi.getOrgPropertyCalendar);
const quoteDirectBooking = vi.mocked(publicBookingApi.quoteDirectBooking);

function httpError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status, statusText: '', headers: {}, config, data: {} });
}

let page: FramingPage;
let spies: MemorySpies | undefined;

function open(search = STAY, options?: Parameters<typeof renderWidgets>[1]) {
  return renderWidgets(`${ENTRY}?${search ? `${search}&` : ''}${FRAME_QUERY}`, options);
}

/** What the frame told the page with `event`, by the name of the GA4 event. */
const events = (name: string) => page.sent('event').filter((message): message is EmbedMessage<'event'> => message.type === 'event' && message.name === name);
const navigations = () => page.sent('navigate') as EmbedMessage<'navigate'>[];
/**
 * Clicks, and says whether the widget took the click over (it called `preventDefault`: the browser then does not follow the link). The click is stopped
 * once it has been seen, so that the browser of the test does not try to leave the page.
 */
function click(element: Element, init?: MouseEventInit): boolean {
  let takenOver = false;
  const see = (event: Event) => {
    takenOver = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', see);
  fireEvent.click(element, init);
  document.removeEventListener('click', see);
  return takenOver;
}

/** «Prenota» once the quote of the stay is in: before, the same place holds a button that waits (no address). */
async function cta() {
  await waitFor(() => expect(screen.getByTestId('booking-cta')).toHaveAttribute('href'));
  return screen.getByTestId('booking-cta');
}

// The routes load the shell and the widgets when they are first needed: here they are loaded before the first test, so that none of them has to wait for it.
beforeAll(async () => {
  await Promise.all([import('../embed-shell'), import('../property-widget'), import('../booking-widget'), import('@/features/public-site/components/AmenityGrid')]);
}, 120_000);

beforeEach(async () => {
  freezeClock(`${TODAY}T10:00:00Z`);
  getPublicOrg.mockReset().mockResolvedValue(ORG);
  getOrgProperty.mockReset().mockResolvedValue(property);
  getCalendar.mockReset().mockResolvedValue(calendar);
  quoteDirectBooking.mockReset().mockResolvedValue(quote);
  vi.mocked(publicBookingApi.createDirectBooking).mockReset();
  vi.mocked(publicBookingApi.resumeCheckoutPayment).mockReset();
  vi.mocked(publicBookingApi.getCheckoutOutcome).mockReset();
  vi.mocked(publicSiteSearchApi.getStays).mockReset().mockResolvedValue(staysResult([stayCard(1, { id: PROPERTY_ID, slug: 'villa-mare', name: 'Villa Mare' })]));
  vi.mocked(publicSiteSearchApi.getSiteCalendar).mockReset().mockResolvedValue(siteCalendar(TODAY));
  vi.mocked(publicSiteSearchApi.getDestinations).mockReset().mockResolvedValue(DESTINATIONS);
  page = frameInsideAPage();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  spies?.restore();
  spies = undefined;
  page.restore();
  localStorage.clear();
  vi.useRealTimers();
});

describe('what the widget shows (AC1)', () => {
  it('embedProperty_Shows_GalleryHeaderOverviewAmenitiesAvailabilityQuoteAndRules', async () => {
    open();

    expect(await screen.findByTestId('embed-property')).toBeInTheDocument();
    expect(screen.getByTestId('embed-widget-property')).toBeInTheDocument();
    expect(screen.getByTestId('property-gallery')).toBeInTheDocument();
    expect(within(screen.getByTestId('property-header')).getByRole('heading', { level: 1 })).toHaveTextContent('Villa Mare');
    expect(screen.getByTestId('property-overview')).toHaveTextContent('Vista mare, a due passi dalla spiaggia.');
    expect(await screen.findByTestId('property-amenities')).toBeInTheDocument();
    expect(screen.getByTestId('property-availability')).toBeInTheDocument();
    // The server's quote of the stay of the address, the tourist tax in it, never added up here.
    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));
    expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('519,50');
    expect(screen.getByTestId('tourist-tax-line')).toBeInTheDocument();
    expect(screen.getByTestId('property-rules')).toBeInTheDocument();
    expect(quoteDirectBooking).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: PROPERTY_ID, checkInDate: '2026-10-16', checkOutDate: '2026-10-19', numberOfAdults: 2, numberOfChildren: 0 }),
      expect.anything(),
    );
  });

  it('embedProperty_LeavesOut_TheHostCardTheDialogsTheDockTheSheetTheReviewsTheSectionBarAndTheStructuredData', async () => {
    open();
    await screen.findByTestId('property-overview');
    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));

    // The card of the host and every way to write to the host (forms with personal data; one keeps a token in the storage of the browser).
    expect(screen.queryByTestId('property-host')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-host-call')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-host-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-host-write')).not.toBeInTheDocument();
    // The dock fixed to the window, its sheet, the bar of the sections, the reviews and the bar of the page (back, share).
    expect(screen.queryByTestId('booking-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-sheet')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mobile-booking-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-section-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-reviews')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-util-bar')).not.toBeInTheDocument();
    // No dialog, no structured data for the search engines (the page is `noindex`), and the mark of the title is not a link to the reviews that are not here.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
    expect(screen.getByTestId('property-rating').tagName).toBe('SPAN');
    expect(document.querySelector('a[href^="#"]')).toBeNull();
  });

  it('embedProperty_Card_IsInTheFlowAtEveryWidth', async () => {
    open();
    const card = await screen.findByTestId('booking-card');

    // Not the sticky aside of the desktop that appears only from a width up, and not the bar of the phone: one card, in the page.
    expect(card.closest('aside')).not.toBeNull();
    expect(card.closest('aside')?.className).not.toMatch(/sticky|fixed/);
    expect(screen.getAllByTestId('booking-card')).toHaveLength(1);
  });

  it('embedProperty_ThePhotosOfTheGallery_OpenNoViewer', async () => {
    open();
    const gallery = await screen.findByTestId('property-gallery');

    // A viewer is a dialog fixed to the window of a frame as tall as its content: far from the guest. The photos are there to be seen, not opened.
    expect(within(gallery).queryAllByRole('button')).toHaveLength(0);
    fireEvent.click(within(gallery).getAllByRole('img')[0]);
    expect(screen.queryByTestId('property-viewer')).not.toBeInTheDocument();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('embedProperty_AHomeThatTakesNoBookingOnline_ShowsNoBookAndOffersTheSite', async () => {
    getOrgProperty.mockResolvedValue({ ...property, acceptsBookings: false });
    open();

    expect(await screen.findByTestId('booking-not-bookable')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-cta')).not.toBeInTheDocument();
    expect(screen.getByTestId('embed-property-open-site')).toBeInTheDocument();
  });
});

describe('the exit to the checkout (AC2, AC3)', () => {
  it('embedCheckoutLink_url_isOnTheFrameOrigin', async () => {
    open(`${STAY}&utm_campaign=Estate-2026`);

    const book = await cta();
    expect(book.tagName).toBe('A');
    expect(book).toHaveAttribute('target', '_top');
    expect(book).toHaveAttribute('rel', 'noopener');
    expect(book).toHaveTextContent('Prenota');
    const url = new URL(book.getAttribute('href') ?? '');
    // The origin of the frame (the agency's domain, or CasaZen's): never another one, and never a page of the frame itself.
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/book/villa-rossi/property/villa-mare/checkout');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      checkin: '2026-10-16',
      checkout: '2026-10-19',
      guests: '2',
      lang: 'it',
      utm_source: 'agency-site',
      utm_medium: 'embed',
      utm_campaign: 'estate-2026',
    });
  });

  it('embedCheckoutLink_OnAnAgencyDomain_IsThePathWithNoBook', async () => {
    const { setHostSite } = await import('@/lib/host-site');
    setHostSite({ host: 'prenota.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi', embedEnabled: true });
    try {
      renderWidgets(`/embed/property/villa-mare?${STAY}&${FRAME_QUERY}`, { mode: 'host' });

      const url = new URL((await cta()).getAttribute('href') ?? '');
      expect(url.origin).toBe(window.location.origin);
      expect(url.pathname).toBe('/property/villa-mare/checkout');
    } finally {
      setHostSite(null);
    }
  });

  it('embedCheckoutLink_ACampaignThatIsNotAPlainName_NeverGoesOn', async () => {
    open(`${STAY}&utm_campaign=mario.rossi%40example.com`);

    const url = new URL((await cta()).getAttribute('href') ?? '');
    expect(url.searchParams.has('utm_campaign')).toBe(false);
    expect(url.searchParams.get('utm_source')).toBe('agency-site');
  });

  it('embedProperty_book_neverRendersPaymentInFrame', async () => {
    open();
    const book = await cta();

    // The exit is a link, and nothing of the payment is in the frame: no frame of its own, no script or element of the payment, no booking made.
    expect(book.tagName).toBe('A');
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('script[src*="stripe"]')).toBeNull();
    expect(document.querySelector('[data-testid*="stripe" i], [class*="StripeElement"], [id*="payment-element"]')).toBeNull();
    click(book);
    expect(publicBookingApi.createDirectBooking).not.toHaveBeenCalled();
    expect(publicBookingApi.resumeCheckoutPayment).not.toHaveBeenCalled();
    expect(publicBookingApi.getCheckoutOutcome).not.toHaveBeenCalled();
    // The only thing the frame asked of the booking API is the quote.
    expect(quoteDirectBooking).toHaveBeenCalled();
  });

  it('embedProperty_Book_WithTheLoaderAttached_TellsBeginCheckoutThenAsksThePageToTakeTheWholeWindow_AndTakesTheClickOver', async () => {
    open();
    await page.attach();
    const book = await cta();

    // What the frame already told the page (the home was viewed) is not the click.
    await waitFor(() => expect(events('view_item')).toHaveLength(1));
    const before = page.sent().length;

    const takenOver = click(book);

    expect(takenOver).toBe(true);
    const order = page.sent().slice(before).map((message) => message.type);
    expect(order).toEqual(['event', 'navigate']);
    expect(events('begin_checkout')).toHaveLength(1);
    const [begin] = events('begin_checkout');
    expect(begin.params).toMatchObject({ currency: 'EUR', value: 519.5 });
    expect((begin.params.items as { item_id: string; item_name: string; price: number }[])[0]).toMatchObject({ item_id: PROPERTY_ID, item_name: 'Villa Mare', price: 519.5, quantity: 1 });
    const [go] = navigations();
    expect(go.target).toBe('top');
    expect(go.url).toBe(book.getAttribute('href'));
    // Addressed to the origin of the page, never to every window.
    expect(page.posts().filter(([message]) => message.type === 'navigate' || message.type === 'event').every(([, target]) => target === PARENT)).toBe(true);
  });

  it('embedProperty_Book_WithNoLoader_LeavesTheClickToTheLinkAndSaysNothing', async () => {
    open();
    const book = await cta();

    // No loader answered (the frame was embedded by hand, or opened on its own): the anchor navigates the top window by itself.
    const takenOver = click(book);

    expect(takenOver).toBe(false);
    expect(events('begin_checkout')).toHaveLength(0);
    expect(navigations()).toHaveLength(0);
  });

  it('embedProperty_Book_AClickThatAsksForANewTabOrAWindow_IsLeftToTheBrowser', async () => {
    open();
    await page.attach();
    const book = await cta();

    expect(click(book, { ctrlKey: true })).toBe(false);
    expect(click(book, { metaKey: true })).toBe(false);
    expect(click(book, { button: 1 })).toBe(false);
    expect(navigations()).toHaveLength(0);
  });

  it('embedProperty_quote_usesServerTotalAndCurrency', async () => {
    // A home in Switzerland: the quote of the server is in francs and so is everything the frame says of it, shown and told. Nothing is converted.
    getOrgProperty.mockResolvedValue(franc);
    getCalendar.mockResolvedValue({ ...calendar, currency: 'CHF' });
    quoteDirectBooking.mockResolvedValue(francQuote);
    open();
    await page.attach();
    const book = await cta();

    expect(screen.getByTestId('booking-price')).toHaveTextContent('CHF');
    expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50');
    expect(screen.getByTestId('booking-price')).not.toHaveTextContent('€');
    expect(screen.getByTestId('price-breakdown-total')).toHaveTextContent('CHF');
    click(book);

    const [begin] = events('begin_checkout');
    // The total of the quote (the line `Total`, in cents, as the server sends it) in the currency of the quote.
    expect(begin.params).toMatchObject({ currency: 'CHF', value: 519.5 });
    expect((begin.params.items as { price: number }[])[0].price).toBe(519.5);
    await waitFor(() => expect(events('view_item')).toHaveLength(1));
    expect(events('view_item')[0].params).toMatchObject({ currency: 'CHF', value: 519.5 });
  });
});

describe('what is told to the page (AC5)', () => {
  it('embedProperty_ViewItem_IsSentOnceForTheHomeAndTheStay_WithTheTotalOfTheQuote', async () => {
    const { router, client } = open();
    await cta();

    await waitFor(() => expect(events('view_item')).toHaveLength(1));
    expect(events('view_item')[0].params).toMatchObject({ currency: 'EUR', value: 519.5 });
    expect((events('view_item')[0].params.items as { item_id: string; item_category: string }[])[0]).toMatchObject({ item_id: PROPERTY_ID, item_category: 'Napoli' });

    // The same quote asked again changes nothing; another stay is another event, told when its quote is in.
    await act(async () => {
      await client.refetchQueries({ queryKey: ['public-booking-quote'] });
    });
    expect(events('view_item')).toHaveLength(1);
    quoteDirectBooking.mockResolvedValue({ ...quote, checkOutDate: '2026-10-21', nights: 5, totalPrice: 800, lines: [{ kind: 'Total', quantity: null, unitAmountCents: null, amountCents: 80000 }] });
    await act(async () => {
      await router.navigate(`${ENTRY}?checkin=2026-10-16&checkout=2026-10-21&guests=2&${FRAME_QUERY}`);
    });
    await waitFor(() => expect(events('view_item')).toHaveLength(2));
    expect(events('view_item')[1].params).toMatchObject({ value: 800 });
  });

  it('embedProperty_ViewItem_WithNoDates_IsSentAtOnceWithNoMoney', async () => {
    open('');

    await waitFor(() => expect(events('view_item')).toHaveLength(1));
    // A total only with a quote of the server for a stay: no dates, no value and no currency (a number without its quote would be a made-up one).
    expect(events('view_item')[0].params.value).toBeUndefined();
    expect(events('view_item')[0].params.currency).toBeUndefined();
    expect(quoteDirectBooking).not.toHaveBeenCalled();
  });

  it('embedProperty_events_carryNoPersonalData', async () => {
    open(`${STAY}&email=mario%40rossi.it&phone=%2B393331234567&code=ABCDE-12345&token=gs1.secret&surname=Rossi`);
    await page.attach();
    click(await cta());
    await waitFor(() => expect(events('view_item')).toHaveLength(1));

    const said = JSON.stringify(page.posts());
    for (const secret of ['mario@rossi.it', 'mario%40', '393331234567', 'ABCDE-12345', 'gs1.secret', 'Rossi', 'surname', 'token', 'phone', 'email']) {
      expect(said).not.toContain(secret);
    }
    // Neither does the address of the checkout the page is asked to open.
    const [go] = navigations();
    for (const key of ['email', 'phone', 'code', 'token', 'surname']) expect(new URL(go.url).searchParams.has(key)).toBe(false);
  });

  it('embedProperty_WithoutAPageThatFramesIt_NothingIsPosted', async () => {
    page.restore();
    open();
    click(await cta());
    await waitFor(() => expect(screen.getByTestId('booking-price')).toHaveTextContent('519,50'));

    expect(page.window.postMessage).not.toHaveBeenCalled();
  });
});

describe('the states (AC6)', () => {
  it('embedProperty_Loading_IsASkeletonAnnounced', async () => {
    getOrgProperty.mockImplementation(() => new Promise(() => undefined));
    open();

    const skeleton = await screen.findByTestId('property-skeleton');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('embed-property')).not.toBeInTheDocument();
  });

  it('embedProperty_NotFound_IsNotAvailable_WithNoLink_AndTellsThePage', async () => {
    getOrgProperty.mockRejectedValue(httpError(404));
    open();

    const state = await screen.findByTestId('embed-property-not-found');
    expect(state).toHaveTextContent('Questa casa non è disponibile');
    expect(state).toHaveTextContent('non è più prenotabile online');
    expect(within(state).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('embed-property-error')).not.toBeInTheDocument();
    await waitFor(() => expect(page.sent('error').filter((message) => message.type === 'error' && message.code === 'not_found')).toHaveLength(1));
  });

  it('embedProperty_Error404WithAnOlderAnswerInTheCache_IsStillNotFound', async () => {
    // TanStack Query keeps the data of an earlier answer on an error: what the server says last wins. The client is the one of the app (an answer kept for five
    // minutes, never asked again on mount): the widget asks for itself, and the older answer is gone as soon as the server says «not found».
    const client = newQueryClient(APP_QUERY_DEFAULTS);
    client.setQueryData(['public-org-property', 'villa-rossi', 'villa-mare'], property);
    getOrgProperty.mockRejectedValue(httpError(404));
    open(STAY, { client });

    expect(await screen.findByTestId('embed-property-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('embed-property')).not.toBeInTheDocument();
    expect(getOrgProperty).toHaveBeenCalledTimes(1);
  });

  it('embedProperty_EachTimeItOpens_TheHomeIsAskedAgain_ShownAtOnceFromTheOlderAnswerAndCorrectedByTheNewOne', async () => {
    const client = newQueryClient(APP_QUERY_DEFAULTS);
    const { router } = open(STAY, { client });
    await screen.findByTestId('embed-property');
    expect(getOrgProperty).toHaveBeenCalledTimes(1);

    // The guest goes to the results and comes back to the home: the home is asked again although the app would keep the answer for five minutes. The page shows the
    // older answer while the new one is on its way.
    await act(async () => {
      await router.navigate(`/embed/villa-rossi/booking?${STAY}&${FRAME_QUERY}`);
    });
    await screen.findByTestId('embed-widget-booking');
    getOrgProperty.mockResolvedValue({ ...property, name: 'Villa Mare Nuova' });
    await act(async () => {
      await router.navigate(`${ENTRY}?${STAY}&${FRAME_QUERY}`);
    });

    expect(await screen.findByTestId('embed-property')).toBeInTheDocument();
    await waitFor(() => expect(getOrgProperty).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(screen.getByTestId('property-header')).getByRole('heading', { level: 1 })).toHaveTextContent('Villa Mare Nuova'));
  });

  it('embedProperty_AnotherFailure_IsAnErrorWithARetry_NeverNotFound_AndTellsThePage', async () => {
    getOrgProperty.mockRejectedValueOnce(httpError(500));
    open();

    const retry = await screen.findByRole('button', { name: 'Riprova' });
    expect(screen.getByTestId('embed-property-error')).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('embed-property-not-found')).not.toBeInTheDocument();
    await waitFor(() => expect(page.sent('error').filter((message) => message.type === 'error' && message.code === 'load_failed')).toHaveLength(1));

    fireEvent.click(retry);

    expect(await screen.findByTestId('embed-property')).toBeInTheDocument();
    expect(getOrgProperty).toHaveBeenCalledTimes(2);
  });

  it('embedProperty_WhileTheBrowserIsOffline_IsAnErrorWithARetry_NeverNotFound_AndTheHomeComesWhenTheConnectionDoes', async () => {
    // The read of the home waits for the network (TanStack Query pauses it, it is no more «loading»): there is no home yet and the server has said nothing, which is not
    // «this home does not exist». The org of the frame is already known (the shell is up), so the widget is what meets the offline browser.
    const client = newQueryClient(APP_QUERY_DEFAULTS);
    client.setQueryData(['public-org', 'villa-rossi'], ORG);
    onlineManager.setOnline(false);
    open(STAY, { client });

    const state = await screen.findByTestId('embed-property-error');
    expect(state).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('embed-property-not-found')).not.toBeInTheDocument();
    expect(getOrgProperty).not.toHaveBeenCalled();
    // The page that frames the widget hears `load_failed` and never `not_found`.
    await waitFor(() => expect(page.sent('error').filter((message) => message.type === 'error' && message.code === 'load_failed')).toHaveLength(1));
    expect(page.sent('error').filter((message) => message.type === 'error' && message.code === 'not_found')).toHaveLength(0);

    // The connection comes back: the read goes on by itself and the home is there.
    act(() => onlineManager.setOnline(true));

    expect(await screen.findByTestId('embed-property')).toBeInTheDocument();
    expect(screen.queryByTestId('embed-property-error')).not.toBeInTheDocument();
    expect(getOrgProperty).toHaveBeenCalledTimes(1);
  });

  it('embedProperty_TheStayProblems_AreTheOnesOfTheSitePage', async () => {
    // The stay of the address does not fit the home: the card says it, as on the page of the site, and there is no way to book.
    open('checkin=2026-10-16&checkout=2026-10-19&guests=9');

    const problem = await screen.findByTestId('stay-problem');
    expect(problem).toHaveAttribute('data-problem', 'tooManyGuests');
    expect(screen.getByTestId('booking-cta')).not.toHaveAttribute('href');
  });
});

describe('where the guest can go (AC4)', () => {
  it('embedProperty_BackToResults_OnlyWithFromBooking_AndKeepsTheStay', async () => {
    open(`${STAY}&from=booking&utm_campaign=estate-2026`);

    const back = await screen.findByTestId('embed-property-back');
    // Opened on its own (the address says where from, but this frame never showed the results): a link to the booking widget with the same stay.
    expect(back.tagName).toBe('A');
    expect(back).toHaveTextContent('Torna ai risultati');
    const url = new URL(back.getAttribute('href') ?? '', 'https://frame.example');
    expect(url.pathname).toBe('/embed/villa-rossi/booking');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      checkin: '2026-10-16',
      checkout: '2026-10-19',
      guests: '2',
      utm_campaign: 'estate-2026',
      lang: 'it',
      parent: PARENT,
      v: '1',
    });
  });

  it('embedProperty_NoBackToResults_WithoutFromBooking', async () => {
    open();
    await screen.findByTestId('embed-property-nav');

    expect(screen.queryByTestId('embed-property-back')).not.toBeInTheDocument();
  });

  it('embedProperty_OpenOnTheSite_IsALinkOfTheWholeWindow_ToThePageOfTheHome_WithTheStayAndTheSameAttribution', async () => {
    open(`${STAY}&utm_campaign=estate-2026`);

    const site = await screen.findByTestId('embed-property-open-site');
    expect(site).toHaveAttribute('target', '_top');
    expect(site).toHaveAttribute('rel', 'noopener');
    expect(site).toHaveTextContent('Apri sul sito');
    const url = new URL(site.getAttribute('href') ?? '');
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/book/villa-rossi/property/villa-mare');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      checkin: '2026-10-16',
      checkout: '2026-10-19',
      guests: '2',
      lang: 'it',
      utm_source: 'agency-site',
      utm_medium: 'embed',
      utm_campaign: 'estate-2026',
    });
  });

  it('embedProperty_FromTheCardOfTheBookingWidget_BackToResultsGoesBackInTheFrame_WithTheFiltersOfTheList', async () => {
    const { router } = renderWidgets(`/embed/villa-rossi/booking?${STAY}&sort=priceAsc&${FRAME_QUERY}`);
    const [card] = await screen.findAllByTestId('house-card-link');

    fireEvent.click(card);

    // The home opened by a link of this very frame: the step back is the list, as the guest left it.
    const back = await screen.findByTestId('embed-property-back');
    expect(back.tagName).toBe('BUTTON');
    expect(router.state.location.pathname).toBe(ENTRY);
    fireEvent.click(back);

    await waitFor(() => expect(router.state.location.pathname).toBe('/embed/villa-rossi/booking'));
    expect(router.state.location.search).toContain('sort=priceAsc');
    expect(await screen.findAllByTestId('house-card')).toHaveLength(1);
  });
});

describe('nothing is kept in the browser (AC7)', () => {
  it('embedProperty_noStorageOrCookies', async () => {
    // What the site keeps (the token of the chat with the host, the hearts, the language of the guest): the frame neither reads it nor writes anything.
    localStorage.setItem('casazen.favorites.villa-rossi', JSON.stringify([PROPERTY_ID]));
    localStorage.setItem('casazen.storefrontChat.villa-rossi', 'secret-token');
    localStorage.setItem('casazen.locale', 'en');

    open(STAY, { afterRouter: () => (spies = spyOnTheBrowserMemory()) });
    await page.attach();
    click(await cta());
    await screen.findByTestId('property-amenities');
    // Everything a guest does on the page: open the dates, close them, look at the photos.
    fireEvent.click(screen.getByTestId('booking-dates'));
    await screen.findByTestId('stay-popover');
    fireEvent.keyDown(screen.getByTestId('stay-popover'), { key: 'Escape' });
    fireEvent.click(within(screen.getByTestId('property-gallery')).getAllByRole('img')[0]);

    expect(spies?.calls()).toEqual([]);
  });

  it('embedProperty_noStorageOrCookies_InTheStatesThatShowNoHome', async () => {
    getOrgProperty.mockRejectedValue(httpError(404));
    open(STAY, { afterRouter: () => (spies = spyOnTheBrowserMemory()) });
    await screen.findByTestId('embed-property-not-found');
    expect(spies?.calls()).toEqual([]);
  });

  it('embedProperty_TheStayPickers_AreAPopoverAtEveryWidth_NeverASheet', async () => {
    open();
    await cta();

    fireEvent.click(screen.getByTestId('booking-dates'));

    const popover = await screen.findByTestId('stay-popover');
    expect(popover).toHaveAttribute('data-embed');
    expect(screen.queryByTestId('stay-sheet')).not.toBeInTheDocument();
  });
});
