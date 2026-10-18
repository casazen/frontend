import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { SupplierServiceWizardPage } from '../supplier-service-wizard-page';
import { addressNow, connectApi, createFakeCatalog, makeDraft, makeService, problem, renderRouted } from './service-test-kit';

// A step is a validation, a save, a new address and a new screen: on a machine that is busy it takes more than the second that a
// query waits by default.
configure({ asyncUtilTimeout: 5000 });

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
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }) }));

const PATH = '/app/supplier/services/new';
const LIST = '/app/supplier/services';
const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function renderWizard(search = '', catalog = createFakeCatalog(), options: { strict?: boolean } = {}) {
  connectApi(api, catalog);
  const view = renderRouted({ at: `${PATH}${search}`, routes: [{ path: PATH, element: <SupplierServiceWizardPage /> }], strict: options.strict });
  return { catalog, ...view };
}

const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });
const next = () => fireEvent.click(screen.getByTestId('service-wizard-next'));
const finish = () => fireEvent.click(screen.getByTestId('service-wizard-finish'));
const stepTitle = (name: string) => screen.findByRole('heading', { level: 2, name });
const png = (name: string) => new File(['x'], name, { type: 'image/png' });
/** A message of a failed "Continue" is under its field and in the summary of the step: it is on the screen at least once. */
const shownMessage = async (text: string) => (await screen.findAllByText(text)).length > 0;

/** The first step as a supplier fills it. The categories come from the API, so the select shows them a moment later. */
async function fillFirstStep(name = 'Pulizia cambio ospiti') {
  await screen.findByRole('option', { name: 'Pulizie' });
  type('service-name', name);
  fireEvent.change(screen.getByTestId('service-category'), { target: { value: 'cleaning' } });
}

/** Goes through the first three steps with what is needed and stops on the last one (photos and preview). */
async function reachPhotos(catalog: ReturnType<typeof createFakeCatalog>) {
  await fillFirstStep();
  next();
  await stepTitle('Quanto costa?');
  type('service-amount', '45');
  next();
  await stepTitle('Quanto dura e quando lo offri?');
  next();
  await stepTitle('Come lo vedranno i clienti?');
  expect(catalog.items()).toHaveLength(1);
}

describe('SupplierServiceWizardPage (SP-06)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  describe('the four steps', () => {
    it('saves the draft at every step with the version the last answer had, and publishes at the end', async () => {
      const { catalog } = renderWizard();

      // 1 · what the service is. The draft is born here: a POST with what is known, no price and the default duration yet.
      await fillFirstStep();
      expect(screen.getByRole('heading', { level: 2, name: 'Cosa offri?' })).toBeInTheDocument();
      type('service-summary', 'La casa pronta per il prossimo ospite.');
      fireEvent.change(screen.getByTestId('service-included'), { target: { value: 'Pulizia completa\nCambio biancheria' } });
      next();
      await stepTitle('Quanto costa?');
      expect(catalog.create).toHaveBeenCalledTimes(1);
      expect(catalog.create).toHaveBeenCalledWith({
        name: 'Pulizia cambio ospiti',
        category: 'cleaning',
        summary: 'La casa pronta per il prossimo ospite.',
        description: null,
        priceFromCents: null,
        priceUnit: 'PerJob',
        pricesIncludeVat: false,
        requiresQuote: false,
        durationMinutes: 120,
        minNoticeHours: null,
        weekdays: WEEK,
        supplements: [],
        included: ['Pulizia completa', 'Cambio biancheria'],
        excluded: [],
      });
      // The address is the one of the draft from then on: a reload gives it back.
      await waitFor(() => expect(addressNow(screen)).toBe(`${PATH}?step=price&bozza=new-1`));
      expect(screen.getByTestId('service-wizard-saved')).toHaveTextContent('Bozza salvata alle');

      // 2 · the price: a fixed one per set, VAT declared, one supplement of her own.
      type('service-amount', '45,50');
      fireEvent.change(screen.getByTestId('service-unit'), { target: { value: 'PerSet' } });
      fireEvent.click(within(screen.getByTestId('service-vat')).getByRole('switch'));
      fireEvent.click(screen.getByTestId('service-supplement-add'));
      fireEvent.change(screen.getByLabelText('Supplemento 1'), { target: { value: 'Bagno in più' } });
      fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '10' } });
      fireEvent.change(screen.getByLabelText('Quando si aggiunge'), { target: { value: 'bathroom' } });
      fireEvent.change(screen.getByLabelText('Massimo'), { target: { value: '3' } });
      next();
      await stepTitle('Quanto dura e quando lo offri?');
      expect(catalog.create).toHaveBeenCalledTimes(1);
      expect(catalog.update).toHaveBeenLastCalledWith(
        'new-1',
        expect.objectContaining({
          version: 1,
          priceFromCents: 4550,
          priceUnit: 'PerSet',
          requiresQuote: false,
          pricesIncludeVat: true,
          supplements: [{ code: 'bagno-in-piu', label: 'Bagno in più', amountCents: 1000, per: 'bathroom', max: 3 }],
        }),
      );

      // 3 · how long, which days, how much notice: Monday to Friday, a day of notice.
      fireEvent.click(screen.getByTestId('service-weekday-Saturday'));
      fireEvent.click(screen.getByTestId('service-weekday-Sunday'));
      fireEvent.change(screen.getByTestId('service-duration'), { target: { value: '90' } });
      fireEvent.change(screen.getByTestId('service-notice'), { target: { value: '24' } });
      next();
      await stepTitle('Come lo vedranno i clienti?');
      expect(catalog.update).toHaveBeenLastCalledWith(
        'new-1',
        expect.objectContaining({ version: 2, durationMinutes: 90, minNoticeHours: 24, weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }),
      );

      // 4 · the photos go up as they are chosen; the last button saves the form and publishes.
      fireEvent.change(screen.getByTestId('service-photos-input'), { target: { files: [png('cucina.png'), png('bagno.png')] } });
      await waitFor(() => expect(screen.getAllByTestId('photo-list-item')).toHaveLength(2));
      expect(catalog.upload).toHaveBeenCalledWith('new-1', expect.any(Array));
      expect(screen.getByTestId('service-preview-card').querySelector('img')).toHaveAttribute('src', 'https://cdn.example/new-1/cucina.png');
      expect(screen.getByTestId('service-wizard-finish')).toHaveTextContent('Pubblica il servizio');
      finish();

      expect(await screen.findByRole('heading', { level: 2, name: 'Il servizio è pubblicato' })).toBeInTheDocument();
      expect(catalog.update).toHaveBeenLastCalledWith('new-1', expect.objectContaining({ version: 4 }));
      expect(catalog.publish).toHaveBeenCalledWith('new-1');
      expect(catalog.items()[0]).toMatchObject({ status: 'Active', photoUrls: ['https://cdn.example/new-1/cucina.png', 'https://cdn.example/new-1/bagno.png'] });
      expect(screen.getByText('Pulizia cambio ospiti')).toBeInTheDocument();
      expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `${LIST}/new-1`);
      expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', LIST);
      expect(screen.getByText('Lo trovi in Servizi e prezzi: lo cambi quando vuoi.')).toBeInTheDocument();
    });

    it('saves a draft instead of publishing when asked, and says it stays hidden', async () => {
      const { catalog } = renderWizard();
      await reachPhotos(catalog);

      const publishNow = within(screen.getByTestId('service-publish-now')).getByRole('switch', { name: 'Pubblica subito' });
      expect(publishNow).toBeChecked();
      fireEvent.click(publishNow);
      expect(screen.getByTestId('service-wizard-finish')).toHaveTextContent('Salva come bozza');
      finish();

      expect(await screen.findByRole('heading', { level: 2, name: 'Il servizio è salvato come bozza' })).toBeInTheDocument();
      expect(catalog.publish).not.toHaveBeenCalled();
      expect(catalog.items()[0]?.status).toBe('Draft');
      expect(screen.getByText('Resta una bozza: la vedi solo tu.')).toBeInTheDocument();
    });

    it('goes back without losing what was typed, and saves again instead of creating a second draft', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep('Pulizia a fondo');
      next();
      await stepTitle('Quanto costa?');

      fireEvent.click(screen.getByTestId('service-wizard-back'));
      await stepTitle('Cosa offri?');
      expect(screen.getByTestId('service-name')).toHaveValue('Pulizia a fondo');
      type('service-name', 'Pulizia a fondo e igienizzazione');
      next();
      await stepTitle('Quanto costa?');

      expect(catalog.create).toHaveBeenCalledTimes(1);
      expect(catalog.update).toHaveBeenCalledWith('new-1', expect.objectContaining({ name: 'Pulizia a fondo e igienizzazione', version: 1 }));
      expect(catalog.items()).toHaveLength(1);
    });

    it('saves a step reached from a half-typed one without being refused: what is not finished is not sent, and stays on the screen', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');
      // The price step is left with a supplement that has nothing in it and a price of 0 ("Back" does not check the step).
      fireEvent.click(screen.getByTestId('service-supplement-add'));
      type('service-amount', '0');
      fireEvent.click(screen.getByTestId('service-wizard-back'));
      await stepTitle('Cosa offri?');

      next();

      await stepTitle('Quanto costa?');
      expect(screen.queryByTestId('service-wizard-error')).not.toBeInTheDocument();
      expect(catalog.update).toHaveBeenLastCalledWith('new-1', expect.objectContaining({ priceFromCents: null, supplements: [] }));
      expect(screen.getAllByTestId('service-supplement')).toHaveLength(1);
      expect(screen.getByTestId('service-amount')).toHaveValue('0');
    });

    it('leaves from the first step to the list, before anything is saved', async () => {
      const { catalog } = renderWizard();
      await screen.findByRole('option', { name: 'Pulizie' });

      fireEvent.click(screen.getByTestId('service-wizard-exit'));

      await waitFor(() => expect(addressNow(screen)).toBe(LIST));
      expect(catalog.create).not.toHaveBeenCalled();
    });
  });

  describe('what each step asks', () => {
    it('does not go on from the first step without a name and a category, and says which', async () => {
      const { catalog } = renderWizard();
      await screen.findByRole('option', { name: 'Pulizie' });

      next();

      expect(await shownMessage('Scrivi come si chiama il servizio.')).toBe(true);
      expect(await shownMessage('Scegli una categoria.')).toBe(true);
      expect(screen.getByTestId('wizard-error-summary')).toHaveTextContent('Ci sono 2 campi da controllare');
      expect(screen.getByTestId('service-name')).toHaveAttribute('aria-invalid', 'true');
      expect(catalog.create).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { level: 2, name: 'Cosa offri?' })).toBeInTheDocument();
    });

    it('counts the letters of the name and the line, and stops at the limits of the API', async () => {
      renderWizard();
      await screen.findByRole('option', { name: 'Pulizie' });

      type('service-name', 'Pulizia');
      expect(screen.getByText('7/60')).toBeInTheDocument();
      expect(screen.getByTestId('service-name')).toHaveAttribute('maxlength', '60');
      expect(screen.getByTestId('service-summary')).toHaveAttribute('maxlength', '200');
      expect(screen.getByTestId('service-description')).toHaveAttribute('maxlength', '2000');
    });

    it('asks for an amount unless the service is on quote, and tells an amount that is not one', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');

      next();
      expect(await shownMessage('Scrivi un importo, oppure scegli «Su preventivo».')).toBe(true);
      expect(catalog.update).not.toHaveBeenCalled();

      type('service-amount', 'abc');
      expect(await shownMessage('Scrivi l’importo in euro, per esempio 45 o 45,50.')).toBe(true);
      type('service-amount', '0');
      expect(await shownMessage('L’importo deve essere almeno 0,01 € e al massimo 100.000 €.')).toBe(true);

      fireEvent.click(screen.getByTestId('service-price-mode-quote'));
      expect(screen.queryByTestId('service-amount')).not.toBeInTheDocument();
      expect(screen.getByTestId('service-quote-note')).toHaveTextContent('I clienti vedranno «Su preventivo».');
      next();
      await stepTitle('Quanto dura e quando lo offri?');
      expect(catalog.update).toHaveBeenCalledWith('new-1', expect.objectContaining({ requiresQuote: true, priceFromCents: null, priceUnit: 'PerJob' }));
    });

    it('prices by the hour with the unit already said, and keeps the supplements within their rules', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');

      fireEvent.click(screen.getByTestId('service-price-mode-hourly'));
      expect(screen.queryByTestId('service-unit')).not.toBeInTheDocument();
      expect(screen.getByText('Si paga all’ora')).toBeInTheDocument();
      type('service-amount', '18');
      fireEvent.click(screen.getByTestId('service-supplement-add'));
      next();

      expect(await shownMessage('Scrivi il nome del supplemento.')).toBe(true);
      expect(await shownMessage('Scrivi l’importo del supplemento.')).toBe(true);
      expect(catalog.update).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText('Supplemento 1'), { target: { value: 'Ora in più' } });
      fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '15' } });
      fireEvent.change(screen.getByLabelText('Quando si aggiunge'), { target: { value: 'hour' } });
      fireEvent.change(screen.getByLabelText('Massimo'), { target: { value: '100' } });
      expect(await shownMessage('Scrivi un numero da 1 a 99, oppure lascia vuoto.')).toBe(true);
      fireEvent.change(screen.getByLabelText('Massimo'), { target: { value: '4' } });
      next();

      await stepTitle('Quanto dura e quando lo offri?');
      expect(catalog.update).toHaveBeenCalledWith(
        'new-1',
        expect.objectContaining({ priceUnit: 'PerHour', priceFromCents: 1800, supplements: [{ code: 'ora-in-piu', label: 'Ora in più', amountCents: 1500, per: 'hour', max: 4 }] }),
      );
    });

    it('lets a supplement be removed, takes the quantity away from a flat one, and stops at ten', async () => {
      renderWizard();
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');

      for (let i = 0; i < 10; i++) fireEvent.click(screen.getByTestId('service-supplement-add'));
      expect(screen.getAllByTestId('service-supplement')).toHaveLength(10);
      expect(screen.getByTestId('service-supplement-add')).toBeDisabled();

      // A flat amount is added once: there is no quantity to limit, so there is no field for it.
      expect(screen.queryByLabelText('Massimo')).not.toBeInTheDocument();
      fireEvent.change(screen.getAllByLabelText('Quando si aggiunge')[0]!, { target: { value: 'set' } });
      expect(screen.getAllByLabelText('Massimo')).toHaveLength(1);

      fireEvent.click(screen.getAllByTestId('service-supplement-remove')[0]!);
      expect(screen.getAllByTestId('service-supplement')).toHaveLength(9);
      expect(screen.getByTestId('service-supplement-add')).toBeEnabled();
    });

    it('asks for at least one day, keeps the duration among the choices, and offers the notice in days', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');
      type('service-amount', '45');
      next();
      await stepTitle('Quanto dura e quando lo offri?');

      for (const day of WEEK) fireEvent.click(screen.getByTestId(`service-weekday-${day}`));
      next();
      expect(await shownMessage('Scegli almeno un giorno.')).toBe(true);
      expect(catalog.update).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('service-weekday-Monday'));
      expect(screen.getByTestId('service-weekday-Monday')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('service-weekday-Tuesday')).toHaveAttribute('aria-pressed', 'false');
      const notice = within(screen.getByTestId('service-notice'));
      expect(notice.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Quello delle regole di disponibilità',
        'Nessun preavviso',
        '2 ore',
        '4 ore',
        '12 ore',
        '1 giorno',
        '2 giorni',
        '3 giorni',
        '7 giorni',
      ]);
      expect(screen.getByTestId('service-confirmation-note')).toHaveTextContent('Ogni prenotazione arriva come richiesta e la confermi tu.');
      // No "immediate booking" and no deposit: every booking is confirmed by the supplier (SP-D4, SP-D5).
      expect(screen.queryByText(/immediata|acconto/i)).not.toBeInTheDocument();
    });
  });

  describe('what the API answers', () => {
    it('shows a refusal of the data in words, marks the field, and stays on the step until it is fixed', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');
      type('service-amount', '45');
      catalog.update.mockRejectedValueOnce(problem(422, { code: 'supplier_service_invalid', fields: ['priceFromCents'], detail: 'Alcuni dati del servizio non sono validi (campi: priceFromCents).' }));

      next();

      const alert = await screen.findByTestId('service-wizard-error');
      expect(alert).toHaveTextContent('Controlla questi dati: Prezzo.');
      expect(alert).not.toHaveTextContent('priceFromCents');
      expect(screen.getByText('Controlla questo valore.')).toBeInTheDocument();
      expect(screen.getByTestId('service-amount')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('heading', { level: 2, name: 'Quanto costa?' })).toBeInTheDocument();

      next();
      await stepTitle('Quanto dura e quando lo offri?');
    });

    it('tells it, and does not overwrite, when the service was changed elsewhere meanwhile; the next try takes the version it now has', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');
      type('service-amount', '45');
      catalog.touch('new-1', { name: 'Cambiato da un altro' });

      next();

      expect(await screen.findByTestId('service-wizard-error')).toHaveTextContent(
        'Questa bozza è stata modificata altrove. Se continui, quello che vedi qui prende il posto della versione salvata.',
      );
      expect(catalog.items()[0]?.name).toBe('Cambiato da un altro');
      expect(screen.getByRole('heading', { level: 2, name: 'Quanto costa?' })).toBeInTheDocument();

      // Not a dead end: the version of the draft was read again, so going on saves what is on the screen over the other one.
      next();
      await stepTitle('Quanto dura e quando lo offri?');
      expect(catalog.items()[0]?.name).toBe('Pulizia cambio ospiti');
    });

    it('says the draft is not there any more when it was deleted meanwhile', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');
      type('service-amount', '45');
      await catalog.remove('new-1');

      next();

      expect(await screen.findByTestId('service-wizard-error')).toHaveTextContent('Non troviamo più questo servizio: forse è stato eliminato.');
    });

    it('says the maximum of services has been reached when the first save is refused for it', async () => {
      const { catalog } = renderWizard();
      await fillFirstStep();
      catalog.create.mockRejectedValueOnce(problem(422, { code: 'supplier_service_limit_reached', detail: 'Puoi avere al massimo 30 servizi.' }));

      next();

      expect(await screen.findByTestId('service-wizard-error')).toHaveTextContent('Hai già 30 servizi, che è il massimo.');
      expect(screen.getByRole('heading', { level: 2, name: 'Cosa offri?' })).toBeInTheDocument();
    });

    it('keeps the draft saved when publishing is refused, says what is missing, and tries again from the last step', async () => {
      const { catalog } = renderWizard();
      await reachPhotos(catalog);
      catalog.publish.mockRejectedValueOnce(problem(422, { code: 'supplier_service_not_publishable', fields: ['priceFromCents'], detail: 'Manca: priceFromCents.' }));

      finish();

      expect(await screen.findByTestId('service-wizard-error')).toHaveTextContent('Per pubblicare servono ancora: Prezzo.');
      expect(screen.queryByRole('heading', { level: 2, name: 'Il servizio è pubblicato' })).not.toBeInTheDocument();
      expect(catalog.items()[0]?.status).toBe('Draft');

      finish();

      expect(await screen.findByRole('heading', { level: 2, name: 'Il servizio è pubblicato' })).toBeInTheDocument();
      expect(catalog.items()[0]?.status).toBe('Active');
    });
  });

  describe('the photos of the last step', () => {
    it('refuses what is not a photo, too large, or too many, before sending anything', async () => {
      const { catalog } = renderWizard();
      await reachPhotos(catalog);
      const input = screen.getByTestId('service-photos-input');

      fireEvent.change(input, { target: { files: [new File(['x'], 'gatto.gif', { type: 'image/gif' })] } });
      expect(await screen.findByTestId('service-photos-error')).toHaveTextContent('«gatto.gif» non è una foto valida: usa immagini JPEG, PNG o WebP.');

      const huge = png('enorme.png');
      Object.defineProperty(huge, 'size', { value: 11 * 1024 * 1024 });
      fireEvent.change(input, { target: { files: [huge] } });
      expect(await screen.findByTestId('service-photos-error')).toHaveTextContent('«enorme.png» è vuota o troppo grande: al massimo 10 MB.');

      fireEvent.change(input, { target: { files: Array.from({ length: 7 }, (_, i) => png(`${i}.png`)) } });
      expect(await screen.findByTestId('service-photos-error')).toHaveTextContent('Puoi aggiungere ancora 6 foto: ne hai scelte 7.');
      expect(catalog.upload).not.toHaveBeenCalled();
    });

    it('shows the answer of the API when the upload is refused, and keeps the photos it has', async () => {
      const { catalog } = renderWizard();
      await reachPhotos(catalog);
      catalog.upload.mockRejectedValueOnce(problem(422, { code: 'supplier_service_photo_invalid_type', detail: 'Il file "x.png" non è una foto valida: sono ammesse solo immagini JPEG, PNG o WebP.' }));

      fireEvent.change(screen.getByTestId('service-photos-input'), { target: { files: [png('x.png')] } });

      expect(await screen.findByTestId('service-photos-error')).toHaveTextContent('Il file "x.png" non è una foto valida');
      expect(screen.queryByTestId('photo-list-item')).not.toBeInTheDocument();
    });

    it('moves a photo with the buttons, saving the order on the service as the server has it, and asks before removing', async () => {
      const { catalog } = renderWizard();
      await reachPhotos(catalog);
      fireEvent.change(screen.getByTestId('service-photos-input'), { target: { files: [png('uno.png'), png('due.png'), png('tre.png')] } });
      await waitFor(() => expect(screen.getAllByTestId('photo-list-item')).toHaveLength(3));
      const names = () => screen.getAllByRole('img').filter((img) => img.getAttribute('alt')?.startsWith('Foto ')).map((img) => img.getAttribute('src')?.split('/').pop());
      expect(names()).toEqual(['uno.png', 'due.png', 'tre.png']);

      fireEvent.click(screen.getByRole('button', { name: 'Sposta la foto 1 dopo' }));

      await waitFor(() => expect(names()).toEqual(['due.png', 'uno.png', 'tre.png']));
      // What is typed in the form and not yet saved is not saved by a photo: the body is the service as the server has it.
      expect(catalog.update).toHaveBeenLastCalledWith(
        'new-1',
        expect.objectContaining({ photoUrls: ['https://cdn.example/new-1/due.png', 'https://cdn.example/new-1/uno.png', 'https://cdn.example/new-1/tre.png'], version: 4 }),
      );
      expect(screen.getByTestId('photo-list-cover')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Togli la foto 2' }));
      const dialog = await screen.findByRole('dialog', { name: 'Togliere questa foto?' });
      expect(catalog.items()[0]?.photoUrls).toHaveLength(3);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Togli la foto' }));

      await waitFor(() => expect(names()).toEqual(['due.png', 'tre.png']));
      expect(catalog.items()[0]?.photoUrls).toEqual(['https://cdn.example/new-1/due.png', 'https://cdn.example/new-1/tre.png']);
      // The button that opened the dialog went with its photo: the focus is on the "remove" button of the photo that took its place.
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Togli la foto 2' })));
      // Confirming the removal is not the last button of the wizard: nothing was published, and the step is still this one.
      expect(catalog.publish).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { level: 2, name: 'Come lo vedranno i clienti?' })).toBeInTheDocument();
    });
  });

  describe('a draft that is reopened', () => {
    const DRAFT = makeDraft({ id: 'd1', name: 'Ripasso pre-arrivo', category: 'cleaning', priceFromCents: 3000, priceUnit: 'PerSquareMeter', durationMinutes: 60, version: 5 });

    it('opens on the first step with what the server has, and saves it with PUT and never with another POST', async () => {
      const { catalog } = renderWizard('?bozza=d1', createFakeCatalog([DRAFT]));

      await screen.findByRole('option', { name: 'Pulizie' });
      expect(screen.getByTestId('service-name')).toHaveValue('Ripasso pre-arrivo');
      expect(screen.getByTestId('service-category')).toHaveValue('cleaning');
      next();
      await stepTitle('Quanto costa?');

      expect(screen.getByTestId('service-amount')).toHaveValue('30');
      expect(screen.getByTestId('service-unit')).toHaveValue('PerSquareMeter');
      expect(catalog.create).not.toHaveBeenCalled();
      expect(catalog.update).toHaveBeenCalledWith('d1', expect.objectContaining({ version: 5, name: 'Ripasso pre-arrivo' }));
      expect(addressNow(screen)).toBe(`${PATH}?bozza=d1&step=price`);
    });

    it('opens on the step of the address, and shows the "saved at" line from the start', async () => {
      renderWizard('?bozza=d1&step=booking', createFakeCatalog([DRAFT]));

      await stepTitle('Quanto dura e quando lo offri?');
      expect(screen.getByTestId('service-duration')).toHaveValue('60');
      expect(screen.getByTestId('service-wizard-saved')).toHaveTextContent('Bozza salvata alle 10:30');
    });

    it('says it when the draft does not exist (any more), with the way to begin a new one', async () => {
      renderWizard('?bozza=sparita');

      const error = await screen.findByTestId('service-wizard-draft-error');
      expect(error).toHaveTextContent('Non riusciamo ad aprire la bozza');
      expect(error).toHaveTextContent('Non troviamo più questo servizio: forse è stato eliminato.');
      expect(within(error).getByRole('link', { name: 'Comincia un nuovo servizio' })).toHaveAttribute('href', PATH);
      expect(within(error).getByRole('link', { name: 'Torna ai servizi' })).toHaveAttribute('href', LIST);

      // The page stays where it is when only its address changes: the way to begin anew has to begin, not show the same error.
      fireEvent.click(within(error).getByRole('link', { name: 'Comincia un nuovo servizio' }));
      expect(await screen.findByTestId('service-name')).toBeInTheDocument();
      expect(screen.queryByTestId('service-wizard-draft-error')).not.toBeInTheDocument();
      expect(addressNow(screen)).toBe(PATH);
    });

    it('shows the confirmation after publishing a draft that was reopened: the page of the service does not take its place', async () => {
      const { catalog } = renderWizard('?bozza=d1', createFakeCatalog([DRAFT]));
      await screen.findByRole('option', { name: 'Pulizie' });
      next();
      await stepTitle('Quanto costa?');
      next();
      await stepTitle('Quanto dura e quando lo offri?');
      next();
      await stepTitle('Come lo vedranno i clienti?');

      finish();

      expect(await screen.findByRole('heading', { level: 2, name: 'Il servizio è pubblicato' })).toBeInTheDocument();
      expect(catalog.items()[0]?.status).toBe('Active');
      expect(addressNow(screen)).not.toContain(`${LIST}/d1`);
    });

    it('sends to the page of a service that is already on offer: it is not a draft', async () => {
      renderWizard('?bozza=live', createFakeCatalog([makeService({ id: 'live' })]));

      await waitFor(() => expect(addressNow(screen)).toBe(`${LIST}/live`));
    });

    it('sends back to the start a link to a step of a service that was never started, and lets the person go on from there', async () => {
      const { catalog } = renderWizard('?step=booking');

      await screen.findByRole('option', { name: 'Pulizie' });
      expect(screen.getByRole('heading', { level: 2, name: 'Cosa offri?' })).toBeInTheDocument();
      expect(addressNow(screen)).toBe(PATH);

      // The wizard writes the step in the address before the one of the draft: that is not a stale link again, and must not take the form away.
      await fillFirstStep();
      next();
      await stepTitle('Quanto costa?');
      expect(catalog.create).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('service-name')).not.toBeInTheDocument();
    });

    it('does not keep the confirmation: a reload of it goes to the list', async () => {
      renderWizard('?step=fatto');

      await waitFor(() => expect(addressNow(screen)).toBe(LIST));
    });
  });

  describe('a copy of a service', () => {
    it('makes the copy once and opens its draft with the name of the copy', async () => {
      const { catalog } = renderWizard('?duplica=a', createFakeCatalog([makeService({ id: 'a', name: 'Pulizia cambio ospiti', priceFromCents: 4500 })]));

      await waitFor(() => expect(addressNow(screen)).toBe(`${PATH}?bozza=copy-1`));
      await screen.findByRole('option', { name: 'Pulizie' });
      expect(screen.getByTestId('service-name')).toHaveValue('Pulizia cambio ospiti (copia)');
      expect(catalog.duplicate).toHaveBeenCalledTimes(1);
      expect(catalog.duplicate).toHaveBeenCalledWith('a');
      expect(catalog.items()).toHaveLength(2);
    });

    it('makes the copy once and goes on even when the page runs its effects twice, as it does in development', async () => {
      const { catalog } = renderWizard('?duplica=a', createFakeCatalog([makeService({ id: 'a' })]), { strict: true });

      await waitFor(() => expect(addressNow(screen)).toBe(`${PATH}?bozza=copy-1`));
      expect(catalog.duplicate).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Preparo la copia…')).not.toBeInTheDocument();
    });

    it('says the maximum has been reached when there is no room for a copy', async () => {
      renderWizard('?duplica=a', createFakeCatalog([makeService({ id: 'a' })], 1));

      const error = await screen.findByTestId('service-wizard-duplicate-error');
      expect(error).toHaveTextContent('Hai già 30 servizi, che è il massimo.');
      expect(within(error).getByRole('link', { name: 'Torna ai servizi' })).toHaveAttribute('href', LIST);
    });
  });

  describe('the limit of services', () => {
    it('does not start a creation that cannot end: says so and goes back to the list', async () => {
      renderWizard('', createFakeCatalog([makeService({ id: 'a' }), makeService({ id: 'b', name: 'B', slug: 'b' })], 2));

      const limit = await screen.findByTestId('service-wizard-limit');
      expect(limit).toHaveTextContent('Non puoi aggiungere altri servizi');
      expect(within(limit).getByRole('link', { name: 'Torna ai servizi' })).toHaveAttribute('href', LIST);
      expect(screen.queryByTestId('service-name')).not.toBeInTheDocument();
    });

    it('does not take the wizard away when the draft it creates is the last service there is room for', async () => {
      const { catalog } = renderWizard('', createFakeCatalog([makeService({ id: 'a' })], 2));
      await fillFirstStep();

      next();
      await stepTitle('Quanto costa?');

      // The list now holds 2 of 2: the creation goes on, it does not turn into the message of the limit.
      await waitFor(() => expect(catalog.fetchList.mock.calls.length).toBeGreaterThan(1));
      expect(screen.queryByTestId('service-wizard-limit')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: 'Quanto costa?' })).toBeInTheDocument();
    });

    it('still reopens a draft when the supplier has the most services it can have', async () => {
      renderWizard('?bozza=d1', createFakeCatalog([makeDraft({ id: 'd1' }), makeService({ id: 'b', name: 'B', slug: 'b' })], 2));

      expect(await screen.findByTestId('service-name')).toHaveValue('Ripasso pre-arrivo');
    });
  });

  describe('English and accessibility', () => {
    it('is in English when the language is', async () => {
      await i18n.changeLanguage('en');
      renderWizard();

      expect(await screen.findByRole('heading', { level: 2, name: 'What do you offer?' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Add a service' })).toBeInTheDocument();
      expect(screen.getByLabelText('What is it called?')).toBeInTheDocument();
    });

    it('keeps the screens free of what axe can find without a browser: the first step, the price, the last and the confirmation', async () => {
      const { catalog, container } = renderWizard();
      await fillFirstStep();
      await expectNoAxeViolations(container);
      next();
      await stepTitle('Quanto costa?');
      fireEvent.click(screen.getByTestId('service-supplement-add'));
      await expectNoAxeViolations(container);
      type('service-amount', '45');
      fireEvent.change(screen.getByLabelText('Supplemento 1'), { target: { value: 'Bagno in più' } });
      fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '10' } });
      next();
      await stepTitle('Quanto dura e quando lo offri?');
      await expectNoAxeViolations(container);
      next();
      await stepTitle('Come lo vedranno i clienti?');
      fireEvent.change(screen.getByTestId('service-photos-input'), { target: { files: [png('uno.png')] } });
      await waitFor(() => expect(screen.getAllByTestId('photo-list-item')).toHaveLength(1));
      await expectNoAxeViolations(container);
      finish();
      await screen.findByRole('heading', { level: 2, name: 'Il servizio è pubblicato' });
      await expectNoAxeViolations(container);
      expect(catalog.items()).toHaveLength(1);
    });
  });
});
