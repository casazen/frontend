import type { Locator, Page } from '@playwright/test';
import { landlordMaintenancePath, tenantMaintenanceRequestPath } from '../src/features/maintenance-requests/paths';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';
import { expect, test } from './test';

/**
 * Phone (390×844): the tenant sends a maintenance request, then the landlord approves (pay appears)
 * or rejects (pay stays hidden). The API is mocked because the lease endpoints may still 404.
 */
const LEASE = 'lease-manutenzione-1';
const VIEWPORT = { width: 390, height: 844 };

interface Row {
  id: string;
  leaseId: string;
  what: string;
  urgency: string;
  note: string;
  photoName: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  reason: string | null;
  createdAt: string;
}

async function mockMaintenanceRequests(page: Page, rows: Row[]): Promise<void> {
  await page.route(/\/api\/leases\/[^/]+\/maintenance-requests/, async (route) => {
    const request = route.request();
    const match = new URL(request.url()).pathname.match(
      /\/leases\/([^/]+)\/maintenance-requests(?:\/([^/]+)(?:\/(decision|payment))?)?$/,
    );
    if (!match) {
      await route.fallback();
      return;
    }
    const leaseId = decodeURIComponent(match[1]);
    const requestId = match[2] ? decodeURIComponent(match[2]) : null;
    const action = match[3] ?? null;
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (request.method() === 'GET' && !requestId) {
      await fulfill(rows.filter((row) => row.leaseId === leaseId));
      return;
    }
    if (request.method() === 'POST' && !requestId) {
      const payload = request.postDataJSON() as { what: string; urgency: string; note: string };
      const created: Row = {
        id: `mr-${rows.length + 1}`,
        leaseId,
        what: payload.what,
        urgency: payload.urgency,
        note: payload.note,
        photoName: null,
        status: 'pending',
        reason: null,
        createdAt: '2026-11-08T10:00:00Z',
      };
      rows.push(created);
      await fulfill(created, 201);
      return;
    }
    const row = rows.find((item) => item.id === requestId && item.leaseId === leaseId);
    if (!row) {
      await fulfill({ title: 'Non trovata' }, 404);
      return;
    }
    if (request.method() === 'POST' && action === 'decision') {
      const payload = request.postDataJSON() as { decision: 'approved' | 'rejected'; reason?: string };
      row.status = payload.decision === 'rejected' ? 'rejected' : 'approved';
      row.reason = payload.reason ?? null;
      await fulfill(row);
      return;
    }
    if (request.method() === 'POST' && action === 'payment') {
      if (row.status !== 'approved') {
        await fulfill({ title: 'Non approvata' }, 409);
        return;
      }
      row.status = 'paid';
      row.reason = null;
      await fulfill(row);
      return;
    }
    await route.fallback();
  });
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectActionInView(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize() ?? VIEWPORT;
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function sendRequest(page: Page, what: string, note: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Cosa non funziona?' })).toBeVisible();
  await page.getByTestId('maintenance-what').fill(what);
  await expectActionInView(page, page.getByTestId('maintenance-next'));
  await page.getByTestId('maintenance-next').click();

  await expect(page.getByRole('heading', { name: 'Quanto è urgente?' })).toBeVisible();
  await page.getByTestId('maintenance-urgency-normale').click();
  await page.getByTestId('maintenance-next').click();

  await expect(page.getByRole('heading', { name: 'Aggiungi una nota' })).toBeVisible();
  await page.getByTestId('maintenance-note').fill(note);
  await page.getByTestId('maintenance-next').click();

  await expect(page.getByRole('heading', { name: 'Una foto, se ce l\'hai' })).toBeVisible();
  await expect(page.getByTestId('maintenance-photo-name')).toHaveText('Nessuna foto');
  await expectNoHorizontalScroll(page);
  await page.getByTestId('maintenance-next').click();

  await expect(page.getByRole('heading', { name: 'Controlla e invia' })).toBeVisible();
  await expect(page.getByTestId('maintenance-confirm-what')).toHaveText(what);
  await expect(page.getByTestId('maintenance-confirm-urgency')).toHaveText('Normale');
  await expectActionInView(page, page.getByTestId('maintenance-submit'));
  await expectNoHorizontalScroll(page);
  await page.getByTestId('maintenance-submit').click();
}

test.describe('Maintenance request on a phone', () => {
  test.use({ viewport: VIEWPORT });
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test('the tenant sends a request, the landlord pays only after approval, and a rejection hides pay', async ({ page }) => {
    const rows: Row[] = [];
    await mockMaintenanceRequests(page, rows);

    await page.goto(demoUrl(tenantMaintenanceRequestPath(LEASE), 'long-term'));
    await sendRequest(page, 'Rubinetto del bagno', 'Gocciola da ieri');

    await expect(page.getByTestId('maintenance-waiting')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In attesa' })).toBeVisible();
    await expect(page.getByTestId('maintenance-tenant-status')).toHaveText('In attesa');
    await expect(page.getByTestId('maintenance-pay')).toHaveCount(0);
    await expect(page.getByTestId('maintenance-approve')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectActionInView(page, page.getByTestId('maintenance-see-requests'));

    await page.goto(demoUrl(landlordMaintenancePath(LEASE), 'long-term'));
    const first = page.getByTestId('maintenance-request-mr-1');
    await expect(first.getByTestId('maintenance-status')).toHaveText('In attesa');
    await expect(first.getByText('Il pagamento non è ancora disponibile.')).toBeVisible();
    await expect(page.getByTestId('maintenance-pay')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    await expectActionInView(page, first.getByTestId('maintenance-approve'));
    await first.getByTestId('maintenance-approve').click();

    await expect(first.getByTestId('maintenance-status')).toHaveText('Approvata');
    await expect(first.getByTestId('maintenance-pay')).toBeVisible();
    await expectActionInView(page, first.getByTestId('maintenance-pay'));
    await expectNoHorizontalScroll(page);

    await page.goto(demoUrl(tenantMaintenanceRequestPath(LEASE), 'long-term'));
    await expect(page.getByTestId('maintenance-tenant-status')).toHaveText('Approvata');
    await expect(page.getByTestId('maintenance-pay')).toHaveCount(0);
    await expect(page.getByTestId('maintenance-approve')).toHaveCount(0);

    await page.goto(demoUrl(landlordMaintenancePath(LEASE), 'long-term'));
    await page.getByTestId('maintenance-request-mr-1').getByTestId('maintenance-pay').click();
    await expect(page.getByTestId('maintenance-request-mr-1').getByTestId('maintenance-status')).toHaveText('Pagata');
    await expect(page.getByTestId('maintenance-pay')).toHaveCount(0);

    await page.goto(demoUrl(tenantMaintenanceRequestPath(LEASE), 'long-term'));
    await page.getByTestId('maintenance-new').click();
    await sendRequest(page, 'Caldaia spenta', 'Non parte da stamattina');
    await expect(page.getByTestId('maintenance-waiting')).toBeVisible();

    await page.goto(demoUrl(landlordMaintenancePath(LEASE), 'long-term'));
    const second = page.getByTestId('maintenance-request-mr-2');
    await expect(second.getByTestId('maintenance-status')).toHaveText('In attesa');
    await expect(page.getByTestId('maintenance-pay')).toHaveCount(0);
    await second.getByTestId('maintenance-reject').click();
    await second.getByTestId('maintenance-reject-reason').fill('Non è un guasto a carico del proprietario.');
    await expectActionInView(page, second.getByTestId('maintenance-reject-confirm'));
    await expectNoHorizontalScroll(page);
    await second.getByTestId('maintenance-reject-confirm').click();

    await expect(second.getByTestId('maintenance-status')).toHaveText('Rifiutata');
    await expect(second.getByTestId('maintenance-reason')).toContainText('Non è un guasto a carico del proprietario.');
    await expect(page.getByTestId('maintenance-pay')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});
