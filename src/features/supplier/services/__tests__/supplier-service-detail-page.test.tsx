import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import type { SupplierProfile } from '@/types/supplier';
import { SupplierServiceDetailPage } from '../supplier-service-detail-page';
import { addressNow, connectApi, createFakeCatalog, makeDraft, makeService, problem, renderRouted } from './service-test-kit';

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
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: vi.fn().mockResolvedValue(['cleaning', 'maintenance', 'plumbing', 'laundry', 'linen', 'check-in', 'gardening', 'events', 'rental', 'excursions', 'electrical']) }));

const sonner = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
}));
vi.mock('sonner', () => sonner);

const supplierApi = vi.hoisted(() => ({ fetchSupplierProfile: vi.fn() }));
vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...supplierApi,
}));

configure({ asyncUtilTimeout: 5000 });

const LIST = '/app/supplier/services';
const SERVICE = makeService({
  id: 'a',
  name: 'Pulizia cambio ospiti',
  pricesIncludeVat: true,
  durationMinutes: 150,
  minNoticeHours: 24,
  weekdays: ['Monday', 'Tuesday', 'Wednesday'],
  included: ['Pulizia completa', 'Cambio biancheria'],
  supplements: [
    { code: 'bagno-in-piu', label: 'Bagno in più', amountCents: 1000, per: 'bathroom', max: 3 },
    { code: 'oltre-60-mq', label: 'Oltre 60 m²', amountCents: 1550, per: 'sqm30', max: null },
  ],
});
const PROFILE = {
  orgId: 'org-1',
  status: 'Active',
  legalName: 'Pulizie Roma Srl',
  phone: '+39 06 1234567',
  email: 'info@example.test',
  categories: ['cleaning'],
  comuni: ['Frazione Rurale'],
  comuneIstatCodes: ['058091', '015146'],
  operatingComuni: [
    { istatCode: '058091', cadastralCode: 'H501', name: 'Roma', displayName: 'Roma', provinceCode: 'RM', regionCode: 'LAZ', regionIstatCode: '12', regionName: 'Lazio', isActive: true },
    { istatCode: '015146', cadastralCode: 'F205', name: 'Milano', displayName: 'Milano', provinceCode: 'MI', regionCode: 'LOM', regionIstatCode: '03', regionName: 'Lombardia', isActive: true },
  ],
  photoUrls: [],
} satisfies SupplierProfile;

function renderPage(catalog = createFakeCatalog([SERVICE]), id = 'a', profile: unknown = PROFILE) {
  connectApi(api, catalog);
  if (profile instanceof Error) supplierApi.fetchSupplierProfile.mockRejectedValue(profile);
  else supplierApi.fetchSupplierProfile.mockResolvedValue(profile);
  const view = renderRouted({ at: `${LIST}/${id}`, routes: [{ path: `${LIST}/:id`, element: <SupplierServiceDetailPage /> }] });
  return { catalog, ...view };
}

const page = () => screen.findByTestId('supplier-service-page');
const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });
const save = () => fireEvent.click(screen.getByTestId('service-save'));
const visible = () => within(screen.getByTestId('service-visible')).getByRole('switch');
const section = (id: string) => screen.getByTestId(`service-section-${id}`) as HTMLDetailsElement;
const titleOf = (id: string) => section(id).querySelector('summary')?.textContent ?? '';
/** Opens a part the way the browser does: the element opens and tells it (jsdom does not toggle a `details` on a click). */
function openSection(id: string) {
  section(id).open = true;
  fireEvent(section(id), new Event('toggle'));
}

async function openHeaderMenu() {
  fireEvent.keyDown(screen.getByTestId('page-header-more'), { key: 'Enter' });
  return screen.findByRole('menu');
}

describe('SupplierServiceDetailPage (SP-06)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('the page of a service', () => {
    it('shows the service in five parts, the first two open, with what each holds said on its title', async () => {
      renderPage();
      await page();

      expect(screen.getByRole('heading', { level: 1, name: 'Pulizia cambio ospiti' })).toBeInTheDocument();
      expect(screen.getByText(/Pulizie · da 45\s€ a intervento · 2 h 30 min/)).toBeInTheDocument();
      expect(section('service').open).toBe(true);
      expect(section('price').open).toBe(true);
      expect(section('booking').open).toBe(false);
      expect(section('photos').open).toBe(false);
      expect(section('zone').open).toBe(false);
      expect(titleOf('service')).toContain('Il servizio');
      expect(titleOf('service')).toContain('Pulizie');
      expect(titleOf('price')).toMatch(/Prezzo.*da 45\s€ a intervento/);
      expect(titleOf('booking')).toContain('2 h 30 min · 3 giorni');
      expect(titleOf('photos')).toContain('2 foto su 6');
      expect(titleOf('zone')).toContain('Le stesse di tutti i tuoi servizi');

      // The fields have what the service has.
      expect(screen.getByTestId('service-name')).toHaveValue('Pulizia cambio ospiti');
      expect(screen.getByTestId('service-category')).toHaveValue('cleaning');
      expect(screen.getByTestId('service-included')).toHaveValue('Pulizia completa\nCambio biancheria');
      expect(screen.getByTestId('service-amount')).toHaveValue('45');
      expect(screen.getByTestId('service-unit')).toHaveValue('PerJob');
      expect(within(screen.getByTestId('service-vat')).getByRole('switch')).toBeChecked();
      expect(screen.getByTestId('service-duration')).toHaveValue('150');
      expect(screen.getByTestId('service-notice')).toHaveValue('24');
      expect(screen.getByTestId('service-weekday-Monday')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('service-weekday-Thursday')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getAllByTestId('service-supplement')).toHaveLength(2);
      expect(screen.getByDisplayValue('Bagno in più')).toBeInTheDocument();
      expect(screen.getByDisplayValue('15,50')).toBeInTheDocument();
    });

    it('shows a service on quote with no amount, and an hourly one with its rate', async () => {
      renderPage(createFakeCatalog([makeService({ id: 'q', name: 'Ristrutturazione', requiresQuote: true, priceFromCents: null })]), 'q');
      await page();

      expect(screen.getByTestId('service-price-mode-quote')).toBeChecked();
      expect(screen.queryByTestId('service-amount')).not.toBeInTheDocument();
      expect(titleOf('price')).toContain('Su preventivo');
      cleanup();

      renderPage(createFakeCatalog([makeService({ id: 'h', name: 'Giardino', priceUnit: 'PerHour', priceFromCents: 1850 })]), 'h');
      await page();

      expect(screen.getByTestId('service-price-mode-hourly')).toBeChecked();
      expect(screen.getByTestId('service-amount')).toHaveValue('18,50');
      expect(screen.getByLabelText('Tariffa oraria')).toBeInTheDocument();
    });

    it('says a service is not there when it is not, with the way to the list and to a new one', async () => {
      renderPage(createFakeCatalog([]), 'sparito');

      const missing = await screen.findByTestId('supplier-service-not-found');
      expect(missing).toHaveTextContent('Non troviamo questo servizio');
      expect(within(missing).getByRole('link', { name: 'Torna ai servizi' })).toHaveAttribute('href', LIST);
      expect(within(missing).getByRole('link', { name: 'Aggiungi un servizio' })).toHaveAttribute('href', `${LIST}/new`);
    });

    it('offers a retry when the service cannot be loaded for another reason, and does not say it is gone', async () => {
      const catalog = createFakeCatalog([SERVICE]);
      connectApi(api, catalog);
      api.fetchSupplierService.mockRejectedValueOnce(problem(500, { title: 'Internal Server Error' }));
      supplierApi.fetchSupplierProfile.mockResolvedValue(PROFILE);
      renderRouted({ at: `${LIST}/a`, routes: [{ path: `${LIST}/:id`, element: <SupplierServiceDetailPage /> }] });

      const error = await screen.findByTestId('supplier-service-error');
      expect(error).toHaveTextContent('Impossibile caricare il servizio');
      expect(screen.queryByTestId('supplier-service-not-found')).not.toBeInTheDocument();
      fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

      expect(await screen.findByTestId('supplier-service-page')).toBeInTheDocument();
    });
  });

  describe('the preview that follows what is typed', () => {
    it('changes with the name, the line, the price, the duration and the VAT, before anything is saved', async () => {
      const { catalog } = renderPage();
      await page();
      const preview = screen.getByTestId('service-preview-card');
      expect(within(preview).getByTestId('service-preview-name')).toHaveTextContent('Pulizia cambio ospiti');
      expect(within(preview).getByTestId('service-preview-notes')).toHaveTextContent('IVA inclusa · 2 supplementi');

      type('service-name', 'Pulizia a fondo');
      type('service-summary', 'Come dopo una ristrutturazione.');
      type('service-amount', '60');
      fireEvent.change(screen.getByTestId('service-unit'), { target: { value: 'PerSquareMeter' } });
      fireEvent.change(screen.getByTestId('service-duration'), { target: { value: '180' } });
      fireEvent.click(within(screen.getByTestId('service-vat')).getByRole('switch'));

      await waitFor(() => expect(within(preview).getByTestId('service-preview-name')).toHaveTextContent('Pulizia a fondo'));
      expect(within(preview).getByTestId('service-preview-summary')).toHaveTextContent('Come dopo una ristrutturazione.');
      expect(within(preview).getByTestId('service-preview-price').textContent?.replace(/\s/g, ' ')).toContain('da 60 € al m² · 3 h');
      expect(within(preview).getByTestId('service-preview-notes')).toHaveTextContent('2 supplementi');
      expect(within(preview).getByTestId('service-preview-notes')).not.toHaveTextContent('IVA');
      expect(preview.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/a.jpg');
      expect(catalog.update).not.toHaveBeenCalled();
    });

    it('says "Su preventivo" in the preview as soon as the way of charging changes, and counts only the supplements that have a name', async () => {
      renderPage(createFakeCatalog([makeService({ id: 'a', supplements: [], pricesIncludeVat: false })]));
      await page();

      fireEvent.click(screen.getByTestId('service-price-mode-quote'));
      await waitFor(() => expect(screen.getByTestId('service-preview-price')).toHaveTextContent('Su preventivo'));

      fireEvent.click(screen.getByTestId('service-supplement-add'));
      expect(screen.queryByTestId('service-preview-notes')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Supplemento 1'), { target: { value: 'Bagno' } });
      await waitFor(() => expect(screen.getByTestId('service-preview-notes')).toHaveTextContent('1 supplemento'));
    });
  });

  describe('saving', () => {
    it('keeps the save button off until something changes, then saves the whole service with the version it was read at', async () => {
      const { catalog } = renderPage();
      await page();
      expect(screen.getByTestId('service-save')).toBeDisabled();

      type('service-name', 'Pulizia a fondo');
      await waitFor(() => expect(screen.getByTestId('service-save')).toBeEnabled());
      save();

      await waitFor(() => expect(catalog.update).toHaveBeenCalledTimes(1));
      expect(catalog.update).toHaveBeenCalledWith(
        'a',
        expect.objectContaining({
          version: 3,
          name: 'Pulizia a fondo',
          category: 'cleaning',
          priceFromCents: 4500,
          priceUnit: 'PerJob',
          pricesIncludeVat: true,
          durationMinutes: 150,
          minNoticeHours: 24,
          weekdays: ['Monday', 'Tuesday', 'Wednesday'],
          included: ['Pulizia completa', 'Cambio biancheria'],
          supplements: SERVICE.supplements,
        }),
      );
      await waitFor(() => expect(sonner.toast.success).toHaveBeenCalledWith('Modifiche salvate'));
      // The page is the saved service now: the title is the new name and there is nothing to save.
      await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Pulizia a fondo' })).toBeInTheDocument());
      await waitFor(() => expect(screen.getByTestId('service-save')).toBeDisabled());
      expect(screen.getByTestId('service-name')).toHaveValue('Pulizia a fondo');
    });

    it('sends a changed supplement under its old code, a removed one no more, and a new one with a code from its name', async () => {
      const { catalog } = renderPage();
      await page();

      fireEvent.change(screen.getByDisplayValue('Oltre 60 m²'), { target: { value: 'Superficie grande' } });
      fireEvent.click(screen.getAllByTestId('service-supplement-remove')[0]!);
      fireEvent.click(screen.getByTestId('service-supplement-add'));
      const rows = screen.getAllByTestId('service-supplement');
      expect(rows).toHaveLength(2);
      fireEvent.change(within(rows[1]!).getByLabelText('Supplemento 2'), { target: { value: 'Biancheria extra' } });
      fireEvent.change(within(rows[1]!).getByLabelText('Importo (€)'), { target: { value: '7,5' } });
      fireEvent.change(within(rows[1]!).getByLabelText('Quando si aggiunge'), { target: { value: 'set' } });
      save();

      await waitFor(() => expect(catalog.update).toHaveBeenCalledTimes(1));
      expect(catalog.update.mock.calls[0]?.[1].supplements).toEqual([
        { code: 'oltre-60-mq', label: 'Superficie grande', amountCents: 1550, per: 'sqm30', max: null },
        { code: 'biancheria-extra', label: 'Biancheria extra', amountCents: 750, per: 'set', max: null },
      ]);
    });

    it('saves a service switched to "su preventivo" without a price', async () => {
      const { catalog } = renderPage();
      await page();

      fireEvent.click(screen.getByTestId('service-price-mode-quote'));
      save();

      await waitFor(() => expect(catalog.update).toHaveBeenCalledTimes(1));
      expect(catalog.update.mock.calls[0]?.[1]).toMatchObject({ requiresQuote: true, priceFromCents: null, priceUnit: 'PerJob' });
    });

    it('does not save what is not valid, says where, and opens the part that holds the problem', async () => {
      const { catalog } = renderPage();
      await page();
      expect(section('booking').open).toBe(false);

      type('service-name', '   ');
      for (const day of ['Monday', 'Tuesday', 'Wednesday']) fireEvent.click(screen.getByTestId(`service-weekday-${day}`));
      type('service-amount', 'tanto');
      save();

      expect(await screen.findByText('Scrivi come si chiama il servizio.')).toBeInTheDocument();
      expect(screen.getByText('Scrivi l’importo in euro, per esempio 45 o 45,50.')).toBeInTheDocument();
      expect(screen.getByText('Scegli almeno un giorno.')).toBeInTheDocument();
      expect(screen.getByTestId('service-name')).toHaveAttribute('aria-invalid', 'true');
      await waitFor(() => expect(section('booking').open).toBe(true));
      expect(catalog.update).not.toHaveBeenCalled();
      expect(sonner.toast.success).not.toHaveBeenCalled();
    });

    it('marks the field the API refuses, says it in words and opens its part', async () => {
      const { catalog } = renderPage();
      await page();
      catalog.update.mockRejectedValueOnce(problem(422, { code: 'supplier_service_invalid', fields: ['durationMinutes', 'priceFromCents'], detail: 'Alcuni dati non sono validi (campi: durationMinutes).' }));

      type('service-name', 'Pulizia a fondo');
      save();

      const alert = await screen.findByTestId('service-problem');
      expect(alert).toHaveTextContent('Controlla questi dati: Durata, Prezzo.');
      expect(alert).not.toHaveTextContent('durationMinutes');
      expect(screen.getByTestId('service-amount')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('service-duration')).toHaveAttribute('aria-invalid', 'true');
      await waitFor(() => expect(section('booking').open).toBe(true));
      // What was typed is still there, to be fixed and sent again.
      expect(screen.getByTestId('service-name')).toHaveValue('Pulizia a fondo');
    });

    it('does not overwrite a service that was changed elsewhere: says it, and reloads on request, with what the server has', async () => {
      const { catalog } = renderPage();
      await page();
      catalog.touch('a', { name: 'Cambiato da un collega', priceFromCents: 9900 });

      type('service-name', 'Il mio cambiamento');
      save();

      const conflict = await screen.findByTestId('service-conflict');
      expect(conflict).toHaveTextContent('Questo servizio è stato modificato altrove. Ricarica per vedere la versione salvata.');
      expect(catalog.items()[0]?.name).toBe('Cambiato da un collega');
      // The typing is not thrown away behind the person's back.
      expect(screen.getByTestId('service-name')).toHaveValue('Il mio cambiamento');
      expect(sonner.toast.success).not.toHaveBeenCalled();

      fireEvent.click(within(conflict).getByRole('button', { name: 'Ricarica' }));

      await waitFor(() => expect(screen.queryByTestId('service-conflict')).not.toBeInTheDocument());
      expect(screen.getByTestId('service-name')).toHaveValue('Cambiato da un collega');
      expect(screen.getByTestId('service-amount')).toHaveValue('99');
      expect(screen.getByRole('heading', { level: 1, name: 'Cambiato da un collega' })).toBeInTheDocument();

      // From the reload on, a save carries the version it brought.
      type('service-name', 'Ora sì');
      save();
      await waitFor(() => expect(catalog.items()[0]?.name).toBe('Ora sì'));
    });

    it('says the service is gone when it was deleted meanwhile', async () => {
      const { catalog } = renderPage();
      await page();
      await catalog.remove('a');

      type('service-name', 'Pulizia a fondo');
      save();

      expect(await screen.findByTestId('service-problem')).toHaveTextContent('Non troviamo più questo servizio: forse è stato eliminato.');
    });
  });

  describe('"Visibile ai clienti"', () => {
    it('shows the state and says what the switch does in each of them', async () => {
      renderPage();
      await page();

      expect(visible()).toBeChecked();
      expect(screen.getByTestId('service-visibility').querySelector('[data-status="Active"]')).toHaveTextContent('Pubblicato');
      expect(screen.getByTestId('service-visibility')).toHaveTextContent('È in elenco: i clienti lo vedono. Spegni per metterlo in pausa.');
      cleanup();

      renderPage(createFakeCatalog([makeService({ id: 'a', status: 'Paused' })]));
      await page();
      expect(visible()).not.toBeChecked();
      expect(screen.getByTestId('service-visibility')).toHaveTextContent('È in pausa: i clienti non lo vedono. Accendi per riattivarlo.');
      cleanup();

      renderPage(createFakeCatalog([makeDraft({ id: 'a' })]));
      await page();
      expect(visible()).not.toBeChecked();
      expect(screen.getByTestId('service-visibility')).toHaveTextContent('È ancora una bozza: lo vedi solo tu. Accendi per pubblicarlo.');
    });

    it('pauses a published service when switched off, and "Annulla" puts it back on offer', async () => {
      const { catalog } = renderPage();
      await page();

      fireEvent.click(visible());

      await waitFor(() => expect(catalog.pause).toHaveBeenCalledWith('a'));
      await waitFor(() => expect(visible()).not.toBeChecked());
      expect(screen.getByTestId('service-visibility').querySelector('[data-status="Paused"]')).toHaveTextContent('In pausa');
      const [message, options] = sonner.toast.success.mock.calls.at(-1) as [string, { action: { label: string; onClick: () => void } }];
      expect(message).toBe('«Pulizia cambio ospiti» è in pausa: i clienti non lo vedono finché non lo riattivi.');
      expect(options.action.label).toBe('Annulla');
      options.action.onClick();

      await waitFor(() => expect(catalog.publish).toHaveBeenCalledWith('a'));
      await waitFor(() => expect(visible()).toBeChecked());
    });

    it('saves what is typed first, and only then puts the service on offer: what goes live is what is on screen', async () => {
      const { catalog } = renderPage(createFakeCatalog([makeService({ id: 'a', status: 'Paused' })]));
      await page();

      type('service-name', 'Pulizia a fondo');
      fireEvent.click(visible());

      await waitFor(() => expect(catalog.publish).toHaveBeenCalledWith('a'));
      expect(catalog.update).toHaveBeenCalledTimes(1);
      expect(catalog.update.mock.invocationCallOrder[0]).toBeLessThan(catalog.publish.mock.invocationCallOrder[0]!);
      expect(catalog.items()[0]).toMatchObject({ name: 'Pulizia a fondo', status: 'Active' });
      await waitFor(() => expect(visible()).toBeChecked());
    });

    it('does not put the service on offer if what is typed cannot be saved', async () => {
      const { catalog } = renderPage(createFakeCatalog([makeService({ id: 'a', status: 'Paused' })]));
      await page();

      type('service-name', '');
      fireEvent.click(visible());

      expect(await screen.findByText('Scrivi come si chiama il servizio.')).toBeInTheDocument();
      expect(catalog.publish).not.toHaveBeenCalled();
      expect(visible()).not.toBeChecked();
    });

    it('says what a draft lacks when it cannot be published yet, and the switch stays off', async () => {
      const { catalog } = renderPage(createFakeCatalog([makeDraft({ id: 'a' })]));
      await page();

      fireEvent.click(visible());

      await waitFor(() => expect(sonner.toast.error).toHaveBeenCalledWith('Per pubblicare servono ancora: Durata, Prezzo.'));
      expect(catalog.items()[0]?.status).toBe('Draft');
      expect(visible()).not.toBeChecked();
    });
  });

  describe('the other things to do', () => {
    it('has in "⋯" duplicate and how customers see it, and the save button is the one main action', async () => {
      renderPage();
      await page();

      const menu = await openHeaderMenu();

      expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Duplica', 'Come lo vedono i clienti', 'Elimina']);
      expect(within(menu).getByRole('menuitem', { name: 'Duplica' })).toHaveAttribute('href', `${LIST}/new?duplica=a`);
      expect(within(menu).getByRole('menuitem', { name: 'Come lo vedono i clienti' })).toHaveAttribute('href', '/app/supplier/availability?sezione=anteprima&servizio=a');
      expect(screen.getAllByTestId('service-save')).toHaveLength(1);
    });

    it('deletes after asking, and goes back to the list', async () => {
      const { catalog } = renderPage();
      await page();

      fireEvent.click(within(await openHeaderMenu()).getByRole('menuitem', { name: 'Elimina' }));
      const dialog = await screen.findByRole('dialog', { name: 'Eliminare «Pulizia cambio ospiti»?' });
      expect(catalog.remove).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina il servizio' }));

      await waitFor(() => expect(catalog.remove).toHaveBeenCalledWith('a'));
      await waitFor(() => expect(addressNow(screen)).toBe(LIST));
      expect(sonner.toast.success).toHaveBeenCalledWith('«Pulizia cambio ospiti» è stato eliminato.');
    });
  });

  describe('the photos', () => {
    it('adds photos to the saved service and shows them, and the cover of the preview is the first', async () => {
      const { catalog } = renderPage(createFakeCatalog([makeService({ id: 'a', photoUrls: [] })]));
      await page();
      expect(within(section('photos')).getByTestId('service-photos-empty')).toHaveTextContent('Non ci sono ancora foto. La prima sarà la copertina.');

      fireEvent.change(screen.getByTestId('service-photos-input'), { target: { files: [new File(['x'], 'cucina.jpg', { type: 'image/jpeg' })] } });

      await waitFor(() => expect(screen.getAllByTestId('photo-list-item')).toHaveLength(1));
      expect(catalog.upload).toHaveBeenCalledWith('a', expect.any(Array));
      expect(screen.getByTestId('service-preview-card').querySelector('img')).toHaveAttribute('src', 'https://cdn.example/a/cucina.jpg');
      expect(titleOf('photos')).toContain('1 foto su 6');
    });

    it('moves a photo by saving the order on the service as the server has it, not what is typed and not yet saved', async () => {
      const { catalog } = renderPage();
      await page();
      type('service-name', 'Un nome non ancora salvato');

      fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));

      await waitFor(() => expect(catalog.update).toHaveBeenCalledTimes(1));
      expect(catalog.update).toHaveBeenCalledWith(
        'a',
        expect.objectContaining({ name: 'Pulizia cambio ospiti', photoUrls: ['https://cdn.example/b.jpg', 'https://cdn.example/a.jpg'], version: 3 }),
      );
      await waitFor(() => expect(screen.getByTestId('service-preview-card').querySelector('img')).toHaveAttribute('src', 'https://cdn.example/b.jpg'));
      // The typed name is still in the form, still to be saved.
      expect(screen.getByTestId('service-name')).toHaveValue('Un nome non ancora salvato');
      expect(screen.getByTestId('service-save')).toBeEnabled();
      // And the next save carries the version the photo left.
      save();
      await waitFor(() => expect(catalog.update).toHaveBeenCalledTimes(2));
      expect(catalog.update.mock.calls[1]?.[1]).toMatchObject({ name: 'Un nome non ancora salvato', version: 4 });
    });

    it('asks before removing a photo, and takes it away with the rest of the service as the server has it', async () => {
      const { catalog } = renderPage();
      await page();

      fireEvent.click(screen.getByRole('button', { name: 'Togli la foto 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Togliere questa foto?' });
      expect(catalog.update).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Togli la foto' }));

      await waitFor(() => expect(screen.getAllByTestId('photo-list-item')).toHaveLength(1));
      expect(catalog.update).toHaveBeenCalledWith('a', expect.objectContaining({ photoUrls: ['https://cdn.example/b.jpg'] }));
    });

    it('offers the reload when a photo is changed on a service that moved on elsewhere', async () => {
      const { catalog } = renderPage();
      await page();
      catalog.touch('a');

      fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));

      expect(await screen.findByTestId('service-conflict')).toBeInTheDocument();
      expect(screen.getByTestId('service-photos-error')).toHaveTextContent('Questo servizio è stato modificato altrove.');
    });
  });

  describe('where it is offered', () => {
    it('shows the comuni of the supplier, as the zone of every service, and where to change them', async () => {
      renderPage();
      await page();

      const zone = await screen.findByTestId('service-zone');
      await waitFor(() => expect(zone).toHaveTextContent('3 comuni'));
      expect(within(zone).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Roma (RM)', 'Milano (MI)', 'Frazione Rurale']);
      expect(zone).toHaveTextContent('La zona è la stessa per tutti i tuoi servizi: la cambi una volta sola.');
      expect(within(zone).getByRole('link', { name: 'Cambia la zona' })).toHaveAttribute('href', '/app/supplier/availability?sezione=regole&zona=1');
    });

    it('shows the first six and says how many more there are', async () => {
      const many = Array.from({ length: 8 }, (_, i) => `Comune ${i + 1}`);
      renderPage(undefined, 'a', { ...PROFILE, comuneIstatCodes: [], operatingComuni: [], comuni: many });
      await page();

      const zone = await screen.findByTestId('service-zone');
      await waitFor(() => expect(zone).toHaveTextContent('8 comuni'));
      expect(within(zone).getAllByRole('listitem').map((item) => item.textContent)).toEqual([...many.slice(0, 6), 'e altri 2']);
    });

    it('says so when no comune has been chosen, and when they cannot be read', async () => {
      renderPage(undefined, 'a', { ...PROFILE, comuneIstatCodes: [], operatingComuni: [], comuni: [] });
      await page();
      expect(await within(await screen.findByTestId('service-zone')).findByText('Non hai ancora scelto i comuni in cui lavori.')).toBeInTheDocument();
      cleanup();

      renderPage(undefined, 'a', problem(500, {}));
      await page();
      expect(await within(await screen.findByTestId('service-zone')).findByRole('alert')).toHaveTextContent('Non riusciamo a leggere i tuoi comuni.');
    });
  });

  describe('English and accessibility', () => {
    it('is in English when the language is', async () => {
      await i18n.changeLanguage('en');
      renderPage();
      await page();

      expect(screen.getByText('Visible to customers')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'How customers see it' })).toBeInTheDocument();
      expect(screen.getByText(/Cleaning · from €45 per job · 2 h 30 min/)).toBeInTheDocument();
    });

    it('has no accessibility violation that can be found without a browser, with every part open', async () => {
      const { container } = renderPage();
      await page();
      for (const id of ['booking', 'photos', 'zone']) openSection(id);
      await screen.findByTestId('service-zone');

      await expectNoAxeViolations(container);
    });
  });
});
