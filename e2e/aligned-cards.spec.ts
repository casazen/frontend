import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';
import type { PublicPropertyDto } from '../src/types';

/**
 * Cards of a row look the same: their sections (the title, the text, the list, the button...) start at the same height even when
 * a title wraps on two lines or a card has less to say than its neighbours. The cards of a grid are subgrids of it
 * (`AlignedCard`, and the same utilities where a card is not a `Card`), so each section is a row of the grid and a row is as
 * tall as its tallest section.
 */

/** `top` or `bottom` of the box of each element: one number per element, in px from the top of the viewport. */
async function edges(elements: Locator[], edge: 'top' | 'bottom'): Promise<number[]> {
  return Promise.all(
    elements.map(async (element) => {
      const box = await element.boundingBox();
      if (!box) throw new Error(`no box for ${String(element)}`);
      return edge === 'top' ? box.y : box.y + box.height;
    }),
  );
}

/** The lines a text takes (the box of the element is the row of the grid, as tall as the longest title of the row). */
async function linesOf(element: Locator): Promise<number> {
  return element.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
  });
}

/** The elements start (or end) at the same height: a pixel is the rounding of a fractional line height, not a difference. */
async function expectAligned(elements: Locator[], what: string, edge: 'top' | 'bottom' = 'top'): Promise<void> {
  expect(elements.length, `${what}: at least two cards to compare`).toBeGreaterThan(1);
  const values = await edges(elements, edge);
  expect(Math.max(...values) - Math.min(...values), `${what} (${edge}) at ${values.map((v) => v.toFixed(1)).join(', ')}`).toBeLessThanOrEqual(1);
}

test.describe('Aligned cards', () => {
  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
    // The cookie banner is not what these specs are about.
    await page.addInitScript(() => localStorage.setItem('casazen_cookie_consent', 'rejected'));
  });

  test.describe('Onboarding: the three ways to start', () => {
    for (const width of [1060, 1900]) {
      test(`the title, the text, the list and the button of the three cards line up at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(demoUrl('/onboarding', 'onboarding'));

        const titles = page.getByRole('heading', { level: 3 });
        await expect(titles).toHaveCount(3);
        const cards = titles.locator('..');
        const each = (selector: string) => [0, 1, 2].map((index) => cards.nth(index).locator(selector).first());

        // At 1060 px "Locazioni di lungo periodo" wraps on two lines: that is what used to push down the rest of its card.
        if (width === 1060) {
          expect(await linesOf(titles.nth(0))).toBe(1);
          expect(await linesOf(titles.nth(1))).toBe(2);
        }

        await expectAligned(each('h3'), 'title');
        await expectAligned(each('p'), 'text');
        await expectAligned(each('ol'), 'list');
        await expectAligned(each('button'), 'button');
        await expectAligned(each('button'), 'button', 'bottom');
        await expectAligned([0, 1, 2].map((index) => cards.nth(index)), 'card', 'bottom');
      });
    }
  });

  test.describe('Public property cards', () => {
    const base = {
      slug: null,
      postalCode: '00153',
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      nightlyRate: 165,
      cleaningFee: 55,
      amenities: ['Wifi'],
      photoUrls: [],
      timezone: 'Europe/Rome',
    };

    // Three cards of a row that differ the way real ones do: a name on three lines or on one, a description of two lines, of
    // one or none, a CIN or none, facts that wrap or fit.
    const properties: PublicPropertyDto[] = [
      {
        ...base,
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Attico panoramico con terrazza privata sul centro storico di Roma e sui Fori Imperiali',
        description: 'Un attico luminoso con una grande terrazza che guarda i tetti di Roma. Due camere, cucina completa, aria condizionata.',
        city: 'Roma',
        cinCode: 'IT058091C27G5FFZDZ',
        cinStatus: 'Valid',
      },
      {
        ...base,
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Loft Duomo',
        description: 'Loft a due passi dal Duomo.',
        city: 'Milano',
        postalCode: '20121',
        cinCode: null,
        cinStatus: 'Missing',
      },
      {
        ...base,
        id: '00000000-0000-4000-8000-000000000003',
        name: 'Casa vacanze sul lago di Como con giardino',
        description: '',
        city: 'Como',
        postalCode: '22100',
        bedrooms: 3,
        bathrooms: 2,
        maxGuests: 6,
        nightlyRate: 240,
        cinCode: 'IT013075C2LKXQ4ZUB',
        cinStatus: 'Valid',
      },
    ];

    async function mockOrgSite(page: Page): Promise<void> {
      await page.route('**/api/public/orgs/**', async (route) => {
        const url = route.request().url();
        if (route.request().method() !== 'GET' || url.includes('/properties/')) {
          await route.fallback();
          return;
        }
        const body = url.endsWith('/properties')
          ? properties
          : { slug: 'demo-casazen', displayName: 'Demo Casazen Stays', logoUrl: null, themeColor: '#2563eb', contactEmail: 'prenotazioni@demo.example' };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.route('**/api/properties/search**', async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        const results = properties.map((property) => ({ ...property, orgSlug: 'demo-casazen', slug: `p-${property.id.slice(-1)}` }));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(results) });
      });
    }

    /** Where the parts of the three cards start: the name, the place, the CIN (two cards have it), the text, the facts and the price. */
    async function expectCardsAligned(page: Page): Promise<void> {
      const cards = page.getByTestId('public-property-card');
      await expect(cards).toHaveCount(3);
      const each = (selector: string) => [0, 1, 2].map((index) => cards.nth(index).locator(selector).first());

      // The name of the first card is on three lines or more, the second on one: without the rows that pushed down everything
      // under the longer name, in its card only.
      expect(await linesOf(cards.nth(0).locator('h3'))).toBeGreaterThanOrEqual(3);
      expect(await linesOf(cards.nth(1).locator('h3'))).toBe(1);

      await expectAligned(each('h3'), 'name');
      await expectAligned(each('h3 + p'), 'place');
      await expectAligned([cards.nth(0), cards.nth(2)].map((card) => card.getByTestId('public-cin')), 'CIN');
      await expectAligned([cards.nth(0), cards.nth(1)].map((card) => card.locator('p.line-clamp-2')), 'description');
      await expectAligned(each('[data-testid=public-property-card-facts]'), 'facts');
      await expectAligned(each('[data-testid=public-property-card-price]'), 'price', 'bottom');
      await expectAligned([0, 1, 2].map((index) => cards.nth(index)), 'card', 'bottom');
    }

    test('the landing page of a host lines the cards up row by row', async ({ page }) => {
      await mockOrgSite(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto('/book/demo-casazen');

      await expectCardsAligned(page);
    });

    test('the search results line the cards up row by row', async ({ page }) => {
      await mockOrgSite(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(demoUrl('/search', 'short-stay'));

      await expectCardsAligned(page);
    });

    test('on a phone the cards are one column with no empty rows to fill', async ({ page }) => {
      await mockOrgSite(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/book/demo-casazen');

      await expect(page.getByTestId('public-property-card')).toHaveCount(3);
      // The rows that keep the cards of a row in step are empty ones; in a single column there is nothing to keep in step with.
      const rowsShown = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid=public-property-card] > div:empty')].filter((row) => getComputedStyle(row).display !== 'none').length,
      );
      expect(rowsShown).toBe(0);
    });
  });
});
