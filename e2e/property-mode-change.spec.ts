import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { pinE2eLocale } from './helpers/locale';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockPropertyModeApi, plusDays, romeToday, type PropertyModeMock } from './helpers/property-mode-mock';
import { WIDER_LETTERS, expectNoAxeViolations, expectNothingSticksOut, untilStill } from './helpers/ui-checks';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

/**
 * PM-03: the wizard that changes the rental mode of a property (short stays <-> long-term leases), its entries in the pages
 * of the property and the row of status with "Annulla il passaggio". L2 (demo mode, mocked API: the four endpoints of PM-02
 * and the flag `propertyModeChange`).
 */
const SHORT_ID = 'prop-mode-short-1';
const LONG_ID = 'prop-mode-long-1';
const SHORT_PAGE = `/app/short-rent/properties/${SHORT_ID}`;
const LONG_PAGE = `/app/long-rent/properties/${LONG_ID}`;

const wizard = (page: Page) => page.getByTestId('property-mode-wizard');
const next = (page: Page) => page.getByTestId('property-mode-next');
const finish = (page: Page) => page.getByTestId('property-mode-finish');
const date = (page: Page) => page.getByTestId('property-mode-date');
const today = () => romeToday();

async function openShortProperty(page: Page, options: { flag?: boolean; scheduledFor?: string } = {}): Promise<PropertyModeMock> {
  await mockPropertiesApi(page, [
    buildCreatedProperty({ id: SHORT_ID, name: 'Villa Aurora', city: 'Roma', rentalMode: 'Short' }),
  ]);
  return mockPropertyModeApi(page, { propertyId: SHORT_ID, rentalMode: 'Short', ...options });
}

async function openLongProperty(page: Page, options: { flag?: boolean } = {}): Promise<PropertyModeMock> {
  await mockLeasesApiEmpty(page);
  await mockPropertiesApi(page, [
    buildCreatedProperty({ id: LONG_ID, name: 'Bilocale Monza', city: 'Monza', rentalMode: 'Long', maxGuests: 0, nightlyRate: 0 }),
  ]);
  // The documents of the property (the properties mock leaves them to the spec).
  await page.route(`**/api/properties/${LONG_ID}/documents`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  return mockPropertyModeApi(page, { propertyId: LONG_ID, rentalMode: 'Long', ...options });
}

/** Every control that has to be hit with a thumb is at least 44 px tall (the sr-only radio of a choice card is not one: its card is). */
async function expectTouchTargets(page: Page, where: string) {
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="property-mode-page"] :is(button, a[href], input, select, textarea)'))
      .filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 1 && box.height > 1 && !element.closest('[class*="sr-only"]');
      })
      .filter((element) => element.getBoundingClientRect().height < 43.5)
      .map((element) => `<${element.tagName.toLowerCase()}> "${(element.textContent ?? '').trim().slice(0, 30)}" ${Math.round(element.getBoundingClientRect().height)}px`),
  );
  expect(small, `${where}: every control is 44 px tall at least`).toEqual([]);
}

test.describe('Change of rental mode (PM-03)', () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
  });

  test('PM-03: from short stays to long-term, the whole way, then withdrawn from the page of the property', async ({ page }) => {
    const mock = await openShortProperty(page);
    await page.goto(demoUrl(SHORT_PAGE, 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Villa Aurora' })).toBeVisible({ timeout: 20_000 });

    // The entry is in the menu "⋯" of the page, not another button on it.
    await page.getByRole('button', { name: 'Altre azioni' }).click();
    await page.getByRole('menuitem', { name: 'Cambia modalità' }).click();
    await expect(page).toHaveURL(new RegExp(`${SHORT_PAGE}/mode$`));

    // 1. Choice: one thing, already chosen, with a line on what changes.
    await expect(wizard(page)).toHaveAttribute('data-step', 'choice');
    await expect(page.getByRole('heading', { level: 2, name: 'Cosa vuoi fare?' })).toBeVisible();
    await expect(page.getByTestId('property-mode-choice')).toBeChecked();
    await expect(page.getByText("Passa all'affitto lungo")).toBeVisible();
    await next(page).click();

    // 2. Date: from tomorrow, the first day there is nothing in the way.
    await expect(wizard(page)).toHaveAttribute('data-step', 'date');
    await expect(date(page)).toHaveValue(plusDays(today(), 1));
    await expect(page.getByTestId('property-mode-date-reason')).toContainText('puoi partire da domani');
    const day = plusDays(today(), 14);
    await date(page).fill(day);
    await next(page).click();

    // 3. Checks: the server looks at the day and says yes.
    await expect(wizard(page)).toHaveAttribute('data-step', 'checks');
    await expect(page.getByTestId('property-mode-checks-result')).toContainText('Tutto a posto per il');
    await next(page).click();

    // 4. Confirm, then "What happens now".
    await expect(wizard(page)).toHaveAttribute('data-step', 'confirm');
    await expect(page.getByTestId('property-mode-confirm')).toContainText('Villa Aurora');
    await expect(finish(page)).toHaveText("Programma il passaggio all'affitto lungo");
    expect(mock.schedules).toEqual([]);
    await finish(page).click();

    await expect(page.getByRole('heading', { level: 2, name: 'Passaggio programmato' })).toBeVisible();
    expect(mock.schedules).toEqual([{ to: 'Long', effectiveDate: day }]);
    await expect(wizard(page)).toHaveAttribute('data-step', 'fatto');
    await expect(page.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/short-rent/properties');

    // The page of the property says it, with the way to withdraw it, after asking what that leads to.
    await page.getByTestId('wizard-done-primary').click();
    await expect(page).toHaveURL(new RegExp(`${SHORT_PAGE}$`));
    const notice = page.getByTestId('property-mode-notice');
    await expect(notice).toContainText("Passaggio all'affitto lungo il");
    await expect(notice).toContainText("Fino ad allora l'immobile resta in Affitti brevi.");
    await page.getByTestId('property-mode-notice-cancel').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText("Annullare il passaggio all'affitto lungo?");
    await expect(dialog.getByTestId('confirmation-consequences')).toContainText("L'immobile resta in Affitti brevi.");
    expect(mock.cancels).toEqual([]);
    await dialog.getByRole('button', { name: 'Annulla il passaggio' }).click();

    await expect(notice).toHaveCount(0);
    expect(mock.cancels).toEqual(['change-e2e-1']);
  });

  test('PM-03: a stay in the way sets the first day, a new one comes in while reading, and the way to the free day is one click', async ({ page }) => {
    const mock = await openShortProperty(page);
    mock.busyUntil = plusDays(today(), 5);
    await page.goto(demoUrl(`${SHORT_PAGE}/mode`, 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(wizard(page)).toHaveAttribute('data-step', 'choice', { timeout: 20_000 });
    await next(page).click();

    // The first day is the one after the last departure, with the reason.
    const earliest = plusDays(today(), 6);
    await expect(date(page)).toHaveValue(earliest);
    await expect(date(page)).toHaveAttribute('min', earliest);
    await expect(page.getByTestId('property-mode-date-reason')).toContainText("L'ultimo soggiorno finisce il");

    // A day before it does not pass. The field says so as soon as it is left (the page moves under the pointer when it does, so the
    // button is pressed once that has settled), and "Continue" says it again in the summary and stays on the step.
    await date(page).fill(plusDays(today(), 2));
    await date(page).blur();
    await expect(page.getByText('Il passaggio non può partire prima del primo giorno possibile.')).toBeVisible();
    await next(page).click();
    await expect(page.getByTestId('wizard-error-summary')).toContainText('Il passaggio non può partire prima del primo giorno possibile.');
    await expect(wizard(page)).toHaveAttribute('data-step', 'date');
    await page.getByTestId('property-mode-use-earliest').click();
    await expect(date(page)).toHaveValue(earliest);

    // A longer stay is booked while the host reads: the checks find it, list it with its action and do not let go.
    mock.busyUntil = plusDays(today(), 9);
    await next(page).click();
    await expect(wizard(page)).toHaveAttribute('data-step', 'checks');
    await expect(page.getByTestId('property-mode-checks-result')).toContainText('non è possibile');
    const stay = page.getByTestId('property-mode-blocker-Stay');
    await expect(stay).toContainText('Soggiorno');
    await expect(stay.getByTestId('property-mode-blocker-open-Stay')).toHaveAttribute('href', '/app/short-rent/bookings/stay-e2e-1');
    await next(page).click();
    await expect(page.getByTestId('wizard-error-summary')).toContainText('Risolvi gli ostacoli');
    await expect(wizard(page)).toHaveAttribute('data-step', 'checks');

    // One click puts the first free day in the field, and the server says yes.
    await page.getByTestId('property-mode-pick-earliest').click();
    await expect(page.getByTestId('property-mode-checks-result')).toContainText('Tutto a posto per il');
    await next(page).click();
    await expect(wizard(page)).toHaveAttribute('data-step', 'confirm');
    await finish(page).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Passaggio programmato' })).toBeVisible();
    expect(mock.schedules).toEqual([{ to: 'Long', effectiveDate: plusDays(today(), 10) }]);
  });

  test('PM-03: from long-term leases back to short stays, from the page of the long-term property', async ({ page }) => {
    const mock = await openLongProperty(page);
    await page.goto(demoUrl(LONG_PAGE, 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Bilocale Monza' })).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'Altre azioni' }).click();
    // The menu keeps the edit, and now has the change next to it.
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
    expect(mock.schedules).toEqual([{ to: 'Short', effectiveDate: plusDays(today(), 1) }]);
    // Until the day the property is still in long-term: both buttons lead there.
    await expect(page.getByTestId('wizard-done-primary')).toHaveAttribute('href', LONG_PAGE);
    await expect(page.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/long-rent/properties');
  });

  test('PM-03: with the flag off there is no entry, no row and no way in', async ({ page }) => {
    const mock = await openShortProperty(page, { flag: false });
    await page.goto(demoUrl(SHORT_PAGE, 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Villa Aurora' })).toBeVisible({ timeout: 20_000 });

    // The header is the one it always was: no menu "⋯", and the actions of the page are where they were.
    await expect(page.getByRole('button', { name: 'Altre azioni' })).toHaveCount(0);
    await expect(page.getByTestId('property-pause-toggle')).toBeVisible();

    // The address of the wizard leads to the home of the area, and nothing asked the server about the mode.
    await page.goto(demoUrl(`${SHORT_PAGE}/mode`, 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/short-rent(\?.*)?$/, { timeout: 20_000 });
    expect(mock.requests).toBe(0);
  });

  test('PM-03: opened from the account, the way out and the way back lead to the list of the account', async ({ page }) => {
    const mock = await openShortProperty(page, { scheduledFor: plusDays(today(), 20) });
    await page.goto(demoUrl(`${SHORT_PAGE}/mode?from=account`, 'short-stay'), { waitUntil: 'domcontentloaded' });

    // A change already waits: the page says so instead of asking for a second one.
    const panel = page.getByTestId('property-mode-scheduled');
    await expect(panel).toContainText("C'è già un passaggio in programma", { timeout: 20_000 });
    await expect(page.getByTestId('property-mode-wizard')).toHaveCount(0);
    await page.getByTestId('property-mode-scheduled-cancel').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Annulla il passaggio' }).click();

    // Withdrawn: back to where the person began (the list of the account, which the area of the account will build).
    await expect(page).toHaveURL(/\/app\/account\/properties$/, { timeout: 20_000 });
    expect(mock.cancels).toEqual(['change-e2e-0']);
  });

  for (const width of [360, 390] as const) {
    test(`PM-03: on a phone of ${width} px every step fits, with wide letters, every control is 44 px and axe finds nothing`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      // The look the product is moving to (UI-01): its tokens are the ones that meet AA. The shared pieces of the page (the
      // description under the title, the "step 2 of 4" line) are muted text, 4.4:1 in the colors of today, which axe refuses.
      await page.addInitScript(() => localStorage.setItem('casazen:ui', 'v2'));
      const mock = await openShortProperty(page);
      mock.busyUntil = plusDays(today(), 3);
      await page.goto(demoUrl(`${SHORT_PAGE}/mode`, 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(wizard(page)).toHaveAttribute('data-step', 'choice', { timeout: 20_000 });
      await page.addStyleTag({ content: WIDER_LETTERS });

      const check = async (step: string) => {
        await expect(wizard(page)).toHaveAttribute('data-step', step);
        // The pointer stays over the button that was pressed, and its hover color (primary at 90 %) is 4.4:1 on this accent: a finger
        // does not hover, so the contrast is read as the page rests.
        await page.mouse.move(1, 1);
        await untilStill(page);
        await expectNothingSticksOut(page, `${width} px, step ${step}`);
        await expectTouchTargets(page, `${width} px, step ${step}`);
        await expectNoAxeViolations(page, { include: '[data-testid="property-mode-page"]' });
      };

      await check('choice');
      await next(page).click();
      await check('date');
      // A stay later than the first day: the checks list it with its link.
      mock.busyUntil = plusDays(today(), 7);
      await next(page).click();
      await expect(page.getByTestId('property-mode-blocker-Stay')).toBeVisible();
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
  }
});
