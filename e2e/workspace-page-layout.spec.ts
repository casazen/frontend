import type { Locator } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { mockEmptyAdminStats } from './helpers/admin-stats';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import { pinE2eLocale } from './helpers/locale';

async function expectShellEdges(element: Locator, fullWidth = true) {
  await expect.poll(async () => {
    if (!(await element.count())) return Infinity;
    return element.evaluate((el, checkRight) => {
      const main = el.closest('#main-content');
      if (!main || !el.getClientRects().length) return Infinity;
      const outer = main.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(main);
      const left = Math.abs(rect.left - outer.left - parseFloat(style.paddingLeft));
      const right = Math.abs(rect.right - outer.right + parseFloat(style.paddingRight));
      return checkRight ? Math.max(left, right) : left;
    }, fullWidth);
  }).toBeLessThan(2);
}

// Each scenario visits several lazy-loaded routes on the demo development server.
test.describe.configure({ timeout: 90_000 });

for (const width of [390, 1920]) {
  test(`section headings, tabs and filters share the shell gutters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setDemoProfile(page, 'short-stay');
    await pinE2eLocale(page, 'it');
    await page.route('**/api/approval-queue', route => route.fulfill({ json: [{
      id: '1', itemId: '1', itemType: 'Campaign', contentText: 'Campagna di prova', status: 'Pending',
      createdAt: '2026-10-01T08:00:00Z', expiresAt: '2027-01-01T08:00:00Z', originActionStatus: 'NotRequired',
    }] }));
    await page.route('**/api/verification/pending', route => route.fulfill({ json: [] }));
    await page.goto(demoUrl('/app/short-rent/activities', 'short-stay'), { waitUntil: 'domcontentloaded' });
    const header = page.getByTestId('page-header');
    await expectShellEdges(header);
    const initialY = (await header.boundingBox())!.y;
    for (const segment of ['approval-queue', 'verifications']) {
      const path = '/app/short-rent/' + segment;
      if (width < 768) await page.getByTestId('nav-section-select').selectOption(path);
      else await page.getByTestId('nav-section-tab-' + segment).click();
      await expect(page).toHaveURL(new RegExp(path + '$'));
      await expectShellEdges(header);
      const tabBar = page.locator('main nav').filter({ has: width < 768 ? page.getByTestId('nav-section-select') : page.getByTestId('nav-section-tab-' + segment) });
      await expectShellEdges(tabBar);
      await expectShellEdges(page.locator(segment === 'approval-queue' ? '#type-filter' : '#reason-filter'), false);
      expect(Math.abs((await header.boundingBox())!.y - initialY)).toBeLessThan(2);
    }
    await page.route('**/api/approval-queue', route => route.fulfill({ json: [] }));
    await page.goto(demoUrl('/app/short-rent/approval-queue', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Nessun elemento', { exact: true })).toBeVisible();
    await expect(page.locator('#type-filter')).toHaveCount(0);
    await expectShellEdges(header);

  });

  test(`settings pages share the workspace gutters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await setDemoProfile(page, 'short-stay');
    const header = page.getByTestId('page-header');
    for (const path of ['/app/short-rent/settings', '/app/short-rent/settings/ai']) {
      await page.goto(demoUrl(path, 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(path + '\\?'));
      await expectShellEdges(header);
    }
  });

  test(`workspace content uses the same gutters in each operating area at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockSupplierConsoleApi(page, { active: true });
    await mockEmptyAdminStats(page);
    for (const [path, profile] of [
      ['/app/long-rent/settings', 'long-term'],
      ['/app/admin', 'admin'],
      ['/app/supplier/dashboard', 'supplier'],
    ] as const) {
      await test.step(path, async () => {
        await page.goto(demoUrl(path, profile), { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(path + '\\?'));
        await expectShellEdges(page.getByTestId('page-header'));
      });
    }
  });
}
