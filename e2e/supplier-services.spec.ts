import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import { drawing, mockService, mockSupplierServicesApi, type MockService, type SupplierServicesMock } from './helpers/supplier-services-mock';
import { WIDER_LETTERS, expectNoAxeViolations, expectNothingSticksOut } from './helpers/ui-checks';

const PHONES = [360, 390];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function openServices(page: Page, path: string, options: { services?: MockService[]; limit?: number } = {}): Promise<SupplierServicesMock> {
  await setDemoProfile(page, 'supplier');
  await mockSupplierConsoleApi(page, { active: true });
  const catalog = await mockSupplierServicesApi(page, options);
  await page.goto(demoUrl(path, 'supplier'), { waitUntil: 'domcontentloaded' });
  return catalog;
}

const writes = (catalog: SupplierServicesMock) => catalog.calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.path}`);

const rowOf = (page: Page, id: string) => page.locator(`[data-testid="list-row-${id}"]:visible`);

async function expectFingerTargets(page: Page, scope: string, where: string) {
  const small = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return ['(the scope is not on the page)'];
    const found: string[] = [];
    for (const element of root.querySelectorAll<HTMLElement>('button, a[href], summary')) {
      if (element.closest('.sr-only, [aria-hidden="true"]') || element.getAttribute('role') === 'switch') continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const label = () => (element.getAttribute('aria-label') ?? element.textContent ?? element.getAttribute('data-testid') ?? '').trim().slice(0, 30);
      if (element.matches(':disabled')) {
        if (box.width < 43.5 || box.height < 43.5) found.push(`<${element.tagName.toLowerCase()}> "${label()}" (disabled) ${Math.round(box.width)}x${Math.round(box.height)}`);
        continue;
      }
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const misses = ([[-21, 0], [21, 0], [0, -21], [0, 21]] as const).filter(([dx, dy]) => {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px > innerWidth || py > innerHeight) return false;
        const hit = document.elementFromPoint(px, py);
        return !(hit && (hit === element || element.contains(hit)));
      });
      if (misses.length > 0) found.push(`<${element.tagName.toLowerCase()}> "${label()}" ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
    return found;
  }, scope);
  expect(small, `${where}: every button and link a finger has to hit has 44 px of target`).toEqual([]);
}

test.describe('Servizi e prezzi (SP-06)', () => {
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test.describe('on a computer', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('creates a service in four steps, publishes it, and pauses it from its page', async ({ page }) => {
      const catalog = await openServices(page, '/app/supplier/services');
      await expect(page.getByRole('heading', { name: 'Crea il tuo primo servizio' })).toBeVisible();

      await expect(page.getByTestId('supplier-service-add')).toHaveCount(0);
      await page.getByTestId('supplier-services-empty').getByRole('link', { name: 'Aggiungi un servizio' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Cosa offri?' })).toBeVisible();
      await page.getByTestId('service-name').fill('Pulizia cambio ospiti');
      await page.getByTestId('service-summary').fill('La casa pronta per il prossimo ospite.');
      await page.getByTestId('service-category').selectOption('cleaning');
      await page.getByTestId('service-wizard-next').click();

      await expect(page.getByRole('heading', { level: 2, name: 'Quanto costa?' })).toBeVisible();
      await expect(page).toHaveURL(/bozza=e2e-1/);
      await expect(page.getByTestId('service-wizard-saved')).toContainText('Bozza salvata alle');
      await page.getByTestId('service-amount').fill('45,50');
      await page.getByTestId('service-supplement-add').click();
      await page.getByLabel('Supplemento 1', { exact: true }).fill('Bagno in più');
      await page.getByLabel('Importo (€)').fill('10');
      await page.getByLabel('Quando si aggiunge').selectOption('bathroom');
      await page.getByTestId('service-wizard-next').click();

      await expect(page.getByRole('heading', { level: 2, name: 'Quanto dura e quando lo offri?' })).toBeVisible();
      await page.getByTestId('service-duration').selectOption('90');
      await page.getByTestId('service-weekday-Sunday').click();
      await expect(page.getByTestId('service-weekday-Sunday')).toHaveAttribute('aria-pressed', 'false');
      await page.getByTestId('service-wizard-next').click();

      await expect(page.getByRole('heading', { level: 2, name: 'Come lo vedranno i clienti?' })).toBeVisible();
      await page.getByTestId('service-photos-input').setInputFiles([
        { name: 'cucina.png', mimeType: 'image/png', buffer: PNG },
        { name: 'sbagliata.png', mimeType: 'image/png', buffer: PNG },
      ]);
      await expect(page.getByTestId('photo-list-item')).toHaveCount(2);
      await page.getByRole('button', { name: 'Togli la foto 2' }).click();
      await page.getByRole('dialog', { name: 'Togliere questa foto?' }).getByRole('button', { name: 'Togli la foto' }).click();
      await expect(page.getByTestId('photo-list-item')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 2, name: 'Come lo vedranno i clienti?' })).toBeVisible();
      await expect(page.getByTestId('photo-list-cover')).toBeVisible();
      const preview = page.getByTestId('service-preview-card');
      await expect(preview.getByTestId('service-preview-name')).toHaveText('Pulizia cambio ospiti');
      await expect(preview.getByTestId('service-preview-price')).toContainText('da 45,50');
      await expect(preview.getByTestId('service-preview-notes')).toContainText('1 supplemento');
      await expect(page.getByTestId('service-wizard-finish')).toHaveText('Pubblica il servizio');
      await page.getByTestId('service-wizard-finish').click();

      await expect(page.getByRole('heading', { level: 2, name: 'Il servizio è pubblicato' })).toBeVisible();
      expect(writes(catalog)).toEqual([
        'POST /api/supplier/services',
        'PUT /api/supplier/services/e2e-1',
        'PUT /api/supplier/services/e2e-1',
        'POST /api/supplier/services/e2e-1/photos',
        'PUT /api/supplier/services/e2e-1',
        'PUT /api/supplier/services/e2e-1',
        'POST /api/supplier/services/e2e-1/publish',
      ]);
      expect(catalog.services()[0]).toMatchObject({
        name: 'Pulizia cambio ospiti',
        status: 'Active',
        priceFromCents: 4550,
        priceUnit: 'PerJob',
        durationMinutes: 90,
        weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        supplements: [{ code: 'bagno-in-piu', label: 'Bagno in più', amountCents: 1000, per: 'bathroom', max: null }],
      });
      expect(catalog.services()[0]?.photoUrls).toHaveLength(1);

      await page.getByTestId('wizard-done-primary').click();
      await expect(page).toHaveURL(/\/app\/supplier\/services\/e2e-1/);
      await expect(page.getByRole('heading', { level: 1, name: 'Pulizia cambio ospiti' })).toBeVisible();
      const visible = page.getByTestId('service-visible').getByRole('switch');
      await expect(visible).toBeChecked();
      await visible.click();
      await expect(page.getByTestId('service-visibility')).toContainText('In pausa');
      expect(catalog.services()[0]?.status).toBe('Paused');

      await page.locator('a[href="/app/supplier/services"]').first().click();
      await expect(rowOf(page, 'e2e-1')).toContainText('In pausa');
    });

    test('resumes a draft from the list where the creation was left, with what was saved', async ({ page }) => {
      const catalog = await openServices(page, '/app/supplier/services', {
        services: [mockService({ id: 'draft-1', name: 'Ripasso pre-arrivo', status: 'Draft', priceFromCents: null, durationMinutes: null, publishable: false, missingForPublication: ['durationMinutes', 'priceFromCents'] })],
      });

      const draft = rowOf(page, 'draft-1');
      await expect(draft).toContainText('Da completare: Durata, Prezzo.');
      await draft.getByRole('link', { name: 'Continua' }).click();

      await expect(page.getByTestId('service-name')).toHaveValue('Ripasso pre-arrivo');
      await page.getByTestId('service-wizard-next').click();
      await expect(page.getByRole('heading', { level: 2, name: 'Quanto costa?' })).toBeVisible();
      await page.getByTestId('service-amount').fill('30');
      await page.getByTestId('service-wizard-next').click();
      await expect(page.getByRole('heading', { level: 2, name: 'Quanto dura e quando lo offri?' })).toBeVisible();

      expect(writes(catalog)).toEqual(['PUT /api/supplier/services/draft-1', 'PUT /api/supplier/services/draft-1']);
      expect(catalog.services()).toHaveLength(1);
    });

    test('edits a service with the preview following what is typed, saving with the version it was read at', async ({ page }) => {
      const catalog = await openServices(page, '/app/supplier/services/svc-1', { services: [mockService({ photoUrls: [drawing('a'), drawing('b')] })] });
      await expect(page.getByRole('heading', { level: 1, name: 'Pulizia cambio ospiti' })).toBeVisible();
      await expect(page.getByTestId('service-save')).toBeDisabled();

      const preview = page.getByTestId('service-preview-card');
      await page.getByTestId('service-name').fill('Pulizia a fondo');
      await page.getByTestId('service-amount').fill('60');
      await page.getByTestId('service-unit').selectOption('PerSquareMeter');
      await expect(preview.getByTestId('service-preview-name')).toHaveText('Pulizia a fondo');
      await expect(preview.getByTestId('service-preview-price')).toContainText('da 60');
      await expect(preview.getByTestId('service-preview-price')).toContainText('al m²');
      expect(catalog.calls.filter((call) => call.method === 'PUT')).toHaveLength(0);

      await page.getByTestId('service-save').click();
      await expect(page.getByRole('heading', { level: 1, name: 'Pulizia a fondo' })).toBeVisible();
      await expect(page.getByTestId('service-save')).toBeDisabled();
      const [put] = catalog.calls.filter((call) => call.method === 'PUT');
      expect(put?.body).toMatchObject({ version: 1, name: 'Pulizia a fondo', priceFromCents: 6000, priceUnit: 'PerSquareMeter' });
      expect(catalog.services()[0]?.version).toBe(2);
    });

    test('does not overwrite a service that changed elsewhere: says it and reloads on request', async ({ page }) => {
      const catalog = await openServices(page, '/app/supplier/services/svc-1', { services: [mockService()] });
      await expect(page.getByRole('heading', { level: 1, name: 'Pulizia cambio ospiti' })).toBeVisible();
      catalog.touch('svc-1', { name: 'Cambiato da un collega' });

      await page.getByTestId('service-name').fill('Il mio cambiamento');
      await page.getByTestId('service-save').click();

      const conflict = page.getByTestId('service-conflict');
      await expect(conflict).toContainText('Questo servizio è stato modificato altrove');
      expect(catalog.services()[0]?.name).toBe('Cambiato da un collega');
      await conflict.getByRole('button', { name: 'Ricarica' }).click();
      await expect(page.getByTestId('service-name')).toHaveValue('Cambiato da un collega');
      await expect(page.getByTestId('service-conflict')).toBeHidden();
    });

    test('pauses from the menu of the list and takes it back with "Annulla"', async ({ page }) => {
      const catalog = await openServices(page, '/app/supplier/services', { services: [mockService(), mockService({ id: 'svc-2', slug: 'altro', name: 'Lavanderia', status: 'Paused', category: 'laundry' })] });
      const row = rowOf(page, 'svc-1');
      await expect(row).toContainText('Pubblicato');

      await row.getByRole('button', { name: 'Altre azioni: Pulizia cambio ospiti' }).click();
      await page.getByRole('menuitem', { name: 'Metti in pausa' }).click();
      await expect(row).toContainText('In pausa');
      expect(catalog.services()[0]?.status).toBe('Paused');

      await page.getByRole('button', { name: 'Annulla' }).click();
      await expect(row).toContainText('Pubblicato');
      expect(catalog.services()[0]?.status).toBe('Active');
      await expect(rowOf(page, 'svc-2').getByRole('button', { name: 'Riattiva' })).toBeVisible();
    });

    test('duplicates a service from its menu: the copy is made once, its draft opens, and the list has it when the person leaves', async ({ page }) => {
      const catalog = await openServices(page, '/app/supplier/services', { services: [mockService()] });
      await rowOf(page, 'svc-1').getByRole('button', { name: 'Altre azioni: Pulizia cambio ospiti' }).click();
      await page.getByRole('menuitem', { name: 'Duplica' }).click();

      await expect(page).toHaveURL(/\/app\/supplier\/services\/new\?bozza=e2e-1/);
      await expect(page.getByTestId('service-name')).toHaveValue('Pulizia cambio ospiti (copia)');
      expect(writes(catalog)).toEqual(['POST /api/supplier/services/svc-1/duplicate']);

      await page.getByTestId('service-wizard-exit').click();
      await expect(rowOf(page, 'e2e-1')).toContainText('Bozza');
      await expect(rowOf(page, 'svc-1')).toBeVisible();
    });

    test('moves a photo with the keyboard and removes one after asking', async ({ page }) => {
      const catalog = await openServices(page, '/app/supplier/services/svc-1', { services: [mockService({ photoUrls: [drawing('uno'), drawing('due'), drawing('tre')] })] });
      await page.getByTestId('service-section-photos').getByText('Foto', { exact: true }).click();
      await expect(page.getByTestId('photo-list-item')).toHaveCount(3);

      const later = page.getByRole('button', { name: 'Sposta la foto 1 dopo' });
      await later.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Sposta la foto 2 dopo' })).toBeFocused();
      expect(catalog.services()[0]?.photoUrls[1]).toBe(drawing('uno'));

      await page.getByRole('button', { name: 'Togli la foto 3' }).click();
      const dialog = page.getByRole('dialog', { name: 'Togliere questa foto?' });
      await dialog.getByRole('button', { name: 'Togli la foto' }).click();
      await expect(page.getByTestId('photo-list-item')).toHaveCount(2);
      expect(catalog.services()[0]?.photoUrls).toEqual([drawing('due'), drawing('uno')]);
      expect(writes(catalog)).toEqual(['PUT /api/supplier/services/svc-1', 'PUT /api/supplier/services/svc-1']);
      await expect(page.getByRole('button', { name: 'Togli la foto 2' })).toBeFocused();
    });

    test('has nothing axe can find in a browser (colors included): the list, a step of the creation and the page of a service', async ({ page }) => {
      await openServices(page, '/app/supplier/services', { services: [mockService({ photoUrls: [drawing('a')] }), mockService({ id: 'svc-2', slug: 'b', name: 'Lavanderia', status: 'Paused' })] });
      await expect(rowOf(page, 'svc-1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-ui', 'v2');
      await expectNoAxeViolations(page, { include: '[data-testid="supplier-services-page"]' });

      await page.goto(demoUrl('/app/supplier/services/new', 'supplier'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('service-name')).toBeVisible();
      await expectNoAxeViolations(page, { include: '[data-testid="supplier-service-wizard-page"]' });

      await page.goto(demoUrl('/app/supplier/services/svc-1', 'supplier'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('supplier-service-page')).toBeVisible();
      await expectNoAxeViolations(page, { include: '[data-testid="supplier-service-page"]' });
    });
  });

  test.describe('on a phone', () => {
    test.use({ hasTouch: true, isMobile: true });

    for (const width of PHONES) {
      test(`at ${width} px the list is cards, nothing sticks out even with wider letters, and the controls are 44 px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await openServices(page, '/app/supplier/services', {
          services: [
            mockService({ photoUrls: [drawing('a')], name: 'Pulizia straordinaria di fine stagione con trattamento anticalcare' }),
            mockService({ id: 'svc-2', slug: 'b', name: 'Lavanderia', status: 'Paused', category: 'laundry', priceUnit: 'PerHour', priceFromCents: 1850 }),
            mockService({ id: 'svc-3', slug: 'c', name: 'Ripasso', status: 'Draft', priceFromCents: null, durationMinutes: null, publishable: false, missingForPublication: ['durationMinutes', 'priceFromCents'] }),
          ],
        });
        await page.addStyleTag({ content: WIDER_LETTERS });

        await expect(rowOf(page, 'svc-1')).toBeVisible();
        await expect(page.getByRole('table', { name: 'Servizi e prezzi' })).toBeHidden();
        await expectNothingSticksOut(page, `${width} px, the list with wider letters`, 'main');
        await expectFingerTargets(page, '[data-testid="supplier-services-page"]', `${width} px, the list`);
      });

      test(`at ${width} px the creation fits the screen in every step, with the button of the step in reach`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await openServices(page, '/app/supplier/services/new');
        await page.addStyleTag({ content: WIDER_LETTERS });

        await page.getByTestId('service-name').fill('Pulizia cambio ospiti con trattamento e igienizzazione completa');
        await page.getByTestId('service-category').selectOption('cleaning');
        await expectNothingSticksOut(page, `${width} px, the first step`, 'main');
        await expectFingerTargets(page, '[data-testid="supplier-service-wizard-page"]', `${width} px, the first step`);
        await page.getByTestId('service-wizard-next').click();

        await expect(page.getByRole('heading', { level: 2, name: 'Quanto costa?' })).toBeVisible();
        await page.getByTestId('service-amount').fill('45');
        await page.getByTestId('service-supplement-add').click();
        await page.getByLabel('Supplemento 1', { exact: true }).fill('Bagno in più con lavaggio dei sanitari');
        await page.getByLabel('Importo (€)').fill('10');
        await page.getByLabel('Quando si aggiunge').selectOption('bathroom');
        await expectNothingSticksOut(page, `${width} px, the price with a supplement`, 'main');
        await expectFingerTargets(page, '[data-testid="supplier-service-wizard-page"]', `${width} px, the price`);
        await page.getByTestId('service-wizard-next').click();

        await expect(page.getByRole('heading', { level: 2, name: 'Quanto dura e quando lo offri?' })).toBeVisible();
        await expectNothingSticksOut(page, `${width} px, duration and days`, 'main');
        await expectFingerTargets(page, '[data-testid="supplier-service-wizard-page"]', `${width} px, duration and days`);
        await page.getByTestId('service-wizard-next').click();

        await expect(page.getByRole('heading', { level: 2, name: 'Come lo vedranno i clienti?' })).toBeVisible();
        await page.getByTestId('service-photos-input').setInputFiles([
          { name: 'uno.png', mimeType: 'image/png', buffer: PNG },
          { name: 'due.png', mimeType: 'image/png', buffer: PNG },
        ]);
        await expect(page.getByTestId('photo-list-item')).toHaveCount(2);
        await expectNothingSticksOut(page, `${width} px, photos and preview`, 'main');
        await expectFingerTargets(page, '[data-testid="supplier-service-wizard-page"]', `${width} px, photos and preview`);
        const finish = page.getByTestId('service-wizard-finish');
        await expect(finish).toBeInViewport();
        const box = (await finish.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(-0.5);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
      });

      test(`at ${width} px the page of a service puts the preview under the fields, and nothing sticks out`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await openServices(page, '/app/supplier/services/svc-1', {
          services: [
            mockService({
              photoUrls: [drawing('a'), drawing('b')],
              supplements: [{ code: 'bagno', label: 'Bagno in più con lavaggio dei sanitari', amountCents: 1000, per: 'bathroom', max: 3 }],
              included: ['Pulizia completa con prodotti professionali', 'Cambio biancheria'],
            }),
          ],
        });
        await page.addStyleTag({ content: WIDER_LETTERS });
        await expect(page.getByTestId('supplier-service-page')).toBeVisible();
        for (const part of ['booking', 'photos', 'zone']) {
          await page.getByTestId(`service-section-${part}`).locator('summary').click();
        }

        const fields = (await page.getByTestId('service-section-service').boundingBox())!;
        const preview = (await page.getByTestId('service-preview-card').boundingBox())!;
        expect(preview.y, 'the preview comes after the fields on a phone').toBeGreaterThan(fields.y + fields.height - 1);
        await expectNothingSticksOut(page, `${width} px, the page of a service with every part open`, 'main');
        await expectFingerTargets(page, '[data-testid="supplier-service-page"]', `${width} px, the page of a service`);
        const row = (await page.getByTestId('service-visible').boundingBox())!;
        expect(row.height).toBeGreaterThanOrEqual(43.5);
      });
    }
  });
});
