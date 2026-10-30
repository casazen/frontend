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
  // The stay travels in the address (deep link); the booking card asks the quote of the server and, once the total is in, "Prenota"
  // is a link to the checkout carrying the same stay.
  await page.goto(`/book/${stay.orgSlug}/property/${stay.propertySlug}?checkin=${stay.checkIn}&checkout=${stay.checkOut}&guests=2`);
  await page.getByRole('button', { name: 'Accetta' }).click().catch(() => undefined); // cookie banner (essential only)
  await expect(page.getByTestId('booking-cta')).toHaveAttribute('href', /\/checkout\?/, { timeout: 30_000 });
  await page.getByTestId('booking-cta').click();

  await expect(page).toHaveURL(new RegExp(`checkin=${stay.checkIn}&checkout=${stay.checkOut}`));
  await expect(page.getByTestId('checkout-stay-summary')).toContainText(`${stay.nights} notti`);

  // Step 1: how to book (the title of the card is the stable text of the choice); step 2: the guest; step 3: consent and the booking.
  await page.getByText(stay.payment === 'card' ? 'Prenotazione immediata' : 'Su richiesta', { exact: true }).click();
  await expect(page.getByTestId('checkout-next')).not.toHaveAttribute('aria-disabled', 'true', { timeout: 30_000 });
  await page.getByTestId('checkout-next').click();
  await page.locator('#firstName').fill(stay.guest.firstName);
  await page.locator('#lastName').fill(stay.guest.lastName);
  await page.locator('#email').fill(stay.guest.email);
  await page.locator('#phone').fill(stay.guest.phone);
  await page.locator('#country').selectOption({ label: 'Italia' });
  await page.getByTestId('checkout-next').click();
  await page.locator('#data-consent').click();
  await expect(page.getByTestId('checkout-submit')).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('checkout-submit').click();

  if (stay.payment === 'card') {
    // Stripe test card in the Payment Element (iframe served by js.stripe.com, the only external call of the suite).
    const frame = page.frameLocator('iframe[name^="__privateStripeFrame"]').first();
    // Stable input names of the card fields of the Payment Element (labels depend on the Stripe locale).
    await frame.locator('input[name="number"]').fill('4242424242424242', { timeout: 60_000 });
    await frame.locator('input[name="expiry"]').fill('12 / 34');
    await frame.locator('input[name="cvc"]').fill('123');
    await page.getByRole('button', { name: 'Paga ora', exact: true }).click();
    // The page shows the backend's state: "confirmed" only after the webhook confirmed the booking.
    await expect(page).toHaveURL(new RegExp(`/book/${stay.orgSlug}/booking/`), { timeout: 60_000 });
    // Stable test ids, not the words of the title: the title greets the guest by name.
    await expect(page.getByTestId('checkout-confirmation')).toBeVisible({ timeout: 90_000 });
  } else {
    await expect(page).toHaveURL(new RegExp(`/book/${stay.orgSlug}/booking/`), { timeout: 30_000 });
    await expect(page.getByTestId('checkout-onsite-request-sent')).toBeVisible();
  }

  await expect(page.getByTestId('checkout-outcome-booking-code')).toBeVisible();
  await expect(page.getByTestId('checkout-outcome-total')).toHaveText(euro(stay.nights * stay.nightlyRate));
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

/** Guest check-in portal (3 steps): two guests, the head of the family's identity document, the privacy notice and the submit. */
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
  await pickHeadOfFamilyDocumentType(page);
  await page.locator('#guest-0-documentNumber').fill('CA12345AB');
  await page.locator('#guest-0-documentIssuePlaceName').fill('Roma');
  await page.getByRole('button', { name: 'Avanti' }).click();
  // Step 3 shows the privacy notice (the Alloggiati registration is a legal obligation: notice only, no consent to
  // tick). "Avanti" must NOT submit by itself: the test used to pass only because that click skipped this step.
  await expect(page.getByTestId('checkin-privacy-notice')).toBeVisible();
  await page.getByTestId('checkin-submit').click();
  await expect(page.getByText('Check-in completato!')).toBeVisible({ timeout: 20_000 });
}

/** Official Alloggiati DOCUMENTI row IDENT (Polizia di Stato). Never a made-up type. */
const OFFICIAL_IDENTITY_CARD_QUERY = 'CARTA DI IDENTITA';
const FALLBACK_SELECT_LABEL = "Carta d'identita'";

/**
 * Head-of-family document type: native select of the local enum when the official table is not imported,
 * otherwise the CodeTableInput (input + datalist) of CO-12. After the Alloggiati seed the GJ stack has
 * DOCUMENTI, so selectOption on #guest-0-documentType fails ("Element is not a select").
 */
async function pickHeadOfFamilyDocumentType(page: Page): Promise<void> {
  const field = page.locator('#guest-0-documentType');
  await expect(field).toBeVisible();
  const tag = await field.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'select') {
    await field.selectOption({ label: FALLBACK_SELECT_LABEL });
    return;
  }

  await field.fill(OFFICIAL_IDENTITY_CARD_QUERY);
  const options = page.getByTestId('guest-0-documentType-options').locator('option');
  await expect(options.first()).toBeAttached({ timeout: 15_000 });
  const official = await options.evaluateAll((els) => {
    const labels = els.map((el) => el.getAttribute('value') ?? '');
    return labels.find((label) => /CARTA DI IDENTITA/i.test(label)) ?? labels[0] ?? '';
  });
  expect(official, 'official identity-card row from Alloggiati DOCUMENTI').toBeTruthy();
  await field.fill(official);
  await expect(page.getByTestId('guest-0-documentType-code')).toBeVisible();
}
