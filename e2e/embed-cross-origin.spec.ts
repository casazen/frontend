import { test as base, expect, type Frame, type FrameLocator, type Page } from '@playwright/test';
import { mockOrgPropertyId, mockOrgPropertySlug } from './helpers/branded-booking-mock';
import { futureStay } from './helpers/direct-checkout-mock';
import {
  AGENCY_HOST,
  AGENCY_ORIGIN,
  GUEST_BOOKING_CODE,
  GUEST_EMAIL,
  GUEST_PHONE_LAST4,
  REFUSED_PATHS,
  WORDPRESS_ORIGIN,
  fulfillWordpressSite,
  mockAgencyApi,
  proxyAgencyDomain,
  vercelHeadersFor,
  type AgencyApi,
  type AgencyProxy,
} from './helpers/embed-fake-wordpress';

/**
 * Cross-origin proof of the embeddable widgets (E43/F01/US01/T01, NF-150): a page of ANOTHER origin that stands for the agency's WordPress site loads the real
 * built `embed.js`, the widgets mount from it, the height of the frame follows the content, «Book» takes the WHOLE page to the checkout of the agency domain, the
 * events reach `dataLayer`, the guest-access widget ends on the guest area, and the pages that must never be framed refuse to be. It is the executable form of
 * AC-NF150-1, AC-NF150-2, AC-NF144-1, AC-NF144-2, AC-NF144-3, AC-NF145-1 and AC-NF145-3.
 *
 * It runs only in the mode `E2E_EMBED=1` (`npm run test:e2e:embed`, the job `e2e-embed`): Playwright builds the app and serves it, the two origins are
 * fictitious and answered by Playwright itself (see `helpers/embed-fake-wordpress.ts`), the API is mocked: no network, no certificate, no Stripe, no real backend.
 */

const test = base.extend<{ world: { proxy: AgencyProxy; api: AgencyApi } }>({
  world: [
    async ({ context, page }, use) => {
      await fulfillWordpressSite(context);
      const proxy = await proxyAgencyDomain(context);
      const api = await mockAgencyApi(page);
      await use({ proxy, api });
    },
    { auto: true },
  ],
});

const BOOKING_FRAME = 'iframe[src*="/embed/booking"]';
const GUEST_FRAME = 'iframe[src*="/embed/guest-access"]';

const SLOW = { timeout: 20_000 };

const STAY = futureStay(30, 3);
const STAY_QUERY = { checkin: STAY.checkIn, checkout: STAY.checkOut, guests: '2' };
const CHECKOUT_PATH = `/property/${mockOrgPropertySlug}/checkout`;

function standInUrl(path: string, query: Record<string, string> = {}): string {
  const url = new URL(path, WORDPRESS_ORIGIN);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  return url.toString();
}

interface StandInWindow {
  dataLayer: { event?: string; ecommerce?: unknown }[];
  __czEvents: { name: string; widget: string }[];
}

const dataLayerOf = (page: Page) => page.evaluate(() => (window as unknown as StandInWindow).dataLayer);
const domEventsOf = (page: Page) => page.evaluate(() => (window as unknown as StandInWindow).__czEvents);

function watchFramedAddresses(page: Page): string[] {
  const addresses: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame.parentFrame() !== null && new URL(page.url()).origin === WORDPRESS_ORIGIN) addresses.push(frame.url());
  });
  return addresses;
}

async function contentFrameOf(page: Page, selector: string): Promise<Frame> {
  const frame = await (await page.locator(selector).elementHandle())?.contentFrame();
  if (!frame) throw new Error(`${selector} has no frame.`);
  return frame;
}

async function openBookingPage(page: Page, query: Record<string, string> = {}): Promise<FrameLocator> {
  await page.goto(standInUrl('/prenota/', query), { waitUntil: 'domcontentloaded' });
  const frame = page.frameLocator(BOOKING_FRAME);
  await expect(frame.getByTestId('house-card')).toHaveCount(2, SLOW);
  return frame;
}

async function openTheHome(frame: FrameLocator) {
  await frame.getByTestId('house-card').filter({ hasText: 'Trastevere Suite' }).getByTestId('house-card-link').click();
  const book = frame.locator('a[data-testid="booking-cta"]').first();
  await expect(book).toBeVisible(SLOW);
  return book;
}

async function bookTheStay(page: Page, campaign: string): Promise<URL> {
  const book = await openTheHome(await openBookingPage(page, { ...STAY_QUERY, utm_campaign: campaign }));
  await book.click();
  await expect(page).toHaveURL((url) => url.origin === AGENCY_ORIGIN && url.pathname === CHECKOUT_PATH, { timeout: 20_000 });
  return new URL(page.url());
}

async function expectTheBookingWidgetMounted(page: Page): Promise<void> {
  await page.goto(standInUrl('/prenota/'), { waitUntil: 'domcontentloaded' });
  expect(new URL(page.url()).origin).toBe(WORDPRESS_ORIGIN);
  expect(new URL(page.url()).origin).not.toBe(AGENCY_ORIGIN);

  const iframe = page.locator(BOOKING_FRAME);
  await expect(iframe).toBeAttached();
  await expect(iframe).toHaveAttribute('title', /\S/);
  await expect(iframe).toHaveAttribute('loading', 'lazy');
  await expect(iframe).toHaveAttribute('referrerpolicy', 'origin');
  const address = new URL((await iframe.getAttribute('src')) ?? '');
  expect(address.origin).toBe(AGENCY_ORIGIN);
  expect(address.pathname).toBe('/embed/booking');
  expect(address.searchParams.get('parent')).toBe(WORDPRESS_ORIGIN);
  expect(address.searchParams.get('v')).toBe('1');

  const frame = page.frameLocator(BOOKING_FRAME);
  await expect(frame.getByTestId('house-card')).toHaveCount(2, SLOW);
  await expect(frame.getByTestId('house-card').nth(0)).toContainText('Trastevere Suite');
  await expect(frame.getByTestId('house-card').nth(1)).toContainText('Centro Storico Loft');
}

test.describe('embeddable widgets on a page of another origin (NF-150)', () => {
  test.describe.configure({ timeout: 60_000 });

  test('embed_wordpressPage_mountsTheBookingWidgetFromAnotherOrigin', async ({ page }) => {
    await expectTheBookingWidgetMounted(page);
  });

  test('embed_contentChange_iframeHeightFollowsWithoutScrollbar', async ({ page }) => {
    await openBookingPage(page);
    const frame = await contentFrameOf(page, BOOKING_FRAME);

    const measure = async () => {
      const box = await page.locator(BOOKING_FRAME).boundingBox();
      const inside = await frame.evaluate(() => ({
        content: document.documentElement.scrollHeight,
        shown: document.documentElement.clientHeight,
      }));
      return { iframe: box?.height ?? 0, content: inside.content, scrollbar: inside.content > inside.shown + 1 };
    };
    const expectItFits = async () => {
      const { iframe, content, scrollbar } = await measure();
      expect(Math.abs(iframe - content), `the iframe is ${iframe}px tall, its content ${content}px`).toBeLessThanOrEqual(2);
      expect(scrollbar, 'the frame would show a vertical scrollbar').toBe(false);
      return iframe;
    };

    let wide = 0;
    await expect(async () => {
      wide = await expectItFits();
    }).toPass({ timeout: 15_000 });
    expect(wide, 'the frame grew past its initial height').toBeGreaterThan(360);

    await page.setViewportSize({ width: 420, height: 900 });
    await expect(async () => {
      const narrow = await expectItFits();
      expect(narrow, 'the narrow page is taller than the wide one').toBeGreaterThan(wide);
    }).toPass({ timeout: 15_000 });
  });

  test('embed_book_navigatesTheWholePageToTheAgencyCheckout', async ({ page }) => {
    const framed = watchFramedAddresses(page);

    const checkout = await bookTheStay(page, 'estate-2026');

    expect(checkout.origin).toBe(AGENCY_ORIGIN);
    expect(Object.fromEntries(checkout.searchParams)).toMatchObject({
      checkin: STAY.checkIn,
      checkout: STAY.checkOut,
      guests: '2',
      lang: 'it',
      utm_source: 'agency-site',
      utm_medium: 'embed',
      utm_campaign: 'estate-2026',
    });
    expect(checkout.href).not.toContain('sito-wordpress');
    expect(checkout.searchParams.has('parent')).toBe(false);

    await expect(page.getByTestId('direct-checkout-page')).toBeVisible(SLOW);
    expect(await page.evaluate(() => document.referrer)).toMatch(/^https:\/\/sito-wordpress\.test/);

    expect(framed.some((address) => address.startsWith(`${AGENCY_ORIGIN}/embed/`)), 'the widget was the frame the stay left from').toBe(true);
    expect(framed.filter((address) => /stripe\.com|\/checkout/.test(address)), 'a frame of the page pointed at the payment').toEqual([]);

    const withPhone = await bookTheStay(page, '3331234567');
    expect(withPhone.searchParams.has('utm_campaign')).toBe(false);
    expect(withPhone.href).not.toContain('3331234567');
    expect(withPhone.searchParams.get('utm_source')).toBe('agency-site');
  });

  test('embed_resultsEvent_reachesDataLayerWithGa4Shape', async ({ page }) => {
    const frame = await openBookingPage(page);

    await expect
      .poll(async () => (await dataLayerOf(page)).filter((entry) => entry.event === 'view_item_list').length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    const layer = await dataLayerOf(page);
    const listAt = layer.findIndex((entry) => entry.event === 'view_item_list');
    expect(layer[listAt - 1]).toEqual({ ecommerce: null });
    expect(layer[listAt].ecommerce).toMatchObject({
      item_list_id: 'search_results',
      items: [
        expect.objectContaining({ item_id: mockOrgPropertyId, item_name: 'Trastevere Suite', item_category: 'Roma', index: 0, quantity: 1 }),
        expect.objectContaining({ item_name: 'Centro Storico Loft', index: 1, quantity: 1 }),
      ],
    });
    expect((await domEventsOf(page)).map((event) => `${event.widget}:${event.name}`)).toContain('booking:view_item_list');

    await frame.getByTestId('house-card').filter({ hasText: 'Trastevere Suite' }).getByTestId('house-card-link').click();
    await expect
      .poll(async () => (await dataLayerOf(page)).filter((entry) => entry.event === 'view_item').length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    const viewed = (await dataLayerOf(page)).find((entry) => entry.event === 'view_item');
    expect(viewed?.ecommerce).toMatchObject({ items: [expect.objectContaining({ item_id: mockOrgPropertyId, item_name: 'Trastevere Suite', quantity: 1 })] });
    expect((await domEventsOf(page)).map((event) => event.name)).toContain('view_item');
  });

  test('embed_guestAccess_endsOnTheGuestAreaOfTheAgencyDomain', async ({ page, world }) => {
    const requested: string[] = [];
    page.on('request', (request) => requested.push(request.url()));

    await page.goto(standInUrl('/check-in-online/'), { waitUntil: 'domcontentloaded' });
    const form = page.frameLocator(GUEST_FRAME).getByTestId('embed-guest-access-form');
    await expect(form).toBeVisible(SLOW);

    await expect(form.locator('input:not([type="hidden"])')).toHaveCount(1);
    await form.getByTestId('embed-guest-access-code').fill(GUEST_BOOKING_CODE);
    await form.getByTestId('embed-guest-access-submit').click();

    await expect(page).toHaveURL((url) => url.origin === AGENCY_ORIGIN && url.pathname === '/my-bookings', { timeout: 20_000 });
    const arrived = new URL(page.url());
    expect([...arrived.searchParams.keys()].sort()).toEqual(['code', 'lang']);
    expect(arrived.searchParams.get('code')).toBe(GUEST_BOOKING_CODE);
    expect(requested.filter((address) => /\/api\/public\/(guest|bookings\/lookup)/.test(address))).toEqual([]);

    await expect(page.locator('#guest-booking-code')).toHaveValue(GUEST_BOOKING_CODE, SLOW);
    const notFound = page.getByTestId('guest-bookings-not-found');
    const lookUp = async (code: string, proof: { email: string } | { phoneLast4: string }) => {
      await page.locator('#guest-booking-code').fill(code);
      if ('phoneLast4' in proof) {
        await page.locator('label:has([data-testid="guest-access-proof-phone"])').click();
        await page.getByTestId('guest-booking-phone-last4').fill(proof.phoneLast4);
      } else {
        await page.locator('label:has([data-testid="guest-access-proof-email"])').click();
        await page.locator('#guest-booking-email').fill(proof.email);
      }
      await page.locator('[data-testid="guest-bookings-form"] button[type="submit"]').click();
    };

    await lookUp('ABCDE-FGH12', { email: GUEST_EMAIL });
    await expect(notFound).toBeVisible();
    const generic = (await notFound.textContent()) ?? '';
    expect(generic, 'the answer says something').toMatch(/\S/);
    await lookUp(GUEST_BOOKING_CODE, { email: 'altra@example.com' });
    await expect(notFound).toHaveText(generic);
    await lookUp(GUEST_BOOKING_CODE, { phoneLast4: '0000' });
    await expect(notFound).toHaveText(generic);
    expect(world.api.guestLookups).toHaveLength(3);

    await lookUp(GUEST_BOOKING_CODE, { email: GUEST_EMAIL });
    await expect(page.getByTestId('guest-booking-result')).toBeVisible();
    await page.getByTestId('guest-bookings-search-another').click();

    // ...as do the last four digits of the phone, instead of the e-mail.
    await expect(page.locator('#guest-booking-code')).toHaveValue(GUEST_BOOKING_CODE);
    await lookUp(GUEST_BOOKING_CODE, { phoneLast4: GUEST_PHONE_LAST4 });
    await expect(page.getByTestId('guest-booking-result')).toBeVisible();

    expect(world.api.guestLookups).toEqual([
      { orgSlug: 'demo-casazen', bookingCode: 'ABCDE-FGH12', email: GUEST_EMAIL },
      { orgSlug: 'demo-casazen', bookingCode: GUEST_BOOKING_CODE, email: 'altra@example.com' },
      { orgSlug: 'demo-casazen', bookingCode: GUEST_BOOKING_CODE, phoneLast4: '0000' },
      { orgSlug: 'demo-casazen', bookingCode: GUEST_BOOKING_CODE, email: GUEST_EMAIL },
      { orgSlug: 'demo-casazen', bookingCode: GUEST_BOOKING_CODE, phoneLast4: GUEST_PHONE_LAST4 },
    ]);
  });

  test('embed_hostAndSensitivePages_refuseToBeFramed', async ({ page, world }) => {
    const consoleLines: string[] = [];
    page.on('console', (message) => consoleLines.push(message.text()));

    await page.goto(standInUrl('/tentativi-di-incorniciatura/'), { waitUntil: 'domcontentloaded' });

    const widget = page.frameLocator('iframe[name="widget"]');
    await expect(widget.getByTestId('embed-shell')).toHaveAttribute('data-state', 'ready', SLOW);
    await expect(widget.getByTestId('house-card')).toHaveCount(2, SLOW);
    const control = vercelHeadersFor('/embed/booking');
    expect(control.headers['content-security-policy']).toBe('frame-ancestors https:');
    expect(control.headers['x-frame-options']).toBeUndefined();
    const framable = world.proxy.documents.find((document) => document.path === '/embed/booking');
    expect(framable?.headers['content-security-policy'], 'the page of the widget was framable').toBe('frame-ancestors https:');
    expect(framable?.headers['x-frame-options']).toBeUndefined();

    for (const [index, path] of REFUSED_PATHS.entries()) {
      const address = `${AGENCY_ORIGIN}${path}`;

      // `vercel.json` has exactly one rule for the path (`vercelHeadersFor` throws otherwise), and it keeps every other site's frames out.
      const { headers } = vercelHeadersFor(path);
      expect(headers['content-security-policy'], path).toBe("frame-ancestors 'none'");
      expect(headers['x-frame-options'], path).toBe('DENY');

      await expect(async () => {
        const served = world.proxy.documents.filter((document) => document.path === new URL(address).pathname);
        expect(served.length, `${path} was asked of the agency domain`).toBeGreaterThan(0);
        for (const document of served) {
          expect(document.headers['content-security-policy'], path).toBe(headers['content-security-policy']);
          expect(document.headers['x-frame-options'], path).toBe(headers['x-frame-options']);
        }

        const frame = await contentFrameOf(page, `iframe[name="refused-${index}"]`);
        const said = consoleLines.some((line) => /^Refused to (frame|display)/.test(line) && line.includes(`'${address}'`));
        const errorPage = frame.url() === 'chrome-error://chromewebdata/';
        expect(said || errorPage, `${path}: Chromium refused the frame (the frame is at ${frame.url()})`).toBe(true);
        if (!errorPage) expect(await frame.locator('#root > *').count(), `${path}: the app rendered inside the frame`).toBe(0);
      }).toPass({ timeout: 15_000 });
    }
  });

  test('embed_storageBlocked_widgetStillWorks', async ({ page, context }) => {
    await context.addInitScript((host: string) => {
      if (location.hostname !== host || window.self === window.top) return;
      const refuse = (): never => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: refuse });
      Object.defineProperty(window, 'sessionStorage', { configurable: true, get: refuse });
      Object.defineProperty(Document.prototype, 'cookie', { configurable: true, get: refuse, set: refuse });
    }, AGENCY_HOST);

    await expectTheBookingWidgetMounted(page);
    const checkout = await bookTheStay(page, 'estate-2026');
    expect(checkout.searchParams.get('utm_source')).toBe('agency-site');
    expect(checkout.searchParams.get('utm_medium')).toBe('embed');
    await expect(page.getByTestId('direct-checkout-page')).toBeVisible(SLOW);

    expect(await context.cookies(AGENCY_ORIGIN)).toEqual([]);
  });
});
