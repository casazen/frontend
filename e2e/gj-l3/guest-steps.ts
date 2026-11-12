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

/** Guest check-in portal: the document photo, then two guests, the head of the family's identity document, the privacy notice and the submit. */
export async function guestCompletesCheckIn(page: Page, link: string): Promise<void> {
  await page.goto(link);
  await page.getByTestId('checkin-enter-manually').click();
  const guests = [
    { first: 'Giulia', gender: 'Femmina', born: '1990-05-12' },
    { first: 'Marco', gender: 'Maschio', born: '1988-03-02' },
  ];
  // Guest 0's ROMA and ITALIA answers stay fresh for five minutes, so guest 1 does not ask again.
  const seenCodes = new Map<string, unknown[]>();
  for (const [i, g] of guests.entries()) {
    await page.locator(`#guest-${i}-firstName`).fill(g.first);
    await page.locator(`#guest-${i}-lastName`).fill('Bianchi');
    await page.locator(`#guest-${i}-gender`).selectOption({ label: g.gender });
    await page.locator(`#guest-${i}-dateOfBirth`).fill(g.born);
    await page.locator(`#guest-${i}-bornInItaly`).selectOption({ label: 'In Italia' });
    const birth = await chooseOfficialCode(page, `guest-${i}-birthComuneName`, 'ROMA', /^ROMA\b/i, undefined, seenCodes);
    // An empty comuni list leaves the typed Roma and does not fill the province. Born in Italy needs one.
    if (birth === 'empty') await page.locator(`#guest-${i}-birthProvince`).fill('RM');
    await chooseOfficialCode(page, `guest-${i}-citizenship`, 'ITALIA', /Ital/i, undefined, seenCodes);
  }
  await page.getByRole('button', { name: 'Avanti' }).click();
  await pickHeadOfFamilyDocumentType(page, seenCodes);
  await page.locator('#guest-0-documentNumber').fill('CA12345AB');
  // Place of issue searches comuni and states. The golden-journey seed has Stati, not Comuni, so the official row is Italia.
  await chooseOfficialCode(page, 'guest-0-documentIssuePlaceName', 'ITALIA', /^ITALIA\b/i, undefined, seenCodes);
  await page.getByRole('button', { name: 'Avanti' }).click();
  // Step 4 is «Ti serve la fattura?» (FIS-01): optional, so the guest goes on without an answer and nothing about the invoice is sent.
  await expect(page.getByTestId('checkin-invoice-step')).toBeVisible();
  await page.getByRole('button', { name: 'Avanti' }).click();
  // Step 5 shows the privacy notice (the Alloggiati registration is a legal obligation: notice only, no consent to
  // tick). "Avanti" must NOT submit by itself: the test used to pass only because that click skipped this step.
  await expect(page.getByTestId('checkin-privacy-notice')).toBeVisible();
  await page.getByTestId('checkin-submit').click();
  await expect(page.getByText('Check-in completato!')).toBeVisible({ timeout: 20_000 });
}

/** Official Alloggiati DOCUMENTI row IDENT (Polizia di Stato). Never a made-up type. */
const OFFICIAL_IDENTITY_CARD_QUERY = 'CARTA DI IDENTITA';
const FALLBACK_SELECT_LABEL = "Carta d'identita'";

/**
 * Head-of-family document type: native select when the official table is not imported, otherwise the
 * suggestion list. After the Alloggiati seed the GJ stack has DOCUMENTI, so the row has to be chosen.
 */
async function pickHeadOfFamilyDocumentType(page: Page, seenCodes: Map<string, unknown[]>): Promise<void> {
  await chooseOfficialCode(page, 'guest-0-documentType', OFFICIAL_IDENTITY_CARD_QUERY, /CARTA DI IDENTITA/i, FALLBACK_SELECT_LABEL, seenCodes);
}

/** Same field on the next guest shares one codes answer. The guest index is not part of the key. */
function seenCodeKey(id: string, query: string): string {
  return `${id.replace(/guest-\d+-/, '')}:${query.toUpperCase()}`;
}

/**
 * Picks an official Alloggiati row when the list is imported. A plain select uses the fallback label.
 * `empty` means the typed name stayed because the table answered with nothing.
 */
async function chooseOfficialCode(
  page: Page,
  id: string,
  query: string,
  option: RegExp,
  selectLabel?: string,
  seenCodes?: Map<string, unknown[]>,
): Promise<'empty' | 'chosen' | 'select'> {
  const field = page.locator(`#${id}`);
  await expect(field).toBeVisible();
  if ((await field.evaluate((el) => el.tagName.toLowerCase())) === 'select') {
    await field.selectOption({ label: selectLabel ?? query });
    return 'select';
  }
  const cacheKey = seenCodeKey(id, query);
  const alreadySeen = seenCodes?.has(cacheKey) === true;
  // Official descriptions are uppercase (ROMA, ITALIA, CARTA DI IDENTITA). The list opens while the
  // field is focused and closes on blur, so the search is waited for and the field is focused again.
  // A query already answered for this check-in is not requested again (staleTime five minutes),
  // including when that answer was an empty list.
  let rows: unknown[];
  if (alreadySeen) {
    await field.focus();
    await field.fill(query);
    rows = seenCodes?.get(cacheKey) ?? [];
  } else {
    const codes = page.waitForResponse(
      (res) => {
        if (res.request().method() !== 'GET' || !res.url().includes('/codes')) return false;
        const url = decodeURIComponent(res.url()).replace(/\+/g, ' ');
        return url.toUpperCase().includes(query.toUpperCase());
      },
      { timeout: 15_000 },
    );
    await field.focus();
    await field.fill(query);
    const response = await codes;
    const body = await response.json().catch(() => []);
    rows = Array.isArray(body) ? body : [];
    seenCodes?.set(cacheKey, rows);
  }
  // A table that was not imported answers []. The typed name stays. A table that was imported
  // (Stati, Documenti on the golden-journey stack) has a row, and that row is chosen.
  if (rows.length === 0) return 'empty';
  await field.focus();
  const choice = page.locator(`#${id}-listbox`).getByRole('option', { name: option });
  await expect(choice.first()).toBeVisible({ timeout: 15_000 });
  await choice.first().click();
  await expect(page.getByTestId(`${id}-code`)).toBeVisible();
  return 'chosen';
}
