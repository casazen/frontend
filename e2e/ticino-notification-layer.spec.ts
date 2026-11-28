import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { DEMO_TICINO_DAY, DEMO_TICINO_PROPERTY_ID, mockTicinoNotificationApi } from './helpers/compliance-mock';
import { resetE2eStorage } from './helpers/locale';

const LAYER_ADDRESS = `/app/short-rent/compliance?detail=ticino:${DEMO_TICINO_PROPERTY_ID}:${DEMO_TICINO_DAY}`;

test.describe('Ticino police notification as a layer of the cockpit (E30/F02/US03)', () => {
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test('the cockpit row opens the layer, the file is downloaded and the declared day leaves the cockpit without a reload', async ({ page }) => {
    const server = await mockTicinoNotificationApi(page);
    await page.goto(demoUrl('/app/short-rent/compliance', 'short-stay'), { waitUntil: 'domcontentloaded' });

    const row = page.getByTestId('compliance-summary-ticino-link');
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();

    await expect(page).toHaveURL(new RegExp(`/app/short-rent/compliance\\?.*detail=ticino:${DEMO_TICINO_PROPERTY_ID}:${DEMO_TICINO_DAY}`));
    await expect(page.getByTestId('ticino-layer')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('compliance-summary-widget')).toBeAttached();
    await expect(page.getByTestId('ticino-day-title')).toContainText('19 novembre');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('ticino-download-csv').click()]);
    expect(download.suggestedFilename()).toBe('notifiche-ti-2026-11-19.csv');
    expect(server.files).toBe(1);

    await page.getByTestId('ticino-step-declare-toggle').click();
    await page.getByTestId('ticino-declare-button').click();
    await expect(page.getByTestId('ticino-day-state')).toContainText('Già caricato il 19 novembre', { timeout: 15_000 });
    expect(server.declarations).toEqual([{ arrivalDay: DEMO_TICINO_DAY }]);
    await expect(row).toHaveCount(0);

    await page.getByTestId('ticino-later').click();
    await expect(page.getByTestId('ticino-layer')).toHaveCount(0);
    await expect(page).toHaveURL(/\/app\/short-rent\/compliance/);
    await expect(page.getByTestId('compliance-summary-widget')).toBeVisible();
  });

  test('a declared day asks before its file is generated again', async ({ page }) => {
    const server = await mockTicinoNotificationApi(page);
    await page.goto(demoUrl(LAYER_ADDRESS, 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('ticino-layer')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('ticino-step-declare-toggle').click();
    await page.getByTestId('ticino-declare-button').click();
    await expect(page.getByTestId('ticino-day-state')).toContainText('Già caricato il 19 novembre', { timeout: 15_000 });

    await page.getByTestId('ticino-step-file-toggle').click();
    await page.getByTestId('ticino-download-csv').click();
    const dialog = page.getByRole('dialog', { name: 'Scaricare di nuovo il file?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('notifiche doppie');
    expect(server.files).toBe(0);

    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Scarica di nuovo' }).click()]);
    expect(download.suggestedFilename()).toBe('notifiche-ti-2026-11-19.csv');
    expect(server.files).toBe(1);
  });

  test('the old address of the page leads to the layer over the cockpit, so no link is broken', async ({ page }) => {
    await mockTicinoNotificationApi(page);
    await page.goto(demoUrl(`/app/short-rent/compliance/ticino?property=${DEMO_TICINO_PROPERTY_ID}&date=${DEMO_TICINO_DAY}`, 'short-stay'), { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(new RegExp(`/app/short-rent/compliance\\?.*detail=ticino:${DEMO_TICINO_PROPERTY_ID}:${DEMO_TICINO_DAY}`), { timeout: 15_000 });
    await expect(page.getByTestId('ticino-layer')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('compliance-summary-widget')).toBeAttached();
  });
});
