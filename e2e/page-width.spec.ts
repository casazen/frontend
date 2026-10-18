import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl, type DemoProfile } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

/**
 * Width of the pages on a wide screen. The content of the shell is a flex column, and in a flex column a block with `mx-auto` and
 * a `max-w-*` but no `w-full` takes the width of its content: the profile was 390 px wide on a 1600 px screen. So the check is on
 * the width a page really has, not on the classes it carries. A page uses the width of the shell (`PAGE_COLUMNS` puts its sections
 * side by side), a guided flow or a short form is a column that starts under the title and is `FOCUS_COLUMN` wide.
 * Demo mode (L2): the API is mocked, no stack.
 */
const VIEWPORT = { width: 1600, height: 900 };
/** Width of `FOCUS_COLUMN` (`max-w-4xl`). */
const FOCUS_WIDTH = 896;

/** Width of the content region of the shell, without its padding, and the one of the block that holds the page. */
async function widths(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const main = document.getElementById('main-content') as HTMLElement;
    const style = getComputedStyle(main);
    const room = main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const root = (sel ? main.querySelector(sel) : main.firstElementChild) as HTMLElement;
    const box = root.getBoundingClientRect();
    return { room: Math.round(room), width: Math.round(box.width), left: Math.round(box.left - main.getBoundingClientRect().left - parseFloat(style.paddingLeft)) };
  }, selector);
}

test.describe('Page width', () => {
  test.use({ viewport: VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
  });

  const fullWidthPages: { name: string; path: string; profile: DemoProfile; heading: RegExp }[] = [
    { name: 'the profile of Affitti brevi', path: '/app/short-rent/profile', profile: 'short-stay', heading: /Il mio profilo/ },
    { name: 'the profile of Affitti lunghi', path: '/app/long-rent/profile', profile: 'long-term', heading: /Il mio profilo/ },
    { name: 'the profile of the staff console', path: '/app/admin/profile', profile: 'admin', heading: /Profilo utente/ },
    { name: 'the form of a new property', path: '/app/short-rent/properties/create', profile: 'short-stay', heading: /Crea propriet/ },
    { name: 'the form of a new lease', path: '/app/long-rent/leases/new', profile: 'long-term', heading: /Nuovo contratto/ },
  ];

  for (const { name, path, profile, heading } of fullWidthPages) {
    test(`${name} uses the whole width of the shell`, async ({ page }) => {
      await page.goto(demoUrl(path, profile), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();

      const { room, width, left } = await widths(page, '');
      expect(room).toBeGreaterThan(1200);
      expect(left).toBe(0);
      expect(width).toBe(room);
    });
  }

  test('the sections of the profile are side by side on a wide screen and under each other on a narrow one', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/profile', 'short-stay'), { waitUntil: 'domcontentloaded' });
    const info = page.getByText('Informazioni profilo');
    const type = page.getByText('Tipo di operatore');
    await expect(type).toBeVisible();
    const wide = { info: (await info.boundingBox())!, type: (await type.boundingBox())! };
    expect(wide.type.x).toBeGreaterThan(wide.info.x + 400);
    expect(Math.abs(wide.type.y - wide.info.y)).toBeLessThan(40);

    await page.setViewportSize({ width: 1100, height: 900 });
    await expect.poll(async () => (await type.boundingBox())!.y).toBeGreaterThan((await info.boundingBox())!.y + 100);
  });

  test('a short form is a column that starts at the left edge of its title, not a block in the middle of the page', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/fiscal/wizard', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Profilo fiscale' })).toBeVisible();

    const column = await widths(page, '[data-testid="fiscal-wizard-page"]');
    expect(column.left).toBe(0);
    expect(column.width).toBe(FOCUS_WIDTH);
    const title = (await page.getByRole('heading', { level: 1, name: 'Profilo fiscale' }).boundingBox())!;
    const form = (await page.getByTestId('fiscal-wizard-form').boundingBox())!;
    expect(Math.abs(form.x - title.x)).toBeLessThan(2);
  });

  test('the wizard of a new booking starts under its title', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/bookings/create', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Nuova prenotazione' })).toBeVisible();

    const column = await widths(page, '[data-testid="booking-create-page"] > div:last-child');
    expect(column.left).toBe(0);
    expect(column.width).toBe(FOCUS_WIDTH);
  });
});
