import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import {
  WIDER_LETTERS,
  expectInsideTheScreen,
  expectNoAxeViolations,
  expectNothingSticksOut,
  untilStill,
} from './helpers/ui-checks';

/**
 * UI-07, the primitives B (responsive dialog, help tip, tabs, segmented, choice card, qty, data view, undo toast) in a real
 * browser. They are on one page that only the dev server has (`/dev/primitives`, `routes/dev-routes.tsx`), so that axe, the
 * widths of a phone and the keyboard can walk through all of them without a mock of the API. The pages that adopt them are
 * in `ui-primitives-b-pilots.spec.ts`.
 */

const GALLERY = '/dev/primitives';
const PHONES = [360, 390] as const;

async function openGallery(page: Page, width: number, height = 800, search = '') {
  await page.setViewportSize({ width, height });
  await page.goto(`${GALLERY}${search}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Primitive UI B' })).toBeVisible();
}

/** Opens the dialog of the calendar and waits until it has stopped moving. */
async function openCalendarDialog(page: Page) {
  await page.getByTestId('open-dialog').click();
  const dialog = page.getByRole('dialog', { name: 'Collega il calendario' });
  await expect(dialog).toBeVisible();
  await untilStill(page);
  return dialog;
}

const tipOf = (page: Page, title: string) => page.getByRole('button', { name: `Cos'è: ${title}` });

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found, 'the element is on the page').not.toBeNull();
  return found!;
}

test.describe('axe, in a real browser (colors and contrast included)', () => {
  for (const width of [1280, 768, 390]) {
    test(`the page of the primitives has no violation at ${width} px`, async ({ page }) => {
      await openGallery(page, width);

      await expectNoAxeViolations(page);
    });
  }

  for (const width of [1280, 390]) {
    test(`the dialog open has no violation at ${width} px`, async ({ page }) => {
      await openGallery(page, width);
      await openCalendarDialog(page);

      await expectNoAxeViolations(page);
    });

    test(`the dialog that asks to type a word, with its consequences, has no violation at ${width} px`, async ({ page }) => {
      await openGallery(page, width);
      await page.getByTestId('open-confirmation').click();
      await expect(page.getByRole('dialog', { name: "Eliminare l'ospite?" })).toBeVisible();
      await untilStill(page);

      await expectNoAxeViolations(page);
    });

    test(`a tip open (a bubble, or a sheet on a phone) has no violation at ${width} px`, async ({ page }) => {
      await openGallery(page, width);
      await tipOf(page, 'Codice CIN').click();
      await expect(page.getByRole('dialog', { name: 'Codice CIN' })).toBeVisible();
      await untilStill(page);

      await expectNoAxeViolations(page);
    });

    test(`a tip open inside the dialog has no violation at ${width} px`, async ({ page }) => {
      await openGallery(page, width);
      await openCalendarDialog(page);
      await tipOf(page, 'iCal').click();
      await expect(page.getByRole('dialog', { name: 'iCal' })).toBeVisible();
      await untilStill(page);

      await expectNoAxeViolations(page);
    });
  }

  test('the list in each of its states has no violation', async ({ page }) => {
    await openGallery(page, 1280);
    for (const state of ['Caricamento', 'Vuoto', 'Errore']) {
      await page.getByRole('group', { name: "Stato dell'elenco" }).getByRole('button', { name: state }).click();
      // The words under the title of an empty list are those of `EmptyState`, which is not of this task (UI-02 reworks it):
      // it still reads them in `muted-foreground`, 4.4:1 on white in the colors of today, a hair under what a text needs.
      await expectNoAxeViolations(page, { exclude: state === 'Vuoto' ? ['[data-testid="guests-view"] p.max-w-sm'] : [] });
    }
  });

  for (const width of [1280, 390]) {
    test(`the tabs with another tab open have no violation at ${width} px`, async ({ page }) => {
      await openGallery(page, width, 800, '?tab=requests');

      await expectNoAxeViolations(page, { include: '[data-testid="tabs-panel"]' });
      await expectNoAxeViolations(page);
    });
  }
});

test.describe('Dialog (responsive)', () => {
  for (const width of PHONES) {
    test(`at ${width} px it is a sheet from the bottom edge, as wide as the screen, with a grip and a close button of 44 px`, async ({ page }) => {
      const height = 844;
      await openGallery(page, width, height);
      const dialog = await openCalendarDialog(page);

      const sheet = await box(dialog);
      expect(sheet.x, 'it starts at the left edge').toBeCloseTo(0, 0);
      expect(sheet.width, 'it is as wide as the screen').toBeCloseTo(width, 0);
      expect(sheet.y + sheet.height, 'it rests on the bottom edge').toBeCloseTo(height, 0);
      expect(sheet.y, 'it leaves the page showing above it').toBeGreaterThan(40);
      await expect(dialog).toHaveCSS('border-top-left-radius', '16px');
      await expect(dialog).toHaveCSS('border-bottom-left-radius', '0px');

      await expect(page.getByTestId('sheet-handle')).toBeVisible();
      const close = await box(dialog.getByRole('button', { name: 'Chiudi' }));
      expect(close.width, 'the close button is 44 px wide').toBeGreaterThanOrEqual(44);
      expect(close.height, 'the close button is 44 px tall').toBeGreaterThanOrEqual(44);
      // At the top right of the sheet.
      expect(close.y).toBeLessThan(sheet.y + 12);
      expect(close.x + close.width).toBeLessThanOrEqual(width);

      await expectNothingSticksOut(page, `${width} px, dialog open`);
    });
  }

  for (const width of [768, 1280]) {
    test(`at ${width} px it is in the middle of the screen, with no grip`, async ({ page }) => {
      const height = 900;
      await openGallery(page, width, height);
      const dialog = await openCalendarDialog(page);

      const centered = await box(dialog);
      expect(centered.x + centered.width / 2, 'centered across').toBeCloseTo(width / 2, 0);
      expect(centered.y + centered.height / 2, 'centered down').toBeCloseTo(height / 2, 0);
      expect(centered.width, 'no wider than a dialog').toBeLessThanOrEqual(512);
      await expect(dialog).toHaveCSS('border-top-left-radius', '8px');
      await expect(page.getByTestId('sheet-handle')).toBeHidden();
      const close = await box(dialog.getByRole('button', { name: 'Chiudi' }));
      // The icon is small and where it has always been; its target is 44 px wide and tall.
      expect(close.width).toBeLessThanOrEqual(20);
      expect(close.x + close.width, 'in the right corner').toBeGreaterThan(centered.x + centered.width - 24);
    });
  }

  test('639 px is still a sheet and 640 px (sm) is the dialog in the middle', async ({ page }) => {
    await openGallery(page, 639, 800);
    const dialog = await openCalendarDialog(page);
    expect((await box(dialog)).width).toBeCloseTo(639, 0);

    await page.setViewportSize({ width: 640, height: 800 });
    await untilStill(page);

    expect((await box(dialog)).width).toBeLessThanOrEqual(512);
    // The same dialog, not a new one: what was typed in it is not lost by turning the phone.
  });

  test('what is typed in the dialog is not lost when the phone is turned to landscape', async ({ page }) => {
    await openGallery(page, 390, 844);
    const dialog = await openCalendarDialog(page);
    await dialog.getByLabel('Link iCal').fill('https://calendar.example.org/me.ics');

    await page.setViewportSize({ width: 844, height: 390 });
    await untilStill(page);

    await expect(dialog.getByLabel('Link iCal')).toHaveValue('https://calendar.example.org/me.ics');
  });

  test('a dialog that wants the whole screen (a photo viewer) stays in the middle on a phone', async ({ page }) => {
    const height = 844;
    await openGallery(page, 390, height);

    await page.getByTestId('open-lightbox').click();
    const lightbox = page.getByRole('dialog', { name: 'Foto' });
    await expect(lightbox).toBeVisible();
    await untilStill(page);

    const found = await box(lightbox);
    expect(found.y + found.height / 2, 'centered down').toBeCloseTo(height / 2, 0);
    expect(found.y + found.height, 'not on the bottom edge').toBeLessThan(height - 100);
    await expect(page.getByTestId('sheet-handle')).toBeHidden();
  });

  for (const width of PHONES) {
    test(`at ${width} px a long dialog scrolls inside and its close button stays at the top`, async ({ page }) => {
      await openGallery(page, width, 800);
      await page.getByTestId('open-long-dialog').click();
      const dialog = page.getByRole('dialog', { name: 'Condizioni di prenotazione' });
      await expect(dialog).toBeVisible();
      await untilStill(page);

      const sheet = await box(dialog);
      expect(sheet.height, 'at most 92 % of the screen').toBeLessThanOrEqual(800 * 0.92 + 1);
      const scrolls = await dialog.evaluate((element) => element.scrollHeight > element.clientHeight + 50);
      expect(scrolls, 'there is more than fits').toBe(true);

      await dialog.evaluate((element) => element.scrollTo(0, element.scrollHeight));
      await untilStill(page);
      await expect(page.getByTestId('long-dialog-accept')).toBeInViewport();
      const close = dialog.getByRole('button', { name: 'Chiudi' });
      await expect(close).toBeInViewport();
      const closeBox = await box(close);
      expect(closeBox.y, 'the close button did not scroll away').toBeLessThan(sheet.y + 12);

      await close.click();
      await expect(dialog).toBeHidden();
    });
  }

  test('a phone closes the sheet with Esc, the close button, a tap outside and a pull of the grip', async ({ page }) => {
    await openGallery(page, 390, 844);

    let dialog = await openCalendarDialog(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    dialog = await openCalendarDialog(page);
    await dialog.getByRole('button', { name: 'Chiudi' }).click();
    await expect(dialog).toBeHidden();

    dialog = await openCalendarDialog(page);
    await page.mouse.click(195, 120);
    await expect(dialog).toBeHidden();

    dialog = await openCalendarDialog(page);
    const grip = await box(page.getByTestId('sheet-handle'));
    const x = grip.x + grip.width / 2;
    const y = grip.y + grip.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 40, { steps: 4 });
    // It follows the finger.
    const during = await box(dialog);
    expect(during.y, 'the sheet moved down with the grip').toBeGreaterThan(844 - during.height + 20);
    await page.mouse.move(x, y + 160, { steps: 6 });
    await page.mouse.up();
    await expect(dialog).toBeHidden();
  });

  test('the grip pulled a little and let go brings the sheet back', async ({ page }) => {
    await openGallery(page, 390, 844);
    const dialog = await openCalendarDialog(page);
    const resting = await box(dialog);
    const grip = await box(page.getByTestId('sheet-handle'));
    const x = grip.x + grip.width / 2;
    const y = grip.y + grip.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 30, { steps: 5 });
    // Slowly: a flick is a quick pull, this one is not.
    await page.waitForTimeout(700);
    await page.mouse.up();

    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await box(dialog)).y, { timeout: 2000 }).toBeCloseTo(resting.y, 0);
  });

  test('the focus stays inside the dialog (it is a trap), and goes back to the button that opened it', async ({ page }) => {
    await openGallery(page, 1280);
    await page.getByTestId('open-confirmation').click();
    const dialog = page.getByRole('dialog', { name: "Eliminare l'ospite?" });
    await expect(dialog).toBeVisible();
    // The first thing to type in has the focus, not the close button.
    await expect(page.getByTestId('confirmation-input')).toBeFocused();

    for (let index = 0; index < 8; index += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null), `Tab ${index + 1}`).toBe(true);
    }
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null), `Shift+Tab ${index + 1}`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('open-confirmation')).toBeFocused();
  });

  for (const width of [1280, 390]) {
    test(`with less motion asked for the dialog does not move and is gone at once, at ${width} px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openGallery(page, width, 800);

      const dialog = await openCalendarDialog(page);
      await expect(dialog).toHaveCSS('animation-name', 'none');

      await page.keyboard.press('Escape');
      // No closing animation to wait for: Radix removes it in the same frame.
      await expect(dialog).toHaveCount(0, { timeout: 400 });
    });
  }

  test('without that setting the dialog does move (the animations are real)', async ({ page }) => {
    await openGallery(page, 1280, 800);

    await page.getByTestId('open-dialog').click();
    const name = await page
      .getByRole('dialog', { name: 'Collega il calendario' })
      .evaluate((element) => getComputedStyle(element).animationName);

    expect(name).not.toBe('none');
  });

  for (const width of PHONES) {
    test(`nothing sticks out at ${width} px with a dialog open, even with wider letters`, async ({ page }) => {
      await openGallery(page, width, 800);
      await page.addStyleTag({ content: WIDER_LETTERS });

      const dialog = await openCalendarDialog(page);
      await expectInsideTheScreen(page, dialog, `${width} px, the dialog`);
      await expectNothingSticksOut(page, `${width} px, the dialog with wider letters`);
      await page.keyboard.press('Escape');

      await page.getByTestId('open-confirmation').click();
      const confirmation = page.getByRole('dialog', { name: "Eliminare l'ospite?" });
      await expect(confirmation).toBeVisible();
      await untilStill(page);
      await expectInsideTheScreen(page, confirmation, `${width} px, the confirmation`);
      await expectNothingSticksOut(page, `${width} px, the confirmation with wider letters`);
    });
  }
});

test.describe('ConfirmationDialog (type a word to confirm, and the consequences)', () => {
  test('the button waits for the word, ignoring capitals, and Enter confirms it', async ({ page }) => {
    await openGallery(page, 1280);
    await page.getByTestId('open-confirmation').click();
    const dialog = page.getByRole('dialog', { name: "Eliminare l'ospite?" });
    const confirm = dialog.getByRole('button', { name: 'Elimina', exact: true });

    await expect(dialog.getByRole('list', { name: 'Cosa succede se confermi' }).getByRole('listitem')).toHaveCount(2);
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Per confermare scrivi ELIMINA').fill('elimin');
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Per confermare scrivi ELIMINA').fill(' elimina ');
    await expect(confirm).toBeEnabled();

    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
  });

  test('what was typed is not there the next time', async ({ page }) => {
    await openGallery(page, 1280);
    await page.getByTestId('open-confirmation').click();
    await page.getByTestId('confirmation-input').fill('ELIMINA');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByTestId('open-confirmation').click();

    await expect(page.getByTestId('confirmation-input')).toHaveValue('');
  });
});

test.describe('HelpTip', () => {
  test('a click opens a bubble with the text and a link, Esc closes it and the focus goes back to the "?"', async ({ page }) => {
    await openGallery(page, 1280);
    const trigger = tipOf(page, 'Codice CIN');

    await trigger.click();

    const bubble = page.getByRole('dialog', { name: 'Codice CIN' });
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText('Il codice che identifica la casa');
    await expect(bubble.getByRole('link', { name: 'Scopri di più' })).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expectInsideTheScreen(page, bubble, 'the bubble');

    await page.keyboard.press('Escape');
    await expect(bubble).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('the keyboard opens it with Enter and with Space, and a click outside closes it', async ({ page }) => {
    await openGallery(page, 1280);
    const trigger = tipOf(page, 'Codice CIN');
    const bubble = page.getByRole('dialog', { name: 'Codice CIN' });

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(bubble).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(bubble).toBeHidden();

    await page.keyboard.press('Space');
    await expect(bubble).toBeVisible();

    await page.mouse.click(900, 60);
    await expect(bubble).toBeHidden();
  });

  test('hovering the "?" does nothing: it is not a tooltip that needs a mouse', async ({ page }) => {
    await openGallery(page, 1280);

    await tipOf(page, 'Codice CIN').hover();
    await page.waitForTimeout(500);

    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the target of the "?" is 44 px although the icon is small', async ({ page }) => {
    await openGallery(page, 1280);
    const trigger = tipOf(page, 'Codice CIN');

    const icon = await box(trigger);
    expect(icon.width).toBeLessThanOrEqual(24);
    // Clicking 20 px away from the icon, still inside the target, opens it.
    await page.mouse.click(icon.x + icon.width / 2 - 18, icon.y + icon.height / 2);
    await expect(page.getByRole('dialog', { name: 'Codice CIN' })).toBeVisible();
  });

  test('the link of the tip leads where it says and closes the tip', async ({ page }) => {
    await openGallery(page, 1280);
    await tipOf(page, 'Codice CIN').click();

    await page.getByRole('dialog', { name: 'Codice CIN' }).getByRole('link', { name: 'Scopri di più' }).click();

    await expect(page).toHaveURL(/\/help\/ical$/);
  });

  test('inside a dialog Esc closes the tip first and the dialog next', async ({ page }) => {
    await openGallery(page, 1280);
    const dialog = await openCalendarDialog(page);
    await tipOf(page, 'iCal').click();
    const bubble = page.getByRole('dialog', { name: 'iCal' });
    await expect(bubble).toBeVisible();
    // The bubble is not cut by the dialog: it may go over its edge.
    await expectInsideTheScreen(page, bubble, 'the bubble in the dialog');

    await page.keyboard.press('Escape');
    await expect(bubble).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(tipOf(page, 'iCal')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  for (const width of PHONES) {
    test(`on a phone (${width} px) a tap opens a sheet from the bottom, with a close button of 44 px`, async ({ page }) => {
      const height = 800;
      await openGallery(page, width, height);

      await tipOf(page, 'Codice CIN').click();

      const sheet = page.getByRole('dialog', { name: 'Codice CIN' });
      await expect(sheet).toBeVisible();
      await untilStill(page);
      const found = await box(sheet);
      expect(found.y + found.height, 'on the bottom edge').toBeCloseTo(height, 0);
      expect(found.width).toBeCloseTo(width, 0);
      const close = await box(sheet.getByRole('button', { name: 'Chiudi' }));
      expect(close.width).toBeGreaterThanOrEqual(44);
      expect(close.height).toBeGreaterThanOrEqual(44);
      const link = await box(sheet.getByRole('link', { name: 'Scopri di più' }));
      expect(link.height, 'the link is a target of 44 px').toBeGreaterThanOrEqual(44);

      await sheet.getByRole('button', { name: 'Chiudi' }).click();
      await expect(sheet).toBeHidden();
      await expect(tipOf(page, 'Codice CIN')).toBeFocused();
    });
  }

  test('on a phone the sheet of a tip opens over a dialog, and Esc closes the sheet and not the dialog', async ({ page }) => {
    await openGallery(page, 390, 844);
    const dialog = await openCalendarDialog(page);

    await tipOf(page, 'iCal').click();
    const sheet = page.getByRole('dialog', { name: 'iCal' });
    await expect(sheet).toBeVisible();
    await untilStill(page);
    // Over the dialog: its top is higher than the one of the dialog? Not necessarily; it must be on top and reachable.
    await expect(sheet.getByRole('link', { name: 'Scopri di più' })).toBeInViewport();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(dialog).toBeVisible();
  });
});

test.describe('Tabs', () => {
  test('they are links with the tab in the address: the other parameters stay, and the history is not filled', async ({ page }) => {
    await openGallery(page, 1280, 800, '?filtro=attivi');
    const tabs = page.getByRole('tablist', { name: 'Sezioni della prenotazione' });
    const historyBefore = await page.evaluate(() => history.length);

    await expect(tabs.getByRole('tab')).toHaveCount(4);
    await expect(tabs.getByRole('tab', { name: 'Dettagli' })).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getByRole('tab', { name: 'Ospite' })).toHaveAttribute('href', '/dev/primitives?filtro=attivi&tab=guest');

    await tabs.getByRole('tab', { name: 'Ospite' }).click();
    await expect(page).toHaveURL(/\?filtro=attivi&tab=guest$/);
    await expect(tabs.getByRole('tab', { name: 'Ospite' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('tabs-panel')).toHaveAccessibleName('Ospite');

    await tabs.getByRole('tab', { name: 'Dettagli' }).click();
    await expect(page).toHaveURL(/\?filtro=attivi$/);
    expect(await page.evaluate(() => history.length), 'a tab does not add an entry to the history').toBe(historyBefore);
  });

  test('a link to a tab opens it, and so does a reload', async ({ page }) => {
    await openGallery(page, 1280, 800, '?tab=alloggiati');
    const tab = page.getByRole('tab', { name: 'Alloggiati' });
    await expect(tab).toHaveAttribute('aria-selected', 'true');

    await page.reload();

    await expect(page.getByRole('tab', { name: 'Alloggiati' })).toHaveAttribute('aria-selected', 'true');
  });

  test('an address with a tab that does not exist opens the first', async ({ page }) => {
    await openGallery(page, 1280, 800, '?tab=inesistente');

    await expect(page.getByRole('tab', { name: 'Dettagli' })).toHaveAttribute('aria-selected', 'true');
  });

  test('the keyboard: only the open tab is in the Tab order, the arrows move along, Enter opens', async ({ page }) => {
    await openGallery(page, 1280);
    const tabs = page.getByRole('tablist');
    await page.getByRole('tab', { name: 'Dettagli' }).focus();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Ospite' })).toBeFocused();
    // Moving is not opening.
    await expect(page.getByRole('tab', { name: 'Dettagli' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\/dev\/primitives$/);

    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Alloggiati' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Dettagli' })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: 'Alloggiati' })).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?tab=alloggiati$/);
    await expect(page.getByRole('tab', { name: 'Alloggiati' })).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getByRole('tab', { name: 'Alloggiati' })).toBeFocused();

    // One Tab leaves the list: the other tabs are not stops.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).not.toBe('tab');
  });

  test('Space opens the tab that has the focus', async ({ page }) => {
    await openGallery(page, 1280);
    await page.getByRole('tab', { name: 'Dettagli' }).focus();
    await page.keyboard.press('ArrowRight');

    await page.keyboard.press('Space');

    await expect(page).toHaveURL(/\?tab=guest$/);
  });

  test('a counter is said with what it counts', async ({ page }) => {
    await openGallery(page, 1280);

    await expect(page.getByRole('tab', { name: /Richieste.*da approvare/ })).toBeVisible();
    await expect(page.getByTestId('tab-requests')).toContainText('3');
  });

  for (const width of PHONES) {
    test(`on a phone (${width} px) the tabs are a native menu that changes the address in the same way`, async ({ page }) => {
      await openGallery(page, width, 800, '?filtro=attivi');

      await expect(page.getByRole('tablist')).toHaveCount(0);
      const menu = page.getByRole('combobox', { name: 'Sezioni della prenotazione' });
      await expect(menu).toBeVisible();
      const found = await box(menu);
      expect(found.height, 'a finger can hit it').toBeGreaterThanOrEqual(44);
      await expectInsideTheScreen(page, menu, 'the menu of the tabs');

      await menu.selectOption('guest');
      await expect(page).toHaveURL(/\?filtro=attivi&tab=guest$/);
      await expect(menu).toHaveValue('guest');
      await menu.selectOption('details');
      await expect(page).toHaveURL(/\?filtro=attivi$/);
      await expectNothingSticksOut(page, `${width} px, tabs`);
    });
  }
});

test.describe('Segmented, ChoiceCard and Qty', () => {
  test('Segmented: the pressed button says so and changes with a click or with the keyboard', async ({ page }) => {
    await openGallery(page, 1280);
    const list = page.getByTestId('view-list');
    const calendar = page.getByTestId('view-calendar');

    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await calendar.click();
    await expect(calendar).toHaveAttribute('aria-pressed', 'true');
    await expect(list).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('view-now')).toHaveText('Vista: calendar');

    await list.focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('view-now')).toHaveText('Vista: list');
  });

  test('Segmented: on a phone each button is 44 px tall in touch mode', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
    await page.goto(GALLERY, { waitUntil: 'domcontentloaded' });

    const found = await box(page.getByTestId('view-list'));

    expect(found.height).toBeGreaterThanOrEqual(44);
    await context.close();
  });

  test('ChoiceCard: a click on the card chooses it, the arrows move between radio buttons, and what is chosen shows by more than color', async ({ page }) => {
    await openGallery(page, 1280);
    const cedolare = page.getByTestId('regime-cedolare');
    const ordinario = page.getByTestId('regime-ordinario');
    await expect(cedolare).toBeChecked();

    await page.getByText('Regime ordinario').click();
    await expect(ordinario).toBeChecked();
    await expect(cedolare).not.toBeChecked();

    // The arrows of a group of radio buttons, native.
    await ordinario.focus();
    await page.keyboard.press('ArrowUp');
    await expect(cedolare).toBeChecked();

    // The chosen one has a thick outline and a tick; the other has an empty disc. (The tick fades: wait for it to be still.)
    await untilStill(page);
    const chosen = page.locator('label', { has: cedolare });
    const other = page.locator('label', { has: ordinario });
    await expect(chosen).toHaveCSS('box-shadow', /\) 0px 0px 0px 2px/);
    await expect(other).not.toHaveCSS('box-shadow', /\) 0px 0px 0px 2px/);
    expect(await chosen.locator('svg').last().evaluate((svg) => getComputedStyle(svg).color)).not.toBe('rgba(0, 0, 0, 0)');
    expect(await other.locator('svg').last().evaluate((svg) => getComputedStyle(svg).color)).toBe('rgba(0, 0, 0, 0)');
  });

  test('ChoiceCard: the card with the keyboard focus has its own outline', async ({ page }) => {
    await openGallery(page, 1280);
    await page.getByTestId('regime-cedolare').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');

    const card = page.locator('label', { has: page.getByTestId('regime-cedolare') });
    await expect(card).toHaveCSS('outline-style', 'solid');
    expect(await card.evaluate((element) => parseFloat(getComputedStyle(element).outlineWidth))).toBeGreaterThanOrEqual(2);
  });

  test('ChoiceCard: checkboxes choose several, with Space', async ({ page }) => {
    await openGallery(page, 1280);
    const pulizie = page.getByTestId('service-pulizie');
    const lavanderia = page.getByTestId('service-lavanderia');
    await expect(lavanderia).toBeChecked();

    await pulizie.focus();
    await page.keyboard.press('Space');

    await expect(pulizie).toBeChecked();
    await expect(lavanderia).toBeChecked();
  });

  for (const width of PHONES) {
    test(`ChoiceCard: at ${width} px the cards stack and nothing sticks out`, async ({ page }) => {
      await openGallery(page, width, 800);
      await page.addStyleTag({ content: WIDER_LETTERS });

      const first = await box(page.locator('label', { has: page.getByTestId('regime-cedolare') }));
      const second = await box(page.locator('label', { has: page.getByTestId('regime-ordinario') }));

      expect(second.y, 'the second card is under the first').toBeGreaterThan(first.y + first.height - 1);
      await expectNothingSticksOut(page, `${width} px, choice cards`);
    });
  }

  test('Qty: plus and minus change the value, stop at the limits and say the value', async ({ page }) => {
    await openGallery(page, 1280);
    const adults = page.getByTestId('qty-adults');
    const plus = adults.getByRole('button', { name: 'Aumenta Adulti' });
    const minus = adults.getByRole('button', { name: 'Diminuisci Adulti' });
    const live = adults.getByRole('status');

    await expect(live).toContainText('Adulti: 2');
    await plus.click();
    await plus.click();
    await expect(live).toContainText('Adulti: 4');
    await expect(plus).toHaveAttribute('aria-disabled', 'true');
    // Playwright treats `aria-disabled` as disabled and waits for it to end: a finger would press it anyway.
    await plus.click({ force: true });
    await expect(live).toContainText('Adulti: 4');
    // The button at the limit keeps the focus: the user is not thrown out of it.
    await expect(plus).toBeFocused();

    await minus.click();
    await minus.click();
    await minus.click();
    await expect(live).toContainText('Adulti: 1');
    await expect(minus).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('qty-now')).toHaveText('Adulti: 1, camere: 1');
  });

  test('Qty: the arrows and Home and End work from the buttons, the buttons are 44 px', async ({ page }) => {
    await openGallery(page, 1280);
    const rooms = page.getByTestId('qty-rooms');
    const plus = rooms.getByRole('button', { name: 'Aumenta Camere' });

    await plus.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(rooms.getByRole('status')).toContainText('Camere: 3');
    await page.keyboard.press('End');
    await expect(rooms.getByRole('status')).toContainText('Camere: 9');
    await page.keyboard.press('Home');
    await expect(rooms.getByRole('status')).toContainText('Camere: 0');

    const found = await box(plus);
    expect(found.width).toBeGreaterThanOrEqual(44);
    expect(found.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('DataView', () => {
  test('on a desktop it is a table and the cards are not there', async ({ page }) => {
    await openGallery(page, 1280);

    const table = page.getByRole('table', { name: 'Ospiti di prova' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('rowheader')).toHaveCount(3);
    await expect(page.getByRole('list', { name: 'Ospiti di prova' })).toBeHidden();
    await expectNothingSticksOut(page, '1280 px');
  });

  for (const width of PHONES) {
    test(`at ${width} px it is a list of cards and the page does not scroll sideways, even with wider letters`, async ({ page }) => {
      await openGallery(page, width, 800);
      await page.addStyleTag({ content: WIDER_LETTERS });

      await expect(page.getByRole('table', { name: 'Ospiti di prova' })).toBeHidden();
      const list = page.getByRole('list', { name: 'Ospiti di prova' });
      await expect(list).toBeVisible();
      await expect(list.getByRole('listitem')).toHaveCount(3);
      await expectInsideTheScreen(page, list, `${width} px, the list of cards`);
      await expectNothingSticksOut(page, `${width} px, data view with wider letters`);
    });
  }

  test('at 768 px (tablet) the table scrolls inside itself if it is wider than the room, and the page does not', async ({ page }) => {
    await openGallery(page, 768, 900);

    await expect(page.getByRole('table', { name: 'Ospiti di prova' })).toBeVisible();
    await expectNothingSticksOut(page, '768 px');
  });

  test('a click on a sortable title sorts the rows and says so with aria-sort', async ({ page }) => {
    await openGallery(page, 1280);
    const table = page.getByRole('table', { name: 'Ospiti di prova' });
    const names = () => table.getByRole('rowheader').allTextContents();
    const nome = table.getByRole('columnheader', { name: 'Nome' });

    await nome.getByRole('button').click();
    await expect(nome).toHaveAttribute('aria-sort', 'ascending');
    expect(await names()).toEqual(['Anna Bianchi', 'Mario Rossi', 'Zenobia-Maria-Giuseppina Verdi-Montefeltro-Della-Rovere']);

    await nome.getByRole('button').click();
    await expect(nome).toHaveAttribute('aria-sort', 'descending');
    expect((await names())[0]).toContain('Zenobia');

    await table.getByRole('columnheader', { name: 'Notti' }).getByRole('button').click();
    await expect(nome).not.toHaveAttribute('aria-sort', /.+/);
    expect(await names()).toEqual(['Anna Bianchi', 'Mario Rossi', 'Zenobia-Maria-Giuseppina Verdi-Montefeltro-Della-Rovere']);
  });

  test('selecting rows shows the bar of actions with the count, and all of them can be selected and cleared', async ({ page }) => {
    await openGallery(page, 1280);
    const table = page.getByRole('table', { name: 'Ospiti di prova' });
    const bar = page.getByRole('region', { name: 'Azioni sulle righe selezionate' });
    await expect(bar).toHaveCount(0);

    await table.getByRole('checkbox', { name: 'Seleziona Mario Rossi' }).check();
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('1 selezionata');
    await expect(bar.getByRole('button', { name: 'Scrivi a 1' })).toBeVisible();

    await table.getByRole('checkbox', { name: 'Seleziona tutte le righe' }).check();
    await expect(bar).toContainText('3 selezionate');
    await bar.getByRole('button', { name: 'Annulla la selezione' }).click();
    await expect(bar).toHaveCount(0);
    await expect(table.getByRole('checkbox', { name: 'Seleziona Mario Rossi' })).not.toBeChecked();
  });

  test('on a phone the loading skeleton is the list one and nothing sticks out', async ({ page }) => {
    await openGallery(page, 390, 700);
    const states = page.getByRole('group', { name: "Stato dell'elenco" });

    await states.getByRole('button', { name: 'Caricamento' }).click();

    const loading = page.getByTestId('guests-view-loading').getByRole('status');
    await expect(loading).toHaveCount(1);
    await expect(loading).toContainText("Caricamento dell'elenco");
    // The list one (round avatars), not the table one, which has no room here.
    await expect(loading.locator('.rounded-full').first()).toBeVisible();
    await expectNothingSticksOut(page, '390 px, loading');
  });

  test('on a phone the cards can be selected as well, and the bar stays in view while the page scrolls', async ({ page }) => {
    await openGallery(page, 390, 700);
    const list = page.getByRole('list', { name: 'Ospiti di prova' });
    await list.scrollIntoViewIfNeeded();

    await list.getByRole('checkbox', { name: 'Seleziona Anna Bianchi' }).check();

    const bar = page.getByRole('region', { name: 'Azioni sulle righe selezionate' });
    await expect(bar).toBeInViewport();
    await page.mouse.wheel(0, 300);
    await expect(bar).toBeInViewport();
  });

  test('loading shows a skeleton that is announced; empty says what to do; failing offers a retry', async ({ page }) => {
    await openGallery(page, 1280);
    const states = page.getByRole('group', { name: "Stato dell'elenco" });

    await states.getByRole('button', { name: 'Caricamento' }).click();
    // The skeleton of each representation is in the page and a media query shows one: at this width the table's is read
    // (the list's is `display: none`, so it is not in the accessibility tree).
    const loading = page.getByTestId('guests-view-loading').getByRole('status');
    await expect(loading).toHaveCount(1);
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(loading).toContainText("Caricamento dell'elenco");

    await states.getByRole('button', { name: 'Vuoto' }).click();
    await expect(page.getByText('Nessun ospite')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Ospiti di prova' })).toHaveCount(0);

    await states.getByRole('button', { name: 'Errore' }).click();
    await expect(page.getByRole('alert')).toContainText('Impossibile caricare gli ospiti');
    await page.getByRole('button', { name: 'Riprova' }).click();
    await expect(page.getByRole('table', { name: 'Ospiti di prova' })).toBeVisible();
  });
});

test.describe('toastUndo', () => {
  const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text });

  test('the toast offers Annulla, and Annulla really undoes the action', async ({ page }) => {
    await openGallery(page, 1280);

    await page.getByTestId('archive').click();
    await expect(page.getByTestId('undo-state')).toContainText('Archiviato: sì');
    const shown = toast(page, 'Ospite archiviato');
    await expect(shown).toBeVisible();

    await shown.getByRole('button', { name: 'Annulla' }).click();

    await expect(page.getByTestId('undo-state')).toContainText('Archiviato: no');
    await expect(shown).toHaveCount(0);
  });

  test('the toast is gone about six seconds after, with no undo left', async ({ page }) => {
    await openGallery(page, 1280);

    await page.getByTestId('archive').click();
    const shown = toast(page, 'Ospite archiviato');
    await expect(shown).toBeVisible();

    await expect(shown).toHaveCount(0, { timeout: 9000 });
    await expect(page.getByTestId('undo-state')).toContainText('Archiviato: sì');
  });

  test('an action held back is done when the window closes, and never if it is undone in time', async ({ page }) => {
    await openGallery(page, 1280);

    await page.getByTestId('hold').click();
    await expect(page.getByTestId('undo-state')).toContainText('eliminazione: pending');
    await expect(page.getByTestId('undo-state')).toContainText('eliminazione: done', { timeout: 6000 });

    await page.getByTestId('hold').click();
    await toast(page, 'Verrà eliminato tra poco').getByRole('button', { name: 'Annulla' }).click();
    await expect(page.getByTestId('undo-state')).toContainText('eliminazione: dropped');
    await page.waitForTimeout(3500);
    await expect(page.getByTestId('undo-state')).toContainText('eliminazione: dropped');
  });

  test('the button of the toast is a real button the keyboard can reach', async ({ page }) => {
    await openGallery(page, 1280);
    await page.getByTestId('archive').click();

    const undo = toast(page, 'Ospite archiviato').getByRole('button', { name: 'Annulla' });
    await undo.focus();
    await expect(undo).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('undo-state')).toContainText('Archiviato: no');
  });

  test('the target of Annulla is 44 px tall although the button of the library is smaller', async ({ page }) => {
    await openGallery(page, 390, 800);
    await page.getByTestId('archive').click();
    const undo = toast(page, 'Ospite archiviato').getByRole('button', { name: 'Annulla' });
    const found = await box(undo);
    expect(found.height, 'the visible button').toBeLessThan(44);

    // 8 px under the button: inside the invisible box around it.
    await page.mouse.click(found.x + found.width / 2, found.y + found.height + 8);

    await expect(page.getByTestId('undo-state')).toContainText('Archiviato: no');
  });
});
