import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { SupplierServicesPage } from '../supplier-services-page';
import { addressNow, listOf, makeDraft, makeService, problem, renderRouted } from './service-test-kit';

const api = vi.hoisted(() => ({
  fetchSupplierServices: vi.fn(),
  fetchSupplierService: vi.fn(),
  createSupplierService: vi.fn(),
  updateSupplierService: vi.fn(),
  deleteSupplierService: vi.fn(),
  publishSupplierService: vi.fn(),
  pauseSupplierService: vi.fn(),
  duplicateSupplierService: vi.fn(),
  uploadSupplierServicePhotos: vi.fn(),
}));
vi.mock('@/api/supplier-services.api', () => api);

const sonner = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('sonner', () => sonner);

const ACTIVE = makeService({ id: 'a', name: 'Pulizia cambio ospiti' });
const PAUSED = makeService({ id: 'p', name: 'Lavanderia', category: 'laundry', status: 'Paused', priceFromCents: 1800, priceUnit: 'PerHour', durationMinutes: 90, photoUrls: [] });
const DRAFT = makeDraft({ id: 'd', name: 'Ripasso pre-arrivo' });
const ALL = [ACTIVE, PAUSED, DRAFT];

const PATH = '/app/supplier/services';
const NO_BREAK = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

function renderPage(search = '', list = listOf(ALL)) {
  api.fetchSupplierServices.mockResolvedValue(list);
  return renderRouted({ at: `${PATH}${search}`, routes: [{ path: PATH, element: <SupplierServicesPage /> }] });
}

async function openMenu(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: `Altre azioni: ${name}` }), { key: 'Enter' });
  return screen.findByRole('menu');
}

/** What the toast of an action that can be undone offers: the word "Annulla" and what it does. */
function undoOf(toastFn: ReturnType<typeof vi.fn>): { message: string; run: () => void } {
  const [message, options] = toastFn.mock.calls.at(-1) as [string, { action: { label: string; onClick: () => void } }];
  expect(options.action.label).toBe('Annulla');
  return { message, run: options.action.onClick };
}

describe('SupplierServicesPage (SP-06)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('shows every service as a card with its price, duration, category and state', async () => {
    renderPage();

    const card = await screen.findByTestId('supplier-service-a');
    expect(within(card).getByRole('link', { name: /Pulizia cambio ospiti/ })).toHaveAttribute('href', `${PATH}/a`);
    expect(NO_BREAK(card.textContent)).toContain('da 45 € a intervento · 2 h');
    expect(card).toHaveTextContent('Pulizie');
    expect(card.querySelector('[data-status="Active"]')).toHaveTextContent('Pubblicato');
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/a.jpg');

    const paused = screen.getByTestId('supplier-service-p');
    expect(NO_BREAK(paused.textContent)).toContain('da 18 € all’ora · 1 h 30 min');
    expect(paused).toHaveTextContent('Lavanderia');
    expect(paused.querySelector('[data-status="Paused"]')).toHaveTextContent('In pausa');
    // No photo: no image, the card does not break.
    expect(paused.querySelector('img')).toBeNull();

    const draft = screen.getByTestId('supplier-service-d');
    expect(draft.querySelector('[data-status="Draft"]')).toHaveTextContent('Bozza');
    expect(draft).toHaveTextContent('Prezzo da indicare · Durata da indicare');
    expect(draft).toHaveTextContent('Da completare: Durata, Prezzo.');
  });

  it('says "Su preventivo" for a service on quote and never a price it does not have', async () => {
    renderPage('', listOf([makeService({ id: 'q', name: 'Ristrutturazione', requiresQuote: true, priceFromCents: null })]));

    expect(await screen.findByTestId('supplier-service-q')).toHaveTextContent('Su preventivo · 2 h');
  });

  it('offers the first service when there is none, with the four steps', async () => {
    renderPage('', listOf([]));

    const empty = await screen.findByTestId('supplier-services-empty');
    expect(within(empty).getByRole('heading', { name: 'Crea il tuo primo servizio' })).toBeInTheDocument();
    const steps = within(empty).getByRole('list', { name: 'I quattro passi' });
    expect(within(steps).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['1Cosa fai', '2Quanto costa', '3Quanto dura e quando lo offri', '4Le foto: poi pubblichi']);
    expect(within(empty).getByRole('link', { name: 'Aggiungi un servizio' })).toHaveAttribute('href', `${PATH}/new`);
    expect(screen.queryByTestId('supplier-services-filters')).not.toBeInTheDocument();
  });

  it('always has the way to add a service in the header', async () => {
    renderPage();

    await screen.findByTestId('supplier-service-a');
    expect(screen.getByTestId('supplier-service-add')).toHaveAttribute('href', `${PATH}/new`);
  });

  it('tells a failed load with a retry, never an empty list', async () => {
    api.fetchSupplierServices.mockRejectedValueOnce(problem(500, { title: 'Internal Server Error' }));
    renderRouted({ at: PATH, routes: [{ path: PATH, element: <SupplierServicesPage /> }] });

    const error = await screen.findByTestId('supplier-services-error');
    expect(error).toHaveTextContent('Impossibile caricare i servizi');
    expect(screen.queryByTestId('supplier-services-empty')).not.toBeInTheDocument();

    api.fetchSupplierServices.mockResolvedValue(listOf(ALL));
    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('supplier-service-a')).toBeInTheDocument();
  });

  describe('filters and views', () => {
    it('counts the services by state and filters on a click, keeping the choice in the address', async () => {
      renderPage();

      await screen.findByTestId('supplier-service-a');
      expect(screen.getByRole('button', { name: 'Tutti (3)' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Pubblicati (1)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'In pausa (1)' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Bozze (1)' }));

      await waitFor(() => expect(screen.queryByTestId('supplier-service-a')).not.toBeInTheDocument());
      expect(screen.getByTestId('supplier-service-d')).toBeInTheDocument();
      expect(screen.queryByTestId('supplier-service-p')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Bozze (1)' })).toHaveAttribute('aria-pressed', 'true');
      expect(addressNow(screen)).toBe(`${PATH}?stato=Draft`);

      fireEvent.click(screen.getByRole('button', { name: 'Tutti (3)' }));

      expect(await screen.findByTestId('supplier-service-a')).toBeInTheDocument();
      expect(addressNow(screen)).toBe(PATH);
    });

    it('opens on the state the address asks for, and ignores one it does not know', async () => {
      renderPage('?stato=Paused');
      await screen.findByTestId('supplier-service-p');
      expect(screen.queryByTestId('supplier-service-a')).not.toBeInTheDocument();
      cleanup();

      renderPage('?stato=archiviati');
      await screen.findByTestId('supplier-service-a');
      expect(screen.getByTestId('supplier-service-p')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tutti (3)' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('offers all the services again when none has the chosen state', async () => {
      renderPage('?stato=Active', listOf([DRAFT]));

      const empty = await screen.findByTestId('supplier-services-filter-empty');
      expect(empty).toHaveTextContent('Nessun servizio con questo stato');
      fireEvent.click(within(empty).getByRole('button', { name: 'Mostra tutti' }));

      expect(await screen.findByTestId('supplier-service-d')).toBeInTheDocument();
      expect(addressNow(screen)).toBe(PATH);
    });

    it('shows the table with the service, the price, the duration and the state when asked, and goes back to the cards', async () => {
      renderPage('?vista=tabella');

      const table = await screen.findByRole('table', { name: 'Servizi e prezzi' });
      expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Servizio', 'Prezzo', 'Durata', 'Stato', 'Azioni']);
      expect(within(table).getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['Pulizia cambio ospitiPulizie', 'LavanderiaLavanderia', 'Ripasso pre-arrivoPulizie']);
      const row = within(table).getByTestId('supplier-service-a');
      expect(NO_BREAK(row.textContent)).toContain('da 45 € a intervento');
      expect(row).toHaveTextContent('Pubblicato');
      expect(within(row).getByRole('link', { name: 'Pulizia cambio ospiti' })).toHaveAttribute('href', `${PATH}/a`);
      expect(screen.queryByTestId('supplier-services-cards')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tabella' })).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Schede' }));

      expect(await screen.findByTestId('supplier-services-cards')).toBeInTheDocument();
      expect(addressNow(screen)).toBe(PATH);
    });

    it('keeps the state when the view changes and the view when the state changes', async () => {
      renderPage('?stato=Paused');

      await screen.findByTestId('supplier-service-p');
      fireEvent.click(screen.getByRole('button', { name: 'Tabella' }));
      await screen.findByRole('table', { name: 'Servizi e prezzi' });
      expect(addressNow(screen)).toBe(`${PATH}?stato=Paused&vista=tabella`);

      fireEvent.click(screen.getByRole('button', { name: 'Bozze (1)' }));
      await waitFor(() => expect(addressNow(screen)).toBe(`${PATH}?stato=Draft&vista=tabella`));
    });
  });

  describe('what can be done with a service', () => {
    it('goes on with a draft: its one action is "Continua", and it opens the creation on that draft', async () => {
      renderPage();

      const draft = await screen.findByTestId('supplier-service-d');
      expect(within(draft).getByRole('link', { name: 'Continua' })).toHaveAttribute('href', `${PATH}/new?bozza=d`);
      // A published service has no main action: the card itself is the way in.
      expect(within(screen.getByTestId('supplier-service-a')).queryByRole('link', { name: 'Continua' })).not.toBeInTheDocument();
      expect(within(screen.getByTestId('supplier-service-a')).queryByRole('button', { name: 'Riattiva' })).not.toBeInTheDocument();
    });

    it('puts a paused service back on offer, and "Annulla" pauses it again for real', async () => {
      api.publishSupplierService.mockResolvedValue({ ...PAUSED, status: 'Active', version: 4 });
      api.pauseSupplierService.mockResolvedValue({ ...PAUSED, version: 5 });
      renderPage();

      fireEvent.click(await within(await screen.findByTestId('supplier-service-p')).findByRole('button', { name: 'Riattiva' }));

      await waitFor(() => expect(api.publishSupplierService).toHaveBeenCalledWith('p'));
      await waitFor(() => expect(sonner.toast.success).toHaveBeenCalled());
      const undo = undoOf(sonner.toast.success);
      expect(undo.message).toBe('«Lavanderia» è pubblicato.');
      undo.run();

      await waitFor(() => expect(api.pauseSupplierService).toHaveBeenCalledWith('p'));
    });

    it('pauses a published service from "⋯", with an "Annulla" that puts it back on offer', async () => {
      api.pauseSupplierService.mockResolvedValue({ ...ACTIVE, status: 'Paused', version: 4 });
      api.publishSupplierService.mockResolvedValue({ ...ACTIVE, version: 5 });
      renderPage();
      await screen.findByTestId('supplier-service-a');

      const menu = await openMenu('Pulizia cambio ospiti');
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Metti in pausa' }));

      await waitFor(() => expect(api.pauseSupplierService).toHaveBeenCalledWith('a'));
      await waitFor(() => expect(sonner.toast.success).toHaveBeenCalled());
      const undo = undoOf(sonner.toast.success);
      expect(undo.message).toBe('«Pulizia cambio ospiti» è in pausa: i clienti non lo vedono finché non lo riattivi.');
      undo.run();

      await waitFor(() => expect(api.publishSupplierService).toHaveBeenCalledWith('a'));
    });

    it('has in "⋯" edit, how customers see it, duplicate, pause and delete, each going where it should', async () => {
      renderPage();
      await screen.findByTestId('supplier-service-a');

      const menu = await openMenu('Pulizia cambio ospiti');

      expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Modifica', 'Come lo vedono i clienti', 'Duplica', 'Metti in pausa', 'Elimina']);
      expect(within(menu).getByRole('menuitem', { name: 'Modifica' })).toHaveAttribute('href', `${PATH}/a`);
      expect(within(menu).getByRole('menuitem', { name: 'Come lo vedono i clienti' })).toHaveAttribute('href', '/app/supplier/availability?sezione=anteprima&servizio=a');
      expect(within(menu).getByRole('menuitem', { name: 'Duplica' })).toHaveAttribute('href', `${PATH}/new?duplica=a`);
    });

    it('offers to publish a draft that is complete, and not one that lacks something', async () => {
      renderPage('', listOf([DRAFT, makeDraft({ id: 'ready', name: 'Pronto', publishable: true, missingForPublication: [], priceFromCents: 3000, durationMinutes: 60 })]));
      await screen.findByTestId('supplier-service-ready');

      const incomplete = await openMenu('Ripasso pre-arrivo');
      expect(within(incomplete).queryByRole('menuitem', { name: 'Pubblica' })).not.toBeInTheDocument();
      fireEvent.keyDown(incomplete, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

      const complete = await openMenu('Pronto');
      expect(within(complete).getByRole('menuitem', { name: 'Pubblica' })).toBeInTheDocument();
    });

    it('tells what is missing when the API refuses to publish, without a word of its JSON', async () => {
      api.publishSupplierService.mockRejectedValue(problem(422, { code: 'supplier_service_not_publishable', fields: ['priceFromCents'], detail: 'Manca: priceFromCents.' }));
      renderPage('', listOf([makeDraft({ id: 'ready', name: 'Pronto', publishable: true })]));
      await screen.findByTestId('supplier-service-ready');

      fireEvent.click(within(await openMenu('Pronto')).getByRole('menuitem', { name: 'Pubblica' }));

      await waitFor(() => expect(sonner.toast.error).toHaveBeenCalledWith('Per pubblicare servono ancora: Prezzo.'));
    });
  });

  describe('deleting', () => {
    it('asks first, says what happens, and deletes only when confirmed', async () => {
      api.deleteSupplierService.mockResolvedValue(undefined);
      renderPage();
      await screen.findByTestId('supplier-service-a');
      api.fetchSupplierServices.mockResolvedValue(listOf([PAUSED, DRAFT]));

      fireEvent.click(within(await openMenu('Pulizia cambio ospiti')).getByRole('menuitem', { name: 'Elimina' }));

      const dialog = await screen.findByRole('dialog', { name: 'Eliminare «Pulizia cambio ospiti»?' });
      expect(within(dialog).getByText('Una volta eliminato non si può ripristinare.')).toBeInTheDocument();
      expect(within(dialog).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Non è più nel tuo catalogo e i clienti non lo vedono.', 'Le richieste già ricevute restano dove sono.']);
      expect(api.deleteSupplierService).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina il servizio' }));

      await waitFor(() => expect(api.deleteSupplierService).toHaveBeenCalledWith('a'));
      await waitFor(() => expect(sonner.toast.success).toHaveBeenCalledWith('«Pulizia cambio ospiti» è stato eliminato.'));
      await waitFor(() => expect(screen.queryByTestId('supplier-service-a')).not.toBeInTheDocument());
      expect(screen.getByTestId('supplier-service-p')).toBeInTheDocument();
    });

    it('can be given up: nothing is deleted', async () => {
      renderPage();
      await screen.findByTestId('supplier-service-a');

      fireEvent.click(within(await openMenu('Pulizia cambio ospiti')).getByRole('menuitem', { name: 'Elimina' }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(api.deleteSupplierService).not.toHaveBeenCalled();
      expect(screen.getByTestId('supplier-service-a')).toBeInTheDocument();
    });

    it('says only what is true of a draft', async () => {
      renderPage();
      await screen.findByTestId('supplier-service-d');

      fireEvent.click(within(await openMenu('Ripasso pre-arrivo')).getByRole('menuitem', { name: 'Elimina' }));

      const dialog = await screen.findByRole('dialog', { name: 'Eliminare «Ripasso pre-arrivo»?' });
      expect(within(dialog).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['La bozza viene eliminata.']);
    });

    it('tells it when the service is already gone', async () => {
      api.deleteSupplierService.mockRejectedValue(problem(404, { code: 'supplier_service_not_found' }));
      renderPage();
      await screen.findByTestId('supplier-service-a');

      fireEvent.click(within(await openMenu('Pulizia cambio ospiti')).getByRole('menuitem', { name: 'Elimina' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Elimina il servizio' }));

      await waitFor(() => expect(sonner.toast.error).toHaveBeenCalledWith('Non troviamo più questo servizio: forse è stato eliminato.'));
    });
  });

  describe('the limit of services', () => {
    it('says it and takes away the ways to add one when the supplier has the most it can have', async () => {
      renderPage('', listOf([ACTIVE, PAUSED], 2));

      await screen.findByTestId('supplier-service-a');
      expect(screen.getByTestId('supplier-services-limit')).toHaveTextContent('Hai raggiunto il limite di 2 servizi: per aggiungerne un altro, eliminane uno.');
      const add = screen.getByTestId('supplier-service-add');
      expect(add).toBeDisabled();
      expect(add.tagName).toBe('BUTTON');

      const menu = await openMenu('Pulizia cambio ospiti');
      const duplicate = within(menu).getByRole('menuitem', { name: 'Duplica' });
      expect(duplicate).toHaveAttribute('data-disabled');
      expect(duplicate).not.toHaveAttribute('href');
    });

    it('says nothing while there is room', async () => {
      renderPage('', listOf([ACTIVE], 30));

      await screen.findByTestId('supplier-service-a');
      expect(screen.queryByTestId('supplier-services-limit')).not.toBeInTheDocument();
    });
  });

  describe('English and accessibility', () => {
    it('is in English when the language is', async () => {
      await i18n.changeLanguage('en');
      renderPage();

      const card = await screen.findByTestId('supplier-service-a');
      expect(card.querySelector('[data-status="Active"]')).toHaveTextContent('Published');
      expect(NO_BREAK(card.textContent)).toContain('from €45 per job · 2 h');
      expect(screen.getByRole('button', { name: 'Drafts (1)' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Services and prices' })).toBeInTheDocument();
    });

    it('has no accessibility violation that can be found without a browser, as cards and as a table', async () => {
      const { container } = renderPage();
      await screen.findByTestId('supplier-service-a');
      await expectNoAxeViolations(container);
      cleanup();

      const table = renderPage('?vista=tabella');
      await screen.findByRole('table', { name: 'Servizi e prezzi' });
      await expectNoAxeViolations(table.container);
    });
  });
});
