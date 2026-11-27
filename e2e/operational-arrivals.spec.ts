import { test as storefrontTest } from '@playwright/test';
import { test, expect } from './test';
import { bookingId, guestName, mockArrivalJourney, property } from './helpers/arrival-journey';
import { expectNoAxeViolations, expectNothingSticksOut } from './helpers/ui-checks';
import { demoUrl } from './helpers/demo-profile';

test.describe.configure({ timeout: 90_000 });
const firstRender = { timeout: 45_000 };
const bookingPath = `/app/short-rent/bookings/${bookingId}?tab=guest`;

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
  test(`arrivi → prenotazione → check-in e ritorno a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockArrivalJourney(page);
    const home = demoUrl(`/app/short-rent?propertyId=${property.id}`, 'short-stay');
    await page.goto(home, { waitUntil: 'domcontentloaded' });
    const today = page.getByTestId('home-today');
    const arrivals = today.getByRole('button', { name: /^Arrivi/ });
    await arrivals.click();
    await expect(arrivals).toHaveAttribute('aria-pressed', 'true');
    const assistant = await page.getByTestId('ask-casazen').boundingBox();
    const guide = await page.getByTestId('guide-button').boundingBox();
    expect(assistant).not.toBeNull();
    expect(guide).not.toBeNull();
    expect(assistant!.x + assistant!.width).toBeLessThanOrEqual(guide!.x + 0.5);
    const item = today.getByRole('link', { name: new RegExp(guestName) });
    await expect(item).toContainText(property.name);
    await expect(item).toHaveAttribute('href', bookingPath);
    const hitArea = await item.boundingBox();
    expect(hitArea?.width).toBeGreaterThanOrEqual(44);
    expect(hitArea?.height).toBeGreaterThanOrEqual(44);
    await expectNothingSticksOut(page, 'Arrivi filtrati');
    await item.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: guestName, exact: true })).toBeVisible();
    const status = page.getByTestId('checkin-session-badge');
    await expect(status).toHaveText(/compilazione/i);
    await expect(status).toBeVisible();
    await expect(page.getByTestId('booking-next-step')).toHaveCount(0);
    await expectNothingSticksOut(page, 'Scheda prenotazione');
    if (width === 320) await expectNoAxeViolations(page, { include: '#main-content' });
    await page.goBack();
    await expect(arrivals).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(new RegExp(`propertyId=${property.id}`));
  });
}

test('Chiedi a CasaZen apre la fonte e restituisce il focus al controllo sulla home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockArrivalJourney(page);
  await page.goto(demoUrl('/app/short-rent?today=arrivals', 'short-stay'), { waitUntil: 'domcontentloaded' });
  const ask = page.getByRole('button', { name: 'Chiedi a CasaZen' });
  await ask.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Chiedi a CasaZen' });
  await expect(dialog).toBeVisible();
  const field = dialog.getByRole('textbox', { name: 'La tua domanda' });
  await field.fill('Quali arrivi di oggi hanno il check-in incompleto?');
  await field.press('Enter');
  const source = dialog.getByRole('link', { name: new RegExp(property.name) });
  await expect(source).toHaveAttribute('href', bookingPath);
  await expect(source).toContainText('Compilazione in corso');
  await expect(dialog).toContainText('Tutti gli immobili assegnati');
  await expectNothingSticksOut(page, 'Assistente aperto');
  await expectNoAxeViolations(page, { include: '[role="dialog"]' });
  await page.keyboard.press('Escape');
  await expect(ask).toBeFocused();
  await expect(page).toHaveURL(/today=arrivals/);
  await page.getByRole('button', { name: 'Trova i check-in incompleti' }).click();
  await source.click();
  await expect(page.getByRole('heading', { name: guestName, exact: true })).toBeVisible();
  await expect(page.getByTestId('checkin-session-badge')).toBeVisible();
});

storefrontTest('vetrina mobile → arrivo sintetico → richiesta di invito', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/affitti-brevi');
  const start = page.getByRole('link', { name: 'Vedi gli arrivi di oggi' }).first();
  await expect(start).toBeVisible(firstRender);
  await start.click();
  const today = page.getByTestId('home-today');
  await expect(today.getByRole('button', { name: /^Arrivi/ })).toHaveAttribute('aria-pressed', 'true', firstRender);
  await today.getByRole('link', { name: new RegExp(guestName) }).click();
  await expect(page.getByRole('heading', { name: guestName, exact: true })).toBeVisible();
  await expect(page.getByTestId('checkin-link-panel')).toBeVisible();
  const contact = page.getByRole('link', { name: /Richiedi un invito/i });
  await expect(contact).toBeVisible();
  await expect(contact).toHaveAttribute('href', /^mailto:inviti@example\.test\?/);
  await expectNothingSticksOut(page, 'Invito dopo il primo compito');
});

storefrontTest('demo Affitti lunghi apre l’immobile, il canone e il contratto campione', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/affitti-lunghi');
  await page.getByRole('link', { name: 'Controlla un contratto' }).first().click();
  await expect(page.getByRole('heading', { name: 'Casa dei Tigli', exact: true })).toBeVisible(firstRender);
  const next = page.getByTestId('long-rent-property-next-step');
  await expect(next).toContainText('850');
  await expect(next.getByRole('link', { name: /canoni/i })).toHaveAttribute('href', /pagamenti/);
  await next.getByRole('link', { name: /Apri contratto/i }).click();
  await expect(page).toHaveURL(/\/app\/long-rent\/leases\/cf000000-0000-4000-8000-000000000004/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
