import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type PaymentMode = 'onsite' | 'card';

export type GuestStay = {
  orgSlug: string;
  propertySlug: string;
  checkIn: string;
  checkOut: string;
  guest: { firstName: string; lastName: string; email: string; phone: string };
  payment: PaymentMode;
  nights: number;
  nightlyRate: number;
};

const euro = (amount: number) => new RegExp(`${amount.toLocaleString('it-IT', { minimumFractionDigits: 2 }).replace('.', '\\.')}\\s*€`);

/**
 * Anonymous guest on the public booking site: picks the dates, checks the summary (dates, nights, total), fills the
 * checkout and pays (card in the Stripe Payment Element) or asks to pay at the property. Returns the booking id.
 */
export async function guestBooksStay(page: Page, stay: GuestStay): Promise<string> {
  await page.goto(`/book/${stay.orgSlug}/property/${stay.propertySlug}`);
  await page.getByRole('button', { name: 'Accetta' }).click().catch(() => undefined); // cookie banner (essential only)
  await page.locator('#check-in').fill(stay.checkIn);
  await page.locator('#check-out').fill(stay.checkOut);
  await page.locator('#guests').fill('2');
  await page.getByRole('button', { name: 'Procedi al checkout' }).click();

  await expect(page).toHaveURL(new RegExp(`checkin=${stay.checkIn}&checkout=${stay.checkOut}`));
  await expect(page.getByTestId('checkout-stay-summary')).toContainText(`${stay.nights} notti`);

  await page.getByRole('button', { name: stay.payment === 'card' ? 'Paga subito' : /Paga in struttura/ }).click();
  await page.locator('#firstName').fill(stay.guest.firstName);
  await page.locator('#lastName').fill(stay.guest.lastName);
  await page.locator('#email').fill(stay.guest.email);
  await page.locator('#phone').fill(stay.guest.phone);
  await page.locator('#country').selectOption({ label: 'Italia' });
  await page.locator('#data-consent').click();
  await page.getByRole('button', { name: 'Continua' }).click();

  if (stay.payment === 'card') {
    // Stripe test card in the Payment Element (iframe served by js.stripe.com, the only external call of the suite).
    const frame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    await frame.getByLabel(/numero|card number/i).fill('4242424242424242', { timeout: 60_000 });
    await frame.getByLabel(/scadenza|expiration/i).fill('12 / 34');
    await frame.getByLabel(/cvc|sicurezza|security/i).fill('123');
    await page.getByRole('button', { name: /Paga ora|Paga/ }).last().click();
    // The page shows the backend's state: "confirmed" only after the webhook confirmed the booking.
    await expect(page).toHaveURL(new RegExp(`/book/${stay.orgSlug}/booking/`), { timeout: 60_000 });
    await expect(page.getByText('Prenotazione confermata!')).toBeVisible({ timeout: 90_000 });
  } else {
    await expect(page).toHaveURL(new RegExp(`/book/${stay.orgSlug}/booking/`), { timeout: 30_000 });
    await expect(page.getByText("Richiesta inviata: in attesa di conferma dell'host")).toBeVisible();
  }

  await expect(page.getByText(euro(stay.nights * stay.nightlyRate)).first()).toBeVisible();
  const bookingId = new URL(page.url()).pathname.split('/').pop() ?? '';
  expect(bookingId).toMatch(/^[0-9a-f-]{36}$/);
  return bookingId;
}

/** The guest opens the email link and clicks the confirmation (mail scanners that open links confirm nothing). */
export async function guestConfirmsEmail(page: Page, link: string): Promise<void> {
  await page.goto(link);
  await page.getByRole('button', { name: /Conferma e invia la richiesta/ }).click();
  await expect(page.getByText('Email confermata')).toBeVisible({ timeout: 20_000 });
}

/** Guest check-in portal (3 steps): two guests, the head of the family's identity document. */
export async function guestCompletesCheckIn(page: Page, link: string): Promise<void> {
  await page.goto(link);
  const guests = [
    { first: 'Giulia', gender: 'Femmina', born: '1990-05-12' },
    { first: 'Marco', gender: 'Maschio', born: '1988-03-02' },
  ];
  for (const [i, g] of guests.entries()) {
    await page.locator(`#guest-${i}-firstName`).fill(g.first);
    await page.locator(`#guest-${i}-lastName`).fill('Bianchi');
    await page.locator(`#guest-${i}-gender`).selectOption({ label: g.gender });
    await page.locator(`#guest-${i}-dateOfBirth`).fill(g.born);
    await page.locator(`#guest-${i}-bornInItaly`).selectOption({ label: 'In Italia' });
    await page.getByLabel('Comune di nascita').nth(i).fill('Roma');
    await page.getByLabel('Provincia (sigla)').nth(i).fill('RM');
    await page.locator(`#guest-${i}-citizenshipName`).fill('Italiana');
  }
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.locator('#guest-0-documentType').selectOption({ label: "Carta d'identita'" });
  await page.locator('#guest-0-documentNumber').fill('CA12345AB');
  await page.locator('#guest-0-documentIssuePlaceName').fill('Roma');
  await page.getByRole('button', { name: 'Avanti' }).click();
  await expect(page.getByText('Check-in completato!')).toBeVisible({ timeout: 20_000 });
}
