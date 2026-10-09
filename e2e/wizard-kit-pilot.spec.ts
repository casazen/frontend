import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';
import { mockServiceCategoriesApi } from './helpers/service-categories-mock';
import { DEMO_CHECKOUT_BOOKING_ID, DEMO_PROPERTY_ID, demoCheckoutWizard, mockComplianceApi } from './helpers/compliance-mock';

/**
 * UI-11: the check-out of a stay is the pilot of the wizard kit (`WizardShell`, the automatic draft, "What happens now").
 * L2 (demo mode, mocked API). The ids and test ids that the Golden Journey of the CI clicks through are the same as before
 * (`checkout-step-next`, `checkout-complete-button`, ...), and so is the text it waits for after the last step.
 */

const BOOKING_ID = DEMO_CHECKOUT_BOOKING_ID;
const CHECKOUT_URL = demoUrl(`/app/short-rent/bookings/${BOOKING_ID}/checkout`, 'short-stay');
const NOTE = 'Chiavi nella cassetta';

const booking = {
  id: BOOKING_ID,
  propertyId: DEMO_PROPERTY_ID,
  userId: 'auth0|host',
  checkInDate: '2026-09-22T00:00:00Z',
  checkOutDate: '2026-09-25T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 300,
  currency: 'EUR',
  status: 'CheckedIn',
  source: 'Manual',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '', country: 'IT' },
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
};

interface Mocked {
  progress: Array<Record<string, unknown>>;
  completions: Array<Record<string, unknown>>;
}

/** The API of the wizard: it starts at the first step every time (as a server that never saved the progress), saves progress and closes the stay. */
async function mockCheckoutApi(page: Page): Promise<Mocked> {
  const calls: Mocked = { progress: [], completions: [] };
  let closed = false;

  await mockComplianceApi(page);
  await mockServiceCategoriesApi(page);

  await page.route(new RegExp(`/api/bookings/${BOOKING_ID}(\\?.*)?$`), async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const body = closed ? { ...booking, status: 'CheckedOut' } : booking;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route(`**/api/bookings/${BOOKING_ID}/checkout-wizard/progress`, async (route) => {
    const command = route.request().postDataJSON() as Record<string, unknown>;
    calls.progress.push(command);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...demoCheckoutWizard, currentStep: command.currentStep }),
    });
  });

  await page.route(`**/api/bookings/${BOOKING_ID}/checkout-wizard/complete`, async (route) => {
    const command = route.request().postDataJSON() as Record<string, unknown>;
    calls.completions.push(command);
    closed = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        propertyReady: command.propertyReady === true,
        bookingStatus: 'CheckedOut',
        serviceRequestId: null,
        wizard: { ...demoCheckoutWizard, bookingStatus: 'CheckedOut' },
      }),
    });
  });

  return calls;
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 2, name });
const next = (page: Page) => page.getByTestId('checkout-step-next');
const step = (page: Page) => page.getByTestId('checkout-wizard-form');

/** Walks the wizard up to the last step: departure confirmed, cleaning skipped, tax collected at the property. */
async function goToLastStep(page: Page): Promise<void> {
  await page.getByTestId('checkout-confirm-departure').click();
  await next(page).click();
  await expect(step(page)).toHaveAttribute('data-step', 'alloggiati');
  await next(page).click();
  await expect(step(page)).toHaveAttribute('data-step', 'cleaning');
  await page.getByTestId('checkout-cleaning-skip').click();
  await next(page).click();
  await expect(step(page)).toHaveAttribute('data-step', 'tourist-tax');
  await page.getByTestId('checkout-tourist-tax-CollectedAtProperty').click();
  await next(page).click();
  await expect(step(page)).toHaveAttribute('data-step', 'property-ready');
}

test.describe('Wizard kit pilot: check-out of a stay (UI-11)', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
  });

  test('AC-W1: the first step has its title, its purpose and the steps, and the address is left alone', async ({ page }) => {
    await mockCheckoutApi(page);
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });

    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Controlla il soggiorno e conferma che l\'ospite è partito.')).toBeVisible();
    await expect(step(page)).toHaveAttribute('data-step', 'stay-summary');
    await expect(page.getByRole('list', { name: 'Passaggi' })).toBeVisible();
    await expect(next(page)).toHaveText('Continua: Alloggiati');
    // Opening the page does not write `?step=` (links to the page are compared with the address as it is).
    expect(new URL(page.url()).searchParams.has('step')).toBe(false);
  });

  test('AC-W2: Continue without the answer stays on the step, says what is missing and the focus goes to it', async ({ page }) => {
    await mockCheckoutApi(page);
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });

    await next(page).click();

    const summary = page.getByTestId('wizard-error-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("C'è 1 campo da controllare");
    await expect(summary).toContainText("Conferma che l'ospite ha lasciato la struttura.");
    await expect(summary).toBeFocused();
    await expect(step(page)).toHaveAttribute('data-step', 'stay-summary');
    // The note for a screen reader is a polite status, not an alert that would interrupt it.
    await expect(page.getByRole('status').filter({ hasText: "C'è 1 campo da controllare" })).toHaveCount(1);

    await page.getByTestId('checkout-confirm-departure').click();
    await next(page).click();
    await expect(step(page)).toHaveAttribute('data-step', 'alloggiati');
    await expect(summary).toHaveCount(0);
  });

  test('AC-W3: each step is in the address, the back button goes to the step before and a reload stays on the step', async ({ page }) => {
    const calls = await mockCheckoutApi(page);
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('checkout-confirm-departure').click();
    await next(page).click();
    await expect(heading(page, 'Alloggiati Web')).toBeVisible();
    await expect(heading(page, 'Alloggiati Web')).toBeFocused();
    expect(new URL(page.url()).searchParams.get('step')).toBe('alloggiati');
    // The server learns where the host is, with the answers so far.
    await expect.poll(() => calls.progress.at(-1)).toMatchObject({ currentStep: 'alloggiati', departureConfirmed: true });

    await page.goBack();
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible();
    await page.goForward();
    await expect(heading(page, 'Alloggiati Web')).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Alloggiati Web')).toBeVisible({ timeout: 20_000 });
  });

  test('AC-W4: after a reload the draft gives back what was typed and offers to resume from the step reached', async ({ page }) => {
    await mockCheckoutApi(page);
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });
    await goToLastStep(page);
    await page.getByTestId('checkout-property-notes').fill(NOTE);
    await expect(page.getByTestId('wizard-draft-saved')).toContainText(/Bozza salvata alle \d{2}:\d{2}/, { timeout: 5_000 });

    // The reload: the address goes back to the one of the page (the server starts at the first step again).
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });
    const banner = page.getByTestId('wizard-draft-banner');
    await expect(banner).toContainText('Eri arrivato al passo 5 di 5');
    await expect(page.getByTestId('checkout-confirm-departure')).toBeChecked();

    await page.getByTestId('wizard-draft-resume').click();
    await expect(step(page)).toHaveAttribute('data-step', 'property-ready');
    await expect(page.getByTestId('checkout-property-notes')).toHaveValue(NOTE);
    await expect(banner).toHaveCount(0);
  });

  test('AC-W5: "Start over" drops the draft', async ({ page }) => {
    await mockCheckoutApi(page);
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('checkout-confirm-departure').click();
    await next(page).click();
    await expect(step(page)).toHaveAttribute('data-step', 'alloggiati');
    await expect(page.getByTestId('wizard-draft-saved')).toBeVisible({ timeout: 5_000 });

    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('wizard-draft-restart').click();

    await expect(page.getByTestId('wizard-draft-banner')).toHaveCount(0);
    await expect(page.getByTestId('checkout-confirm-departure')).not.toBeChecked();
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('casazen.wizardDraft')))).toEqual([]);
  });

  test('AC-W6: closing the stay shows "What happens now" with two ways on, once, and leaves no draft', async ({ page }) => {
    const calls = await mockCheckoutApi(page);
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });
    await goToLastStep(page);

    // The last button checks the step: nothing is sent until the host says whether the property is ready.
    await page.getByTestId('checkout-complete-button').click();
    await expect(page.getByTestId('wizard-error-summary')).toContainText('Indica se la proprietà è pronta per il prossimo ospite.');
    expect(calls.completions).toEqual([]);
    // What was answered before is in the summary, each answer with a link back to its step.
    const summary = page.getByTestId('checkout-summary');
    await expect(summary.getByRole('link', { name: /^Modifica / })).toHaveCount(3);

    await page.getByTestId('checkout-property-ready-yes').click();
    await page.getByTestId('checkout-complete-button').click();

    await expect(heading(page, 'Il soggiorno è chiuso')).toBeVisible({ timeout: 15_000 });
    await expect(heading(page, 'Il soggiorno è chiuso')).toBeFocused();
    await expect(page.getByRole('region', { name: 'Cosa succede ora' })).toContainText("L'immobile è segnato come pronto per il prossimo ospite.");
    await expect(page.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}`);
    await expect(page.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/short-rent/compliance');
    expect(new URL(page.url()).searchParams.get('step')).toBe('fatto');
    // The text the Golden Journey waits for is the toast of the completion, and it is the only element with it.
    await expect(page.getByText(/Check-out completato/i)).toHaveCount(1);
    // The booking is checked out now, and the confirmation is still on screen (not the card "already done").
    await expect(page.getByTestId('checkout-already-done')).toHaveCount(0);
    expect(calls.completions).toHaveLength(1);
    expect(calls.completions[0]).toMatchObject({ confirmDeparture: true, cleaningChoice: 'Skip', touristTaxCollection: 'CollectedAtProperty', propertyReady: true });
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('casazen.wizardDraft')))).toEqual([]);

    await page.getByTestId('wizard-done-primary').click();
    await expect(page).toHaveURL(new RegExp(`/app/short-rent/bookings/${BOOKING_ID}(\\?|$)`));
  });

  test('AC-W7: the keyboard drives the wizard: Enter in a form moves on and the focus goes to the new heading', async ({ page }) => {
    await mockCheckoutApi(page);
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('checkout-confirm-departure').focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('checkout-confirm-departure')).toBeChecked();
    await next(page).focus();
    await page.keyboard.press('Enter');

    await expect(heading(page, 'Alloggiati Web')).toBeFocused();
  });
});

const WIDER_LETTERS = 'body, body * { letter-spacing: 0.08em !important; }';

/** The box of an element that slides into place (a toast does): once it has stopped. */
async function settled(locator: Locator) {
  let previous = '';
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      const key = box ? [box.x, box.y, box.width, box.height].map(Math.round).join(',') : '';
      const same = key !== '' && key === previous;
      previous = key;
      return same;
    })
    .toBe(true);
  return (await locator.boundingBox())!;
}

test.describe('Wizard kit pilot on a phone (UI-11)', () => {
  test.describe.configure({ timeout: 90_000 });

  for (const width of [360, 390]) {
    test(`AC-W8: at ${width} px, with wider letters, nothing sticks out and the buttons stay above the bottom bar`, async ({ page }) => {
      await pinE2eLocale(page, 'it');
      await mockCheckoutApi(page);
      // Short on purpose: the step is taller than the screen, so the buttons have to stay in view while the page scrolls.
      await page.setViewportSize({ width, height: 520 });
      await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
      await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });
      await page.addStyleTag({ content: WIDER_LETTERS });
      await goToLastStep(page);
      await page.getByTestId('checkout-property-notes').fill(NOTE);
      await page.getByTestId('checkout-property-ready-no').click();

      // The wizard and its buttons, not the breadcrumb of the page above them (the "Breadcrumb" component does not wrap, and
      // the page already had it: UI-05 replaces it with a back link on a phone).
      const measures = async () =>
        page.evaluate(() => {
          const root = document.documentElement;
          const bar = document.querySelector('[data-testid="checkout-complete-button"]')?.closest('div.sticky')?.getBoundingClientRect();
          const nav = document.querySelector('nav[aria-label="Navigazione mobile"]')?.getBoundingClientRect();
          const wizard = document.querySelector('[data-testid="checkout-wizard-form"]');
          const outside = Array.from(wizard?.querySelectorAll('*') ?? [])
            .filter((element) => element.getBoundingClientRect().right > root.clientWidth + 0.5)
            .slice(0, 6)
            .map((element) => `<${element.tagName.toLowerCase()}> "${(element.textContent ?? '').trim().slice(0, 30)}" ends at ${Math.round(element.getBoundingClientRect().right)}`);
          const buttons = Array.from(document.querySelectorAll('[data-testid="checkout-complete-button"], [data-testid="checkout-step-back"]')).map(
            (element) => Math.round(element.getBoundingClientRect().height),
          );
          return {
            wizardRight: wizard ? Math.round(wizard.getBoundingClientRect().right) : null,
            outside,
            barBottom: bar ? Math.round(bar.bottom) : null,
            barRight: bar ? Math.round(bar.right) : null,
            navTop: nav ? Math.round(nav.top) : null,
            viewport: root.clientHeight,
            buttons,
          };
        });

      // At the top of the page the buttons are stuck right above the bottom bar (the step is taller than the screen).
      await page.evaluate(() => window.scrollTo(0, 0));
      const top = await measures();
      expect(top.outside, 'nothing of the wizard sticks out of the screen').toEqual([]);
      expect(top.wizardRight!).toBeLessThanOrEqual(width);
      expect(top.barRight!, 'the bar of the buttons ends with the screen').toBeLessThanOrEqual(width);
      expect(top.navTop, 'the bottom bar is there').not.toBeNull();
      expect(top.barBottom!, 'the buttons end where the bottom bar starts').toBeLessThanOrEqual(top.navTop! + 1);
      expect(top.barBottom!, 'and they are not left far above it').toBeGreaterThanOrEqual(top.navTop! - 4);
      for (const height of top.buttons) expect(height, 'tap targets are 44 px').toBeGreaterThanOrEqual(44);

      // At the end of the page the last field is not under the buttons.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const notes = await page.getByTestId('checkout-property-notes').boundingBox();
      const bar = await page.getByTestId('checkout-complete-button').boundingBox();
      expect(notes, 'the notes are on the page').not.toBeNull();
      expect(notes!.y + notes!.height, 'the notes end above the buttons').toBeLessThanOrEqual(bar!.y + 1);
      // What the page puts after the wizard (the link back to the booking) is not left under the buttons either: they stay above it.
      const back = await page.getByRole('link', { name: 'Torna alla prenotazione' }).boundingBox();
      expect(back, 'the link back to the booking is on the page').not.toBeNull();
      expect(back!.y, 'and it starts below the buttons').toBeGreaterThanOrEqual(bar!.y + bar!.height - 1);

      // The summary and its links fit too.
      await expect(page.getByTestId('checkout-summary').getByRole('link', { name: /^Modifica / }).first()).toBeVisible();
      const after = await measures();
      expect(after.outside).toEqual([]);

      // The confirmation fits as well, and its two actions are big enough to tap.
      await page.getByTestId('checkout-complete-button').click();
      await expect(heading(page, 'Il soggiorno è chiuso')).toBeVisible({ timeout: 15_000 });
      const done = await measures();
      expect(done.outside, 'nothing of the confirmation sticks out of the screen').toEqual([]);
      for (const id of ['wizard-done-primary', 'wizard-done-secondary']) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box!.height, id).toBeGreaterThanOrEqual(44);
        expect(box!.x + box!.width, id).toBeLessThanOrEqual(width);
      }
    });
  }

  test('AC-W9: when the server refuses, the message is on the screen above the buttons and the toast comes up over their bar', async ({ page }) => {
    await pinE2eLocale(page, 'it');
    await mockCheckoutApi(page);
    // The server refuses to close the stay: its reason is in the page (under the buttons' step) and in a toast.
    await page.route(`**/api/bookings/${BOOKING_ID}/checkout-wizard/complete`, async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/problem+json',
        body: JSON.stringify({ status: 422, title: 'Dati non validi', detail: 'Il check-out non è valido' }),
      });
    });
    await page.setViewportSize({ width: 390, height: 520 });
    await page.goto(CHECKOUT_URL, { waitUntil: 'domcontentloaded' });
    await expect(heading(page, 'Riepilogo soggiorno')).toBeVisible({ timeout: 20_000 });
    await goToLastStep(page);
    await page.getByTestId('checkout-property-ready-yes').click();

    await page.getByTestId('checkout-complete-button').click();

    await expect(page.getByTestId('checkout-complete-error')).toBeVisible();
    // The focus goes to the message: the button that was busy has lost it, and the page scrolls the message in.
    await expect(page.getByTestId('checkout-complete-error')).toBeFocused();
    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible();
    const box = await settled(toast);
    const reason = await settled(page.getByTestId('checkout-complete-error'));
    const buttons = (await page.getByTestId('checkout-complete-button').boundingBox())!;
    const nav = (await page.locator('nav[aria-label="Navigazione mobile"]').boundingBox())!;
    // The toast is raised over the room of the bar of the buttons (72 px), not only over the bottom bar...
    expect(box.y + box.height, 'the toast comes up over the bar of the buttons').toBeLessThanOrEqual(nav.y - 72);
    // ...and wherever the page is scrolled to (the focus took it to the message), it does not cover the buttons.
    expect(box.y < buttons.y + buttons.height && box.y + box.height > buttons.y, 'the toast does not cover the buttons').toBe(false);
    // The message of the page is in view too, above the buttons and not under them.
    expect(reason.y, 'the message is on the screen').toBeGreaterThanOrEqual(0);
    expect(reason.y + reason.height, 'and above the buttons').toBeLessThanOrEqual(buttons.y);
  });
});
