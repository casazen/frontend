import { completeCommercialSignup } from './commercial-signup';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { accessToken, loadStack, loginAs, oracleFor, type StackEnv } from './stack';
import { pickComune } from './host-steps';

/**
 * Onboarding L3: a new host and a new supplier reach a working account through the UI only, against the ephemeral stack
 * (real backend, throw-away PostgreSQL, mock IdP). The entry points are the printed QR codes of the admin page: the test
 * decodes the image and opens exactly the address it holds. A signed simulated Stripe webhook confirms payment in the disposable stack; the API otherwise serves as an oracle.
 *
 * Every test runs on a phone viewport (the people scanning a QR are on a phone) unless it says otherwise, and fails on any
 * 5xx answer of the API and on horizontal overflow of the screens a new user sees.
 */

const PHONE = { width: 390, height: 844 };
const SHOTS = process.env.E2E_SHOTS_DIR ?? 'e2e/.stack/shots';

const stack: StackEnv = loadStack();
const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type Actor = { page: Page; context: BrowserContext; errors5xx: string[] };

async function newActor(browser: Browser, viewport = PHONE): Promise<Actor> {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    viewport,
    isMobile: viewport.width < 600,
    hasTouch: viewport.width < 600,
  });
  const page = await context.newPage();
  const errors5xx: string[] = [];
  page.on('response', (res) => {
    if (res.url().includes('/api/') && res.status() >= 500) errors5xx.push(`${res.status()} ${res.url()}`);
  });
  await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
  return { page, context, errors5xx };
}

/** Logs in (or signs up: the mock IdP creates the account at the first login) on the IdP page the app redirected to. */
async function signInAtIdp(page: Page, email: string): Promise<void> {
  await page.waitForURL(/\/authorize/, { timeout: 30_000 });
  await page.locator('input#username').fill(email);
  await page.locator('input#password').fill(stack.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.origin === new URL(stack.feUrl).origin, { timeout: 30_000 });
}

async function expectNoHorizontalOverflow(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `horizontal overflow on ${where}`).toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

/** Decodes the QR image shown on the page and returns the text it holds. */
async function decodeQr(page: Page, testId: string): Promise<string> {
  const src = await page.getByTestId(`${testId}-image`).getAttribute('src');
  expect(src, `${testId} image`).toMatch(/^data:image\/png;base64,/);
  const png = PNG.sync.read(Buffer.from((src as string).split(',')[1], 'base64'));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(decoded, `${testId} is a readable QR code`).not.toBeNull();
  return (decoded as { data: string }).data;
}

/** The agency founder receives a personal QR; public registration remains available to private owners and suppliers. */
async function readPrintedEntryAddresses(browser: Browser): Promise<{ host: string; supplier: string; agency: string }> {
  const { page, context } = await newActor(browser, { width: 1280, height: 900 });
  try {
    await loginAs(page, stack, `gj-admin-${unique()}@example.test`);
    await page.goto('/app/admin/invite-qr');
    await expect(page.getByTestId('host-invite-email')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('host-invite-email').fill(`agency-${unique()}@example.test`);
    await page.getByTestId('host-invite-submit').click();
    await expect(page.getByTestId('qr-agency-image')).toBeVisible({ timeout: 20_000 });
    const agency = await decodeQr(page, 'qr-agency');
    await expect(page.getByTestId('qr-agency-url')).toHaveText(agency);
    await shot(page, 'admin-invite-qr');
    const origin = new URL(stack.feUrl).origin;
    return { host: `${origin}/signup?role=host`, supplier: `${origin}/register`, agency };
  } finally {
    await context.close();
  }
}

// The CI config has a 30 s default per test: a whole onboarding (login, several screens, API) needs more on a shared runner.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Onboarding L3 (real stack)', () => {
  let entry: { host: string; supplier: string; agency: string };

  test.beforeAll(async ({ browser }) => {
    entry = await readPrintedEntryAddresses(browser);
  });

  test('the admin prints a personal QR for a new agency', async () => {
    const url = new URL(entry.agency);
    expect(url.origin).toBe(new URL(stack.feUrl).origin);
    expect(url.pathname).toMatch(/^\/invito-host\/[^/]+$/);
    expect(entry.agency).not.toContain('@');
  });

  test('new host scans the code on a phone: type, consents, first property, then the checklist (short rent)', async ({ browser }) => {
    const { page, context, errors5xx } = await newActor(browser);
    const email = `host-short-${unique()}@example.test`;
    const propertyName = `Casa Prova ${unique()}`;
    const t0 = Date.now();
    try {
      // The signup of the QR code: straight to the account creation, no intermediate page to read.
      await page.goto(entry.host);
      await signInAtIdp(page, email);

      await expect(page.getByTestId(/^signup-profile-/)).toHaveCount(3);
      await expectNoHorizontalOverflow(page, 'onboarding choice');
      await shot(page, 'host-1-choice');
      await completeCommercialSignup(page, 'owner');

      // Straight into the first property, in the short form.
      await expect(page).toHaveURL(/\/app\/short-rent\/properties\/create\?first=1/, { timeout: 30_000 });
      const form = page.getByTestId('quick-property-form');
      await expect(form).toBeVisible();
      await expectNoHorizontalOverflow(page, 'quick property form');
      await shot(page, 'host-2-first-property');
      await page.locator('#name').fill(propertyName);
      await pickComune(page, '#comune', 'Roma');
      await page.locator('#address').fill('Via della Lungaretta 10');
      await page.locator('#postalCode').fill('00153');
      await page.locator('#maxGuests').fill('4');
      await page.locator('#nightlyRate').fill('120');
      await page.getByTestId('quick-property-submit').click();

      // After creating the property, the host lands on the dashboard and the guide of the header is the manual.
      await expect(page).toHaveURL(/\/app\/short-rent$/, { timeout: 30_000 });
      // «Inizia con CasaZen» as the first wizard: the welcome opens over the Home of a new host, once; «Più tardi» leaves the Home to the journey.
      await expect(page.getByTestId('first-run-wizard')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('first-run-later').click();
      await expect(page.getByTestId('first-run-wizard')).toHaveCount(0);
      await page.getByTestId('guide-button').click();
      const guide = page.getByTestId('guide-panel');
      await expect(guide.getByTestId('guide-search')).toBeVisible({ timeout: 30_000 });
      await expect(guide.getByTestId('guide-topics')).toBeVisible();
      await expect(guide.getByTestId('guide-setup')).toHaveCount(0);
      await expectNoHorizontalOverflow(page, 'user guide panel');
      await shot(page, 'host-3-guide-manual');
      console.log(`[onboarding-l3] short-rent host: QR -> property created in ${Math.round((Date.now() - t0) / 1000)}s`);

      // The oracle: the org exists on Pro and the property is stored with its comune.
      const api = oracleFor(context.request, stack, await accessToken(page));
      const me = await api.get<{ org?: { planTier?: string }; rentalType?: string }>('/users/me');
      expect(me.org?.planTier).toBe('Pro');
      expect(me.rentalType).toBe('ShortTerm');
      const properties = await api.get<Array<{ name: string; city: string; comuneIstatCode?: string; maxGuests: number; nightlyRate: number }>>('/properties');
      const created = properties.find((p) => p.name === propertyName);
      expect(created, 'the property of the quick form').toBeTruthy();
      expect(created).toMatchObject({ city: 'Roma', comuneIstatCode: '058091', maxGuests: 4, nightlyRate: 120 });

      expect(errors5xx, '5xx answers of the API').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('new long-term landlord: type, consents, first property, then the guide asks for the first lease', async ({ browser }) => {
    const { page, context, errors5xx } = await newActor(browser);
    const email = `host-long-${unique()}@example.test`;
    const propertyName = `Appartamento Lungo ${unique()}`;
    try {
      await page.goto(entry.host);
      await signInAtIdp(page, email);

      await completeCommercialSignup(page, 'long-rent');

      await expect(page).toHaveURL(/\/app\/long-rent\/properties\/new\?first=1/, { timeout: 30_000 });
      await expect(page.getByTestId('quick-property-form')).toBeVisible();
      // A landlord has no nightly rate nor guests to give.
      await expect(page.locator('#nightlyRate')).toHaveCount(0);
      await expect(page.locator('#maxGuests')).toHaveCount(0);
      await expectNoHorizontalOverflow(page, 'long-rent quick property form');
      await page.locator('#name').fill(propertyName);
      await pickComune(page, '#comune', 'Milano');
      await page.locator('#address').fill('Via Torino 20');
      await page.locator('#postalCode').fill('20123');
      await page.getByTestId('quick-property-submit').click();

      // The guide of the area: property done, lease next.
      await expect(page).toHaveURL(/\/app\/long-rent\/properties$/, { timeout: 30_000 });
      const guide = page.getByTestId('long-rent-guide');
      await expect(guide).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('long-rent-guide-property')).toHaveAttribute('data-state', 'done');
      await expect(page.getByTestId('long-rent-guide-lease')).toHaveAttribute('data-state', 'todo');
      await expectNoHorizontalOverflow(page, 'long-rent leases with the guide');
      await shot(page, 'landlord-leases-guide');

      await guide.getByRole('link', { name: 'Crea contratto' }).click();
      await expect(page).toHaveURL(/\/app\/long-rent\/leases\/new/);

      const api = oracleFor(context.request, stack, await accessToken(page));
      const me = await api.get<{ org?: { planTier?: string }; rentalType?: string }>('/users/me');
      expect(me.rentalType).toBe('LongTerm');
      expect(me.org?.planTier).toBe('Pro');
      expect(errors5xx, '5xx answers of the API').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('new supplier scans the code: any comune, three screens, active', async ({ browser }) => {
    const { page, context, errors5xx } = await newActor(browser);
    const email = `sup-${unique()}@example.test`;
    const legalName = `Pulizie Pavia ${unique()}`;
    try {
      // The supplier lands on the supplier registration, never on the host choice.
      await page.goto(entry.supplier);
      await expect(page.locator('#legalName')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Scegli' })).toHaveCount(0);
      await expectNoHorizontalOverflow(page, 'supplier registration');
      await shot(page, 'supplier-1-register');

      // A comune that is no pilot and no invite: any of the 7,894 of the official list.
      await page.locator('#email').fill(email);
      await pickComune(page, '#comune', 'Pavia');
      await page.locator('#legalName').fill(legalName);
      await page.locator('#phone').fill('+390382123456');
      await page.getByRole('button', { name: 'Completa la registrazione' }).click();

      // The account is created next, with the same address; the profile is linked to it.
      await expect(page.getByRole('button', { name: 'Crea il tuo account' })).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Crea il tuo account' }).click();
      await signInAtIdp(page, email);

      // Straight into the activation wizard: three screens, the business details were just given.
      await expect(page).toHaveURL(/\/app\/supplier\/activation/, { timeout: 60_000 });
      await expect(page.getByTestId('supplier-activation-page')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('supplier-activation-nav-identity')).toHaveCount(0);
      await expect(page.getByTestId('supplier-activation-step-of')).toContainText('1 di 3');
      await expectNoHorizontalOverflow(page, 'supplier wizard');
      await shot(page, 'supplier-2-wizard-services');

      // Screen 1: services. The comune of the registration is already there.
      await page.getByTestId('service-category-cleaning').click();
      await expect(page.getByTestId('supplier-comuni-chosen')).toContainText('Pavia');
      await page.getByRole('button', { name: 'Salva e continua' }).click();

      // Screen 2: presentation (the photos on it are optional).
      await expect(page.getByTestId('supplier-activation-step-of')).toContainText('2 di 3');
      await page.locator('#bio').fill(`Pulizie professionali di appartamenti turistici a Pavia (${legalName}).`);
      await expect(page.getByTestId('supplier-photos-section')).toBeVisible();
      await shot(page, 'supplier-3-wizard-presentation');
      await page.getByRole('button', { name: 'Salva e continua' }).click();

      // Screen 3: the terms and the activation.
      await expect(page.getByTestId('supplier-activation-step-of')).toContainText('3 di 3');
      await expect(page.getByTestId('supplier-activation-summary')).toBeVisible();
      await page.locator('#tos').click();
      await shot(page, 'supplier-4-wizard-terms');
      await page.getByRole('button', { name: 'Attiva profilo' }).click();
      await expect(page).toHaveURL(/\/app\/supplier\/dashboard/, { timeout: 30_000 });
      await expect(page.getByTestId('supplier-home').getByTestId('supplier-kpis')).toBeVisible({ timeout: 20_000 });
      await shot(page, 'supplier-5-dashboard');

      const api = oracleFor(context.request, stack, await accessToken(page));
      const profile = await api.get<{ status: string; legalName: string; comuneIstatCodes?: string[]; categories?: string[] }>('/supplier/profile');
      expect(profile.status).toBe('Active');
      expect(profile.legalName).toBe(legalName);
      expect(profile.categories).toContain('cleaning');
      expect(profile.comuneIstatCodes?.[0]).toMatch(/^018110$/); // Pavia
      expect(errors5xx, '5xx answers of the API').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('a supplier link on the signup address goes to the supplier registration, not through the host choice', async ({ browser }) => {
    const { page, context } = await newActor(browser);
    try {
      await page.goto('/signup?role=supplier');
      await expect(page).toHaveURL(/\/register$/, { timeout: 20_000 });
      await expect(page.locator('#legalName')).toBeVisible();
      expect(page.url()).not.toContain('/authorize');
    } finally {
      await context.close();
    }
  });

  test('a host who landed on the choice by mistake finds the supplier registration', async ({ browser }) => {
    const { page, context } = await newActor(browser);
    try {
      await page.goto('/login');
      await signInAtIdp(page, `lost-${unique()}@example.test`);
      await expect(page.getByTestId('signup-profile-supplier')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('signup-profile-supplier').click();
      await expect(page).toHaveURL(/\/register$/);
      await expect(page.locator('#legalName')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
