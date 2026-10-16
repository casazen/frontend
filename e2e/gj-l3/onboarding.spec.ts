import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { accessToken, loadStack, loginAs, oracleFor, type StackEnv } from './stack';
import { pickComune } from './host-steps';

/**
 * Onboarding L3: a new host and a new supplier reach a working account through the UI only, against the ephemeral stack
 * (real backend, throw-away PostgreSQL, mock IdP). The entry points are the printed QR codes of the admin page: the test
 * decodes the image and opens exactly the address it holds. The API is only an oracle for assertions.
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

/** The two entry addresses, as the admin page prints them (read from the QR images, not from the page text). */
async function readPrintedEntryAddresses(browser: Browser, campaign: string): Promise<{ host: string; supplier: string }> {
  const { page, context } = await newActor(browser, { width: 1280, height: 900 });
  try {
    await loginAs(page, stack, `gj-admin-${unique()}@example.test`);
    await page.goto('/app/admin/invite-qr');
    await expect(page.getByTestId('qr-supplier-image')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('qr-host-image')).toBeVisible();
    await page.getByTestId('qr-campaign-input').fill(campaign);
    // The host code follows the campaign: wait for the image to be redrawn with it.
    await expect(page.getByTestId('qr-host-url')).toContainText(`utm_campaign=${campaign}`);
    await expect.poll(async () => decodeQr(page, 'qr-host')).toContain(`utm_campaign=${campaign}`);
    const host = await decodeQr(page, 'qr-host');
    const supplier = await decodeQr(page, 'qr-supplier');
    // What is printed under the code is what the code holds.
    await expect(page.getByTestId('qr-host-url')).toHaveText(host);
    await expect(page.getByTestId('qr-supplier-url')).toHaveText(supplier);
    await shot(page, 'admin-invite-qr');
    return { host, supplier };
  } finally {
    await context.close();
  }
}

/** Accepts every consent of the onboarding and continues (the last screen: no plan is asked). */
async function acceptConsents(page: Page): Promise<void> {
  const consents = page.getByTestId('onboarding-consents-step');
  await expect(consents).toBeVisible({ timeout: 20_000 });
  for (const checkbox of await consents.getByRole('checkbox').all()) {
    if ((await checkbox.getAttribute('id')) !== 'marketing') await checkbox.click();
  }
  await page.getByTestId('onboarding-consents-continue').click();
}

// The CI config has a 30 s default per test: a whole onboarding (login, several screens, API) needs more on a shared runner.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Onboarding L3 (real stack)', () => {
  let entry: { host: string; supplier: string };

  test.beforeAll(async ({ browser }) => {
    entry = await readPrintedEntryAddresses(browser, `e2e-${unique()}`);
  });

  test('the admin prints two QR codes that hold the public entry addresses, without tokens', async () => {
    const origin = new URL(stack.feUrl).origin;
    expect(entry.supplier).toBe(`${origin}/register`);
    const host = new URL(entry.host);
    expect(host.origin + host.pathname).toBe(`${origin}/signup`);
    expect(host.searchParams.get('role')).toBe('host');
    expect(host.searchParams.get('utm_source')).toBe('qr');
    expect(host.searchParams.get('utm_medium')).toBe('print');
    // Nothing secret or personal in a code that anyone can photograph.
    expect(entry.host + entry.supplier).not.toMatch(/token|email|@/i);
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

      // Screen 1: only the choice of the host. The supplier is a quiet line, not a card that competes.
      await expect(page.getByRole('heading', { name: /Da dove vuoi iniziare/i })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('button', { name: 'Scegli' })).toHaveCount(3);
      await expect(page.getByRole('heading', { name: /Sono un fornitore/i })).toHaveCount(0);
      await expectNoHorizontalOverflow(page, 'onboarding choice');
      await shot(page, 'host-1-choice');
      await page.getByRole('button', { name: 'Scegli' }).first().click();

      // Screen 2: the consents, the last one. No plan is asked.
      await acceptConsents(page);
      await expect(page.getByTestId('plan-selection-grid')).toHaveCount(0);
      await expect(page.getByTestId('onboarding-roles-pending')).toHaveCount(0, { timeout: 20_000 });

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

      // The dashboard with the checklist: the property is done, the rest is asked one step at a time.
      await expect(page).toHaveURL(/\/app\/short-rent$/, { timeout: 30_000 });
      const checklist = page.getByTestId('activation-checklist');
      await expect(checklist).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('activation-step-property')).toHaveAttribute('data-state', 'done', { timeout: 20_000 });
      await expectNoHorizontalOverflow(page, 'dashboard with the checklist');
      // On a phone the text of a step keeps room to be read (it used to be squeezed to one word per line).
      const orgStep = page.getByTestId('activation-step-organization');
      await expect(orgStep).toBeVisible();
      expect((await orgStep.getByText(/organizzazione/i).first().boundingBox())?.width ?? 0).toBeGreaterThan(200);
      await shot(page, 'host-3-dashboard-checklist');
      console.log(`[onboarding-l3] short-rent host: QR -> property created in ${Math.round((Date.now() - t0) / 1000)}s`);

      // The oracle: the org exists on Starter and the property is stored with its comune.
      const api = oracleFor(context.request, stack, await accessToken(page));
      const me = await api.get<{ org?: { planTier?: string }; rentalType?: string }>('/users/me');
      expect(me.org?.planTier).toBe('Starter');
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

      await expect(page.getByRole('heading', { name: /Da dove vuoi iniziare/i })).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Scegli' }).nth(1).click(); // "Locazioni di lungo periodo"
      await acceptConsents(page);

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
      await expect(page).toHaveURL(/\/app\/long-rent\/leases$/, { timeout: 30_000 });
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
      expect(me.org?.planTier).toBe('Starter');
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
      await expect(page.getByTestId('supplier-getting-started').or(page.getByTestId('supplier-kpis'))).toBeVisible({ timeout: 20_000 });
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
      await expect(page.getByRole('heading', { name: /Da dove vuoi iniziare/i })).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('onboarding-supplier-register').click();
      await expect(page).toHaveURL(/\/register$/);
      await expect(page.locator('#legalName')).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
