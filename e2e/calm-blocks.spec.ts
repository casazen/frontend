import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { WIDER_LETTERS, expectNoAxeViolations, expectNothingSticksOut, untilStill } from './helpers/ui-checks';

/**
 * UI-16, the calm blocks of the screens in a real browser. They are on one page that only the dev server has
 * (`/dev/calm-blocks`, `routes/dev-routes.tsx`), so that axe (colors and contrast included), the widths of a phone, the
 * keyboard and a finger can walk through all of them without a mock of the API. The unit tests of each block are next to it.
 */

const GALLERY = '/dev/calm-blocks';
const PHONES = [360, 390] as const;
const AREAS = ['short-rent', 'long-rent', 'supplier', 'admin'] as const;

async function openGallery(page: Page, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(GALLERY, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Blocchi calmi' })).toBeVisible();
}

async function boxes(locator: Locator) {
  const found = await Promise.all((await locator.all()).map((item) => item.boundingBox()));
  expect(found.every((item) => item !== null), 'every element is on the page').toBe(true);
  return found as NonNullable<(typeof found)[number]>[];
}

/** Every button, link and day of the gallery that is under 44 px high (what a finger needs), one line each. */
async function smallTargets(page: Page) {
  return page.locator('[data-testid="calm-blocks-page"]').evaluate((root) => {
    const found: string[] = [];
    for (const element of Array.from(root.querySelectorAll<HTMLElement>('a, button, [role="radio"]'))) {
      const box = element.getBoundingClientRect();
      if (box.width === 0) continue;
      if (box.height < 43.5) found.push(`<${element.tagName.toLowerCase()}> "${(element.textContent ?? '').trim().slice(0, 30)}" is ${Math.round(box.height)} px high`);
    }
    return found;
  });
}

test.describe('axe, in a real browser (colors and contrast included)', () => {
  for (const width of [1280, 768, 390, 360]) {
    test(`the page of the blocks has no violation at ${width} px`, async ({ page }) => {
      await openGallery(page, width);

      await expectNoAxeViolations(page);
    });
  }

  for (const area of AREAS) {
    test(`in the area ${area}, the page of the blocks has no violation`, async ({ page }) => {
      await openGallery(page, 1280);
      await page.evaluate((value) => document.documentElement.setAttribute('data-area', value), area);
      await expect(page.locator('html')).toHaveAttribute('data-ui', 'v2');

      await expectNoAxeViolations(page);
    });
  }

  test('with a day chosen and more activity shown, the page has no violation', async ({ page }) => {
    await openGallery(page, 390);
    await page.getByTestId('week-strip').getByRole('radio').nth(4).click();
    const activity = page.getByTestId('activity-list');
    await activity.getByRole('button', { name: 'Mostra altro' }).click();
    await expect(activity.getByRole('listitem')).toHaveCount(6);
    await untilStill(page);

    await expectNoAxeViolations(page);
  });
});

test.describe('widths', () => {
  for (const width of PHONES) {
    test(`nothing sticks out at ${width} px, even with wider letters and names that have no space in them`, async ({ page }) => {
      await openGallery(page, width);
      await page.addStyleTag({ content: WIDER_LETTERS });

      await expectNothingSticksOut(page, `${width} px, the blocks with wider letters`, '[data-testid="calm-blocks-page"]');
      // The words of a long name wrap inside the block that holds them: the page does not scroll sideways (the check above) and
      // the name does not stand out of its own box either.
      for (const testId of ['plain-long', 'checklist-long', 'day-list']) {
        const stickingOut = await page.getByTestId(testId).evaluate((root) => {
          const right = root.getBoundingClientRect().right;
          return Array.from(root.querySelectorAll('*')).filter((element) => element.getBoundingClientRect().right > right + 0.5).length;
        });
        expect(stickingOut, `${testId} at ${width} px: elements past the right edge of the block`).toBe(0);
      }
    });
  }

  test('the numbers are one column on a phone, two on a tablet and three or four across on a laptop', async ({ page }) => {
    const rowsAndColumns = async (testId: string) => {
      const tiles = await boxes(page.getByTestId(testId).getByRole('listitem'));
      return { columns: new Set(tiles.map((tile) => Math.round(tile.x))).size, rows: new Set(tiles.map((tile) => Math.round(tile.y))).size };
    };

    await openGallery(page, 390);
    expect(await rowsAndColumns('strip-4'), 'four numbers on a phone').toEqual({ columns: 1, rows: 4 });
    expect(await rowsAndColumns('strip-3'), 'three numbers on a phone').toEqual({ columns: 1, rows: 3 });

    await page.setViewportSize({ width: 768, height: 900 });
    expect(await rowsAndColumns('strip-4'), 'four numbers on a tablet').toEqual({ columns: 2, rows: 2 });

    await page.setViewportSize({ width: 1280, height: 900 });
    expect(await rowsAndColumns('strip-4'), 'four numbers on a laptop').toEqual({ columns: 4, rows: 1 });
    expect(await rowsAndColumns('strip-3'), 'three numbers on a laptop').toEqual({ columns: 3, rows: 1 });
    expect(await rowsAndColumns('strip-2'), 'two numbers on a laptop').toEqual({ columns: 2, rows: 1 });
  });

  test('the main action of the highlighted block takes the whole width on a phone and only its own on a laptop', async ({ page }) => {
    await openGallery(page, 390);
    const block = page.getByTestId('focus-neutral');
    const primary = block.getByRole('link', { name: 'Vai al passo' });
    expect((await boxes(primary))[0].width, 'on a phone').toBeGreaterThan((await boxes(block))[0].width * 0.7);

    await page.setViewportSize({ width: 1280, height: 900 });
    expect((await boxes(primary))[0].width, 'on a laptop').toBeLessThan((await boxes(block))[0].width * 0.4);
  });
});

test.describe('touch targets', () => {
  for (const width of [1280, ...PHONES]) {
    test(`every button, link and day is at least 44 px high at ${width} px`, async ({ page }) => {
      await openGallery(page, width);

      expect(await smallTargets(page)).toEqual([]);
    });
  }

  test('the days of the week are 44 px wide at 360 px', async ({ page }) => {
    await openGallery(page, 360);

    for (const day of await boxes(page.getByTestId('week-strip').getByRole('radio'))) expect(day.width).toBeGreaterThanOrEqual(43.5);
  });
});

test.describe('keyboard', () => {
  test('the week is one stop of the Tab key, and the arrows, Home and End choose the day', async ({ page }) => {
    await openGallery(page, 1280);
    const days = page.getByTestId('week-strip').getByRole('radio');
    await expect(page.getByTestId('week-strip').getByRole('radio', { checked: true })).toHaveCount(1);

    // Only the chosen day is in the Tab order.
    const tabIndexes = await days.evaluateAll((items) => items.map((item) => (item as HTMLElement).tabIndex));
    const chosenIndex = await days.evaluateAll((items) => items.findIndex((item) => item.getAttribute('aria-checked') === 'true'));
    expect(tabIndexes.filter((value) => value === 0)).toHaveLength(1);
    expect(tabIndexes[chosenIndex]).toBe(0);

    await days.first().focus();
    await page.keyboard.press('End');
    await expect(days.last()).toBeFocused();
    await expect(days.last()).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('week-selected')).toHaveText(`Giorno scelto: ${await days.last().getAttribute('data-date')}`);

    await page.keyboard.press('ArrowRight');
    await expect(days.first()).toBeFocused();
    await expect(days.first()).toHaveAttribute('aria-checked', 'true');

    await page.keyboard.press('ArrowLeft');
    await expect(days.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(days.first()).toBeFocused();

    // A shortcut of the browser is not taken for a choice of day (Alt+Left is Back).
    await page.keyboard.press('Alt+ArrowRight');
    await expect(days.first()).toBeFocused();

    // Tab leaves the week: it is one stop.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="radiogroup"]'))).toBeNull();
  });

  test('a day, a row and a button show where the focus is, and show nothing when it is not there', async ({ page }) => {
    await openGallery(page, 1280);

    const day = page.getByTestId('week-strip').getByRole('radio').first();
    const row = page.getByTestId('day-list').getByRole('link').first();
    const button = page.getByTestId('focus-warning').getByRole('button', { name: 'Registra il contratto' });
    const ring = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).boxShadow);

    // Before the focus: no ring (a static shadow of the element would not count as one).
    const before = [await ring(day), await ring(row), await ring(button)];
    // A key press first, so that the browser treats the next focus as the keyboard's (`:focus-visible`).
    await page.keyboard.press('Tab');
    for (const [index, locator] of [day, row, button].entries()) {
      await locator.focus();
      expect(await ring(locator), ['a day', 'a row', 'a button'][index]).not.toBe(before[index]);
      expect(await ring(locator), ['a day', 'a row', 'a button'][index]).not.toBe('none');
    }
  });

  test('a row opens by its title and its line, its action does not open the row', async ({ page }) => {
    await openGallery(page, 1280);
    const list = page.getByTestId('day-list');

    await list.getByRole('button', { name: 'Invia il sollecito: canone Bianchi' }).click();
    await expect(page.getByTestId('last-action')).toHaveText('Ultima azione: sollecito Bianchi');

    await list.getByRole('button', { name: /Canone di ottobre · Bianchi/ }).click();
    await expect(page.getByTestId('last-action')).toHaveText('Ultima azione: apri canone Bianchi');

    // The line under the title is part of the link.
    await list.getByText('Elisa Rossi · Via Roma 12, Bari').click();
    await expect(page).toHaveURL(/\/dev\/calm-blocks\?aperto=rossi$/);
  });

  test('the activity list shows more and the focus goes to the first new entry', async ({ page }) => {
    await openGallery(page, 1280);
    const list = page.getByTestId('activity-list');
    await expect(list.getByRole('listitem')).toHaveCount(3);

    await list.getByRole('button', { name: 'Mostra altro' }).click();

    await expect(list.getByRole('listitem')).toHaveCount(6);
    await expect(list.getByRole('listitem').nth(3)).toBeFocused();
  });
});

// A phone: a finger (a coarse pointer) and `data-ui="v2"`, where `tokens.css` gives every link and button its own hit area.
// What a block does there is not what it does with a mouse, and nothing else looks at it.
test.describe('a phone under the redesign', () => {
  test.use({ hasTouch: true, isMobile: true });

  test.beforeEach(async ({ page }) => {
    await openGallery(page, 390, 844);
    await expect(page.locator('html')).toHaveAttribute('data-ui', 'v2');
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches), 'the pointer is a finger').toBe(true);
  });

  test('a tap on the line under the title of a row that is a link opens it', async ({ page }) => {
    const subline = page.getByTestId('day-list').getByText('Elisa Rossi · Via Roma 12, Bari');
    await subline.scrollIntoViewIfNeeded();

    await subline.tap();

    await expect(page).toHaveURL(/\/dev\/calm-blocks\?aperto=rossi$/);
  });

  test('a tap on the line under the title of a row that is a button opens it, and a tap on its action only runs the action', async ({ page }) => {
    const list = page.getByTestId('day-list');
    const subline = list.getByText('Marco Bianchi · Corso Vittorio 3');
    await subline.scrollIntoViewIfNeeded();

    await subline.tap();
    await expect(page.getByTestId('last-action')).toHaveText('Ultima azione: apri canone Bianchi');

    await list.getByRole('button', { name: 'Invia il sollecito: canone Bianchi' }).tap();
    await expect(page.getByTestId('last-action')).toHaveText('Ultima azione: sollecito Bianchi');
  });

  test('the title of a row is a target as high as a finger needs', async ({ page }) => {
    const rows = page.getByTestId('day-list').getByRole('listitem');
    for (const link of await boxes(rows.getByRole('link').or(rows.getByRole('button', { name: /Canone di ottobre/ })))) expect(link.height).toBeGreaterThanOrEqual(43.5);
  });

  test('every button, link and day is at least 44 px high', async ({ page }) => {
    expect(await smallTargets(page)).toEqual([]);
  });

  test('a day of the week is chosen with a tap', async ({ page }) => {
    const days = page.getByTestId('week-strip').getByRole('radio');
    await days.nth(3).scrollIntoViewIfNeeded();

    await days.nth(3).tap();

    await expect(days.nth(3)).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('week-selected')).toHaveText(`Giorno scelto: ${await days.nth(3).getAttribute('data-date')}`);
  });

  test('the page has no violation', async ({ page }) => {
    await expectNoAxeViolations(page);
  });
});

test.describe('motion', () => {
  test('a day of the week fades in a change of color, and with less motion asked for it does not move', async ({ page }) => {
    await openGallery(page, 1280);
    const day = page.getByTestId('week-strip').getByRole('radio').first();
    expect(await day.evaluate((element) => getComputedStyle(element).transitionProperty)).not.toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });

    expect(await day.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe('none');
  });
});
