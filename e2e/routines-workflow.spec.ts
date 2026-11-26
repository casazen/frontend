import { type Page } from '@playwright/test';
import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';

const baseRoutine = {
  id: '00000000-0000-4000-8000-000000000701', orgId: 'demo-org',
  name: 'Pulizia al check-out', agentObjective: 'Prepara l’alloggio per il prossimo ospite.',
  eventType: 'AfterCheckout', eventConfig: '{"days":0,"hours":0}', conditionJson: '{}',
  actionsJson: '[{"type":"CreateCleaningRequest","config":{}}]', active: true, testMode: false,
};
const booking = {
  id: '00000000-0000-4000-8000-000000000801', bookingCode: 'ROMA1-00001', propertyName: 'Casa Roma',
  checkInDate: '2026-11-18', checkOutDate: '2026-11-21',
};

async function mockRoutines(page: Page) {
  const routines = [
    baseRoutine,
    { ...baseRoutine, id: '00000000-0000-4000-8000-000000000702', name: 'Istruzioni per l’arrivo',
      agentObjective: 'Ricorda all’ospite gli orari e le istruzioni di accesso.',
      eventType: 'BeforeCheckin', eventConfig: '{"days":2,"hours":0}',
      actionsJson: '[{"type":"MessageToGuest","config":{"channel":"email","templateId":"demo-arrival"}}]', testMode: true },
    { ...baseRoutine, id: '00000000-0000-4000-8000-000000000703', name: 'Richiesta di recensione',
      agentObjective: 'Invita gli ospiti delle prenotazioni dirette a raccontare il soggiorno.',
      eventConfig: '{"days":1,"hours":0}', actionsJson: '[{"type":"RequestReview","config":{}}]', active: false },
  ];
  const saved: object[] = [];
  const simulated: object[] = [];
  await page.route('**/api/public/features', route => route.fulfill({ json: { routines: true } }));
  await page.route('**/api/routines/actions', route => route.fulfill({ json: ['CreateCleaningRequest', 'RequestReview', 'MessageToGuest'].map(type => ({ type, available: true, code: null })) }));
  await page.route('**/api/routines', async route => {
    if (route.request().method() === 'POST') {
      const dto = route.request().postDataJSON();
      saved.push(dto);
      const record = { ...baseRoutine, ...dto, id: '00000000-0000-4000-8000-000000000704', actionsJson: JSON.stringify(dto.actions), eventConfig: JSON.stringify(dto.eventConfig) };
      routines.push(record);
      await route.fulfill({ json: record, status: 201 });
    } else await route.fulfill({ json: routines });
  });
  await page.route('**/api/bookings/search?**', route => route.fulfill({ json: { items: [booking], page: 1, pageSize: 25, totalCount: 1 } }));
  await page.route('**/api/routines/*/simulate', async route => {
    simulated.push(route.request().postDataJSON());
    await route.fulfill({ json: { routineId: routines.at(-1)!.id, routineName: routines.at(-1)!.name, conditionsMatched: true, wouldExecute: true, actions: [{ index: 0, type: 'RequestReview', wouldBlock: false }] } });
  });
  return { saved, simulated };
}

for (const width of [390, 1440]) {
  test(`routine overview at ${width}px`, async ({ page }, info) => {
    await mockRoutines(page);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(demoUrl('/app/short-rent/automations', 'short-stay'));
    await expect(page.getByTestId(`routine-card-${baseRoutine.id}`)).toBeVisible();
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
    await page.evaluate(() => document.fonts.ready);
    // Dev builds may refresh during capture. Retry if Chromium returned an empty frame.
    await expect(async () => {
      await expect(page.getByTestId(`routine-card-${baseRoutine.id}`)).toBeVisible();
      const shot = await page.screenshot({ path: info.outputPath(`routine-ai-${width}.jpg`), type: 'jpeg', animations: 'disabled' });
      expect(shot.byteLength).toBeGreaterThan(10000);
    }).toPass({ timeout: 15000 });
  });
}

test('opens the library directly, saves a configured template paused and simulates an authorized booking', async ({ page }) => {
  const { saved, simulated } = await mockRoutines(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(demoUrl('/app/short-rent/automations?view=library', 'short-stay'));
  await expect(page.getByRole('dialog', { name: 'Modelli di routine' })).toBeVisible();
  await page.getByTestId('configure-template-2').click();
  await expect(page.getByTestId('routine-name-input')).toHaveValue('Richiesta di recensione');
  expect(saved).toHaveLength(0);
  await page.getByTestId('routine-name-input').fill('Verifica recensione');
  await page.getByRole('button', { name: 'Salva in pausa' }).click();
  const paused = page.getByTestId('routine-card-00000000-0000-4000-8000-000000000704');
  await expect(paused).toContainText('In pausa');
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ active: false, testMode: true });
  await paused.getByRole('button', { name: /Altre azioni/i }).press('Enter');
  await page.getByRole('menuitem', { name: 'Prova su una prenotazione' }).click();
  await page.getByLabel('Scegli una prenotazione').selectOption(booking.id);
  await page.getByRole('button', { name: 'Simula con questi dati' }).click();
  await expect(page.getByText('Prevista nella simulazione')).toBeVisible();
  expect(simulated).toEqual([{ bookingId: booking.id }]);
  expect(saved).toHaveLength(1);
});
