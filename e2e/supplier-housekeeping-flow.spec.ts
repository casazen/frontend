import { expect, test } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';

test('the supplier takes a cleaning job, sees its contact and completes it', async ({ page }) => {
  await setDemoProfile(page, 'supplier');
  await mockSupplierConsoleApi(page, { active: true });

  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
  let status = 'Richiesto';
  const transitions: string[] = [];
  const request = () => ({
    id, status, category: 'cleaning', urgency: 'Normal', rentalContext: 'ShortRent',
    propertyId: 'p1', propertyName: 'Casa Lago', city: 'Roma', postalCode: '00184',
    createdAt: '2026-11-20T09:00:00Z', updatedAt: '2026-11-20T09:00:00Z',
    scheduledFor: '2026-11-25', notes: 'Cambio biancheria', history: [],
    contactDisclosed: status !== 'Richiesto',
    hostContact: status === 'Richiesto' ? null : { name: 'Gestore Casa Lago', email: 'host@example.test', phone: null },
    address: status === 'Richiesto' ? null : 'Via dei Tigli 6',
  });
  await page.route(`**/api/supplier/inbox/${id}`, route => route.fulfill({ json: request() }));
  for (const [action, from, to] of [['take', 'Richiesto', 'PresoInCarico'], ['complete', 'PresoInCarico', 'Completato']]) {
    await page.route(`**/api/service-requests/${id}/${action}`, route => {
      expect(route.request().method()).toBe('POST');
      expect(status).toBe(from);
      transitions.push(action);
      status = to;
      return route.fulfill({ json: request() });
    });
  }

  await page.goto(demoUrl(`/app/supplier/inbox/${id}`, 'supplier'));
  await expect(page.getByTestId('supplier-request-take')).toBeVisible();
  await expect(page.getByText('Via dei Tigli 6')).toHaveCount(0);
  await page.getByTestId('supplier-request-take').click();
  await expect(page.getByTestId('supplier-request-host-name')).toHaveText('Gestore Casa Lago');
  await page.getByTestId('supplier-request-complete').click();
  await expect(page.getByTestId('supplier-request-complete')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('supplier-request-now')).toBeVisible();
  await expect(page.getByTestId('supplier-request-take')).toHaveCount(0);
  await expect(page.getByTestId('supplier-request-complete')).toHaveCount(0);
  expect(transitions).toEqual(['take', 'complete']);
});
