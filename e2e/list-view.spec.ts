import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { WIDER_LETTERS, axeViolations, expectInsideTheScreen, expectNoAxeViolations, expectNothingSticksOut, untilStill } from './helpers/ui-checks';

/**
 * UI-14, the unified list in a real browser. Its parts are on one page that only the dev server has (`/dev/list-view`, made-up
 * stays that really change when an action is run), so that the address, the CSV, the swipe and the widths of a phone can be
 * walked through without a mock of the API; and the list of guests (`/app/short-rent/guests`), the first real page that uses it
 * and the one that asks a server for its rows, with the API of the demo mode mocked.
 */

const DEV_PAGE = '/dev/list-view';
const PHONES = [360, 390] as const;

async function openList(page: Page, width = 1280, search = '', height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(`${DEV_PAGE}${search}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Elenco unico' })).toBeVisible();
  await expect(page.getByTestId('dev-list')).toBeVisible();
}

const list = (page: Page) => page.getByTestId('dev-list');
const table = (page: Page) => page.getByRole('table', { name: 'Prenotazioni' });
const cards = (page: Page) => page.getByRole('list', { name: 'Prenotazioni' });
const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Cerca prenotazioni' });
const chip = (page: Page, name: RegExp | string) => page.getByRole('button', { name, exact: typeof name === 'string' });

/** The guests of the rows of the table, in the order they are in. */
async function guestsInTable(page: Page) {
  return (await table(page).locator('th[scope="row"] [data-list-opener]').allInnerTexts()).map((text) => text.trim());
}

/** The guests the table shows now, waited for: the address changes before the rows do. */
const expectGuests = (page: Page, expected: string[]) => expect.poll(() => guestsInTable(page)).toEqual(expected);
const expectGuestCount = (page: Page, count: number) => expect.poll(async () => (await guestsInTable(page)).length).toBe(count);

/** The words of the row of the table that has the guest in it. */
const rowOf = (page: Page, guest: string) => table(page).getByRole('row').filter({ has: page.getByRole('button', { name: guest, exact: true }) });

/** A menu that opens with the keyboard, as it does for a person who does not use a mouse. */
async function openMenuWithKeyboard(button: Locator) {
  await button.focus();
  await button.press('Enter');
}

// ---------------------------------------------------------------------------------------------------------------------------
// The address

test.describe('the state of the list is in the address', () => {
  test('the quick filter, the search and Back: each view has its own address and Back gives the one before', async ({ page }) => {
    await openList(page);
    await expect(chip(page, 'In arrivo')).toHaveAttribute('aria-pressed', 'true');
    await expectGuestCount(page, 7);

    await chip(page, /^Da confermare/).click();
    await expect(page).toHaveURL(/\/dev\/list-view\?chip=pending$/);
    await expectGuests(page, ['Sofia Marino', 'Elena Gatti']);

    await searchBox(page).fill('elena');
    await expect(page).toHaveURL(/\?q=elena&chip=pending$/);
    await expectGuests(page, ['Elena Gatti']);
    await expect(page.getByTestId('list-count')).toHaveText('1 prenotazione su 14');

    // A refresh gives the same list: the address is all the state there is.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(searchBox(page)).toHaveValue('elena');
    await expect(chip(page, /^Da confermare/)).toHaveAttribute('aria-pressed', 'true');
    await expectGuests(page, ['Elena Gatti']);

    // Back: the search was one step (typing it did not leave a step for each letter), then the quick filter, then the plain list.
    await page.goBack();
    await expect(page).toHaveURL(/\?chip=pending$/);
    await expect(searchBox(page)).toHaveValue('');
    await expectGuests(page, ['Sofia Marino', 'Elena Gatti']);
    await page.goBack();
    await expect(page).toHaveURL(/\/dev\/list-view$/);
    await expect(chip(page, 'In arrivo')).toHaveAttribute('aria-pressed', 'true');

    await page.goForward();
    await page.goForward();
    await expect(searchBox(page)).toHaveValue('elena');
  });

  test('a search typed letter by letter makes one step of the history, not one for each letter', async ({ page }) => {
    await openList(page);

    await searchBox(page).pressSequentially('ma', { delay: 60 });
    await expect(page).toHaveURL(/\?q=ma$/);
    await searchBox(page).pressSequentially('rio', { delay: 60 });
    await expect(page).toHaveURL(/\?q=mario$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/dev\/list-view$/);
  });

  test('what is not valid in the address is ignored, and the list is the plain one', async ({ page }) => {
    await openList(page, 1280, '?chip=nope&f_property=castle&f_arrival=ieri&f_channel=nave&sort=email:sideways&cols=niente&view=colonne&page=-2');

    await expect(chip(page, 'In arrivo')).toHaveAttribute('aria-pressed', 'true');
    await expectGuestCount(page, 7);
    await expect(page.getByRole('button', { name: /^Filtri$/ })).toBeVisible();
    await expect(table(page).getByRole('columnheader', { name: 'Date' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.getByTestId('list-board')).toHaveCount(0);
  });

  test('the parameters of the page that are not the list are left alone', async ({ page }) => {
    await openList(page, 1280, '?scenario=refreshing');

    await chip(page, 'Concluse').click();

    await expect(page).toHaveURL(/\?scenario=refreshing&chip=done$/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Filters

test.describe('the filters', () => {
  test('a drawer with the number of results, tags that take a filter away, and "Azzera i filtri"', async ({ page }) => {
    await openList(page);

    await page.getByRole('button', { name: 'Filtri' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtri' });
    await expect(panel).toBeVisible();
    await panel.getByLabel('Immobile').selectOption('trullo');
    await panel.getByRole('checkbox', { name: 'Airbnb' }).check();
    await panel.getByRole('checkbox', { name: 'A mano' }).check();
    // Elena (Airbnb) and Luigi (a mano) are the two upcoming stays of the Trullo that come from there.
    await expect(panel.getByRole('button', { name: 'Mostra 2 risultati' })).toBeVisible();
    await panel.getByRole('button', { name: 'Mostra 2 risultati' }).click();

    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(/\?f_property=trullo&f_channel=airbnb%2Cmanual$/);
    await expectGuests(page, ['Elena Gatti', 'Luigi Verdi']);
    await expect(page.getByRole('button', { name: 'Filtri · 2' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rimuovi il filtro: Immobile: Trullo dei Sogni' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rimuovi il filtro: Canale: Airbnb, A mano' })).toBeVisible();

    await page.getByRole('button', { name: 'Rimuovi il filtro: Immobile: Trullo dei Sogni' }).click();
    await expect(page).toHaveURL(/\?f_channel=airbnb%2Cmanual$/);

    await page.getByTestId('list-clear').click();
    // "Azzera i filtri" leaves the quick filter for everything.
    await expect(page).toHaveURL(/\?chip=all$/);
    await expectGuestCount(page, 14);
  });

  test('a range of dates, and the panel opens on the filters that are on and gives the focus back to its button', async ({ page }) => {
    await openList(page, 1280, '?chip=all');
    await page.getByTestId('list-filters-button').click();
    const panel = page.getByRole('dialog', { name: 'Filtri' });
    await panel.getByLabel('Dal', { exact: true }).fill('2026-10-10');
    await panel.getByLabel('Al', { exact: true }).fill('2026-10-12');
    await panel.getByRole('button', { name: /^Mostra \d+ risultat/ }).click();

    await expect(page).toHaveURL(/f_arrival=2026-10-10\.\.2026-10-12/);
    await expectGuests(page, ['Mario Rossi', 'Zoë Müller', 'Sofia Marino']);
    await expect(page.getByTestId('list-filters-button')).toBeFocused();

    await page.getByTestId('list-filters-button').click();
    await expect(page.getByRole('dialog', { name: 'Filtri' }).getByLabel('Dal', { exact: true })).toHaveValue('2026-10-10');
  });

  test('a range that ends before it starts is refused, and says so', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: 'Filtri' }).click();
    const panel = page.getByRole('dialog', { name: 'Filtri' });

    await panel.getByLabel('Dal', { exact: true }).fill('2026-10-20');
    await panel.getByLabel('Al', { exact: true }).fill('2026-10-01');

    await expect(panel.getByRole('alert')).toHaveText('La data di inizio è dopo quella di fine.');
    await expect(panel.getByTestId('list-filters-apply')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Views

test.describe('the views', () => {
  test('a view of the list, and a view of the person that stays after a refresh, and goes with a way back', async ({ page }) => {
    await openList(page);
    await page.getByTestId('list-views-button').click();
    await page.getByRole('menuitemradio', { name: 'Arrivi dei prossimi 7 giorni' }).click();
    await expect(page).toHaveURL(/\?f_arrival=2026-10-09\.\.2026-10-16$/);
    await expectGuestCount(page, 5);
    // The menu says which view the list is in.
    await page.getByTestId('list-views-button').click();
    await expect(page.getByRole('menuitemradio', { name: 'Arrivi dei prossimi 7 giorni' })).toBeChecked();
    await page.keyboard.press('Escape');

    // The person's own: the Trullo, saved under a name.
    await page.goto(`${DEV_PAGE}?chip=all&f_property=trullo`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('list-views-button').click();
    await page.getByRole('menuitem', { name: 'Salva questa vista…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Salva questa vista' });
    // Without a name nothing is saved.
    await dialog.getByRole('button', { name: 'Salva la vista' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Scrivi un nome per la vista.');
    await dialog.getByRole('textbox', { name: 'Nome della vista' }).fill('Solo il Trullo');
    await dialog.getByRole('button', { name: 'Salva la vista' }).click();
    await expect(page.getByText('Vista «Solo il Trullo» salvata')).toBeVisible();

    // It stays after a refresh (it is kept in the browser), and applying it brings the list back to what it was.
    await page.goto(`${DEV_PAGE}?chip=cancelled`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('list-views-button').click();
    await page.getByRole('menuitemradio', { name: 'Solo il Trullo' }).click();
    await expect(page).toHaveURL(/\?chip=all&f_property=trullo$/);

    // Deleting it can be undone.
    await page.getByTestId('list-views-button').click();
    await page.getByRole('menuitem', { name: 'Elimina una vista salvata…' }).click();
    await page.getByRole('dialog', { name: 'Elimina una vista' }).getByRole('button', { name: 'Elimina la vista: Solo il Trullo' }).click();
    await expect(page.getByText('Vista «Solo il Trullo» eliminata')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Elimina una vista' }).getByText('Non hai ancora salvato nessuna vista.')).toBeVisible();
    // The toast is out of the reach of a person who has a dialog open: closing the dialog first, then "Annulla".
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Annulla' }).click();
    await page.getByTestId('list-views-button').click();
    await expect(page.getByRole('menuitemradio', { name: 'Solo il Trullo' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// The CSV

test.describe('the CSV', () => {
  /** What the browser was asked to save: the bytes of the start, the file name and the text. */
  async function download(page: Page, click: () => Promise<void>) {
    const [saved] = await Promise.all([page.waitForEvent('download'), click()]);
    const bytes = await readFile(await saved.path());
    return { name: saved.suggestedFilename(), mark: Array.from(bytes.subarray(0, 3)), text: bytes.subarray(3).toString('utf8') };
  }

  test('saves what is on the screen: the columns, the filters, in the way of Excel, with a formula written as text', async ({ page }) => {
    await openList(page, 1280, '?chip=all');
    await openMenuWithKeyboard(page.getByRole('button', { name: 'Colonne, ordine ed esportazione' }));

    const file = await download(page, () => page.getByRole('menuitem', { name: 'Esporta 14 righe (CSV)' }).click());

    expect(file.name).toMatch(/^prenotazioni-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(file.mark).toEqual([0xef, 0xbb, 0xbf]);
    const lines = file.text.split('\r\n');
    // Italian: `;` between the cells and the comma as the decimal mark.
    expect(lines[0]).toBe('"Ospite e immobile";"Date";"Canale";"Stato";"Totale"');
    expect(lines).toHaveLength(15);
    expect(lines).toContain('"Anna Maria Giuseppina Bianchi Montefeltro Della Rovere · Masseria Ulivi";"2026-10-16 → 2026-10-23";"Booking.com";"Confirmed";"1480"');
    expect(file.text).toContain('"640,5"');
    // A guest that wrote a formula as a name: it is text in the file, not something that runs when Excel opens it.
    expect(file.text).toContain(`"'=HYPERLINK(""http://evil.example"",""clicca qui"") · Trullo dei Sogni"`);
    expect(file.text).not.toMatch(/(^|;)"=HYPERLINK/m);
  });

  test('follows the filters and the columns the person has on', async ({ page }) => {
    await openList(page, 1280, '?chip=all&f_property=masseria&cols=guest,email');
    await openMenuWithKeyboard(page.getByRole('button', { name: 'Colonne, ordine ed esportazione' }));

    const file = await download(page, () => page.getByRole('menuitem', { name: /^Esporta \d+ righe \(CSV\)$/ }).click());

    const lines = file.text.split('\r\n');
    expect(lines[0]).toBe('"Ospite e immobile";"Email"');
    expect(lines).toHaveLength(5);
    expect(lines.every((line, index) => index === 0 || line.includes('Masseria Ulivi'))).toBe(true);
  });

  test('saves only the rows that are selected, from the bar of the actions', async ({ page }) => {
    await openList(page, 1280, '?chip=all');
    await table(page).getByRole('checkbox', { name: 'Mario Rossi' }).check();
    await table(page).getByRole('checkbox', { name: 'Luigi Verdi' }).check();

    const file = await download(page, () => page.getByRole('button', { name: 'Esporta la selezione (CSV)' }).click());

    expect(file.text.split('\r\n')).toHaveLength(3);
    expect(file.text).toContain('"Mario Rossi · Casa Bianca"');
    expect(file.text).toContain('"Luigi Verdi · Trullo dei Sogni"');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Selecting, and acting on many

test.describe('actions on many rows', () => {
  test('a bar with the number selected, an action with its "Annulla", and a question before what cannot be taken back', async ({ page }) => {
    await openList(page, 1280, '?chip=all');
    await table(page).getByRole('checkbox', { name: 'Sofia Marino' }).check();
    await table(page).getByRole('checkbox', { name: 'Elena Gatti' }).check();

    const bar = page.getByRole('region', { name: 'Azioni sulle righe selezionate' });
    await expect(bar.getByRole('status')).toHaveText('2 selezionate');

    // Reversible: done at once, with a toast that takes it back.
    await bar.getByRole('button', { name: 'Invia il link di check-in' }).click();
    await expect(page.getByText('Link inviato a 2 ospiti')).toBeVisible();
    await expect(bar).toBeHidden();
    await page.getByRole('button', { name: 'Annulla' }).click();
    await expect(page.getByText('Link inviato a 2 ospiti')).toBeHidden();

    // Not reversible: it asks first, and "Annulla" means no.
    await table(page).getByRole('checkbox', { name: 'Sofia Marino' }).check();
    await table(page).getByRole('checkbox', { name: 'Elena Gatti' }).check();
    await bar.getByRole('button', { name: 'Cancella' }).click();
    const question = page.getByRole('dialog', { name: 'Cancellare 2 prenotazioni?' });
    await expect(question.getByText('Gli ospiti vengono avvisati con un’email.')).toBeVisible();
    await question.getByRole('button', { name: 'Annulla' }).click();
    await expect(question).toBeHidden();
    await expect(table(page).getByText('In attesa')).toHaveCount(2);

    await bar.getByRole('button', { name: 'Cancella' }).click();
    await page.getByRole('dialog', { name: 'Cancellare 2 prenotazioni?' }).getByRole('button', { name: 'Cancella le prenotazioni' }).click();
    await expect(table(page).getByText('In attesa')).toHaveCount(0);
    await expect(rowOf(page, 'Sofia Marino').getByText('Annullata')).toBeVisible();
    await expect(bar).toBeHidden();
  });

  test('the selection does not outlive the rows it was made on', async ({ page }) => {
    await openList(page, 1280, '?chip=all');
    await table(page).getByRole('checkbox', { name: 'Mario Rossi' }).check();
    await expect(page.getByRole('region', { name: 'Azioni sulle righe selezionate' })).toBeVisible();

    await chip(page, 'Concluse').click();
    await expect(page.getByRole('region', { name: 'Azioni sulle righe selezionate' })).toBeHidden();
    await chip(page, 'Tutte').click();
    await expect(table(page).getByRole('checkbox', { name: 'Mario Rossi' })).not.toBeChecked();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// A row: its action, its menu, its drawer

test.describe('a row', () => {
  test('its action is in sight and undoes with "Annulla"; its menu has the rest; its drawer shows the row', async ({ page }) => {
    await openList(page, 1280, '?chip=all');

    const mario = rowOf(page, 'Mario Rossi');
    await mario.getByRole('button', { name: 'Registra arrivo' }).click();
    await expect(page.getByText('Mario Rossi: registra arrivo')).toBeVisible();
    await expect(mario.getByText('Check-in effettuato')).toBeVisible();
    await page.getByRole('button', { name: 'Annulla' }).click();
    await expect(mario.getByText('Confermata')).toBeVisible();

    await openMenuWithKeyboard(mario.getByRole('button', { name: 'Altre azioni: Mario Rossi' }));
    await expect(page.getByRole('menuitem')).toHaveText(['Scrivi all’ospite', 'Apri la scheda', 'Cancella la prenotazione']);
    await page.keyboard.press('Escape');

    // The name opens the drawer; so does a click on the row; it gives the focus back to the name when it closes.
    const name = mario.getByRole('button', { name: 'Mario Rossi', exact: true });
    await name.click();
    const drawer = page.getByRole('dialog', { name: 'Mario Rossi' });
    await expect(drawer.getByTestId('dev-detail')).toContainText('ZS-1003');
    await expect(drawer.getByRole('link', { name: 'Apri la scheda completa' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(name).toBeFocused();

    await mario.getByText('Sito diretto').click();
    await expect(page.getByRole('dialog', { name: 'Mario Rossi' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Columns by state

test.describe('the columns by state', () => {
  const column = (page: Page, name: string) => page.getByRole('region', { name });
  const cardOf = (page: Page, guest: string) => page.locator('[data-board-card]').filter({ hasText: guest });

  test('a card moves with its menu, a move that is not allowed says why, and "Annulla" brings it back', async ({ page }) => {
    await openList(page);
    await page.getByRole('button', { name: 'Colonne', exact: true }).click();
    await expect(page).toHaveURL(/\?view=board$/);
    await expect(page.getByTestId('list-board')).toBeVisible();
    // The columns start from the quick filter for everything.
    await expect(chip(page, 'Tutte')).toHaveAttribute('aria-pressed', 'true');

    await openMenuWithKeyboard(page.getByRole('button', { name: 'Sposta o altre azioni: Sofia Marino' }));
    await page.getByRole('menuitem', { name: 'Sposta in «Concluse»' }).click();
    await expect(page.getByText('Non si può spostare qui')).toBeVisible();
    await expect(page.getByText('Il soggiorno si conclude dopo la partenza: prima registra l’arrivo.')).toBeVisible();
    await expect(column(page, 'Richieste').getByText('Sofia Marino')).toBeVisible();

    await openMenuWithKeyboard(page.getByRole('button', { name: 'Sposta o altre azioni: Sofia Marino' }));
    await page.getByRole('menuitem', { name: 'Sposta in «Confermate»' }).click();
    await expect(page.getByText('Sofia Marino è ora in «Confermate»')).toBeVisible();
    await expect(column(page, 'Confermate').getByText('Sofia Marino')).toBeVisible();

    await page.getByRole('button', { name: 'Annulla' }).click();
    await expect(column(page, 'Richieste').getByText('Sofia Marino')).toBeVisible();
  });

  test('a card is dragged to the next column with the mouse, with a ghost that follows and the column lit', async ({ page }) => {
    await openList(page, 1280, '?view=board');
    const source = cardOf(page, 'Mario Rossi');
    const target = column(page, 'In corso');
    // Pressed on a line of text of the card, not on its title (a link) nor its buttons: those are theirs.
    const grip = (await source.getByText('Sito diretto').boundingBox())!;
    const to = (await target.boundingBox())!;

    await page.mouse.move(grip.x + 4, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + 50, grip.y + 20, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
    // The column under the pointer is lit; a copy of the card goes with the pointer.
    await expect(target).toHaveClass(/border-dashed/);
    await expect(page.locator('body > [data-board-ghost]')).toHaveCount(1);
    await page.mouse.up();

    await expect(column(page, 'In corso').getByText('Mario Rossi')).toBeVisible();
    await expect(page.getByText('Mario Rossi è ora in «In corso»')).toBeVisible();
    await expect(page.locator('body > [data-board-ghost]')).toHaveCount(0);
  });

  test('a drop where the card cannot go says why and leaves it where it was', async ({ page }) => {
    await openList(page, 1280, '?view=board');
    const grip = (await cardOf(page, 'Sofia Marino').getByText('Sito diretto').boundingBox())!;

    // From "Richieste" to "In corso": two steps at once, which is not allowed.
    await page.mouse.move(grip.x + 4, grip.y + grip.height / 2);
    await page.mouse.down();
    const inProgress = (await column(page, 'In corso').boundingBox())!;
    await page.mouse.move(inProgress.x + inProgress.width / 2, inProgress.y + 80, { steps: 14 });
    await page.mouse.up();

    await expect(page.getByText('Non si può spostare qui')).toBeVisible();
    await expect(column(page, 'Richieste').getByText('Sofia Marino')).toBeVisible();
  });

  test('Escape puts a card being dragged back', async ({ page }) => {
    await openList(page, 1280, '?view=board');
    const grip = (await cardOf(page, 'Mario Rossi').getByText('Sito diretto').boundingBox())!;
    const to = (await column(page, 'In corso').boundingBox())!;

    await page.mouse.move(grip.x + 4, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
    await expect(page.locator('body > [data-board-ghost]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.mouse.up();

    await expect(page.locator('body > [data-board-ghost]')).toHaveCount(0);
    await expect(column(page, 'Confermate').getByText('Mario Rossi')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// When there is nothing to show

test.describe('the states', () => {
  test('while it loads, when it fails, when it is empty', async ({ page }) => {
    await openList(page);

    await page.getByTestId('scenario-loading').click();
    await expect(list(page).getByRole('status').filter({ hasText: "Caricamento dell'elenco" }).first()).toBeAttached();
    await expect(searchBox(page)).toBeVisible();

    await page.getByTestId('scenario-error').click();
    await expect(list(page).getByRole('alert')).toContainText('Impossibile caricare l’elenco');
    await expect(list(page).getByRole('button', { name: 'Riprova' })).toBeVisible();

    await page.getByTestId('scenario-empty').click();
    await expect(list(page).getByText('Qui arrivano tutte le tue prenotazioni')).toBeVisible();
    await expect(list(page).getByRole('button', { name: 'Crea prenotazione' })).toBeVisible();
  });

  test('when the search finds nothing it says so, with the way to see everything again', async ({ page }) => {
    await openList(page);

    await searchBox(page).fill('zzzzzz');

    await expect(list(page).getByText('Nessuna prenotazione con questi filtri')).toBeVisible();
    await expect(list(page).getByText('Prova a togliere un filtro, a cambiare filtro rapido o a cercare per codice.')).toBeVisible();
    await list(page).getByRole('button', { name: 'Azzera i filtri' }).last().click();
    await expect(page).toHaveURL(/\?chip=all$/);
    await expect(searchBox(page)).toHaveValue('');
    await expectGuestCount(page, 14);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// A phone

test.describe('on a phone', () => {
  test.use({ hasTouch: true, isMobile: true });

  /** A finger that goes down at `x`, moves along and is lifted: real touch events, which is what a phone sends. */
  async function swipe(page: Page, target: Locator, dx: number) {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    const y = box.y + 28;
    const x = box.x + box.width * 0.6;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step += 1) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * step) / 8, y }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }

  const cardOf = (page: Page, id: string) => cards(page).getByTestId(`list-row-${id}`);

  for (const width of PHONES) {
    test(`at ${width} px the rows are cards and nothing sticks out, even with wider letters`, async ({ page }) => {
      await openList(page, width, '?chip=all');
      await page.addStyleTag({ content: WIDER_LETTERS });

      await expect(table(page)).toBeHidden();
      await expect(cards(page)).toBeVisible();
      await expectInsideTheScreen(page, cards(page), `${width} px, the cards`);
      // The long name and the long e-mail of one guest are broken, not pushed out.
      await expect(cardOf(page, 'ZS-1004')).toContainText('Anna Maria Giuseppina');
      await expectNothingSticksOut(page, `${width} px, the list with wider letters`, 'main');
    });

    test(`at ${width} px everything the finger has to hit is 44 px, and the bar is as wide as the screen`, async ({ page }) => {
      await openList(page, width, '?chip=all');

      for (const target of [
        page.getByRole('button', { name: 'Filtri' }),
        page.getByTestId('list-views-button'),
        page.getByTestId('list-more-button'),
        page.getByTestId('list-layout-list'),
        page.getByTestId('list-layout-board'),
        chip(page, 'Tutte'),
        chip(page, /^Da confermare/),
        cardOf(page, 'ZS-1003').getByRole('button', { name: 'Registra arrivo' }),
        cardOf(page, 'ZS-1003').getByRole('button', { name: 'Altre azioni: Mario Rossi' }),
      ]) {
        const box = (await target.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(43.5);
        expect(box.width).toBeGreaterThanOrEqual(43.5);
      }
      await expectInsideTheScreen(page, searchBox(page), `${width} px, the search box`);
    });

    test(`at ${width} px the filters are a sheet from the bottom, with the button that shows the results in reach`, async ({ page }) => {
      await openList(page, width, '?chip=all', 800);

      await page.getByRole('button', { name: 'Filtri' }).click();
      const sheet = page.getByRole('dialog', { name: 'Filtri' });
      await expect(sheet).toBeVisible();
      await untilStill(page);
      const box = (await sheet.boundingBox())!;
      expect(box.x).toBeLessThanOrEqual(0.5);
      expect(box.width).toBeGreaterThanOrEqual(width - 1);
      expect(box.y + box.height).toBeGreaterThanOrEqual(799);
      await expectInsideTheScreen(page, sheet.getByTestId('list-filters-apply'), `${width} px, the button of the results`);
      await expectNothingSticksOut(page, `${width} px, the sheet of the filters with wider letters`);
    });
  }

  test('a swipe past the threshold runs the action of the card, and a short one or a vertical one does not', async ({ page }) => {
    await openList(page, 390, '?chip=all');
    const mario = cardOf(page, 'ZS-1003');
    await expect(mario.getByText('Confermata')).toBeVisible();

    // A short pull: the card goes back and nothing happens.
    await swipe(page, mario, -30);
    await expect(mario.getByText('Confermata')).toBeVisible();

    // Pulled to the left past the threshold: the arrival is registered (the same as the button on the card).
    await swipe(page, mario, -100);
    await expect(mario.getByText('Check-in effettuato')).toBeVisible();

    // The other way: "Scrivi", which is a message.
    await swipe(page, mario, 100);
    await expect(page.getByText('Messaggio a Mario Rossi')).toBeVisible();
  });

  test('what a swipe does is also a button on the card, and in its menu: the gesture is not the only way', async ({ page }) => {
    await openList(page, 390, '?chip=all');
    const mario = cardOf(page, 'ZS-1003');

    // The action of the swipe to the left is the one of the card, in sight.
    await expect(mario.getByRole('button', { name: 'Registra arrivo' })).toBeVisible();
    // The one of the swipe to the right is in the menu, which a keyboard and a screen reader reach.
    await openMenuWithKeyboard(mario.getByRole('button', { name: 'Altre azioni: Mario Rossi' }));
    await expect(page.getByRole('menuitem', { name: 'Scrivi all’ospite' })).toBeVisible();
  });

  test('"Seleziona più righe" brings the boxes, the hint and a bar of actions where the thumb is', async ({ page }) => {
    await openList(page, 390, '?chip=all', 800);
    await expect(cards(page).getByRole('checkbox')).toHaveCount(0);

    await page.getByTestId('list-more-button').click();
    await page.getByRole('menuitem', { name: 'Seleziona più righe' }).click();
    await expect(page.getByTestId('list-select-hint')).toContainText('Tocca le righe che vuoi selezionare.');
    await expect(cards(page).getByRole('checkbox').first()).toBeVisible();

    await cards(page).getByRole('checkbox', { name: 'Mario Rossi' }).check();
    const bar = page.getByRole('region', { name: 'Azioni sulle righe selezionate' });
    await expect(bar).toBeVisible();
    const box = (await bar.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(800);
    expect(box.y).toBeGreaterThan(400);
    await expectInsideTheScreen(page, bar, 'the bar of actions on a phone');

    await page.getByTestId('list-select-hint').getByRole('button', { name: 'Fine' }).click();
    await expect(cards(page).getByRole('checkbox')).toHaveCount(0);
    await expect(bar).toBeHidden();
  });

  test('the columns by state scroll sideways inside themselves and the page does not', async ({ page }) => {
    await openList(page, 390, '?view=board');
    await page.addStyleTag({ content: WIDER_LETTERS });

    await expect(page.getByTestId('list-board')).toBeVisible();
    const scrolls = await page.getByTestId('list-board').evaluate((board) => board.scrollWidth > board.clientWidth);
    expect(scrolls).toBe(true);
    await expectNothingSticksOut(page, 'the columns on a phone', 'main');
    // A card moves with its menu: a finger does not drag.
    await openMenuWithKeyboard(page.getByRole('button', { name: 'Sposta o altre azioni: Sofia Marino' }));
    await expect(page.getByRole('menuitem', { name: 'Sposta in «Confermate»' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Accessibility, in a real browser (colors and contrast included)

test.describe('accessibility', () => {
  for (const width of [1280, 390]) {
    test(`the list with its rows has no violation at ${width} px`, async ({ page }) => {
      await openList(page, width, '?chip=all');

      await expectNoAxeViolations(page);
    });

    test(`the list with rows selected, and the bar of the actions, has no violation at ${width} px`, async ({ page }) => {
      await openList(page, width, '?chip=all');
      if (width < 768) {
        await page.getByTestId('list-more-button').click();
        await page.getByRole('menuitem', { name: 'Seleziona più righe' }).click();
        await cards(page).getByRole('checkbox', { name: 'Mario Rossi' }).check();
      } else {
        await table(page).getByRole('checkbox', { name: 'Mario Rossi' }).check();
      }
      await expect(page.getByRole('region', { name: 'Azioni sulle righe selezionate' })).toBeVisible();

      await expectNoAxeViolations(page);
    });

    test(`the columns by state have no violation at ${width} px`, async ({ page }) => {
      await openList(page, width, '?view=board');
      await expect(page.getByTestId('list-board')).toBeVisible();

      await expectNoAxeViolations(page);
    });

    for (const scenario of ['loading', 'error', 'empty']) {
      test(`the list has no violation at ${width} px when it is in the state "${scenario}"`, async ({ page }) => {
        await openList(page, width, `?scenario=${scenario}`);
        await expect(page.getByTestId(`scenario-${scenario}`)).toHaveAttribute('aria-pressed', 'true');

        // The empty state is `EmptyState` (UI-02), not drawn by the list: its description is `muted-foreground` (4.36:1, the defect
        // that UI-07 already reported) and its title an `h3` under the `h1` of the page. Those two are not the list's to fix here;
        // anything else that axe finds is.
        const known = scenario === 'empty' ? ['color-contrast', 'heading-order'] : [];
        const found = (await axeViolations(page)).filter((violation) => !known.some((rule) => violation.startsWith(`${rule} `)));
        expect(found).toEqual([]);
      });
    }

    test(`the panel of the filters, and the dialog of the columns, have no violation at ${width} px`, async ({ page }) => {
      await openList(page, width, '?chip=all');

      await page.getByRole('button', { name: 'Filtri' }).click();
      await expect(page.getByRole('dialog', { name: 'Filtri' })).toBeVisible();
      await untilStill(page);
      await expectNoAxeViolations(page, { include: '[role="dialog"]' });
      await page.keyboard.press('Escape');

      await openMenuWithKeyboard(page.getByTestId('list-more-button'));
      await page.getByRole('menuitem', { name: 'Scegli le colonne…' }).click();
      await expect(page.getByRole('dialog', { name: 'Colonne dell’elenco' })).toBeVisible();
      await untilStill(page);
      await expectNoAxeViolations(page, { include: '[role="dialog"]' });
    });

    test(`the menus (of the list, of the views, of a row) have no violation at ${width} px`, async ({ page }) => {
      await openList(page, width, '?chip=all');

      await openMenuWithKeyboard(page.getByTestId('list-more-button'));
      await expect(page.getByRole('menu')).toBeVisible();
      // A menu eases in and its items change color as the focus moves: the colors are read when they have stopped.
      await untilStill(page);
      await expectNoAxeViolations(page, { include: '[role="menu"]' });
      await page.keyboard.press('Escape');

      await page.getByTestId('list-views-button').click();
      await expect(page.getByRole('menu')).toBeVisible();
      // A menu eases in and its items change color as the focus moves: the colors are read when they have stopped.
      await untilStill(page);
      await expectNoAxeViolations(page, { include: '[role="menu"]' });
      await page.keyboard.press('Escape');

      await openMenuWithKeyboard(page.getByRole('button', { name: 'Altre azioni: Mario Rossi' }).first());
      await expect(page.getByRole('menu')).toBeVisible();
      // A menu eases in and its items change color as the focus moves: the colors are read when they have stopped.
      await untilStill(page);
      await expectNoAxeViolations(page, { include: '[role="menu"]' });
    });

    test(`the drawer of a row has no violation at ${width} px`, async ({ page }) => {
      await openList(page, width, '?chip=all');

      await page.getByRole('button', { name: 'Mario Rossi', exact: true }).first().click();
      await expect(page.getByRole('dialog', { name: 'Mario Rossi' })).toBeVisible();
      await untilStill(page);
      await expectNoAxeViolations(page, { include: '[role="dialog"]' });
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// The list of guests: the first page that uses the list, and one that asks a server

interface GuestRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  city: string;
  country: string;
  createdAt: string;
}

const FIRST_NAMES = ['Mario', 'Anna', 'Luigi', 'Chiara', 'Giuseppe', 'Elena'];
const LAST_NAMES = ['Rossi', 'Bianchi', 'Verdi', 'Neri', 'Esposito', 'Gatti', 'Colombo'];

/** 45 guests, one of them with a name and an e-mail that no phone can show in one line. */
const GUESTS: GuestRow[] = Array.from({ length: 45 }, (_, index) => {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 3) % LAST_NAMES.length];
  return {
    id: `g${index + 1}`,
    firstName: index === 4 ? 'Anna Maria Giuseppina' : first,
    lastName: index === 4 ? 'Bianchi Montefeltro Della Rovere' : last,
    email: index === 4 ? 'anna.maria.giuseppina.bianchi.montefeltro.della.rovere@un-dominio-di-posta-molto-lungo.example.org' : `${first.toLowerCase()}.${last.toLowerCase()}${index}@example.com`,
    phoneNumber: '',
    city: index % 5 === 0 ? '' : 'Roma',
    country: 'IT',
    createdAt: '2026-09-20T10:00:00Z',
  };
});

/** The API of the guests: it searches (`search`) and pages (`page`, `pageSize`) as the real one does. Returns what it was asked. */
async function mockGuests(page: Page, guests: GuestRow[] = GUESTS) {
  const asked: URL[] = [];
  await page.route('**/api/guests**', async (route) => {
    const url = new URL(route.request().url());
    // `**/api/guests**` also matches the Vite module `/src/api/guests.api.ts`: only the list of the API is answered.
    if (url.pathname.replace(/\/$/, '') !== '/api/guests' || route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    asked.push(url);
    const search = (url.searchParams.get('search') ?? '').toLowerCase();
    const pageNumber = Number(url.searchParams.get('page') ?? 1);
    const pageSize = Number(url.searchParams.get('pageSize') ?? 20);
    const matching = guests.filter((guest) => `${guest.firstName} ${guest.lastName} ${guest.email}`.toLowerCase().includes(search));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: matching.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), totalCount: matching.length, page: pageNumber, pageSize }),
    });
  });
  return asked;
}

async function openGuests(page: Page, width = 1280, search = '', height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(demoUrl(`/app/short-rent/guests${search}`, 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Ospiti' })).toBeVisible();
  await expect(page.getByTestId('guest-list')).toBeVisible();
}

test.describe('the list of guests', () => {
  const guestTable = (page: Page) => page.getByRole('table', { name: 'Ospiti' });
  const guestNames = async (page: Page) => (await guestTable(page).locator('th[scope="row"]').allInnerTexts()).map((text) => text.trim());

  test('pages through the server, and the page is in the address: a refresh and Back give the same page', async ({ page }) => {
    const asked = await mockGuests(page);
    await openGuests(page);
    await expect(guestTable(page).locator('tbody tr')).toHaveCount(20);
    await expect(page.getByTestId('list-count')).toHaveText('45 risultati');
    const nav = page.getByRole('navigation', { name: 'Pagine dell’elenco' });
    await expect(nav).toContainText('Pagina 1 di 3');
    await expect(nav.getByRole('button', { name: 'Precedente' })).toBeDisabled();

    await nav.getByRole('button', { name: 'Successiva' }).click();
    await expect(page).toHaveURL(/\/app\/short-rent\/guests\?.*page=2/);
    await expect(nav).toContainText('Pagina 2 di 3');
    await expect.poll(() => asked.at(-1)?.searchParams.get('page')).toBe('2');
    const secondPage = await guestNames(page);

    await page.goBack();
    await expect(nav).toContainText('Pagina 1 di 3');
    await page.goForward();
    expect(await guestNames(page)).toEqual(secondPage);

    await page.goto(demoUrl('/app/short-rent/guests?page=3', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(guestTable(page).locator('tbody tr')).toHaveCount(5);
    await expect(nav.getByRole('button', { name: 'Successiva' })).toBeDisabled();
  });

  test('searches on the server a moment after the last key, once, and says when nothing is found', async ({ page }) => {
    const asked = await mockGuests(page);
    await openGuests(page);
    await expect(guestTable(page).locator('tbody tr')).toHaveCount(20);
    const before = asked.length;

    await page.getByRole('searchbox').pressSequentially('verdi', { delay: 50 });

    await expect(page).toHaveURL(/[?&]q=verdi$/);
    await expect.poll(() => asked.at(-1)?.searchParams.get('search')).toBe('verdi');
    // One request for the word and not one for each letter.
    expect(asked.length - before).toBe(1);
    const names = await guestNames(page);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name).toContain('Verdi');

    await page.getByRole('searchbox').fill('zzzzzz');
    await expect(page.getByText('Nessun risultato', { exact: true })).toBeVisible();
    await page.getByTestId('guest-list').getByRole('button', { name: 'Azzera i filtri' }).last().click();
    await expect(guestTable(page).locator('tbody tr')).toHaveCount(20);
    await expect(page).toHaveURL(/\/app\/short-rent\/guests(\?.*)?$/);
  });

  test('a row is the link to the guest, from the name and from the action', async ({ page }) => {
    await mockGuests(page);
    await openGuests(page);

    const first = guestTable(page).locator('tbody tr').first();
    await expect(first.getByRole('link', { name: 'Dettagli' })).toHaveAttribute('href', '/app/short-rent/guests/g1');
    await expect(first.locator('th[scope="row"] a')).toHaveAttribute('href', '/app/short-rent/guests/g1');
  });

  test('saves the guests that are selected, with the columns on the screen', async ({ page }) => {
    await mockGuests(page);
    await openGuests(page);

    await guestTable(page).locator('tbody tr').nth(0).getByRole('checkbox').check();
    await guestTable(page).locator('tbody tr').nth(2).getByRole('checkbox').check();
    const [saved] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Esporta la selezione (CSV)' }).click()]);

    const text = (await readFile(await saved.path())).subarray(3).toString('utf8');
    expect(saved.suggestedFilename()).toMatch(/^ospiti-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = text.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('"Anagrafica";"Email";"Città";"Data Creazione"');
  });

  for (const width of PHONES) {
    test(`at ${width} px the guests are cards and the page does not scroll sideways, even with wider letters`, async ({ page }) => {
      await mockGuests(page);
      await openGuests(page, width);
      await page.addStyleTag({ content: WIDER_LETTERS });

      await expect(guestTable(page)).toBeHidden();
      const cardList = page.getByRole('list', { name: 'Ospiti' });
      await expect(cardList.getByTestId('list-row-g1')).toBeVisible();
      await expectInsideTheScreen(page, cardList, `${width} px, the guests`);
      await expectNothingSticksOut(page, `${width} px, the guests with wider letters`, 'main');

      await cardList.getByRole('link', { name: /Mario Rossi/ }).first().click();
      await expect(page).toHaveURL(/\/app\/short-rent\/guests\/g\d+$/);
    });
  }

  test('has no accessibility violation, on a desktop and on a phone', async ({ page }) => {
    await mockGuests(page);
    await openGuests(page);
    await expectNoAxeViolations(page, { include: '[data-testid="guest-list"]' });

    await page.setViewportSize({ width: 390, height: 800 });
    await expectNoAxeViolations(page, { include: '[data-testid="guest-list"]' });
  });
});
