import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { WIDER_LETTERS, expectNoAxeViolations, expectNothingSticksOut } from './helpers/ui-checks';

/**
 * UI-16, the calm blocks of the screens in a real browser. They are on one page that only the dev server has
 * (`/dev/calm-blocks`, `routes/dev-routes.tsx`), so that axe (colors and contrast included), the widths of a phone and the
 * keyboard can walk through all of them without a mock of the API. The unit tests of each block are next to it.
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

test.describe('axe, in a real browser (colors and contrast included)', () => {
  for (const width of [1280, 768, 390, 360]) {
    test(`the page of the blocks has no violation at ${width} px`, async ({ page }) => {
      await openGallery(page, width);

      await expectNoAxeViolations(page);
    });
  }

  for (const area of AREAS) {
    test(`under the redesign, in the area ${area}, the page of the blocks has no violation`, async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem('casazen:ui', 'v2'));
      await openGallery(page, 1280);
      await page.evaluate((value) => document.documentElement.setAttribute('data-area', value), area);
      await expect(page.locator('html')).toHaveAttribute('data-ui', 'v2');

      await expectNoAxeViolations(page);
    });
  }

  test('with a day chosen and more activity shown, the page has no violation', async ({ page }) => {
    await openGallery(page, 390);
    await page.getByTestId('week-strip').getByRole('radio').nth(4).click();
    await page.getByRole('button', { name: 'Mostra altro' }).click();
    await expect(page.getByTestId('activity-list').getByRole('listitem')).toHaveCount(6);

    await expectNoAxeViolations(page);
  });
});

test.describe('widths', () => {
  for (const width of PHONES) {
    test(`nothing sticks out at ${width} px, even with wider letters`, async ({ page }) => {
      await openGallery(page, width);
      await page.addStyleTag({ content: WIDER_LETTERS });

      await expectNothingSticksOut(page, `${width} px, the blocks with wider letters`, '[data-testid="calm-blocks-page"]');
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
    test(`every button, link and day is at least 44 px high at ${width} px, and a row is as high as its hit area`, async ({ page }) => {
      await openGallery(page, width);

      const small = await page.locator('[data-testid="calm-blocks-page"]').evaluate((root) => {
        const found: string[] = [];
        for (const element of Array.from(root.querySelectorAll<HTMLElement>('a, button, [role="radio"]'))) {
          const box = element.getBoundingClientRect();
          if (box.width === 0) continue;
          // The title of a row is a link that stretches over the whole row: what has to be 44 px is the row.
          const stretched = element.className.includes('after:absolute');
          const target = stretched ? (element.closest('li') as HTMLElement).getBoundingClientRect() : box;
          if (target.height < 43.5) found.push(`<${element.tagName.toLowerCase()}> "${(element.textContent ?? '').trim().slice(0, 30)}" is ${Math.round(target.height)} px high`);
        }
        return found;
      });

      expect(small).toEqual([]);
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

    // Tab leaves the week: it is one stop.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('[role="radiogroup"]'))).toBeNull();
  });

  test('a day, a row and a button show where the focus is', async ({ page }) => {
    await openGallery(page, 1280);

    // A key press first, so that the browser treats the next focus as the keyboard's (`:focus-visible`).
    await page.keyboard.press('Tab');
    const ring = async (locator: Locator, pseudo?: string) => {
      await locator.focus();
      return locator.evaluate((element, which) => {
        const style = getComputedStyle(element, which ?? null);
        return { shadow: style.boxShadow, outline: `${style.outlineStyle} ${style.outlineWidth}` };
      }, pseudo);
    };

    const day = await ring(page.getByTestId('week-strip').getByRole('radio').first());
    expect(day.shadow, 'a day').not.toBe('none');
    const row = await ring(page.getByTestId('day-list').getByRole('link').first(), '::after');
    expect(row.shadow, 'the hit area of a row').not.toBe('none');
    const button = await ring(page.getByTestId('focus-warning').getByRole('button', { name: 'Registra il contratto' }));
    expect(button.shadow, 'a button').not.toBe('none');
  });

  test('a row opens by its title, its action does not open the row', async ({ page }) => {
    await openGallery(page, 1280);

    await page.getByTestId('day-list').getByRole('button', { name: 'Invia il sollecito: canone Bianchi' }).click();
    await expect(page.getByTestId('last-action')).toHaveText('Ultima azione: sollecito Bianchi');

    await page.getByTestId('day-list').getByRole('button', { name: 'Canone di ottobre · Bianchi' }).click();
    await expect(page.getByTestId('last-action')).toHaveText('Ultima azione: apri canone Bianchi');
  });

  test('the link of a row opens the page by a click anywhere on the row', async ({ page }) => {
    await openGallery(page, 1280);
    const row = page.getByTestId('day-list').getByRole('listitem').first();
    await row.scrollIntoViewIfNeeded();
    const box = (await boxes(row))[0];

    // On the date, away from the title: the hit area is the row.
    await page.mouse.click(box.x + 20, box.y + box.height / 2);

    await expect(page).toHaveURL(/\/dev\/calm-blocks\?aperto=rossi$/);
  });

  test('the activity list shows more and the focus goes to the first new entry', async ({ page }) => {
    await openGallery(page, 1280);
    const list = page.getByTestId('activity-list');
    await expect(list.getByRole('listitem')).toHaveCount(3);

    await list.locator('xpath=ancestor::div[1]').getByRole('button', { name: 'Mostra altro' }).click();

    await expect(list.getByRole('listitem')).toHaveCount(6);
    await expect(list.getByRole('listitem').nth(3)).toBeFocused();
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
