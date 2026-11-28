import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { addDays, todayInRome } from '../src/lib/stay-dates';
import { wizardDraftKey } from '../src/lib/wizard-draft';
import { DEMO_ORG } from './helpers/org-api-mock';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { pinE2eLocale } from './helpers/locale';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockPropertyModeApi, type PropertyModeMock } from './helpers/property-mode-mock';
import { WIDER_LETTERS, expectInsideTheScreen, expectNoAxeViolations, expectNothingSticksOut, untilStill } from './helpers/ui-checks';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

const SHORT_ID = 'prop-mode-short-1';
const LONG_ID = 'prop-mode-long-1';
const SHORT_PAGE = `/app/short-rent/properties/${SHORT_ID}`;
const LONG_PAGE = `/app/long-rent/properties/${LONG_ID}`;

const wizard = (page: Page) => page.getByTestId('property-mode-wizard');
const next = (page: Page) => page.getByTestId('property-mode-next');
const finish = (page: Page) => page.getByTestId('property-mode-finish');
const date = (page: Page) => page.getByTestId('property-mode-date');

async function openShortProperty(page: Page, options: { scheduledFor?: string } = {}): Promise<PropertyModeMock> {
  await mockPropertiesApi(page, [
    buildCreatedProperty({ id: SHORT_ID, name: 'Villa Aurora', city: 'Roma', rentalMode: 'Short' }),
  ]);
  return mockPropertyModeApi(page, { propertyId: SHORT_ID, rentalMode: 'Short', ...options });
}

async function openLongProperty(page: Page): Promise<PropertyModeMock> {
  await mockLeasesApiEmpty(page);
  await mockPropertiesApi(page, [
    buildCreatedProperty({ id: LONG_ID, name: 'Bilocale Monza', city: 'Monza', rentalMode: 'Long', maxGuests: 0, nightlyRate: 0 }),
  ]);
  await page.route(`**/api/properties/${LONG_ID}/documents`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  return mockPropertyModeApi(page, { propertyId: LONG_ID, rentalMode: 'Long' });
}

async function expectTouchTargets(page: Page, where: string, scope = '[data-testid="property-mode-page"]') {
  const small = await page.evaluate((within) =>
    Array.from(document.querySelectorAll(`${within} :is(button, a[href], input, select, textarea)`))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 1 && box.height > 1 && !element.closest('[class*="sr-only"]');
      })
      .filter((element) => element.getBoundingClientRect().height < 43.5)
      .map((element) => `<${element.tagName.toLowerCase()}> "${(element.textContent ?? '').trim().slice(0, 30)}" ${Math.round(element.getBoundingClientRect().height)}px`),
  scope);
  expect(small, `${where}: every control is 44 px tall at least`).toEqual([]);
}

test.describe('Change of rental mode (PM-03)', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
  });

  test('#915: short rentals no longer offer conversion and direct URLs cannot reopen it', async ({ page }) => {
    const mock = await openShortProperty(page);
    const previews: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes(`/properties/${SHORT_ID}/mode/preview`)) previews.push(request.url());
    });
    await page.goto(demoUrl(SHORT_PAGE, 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Villa Aurora' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('property-mode-change')).toHaveCount(0);
    await page.getByTestId('page-header-more').click();
    const actions = page.getByRole('menu');
    await expect(actions.getByRole('menuitem', { name: 'Modifica', exact: true })).toBeVisible();
    await expect(actions.getByRole('menuitem', { name: 'Cambia modalità', exact: true })).toHaveCount(0);
    await expect(actions.getByTestId('property-mode-change')).toHaveCount(0);
    await page.keyboard.press('Escape');

    const draftKey = wizardDraftKey(`property-mode-${SHORT_ID}`, { userId: 'auth0|demo-e2e', orgId: DEMO_ORG.id });
    await page.addInitScript(({ key, day }) => {
      sessionStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), step: 'confirm', values: { effectiveDate: day, choice: true } }));
    }, { key: draftKey, day: addDays(todayInRome(), 14) });
    for (const search of ['', '?step=confirm', '?step=fatto']) {
      await page.goto(demoUrl(`${SHORT_PAGE}/mode${search}`, 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`${SHORT_PAGE}$`));
      await expect(wizard(page)).toHaveCount(0);
    }
    await page.goto(demoUrl(`${SHORT_PAGE}/mode?from=account&step=date`, 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/short-rent$/);
    expect(previews).toEqual([]);
    expect(mock.schedules).toEqual([]);
  });

  test('PM-03: a lease in the way sets the first day, a new one comes in while reading, and the way to the free day is one click', async ({ page }) => {
    const mock = await openLongProperty(page);
    mock.busyUntil = addDays(todayInRome(), 5);
    await page.goto(demoUrl(`${LONG_PAGE}/mode`, 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(wizard(page)).toHaveAttribute('data-step', 'choice', { timeout: 20_000 });
    await next(page).click();

    const earliest = addDays(todayInRome(), 6);
    await expect(date(page)).toHaveValue(earliest);
    await expect(date(page)).toHaveAttribute('min', earliest);
    await expect(page.getByTestId('property-mode-date-reason')).toContainText("Il contratto finisce il");

    await date(page).fill(addDays(todayInRome(), 2));
    await date(page).blur();
    await expect(page.getByText('Il passaggio non può partire prima del primo giorno possibile.')).toBeVisible();
    await next(page).click();
    await expect(page.getByTestId('wizard-error-summary')).toContainText('Il passaggio non può partire prima del primo giorno possibile.');
    await expect(wizard(page)).toHaveAttribute('data-step', 'date');
    await page.getByTestId('property-mode-use-earliest').click();
    await expect(date(page)).toHaveValue(earliest);

    mock.busyUntil = addDays(todayInRome(), 9);
    await next(page).click();
    await expect(wizard(page)).toHaveAttribute('data-step', 'checks');
    await expect(page.getByTestId('property-mode-checks-result')).toContainText('non è possibile');
    const lease = page.getByTestId('property-mode-blocker-Lease');
    await expect(lease).toContainText('Contratto');
    await expect(lease.getByTestId('property-mode-blocker-open-Lease')).toHaveAttribute('href', '/app/long-rent/leases/lease-e2e-1');
    await next(page).click();
    await expect(page.getByTestId('wizard-error-summary')).toContainText('Risolvi gli ostacoli');
    await expect(wizard(page)).toHaveAttribute('data-step', 'checks');

    await page.getByTestId('property-mode-pick-earliest').click();
    await expect(page.getByTestId('property-mode-checks-result')).toContainText('Tutto a posto per il');
    await next(page).click();
    await expect(wizard(page)).toHaveAttribute('data-step', 'confirm');
    await finish(page).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Passaggio programmato' })).toBeVisible();
    expect(mock.schedules).toEqual([{ to: 'Short', effectiveDate: addDays(todayInRome(), 10) }]);
  });

  test('PM-03: from long-term leases back to short stays, from the page of the long-term property', async ({ page }) => {
    const mock = await openLongProperty(page);
    await page.goto(demoUrl(LONG_PAGE, 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Bilocale Monza' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Altre azioni' }).click();
    await expect(page.getByRole('menuitem', { name: 'Modifica' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Cambia modalità' }).click();
    await expect(page).toHaveURL(new RegExp(`${LONG_PAGE}/mode$`));

    await expect(page.getByText("Passa all'affitto breve")).toBeVisible();
    await next(page).click();
    await expect(wizard(page)).toHaveAttribute('data-step', 'date');
    await next(page).click();
    await expect(wizard(page)).toHaveAttribute('data-step', 'checks');
    await expect(page.getByTestId('property-mode-checks-result')).toContainText('Tutto a posto per il');
    await next(page).click();
    await expect(wizard(page)).toHaveAttribute('data-step', 'confirm');
    await expect(finish(page)).toHaveText("Programma il passaggio all'affitto breve");
    await finish(page).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Passaggio programmato' })).toBeVisible();
    expect(mock.schedules).toEqual([{ to: 'Short', effectiveDate: addDays(todayInRome(), 1) }]);
    await expect(page.getByTestId('wizard-done-primary')).toHaveAttribute('href', LONG_PAGE);
    await expect(page.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/long-rent/properties');
  });

  test('PM-03: a short-stay demo host without Account access can still withdraw a historical change', async ({ page }) => {
    const mock = await openShortProperty(page, { scheduledFor: addDays(todayInRome(), 20) });
    await page.goto(demoUrl(`${SHORT_PAGE}/mode?from=account`, 'short-stay'), { waitUntil: 'domcontentloaded' });

    // A change already waits: the page says so instead of asking for a second one.
    const panel = page.getByTestId('property-mode-scheduled');
    await expect(panel).toContainText("C'è già un passaggio in programma", { timeout: 20_000 });
    await expect(page.getByTestId('property-mode-wizard')).toHaveCount(0);
    await page.getByTestId('property-mode-scheduled-cancel').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Annulla il passaggio' }).click();

    await expect(page).toHaveURL(/\/app\/short-rent$/, { timeout: 20_000 });
    expect(mock.cancels).toEqual(['change-e2e-0']);
  });

  for (const width of [360, 390] as const) {
    test(`PM-03: on a phone of ${width} px every step fits, with wide letters, every control is 44 px and axe finds nothing`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const mock = await openLongProperty(page);
      mock.busyUntil = addDays(todayInRome(), 3);
      await page.goto(demoUrl(`${LONG_PAGE}/mode`, 'long-term'), { waitUntil: 'domcontentloaded' });
      await expect(wizard(page)).toHaveAttribute('data-step', 'choice', { timeout: 20_000 });
      await page.addStyleTag({ content: WIDER_LETTERS });

      const check = async (step: string) => {
        await expect(wizard(page)).toHaveAttribute('data-step', step);
        await page.mouse.move(1, 1);
        await untilStill(page);
        await expectNothingSticksOut(page, `${width} px, step ${step}`);
        await expectTouchTargets(page, `${width} px, step ${step}`);
        await expectNoAxeViolations(page, { include: '[data-testid="property-mode-page"]' });
      };

      await check('choice');
      await next(page).click();
      await check('date');
      mock.busyUntil = addDays(todayInRome(), 7);
      await next(page).click();
      await expect(page.getByTestId('property-mode-blocker-Lease')).toBeVisible();
      await check('checks');
      await page.getByTestId('property-mode-pick-earliest').click();
      await expect(page.getByTestId('property-mode-checks-result')).toContainText('Tutto a posto per il');
      await check('checks');
      await next(page).click();
      await check('confirm');
      await finish(page).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Passaggio programmato' })).toBeVisible();
      await page.mouse.move(1, 1);
      await untilStill(page);
      await expectNothingSticksOut(page, `${width} px, the last screen`);
      await expectTouchTargets(page, `${width} px, the last screen`);
      await expectNoAxeViolations(page, { include: '[data-testid="property-mode-page"]' });
    });

    test(`PM-03: on a phone of ${width} px the row of status of the property fits, its button is 44 px and axe finds nothing`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openShortProperty(page, { scheduledFor: addDays(todayInRome(), 20) });
      await page.goto(demoUrl(SHORT_PAGE, 'short-stay'), { waitUntil: 'domcontentloaded' });

      const row = page.getByTestId('property-mode-notice');
      await expect(row).toContainText("Passaggio all'affitto lungo il", { timeout: 20_000 });
      await page.addStyleTag({ content: WIDER_LETTERS });
      await page.mouse.move(1, 1);
      await untilStill(page);

      await expectInsideTheScreen(page, row, `${width} px, the row of status`);
      await expectTouchTargets(page, `${width} px, the row of status`, '[data-testid="property-mode-notice"]');
      await expectNoAxeViolations(page, { include: '[data-testid="property-mode-notice"]' });
    });
  }
});
