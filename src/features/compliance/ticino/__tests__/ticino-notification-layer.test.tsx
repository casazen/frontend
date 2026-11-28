import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { swissComplianceApi } from '@/api/swissCompliance.api';
import i18n from '@/i18n/config';
import { saveBlobAs } from '@/lib/file-download';
import type { TicinoNotificationDay } from '@/types/swissCompliance.types';
import { TicinoLayerContent } from '../ticino-notification-layer';

vi.mock('@/api/swissCompliance.api', () => ({
  swissComplianceApi: {
    getTicinoDay: vi.fn(),
    downloadTicinoFile: vi.fn(),
    downloadGroupSheet: vi.fn(),
    declareTicinoDay: vi.fn(),
    undeclareTicinoDay: vi.fn(),
    uploadReceipt: vi.fn(),
  },
}));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getGuestSummary: vi.fn() } }));
vi.mock('@/features/alloggiati/components/stay-guests-edit-dialog', () => ({
  StayGuestsEditDialog: ({ bookingId, onOpenChange }: { bookingId: string; onOpenChange: (open: boolean) => void }) => (
    <div data-testid="stay-guests-edit-dialog">
      {bookingId}
      <button type="button" onClick={() => onOpenChange(false)}>
        chiudi-ospiti
      </button>
    </div>
  ),
}));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }) }));
vi.mock('@/queries/use-properties', () => ({
  PROPERTIES_KEY: 'properties',
  useProperty: () => ({ data: { name: 'Casa Lugano' } }),
  useUpdateProperty: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const permissions = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (contextKey: string, permission: string) => contextKey === 'short-rent' && permissions.granted.includes(permission),
  }),
}));

const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER_BOOKING_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const DAY = '2026-11-19';
const OTHER_DAY = '2026-11-18';
const REFERENCE = `TI-${PROPERTY_ID.replaceAll('-', '')}-20261119`;
const EVERYTHING = ['guest.read', 'alloggiati.submit', 'booking.write', 'property.write'];

function dayOf(overrides: Partial<TicinoNotificationDay> = {}): TicinoNotificationDay {
  return {
    propertyId: PROPERTY_ID,
    day: DAY,
    structureId: 'NL-12345678',
    stayCount: 1,
    rows: [{ bookingId: BOOKING_ID, guestName: 'Mario Rossi', personsOver14: 0, personsUnder14: 1, kind: 'guest', groupSize: 0 }],
    issues: [],
    xmlAvailable: true,
    receiptCount: 0,
    dueAt: '2026-11-20T14:00:00Z',
    reference: REFERENCE,
    portalUrl: 'https://www.notifiche.ti.ch',
    pendingDays: [{ day: DAY, stayCount: 1, dueAt: '2026-11-20T14:00:00Z' }],
    warnings: [],
    csvCharset: 'windows-1252',
    transliteratedCount: 0,
    declaredAt: null,
    declaredBy: null,
    fileGeneratedAt: null,
    fileGeneratedCount: 0,
    alreadyDeclared: false,
    ...overrides,
  };
}

const declaredDay = (overrides: Partial<TicinoNotificationDay> = {}) =>
  dayOf({ declaredAt: '2026-11-19T14:20:00Z', declaredBy: 'Luca Bianchi', alreadyDeclared: true, fileGeneratedCount: 1, fileGeneratedAt: '2026-11-19T14:00:00Z', ...overrides });

function apiError(status: number, code?: string) {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('failed', String(status), config, undefined, { status, statusText: '', headers: {}, config, data: code ? { code } : {} });
}

function renderLayer(id = `${PROPERTY_ID}:${DAY}`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const close = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TicinoLayerContent id={id} close={close} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, close, ...view };
}

const stepOf = (step: string) => screen.getByTestId(`ticino-step-${step}`);
const isOpen = (step: string) => stepOf(step).getAttribute('data-open') === 'true';
/** Opens a step the way a person does: by its line, unless it is open already (pressing the open one closes it). */
function openStep(step: string) {
  if (!isOpen(step)) fireEvent.click(screen.getByTestId(`ticino-step-${step}-toggle`));
}

beforeEach(async () => {
  vi.clearAllMocks();
  // Only the clock is held still (the instant the day is read at): the timers stay real, so that React and the queries settle by themselves.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-19T20:30:00Z'));
  permissions.granted = [...EVERYTHING];
  await i18n.changeLanguage('it');
  vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf());
  vi.mocked(swissComplianceApi.downloadTicinoFile).mockResolvedValue(new Blob(['csv']));
  vi.mocked(swissComplianceApi.downloadGroupSheet).mockResolvedValue({ blob: new Blob(['sheet']), contentDisposition: null });
  vi.mocked(swissComplianceApi.declareTicinoDay).mockResolvedValue({
    propertyId: PROPERTY_ID,
    arrivalDay: DAY,
    declaredAt: '2026-11-19T20:30:00Z',
    declaredBy: 'Luca Bianchi',
    receiptId: null,
    created: true,
  });
  vi.mocked(swissComplianceApi.undeclareTicinoDay).mockResolvedValue(undefined);
  vi.mocked(swissComplianceApi.uploadReceipt).mockResolvedValue({
    id: 'receipt-1',
    propertyId: PROPERTY_ID,
    type: 'Police',
    reportDate: DAY,
    reference: REFERENCE,
    fileHash: 'hash',
    uploadedAt: '2026-11-19T20:30:00Z',
  });
  vi.mocked(alloggiatiApi.getGuestSummary).mockResolvedValue({ guests: [], missingCodeTables: [], arrivalDate: DAY } as never);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TicinoNotificationLayer (E30/F02/US03/T02)', () => {
  describe('the day and where it opens', () => {
    it('TicinoLayer_DayToNotify_OpensOnTheFileStepAndSaysWhenItIsDue', async () => {
      renderLayer();

      expect(await screen.findByTestId('ticino-layer')).toBeInTheDocument();
      expect(screen.getByTestId('ticino-day-title')).toHaveTextContent('Arrivi di giovedì 19 novembre');
      expect(screen.getByTestId('ticino-day-state')).toHaveTextContent(/Da notificare entro venerdì 20 novembre.*15:00/);
      expect(isOpen('file')).toBe(true);
      expect(stepOf('guests')).toHaveAttribute('data-state', 'done');
      expect(stepOf('file')).toHaveAttribute('data-state', 'todo');
      expect(stepOf('receipt')).toHaveAttribute('data-state', 'optional');
      expect(within(screen.getByTestId('ticino-steps')).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
        expect.stringContaining('Ospiti da notificare'),
        expect.stringContaining('Scarica il file'),
        expect.stringContaining('Carica sul portale'),
        expect.stringContaining('Ho caricato il file'),
        expect.stringContaining('Aggiungi la ricevuta'),
      ]);
      expect(swissComplianceApi.getTicinoDay).toHaveBeenCalledWith(PROPERTY_ID, DAY);
    });

    it('TicinoLayer_NoDayInTheAddress_AsksTheFirstDayToNotifyAndOpensOnThatOne', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ day: OTHER_DAY }));
      renderLayer(PROPERTY_ID);

      expect(await screen.findByTestId('ticino-day-title')).toHaveTextContent('Arrivi di mercoledì 18 novembre');
      expect(swissComplianceApi.getTicinoDay).toHaveBeenCalledWith(PROPERTY_ID, undefined);
    });

    it('TicinoLayer_TheFileIsWritten_OpensOnTheDeclarationBecauseThePersonIsBackFromThePortal', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ fileGeneratedCount: 1, fileGeneratedAt: '2026-11-19T20:00:00Z' }));
      renderLayer();

      await screen.findByTestId('ticino-layer');
      expect(isOpen('declare')).toBe(true);
      expect(stepOf('file')).toHaveAttribute('data-state', 'done');
    });

    it('TicinoLayer_GuestsMissDataOrNobodyIsReady_OpensOnTheGuestsStepWithAttention', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(
        dayOf({ issues: [{ bookingId: OTHER_BOOKING_ID, position: 1, guestName: 'Anna Verdi', missing: ['birthDate', 'documentType'] }] }),
      );
      renderLayer();

      await screen.findByTestId('ticino-layer');
      expect(isOpen('guests')).toBe(true);
      expect(stepOf('guests')).toHaveAttribute('data-state', 'attention');
      expect(screen.getByTestId('ticino-issues')).toHaveTextContent('Anna Verdi: data di nascita, tipo di documento');
    });

    it('TicinoLayer_ADayWithNoArrival_SaysSoAndShowsNoStep', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ stayCount: 0, rows: [] }));
      renderLayer();

      expect(await screen.findByTestId('ticino-day-state')).toHaveTextContent('Nessun arrivo in questo giorno.');
      expect(screen.queryByTestId('ticino-steps')).not.toBeInTheDocument();
    });

    it('TicinoLayer_ThePassedDeadline_SaysTheTermIsOver', async () => {
      vi.setSystemTime(new Date('2026-11-21T09:00:00Z'));
      renderLayer();

      expect(await screen.findByTestId('ticino-day-state')).toHaveTextContent(/Le 24 ore per notificare questo giorno sono passate/);
    });

    it('TicinoLayer_ADeclaredDay_SaysWhoUploadedItAndWhen_OnTheDayAndOnTheStep', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay());
      renderLayer();

      expect(await screen.findByTestId('ticino-day-state')).toHaveTextContent(/Già caricato il 19 novembre.*15:20 da Luca Bianchi\./);
      expect(isOpen('receipt')).toBe(true);
      for (const step of ['guests', 'file', 'portal', 'declare']) expect(stepOf(step)).toHaveAttribute('data-state', 'done');
      openStep('declare');
      expect(screen.getByTestId('ticino-declared')).toHaveTextContent(/Già caricato il 19 novembre.*da Luca Bianchi/);
    });

    it('TicinoLayer_ADayClosedByTheReceiptAlone_SaysTheReceiptIsArchivedAndOffersNothingToDeclare', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ receiptCount: 1, alreadyDeclared: true }));
      renderLayer();

      expect(await screen.findByTestId('ticino-day-state')).toHaveTextContent('Ricevuta del portale archiviata: il giorno è notificato.');
      openStep('declare');
      expect(screen.getByTestId('ticino-declared')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-declare-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ticino-undeclare')).not.toBeInTheDocument();
    });

    it('TicinoLayer_OtherDaysToNotify_AreOneButtonEachAndLoadThatDay', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockImplementation(async (_property, date) =>
        date === OTHER_DAY
          ? dayOf({ day: OTHER_DAY })
          : dayOf({ pendingDays: [{ day: OTHER_DAY, stayCount: 1, dueAt: '2026-11-19T14:00:00Z' }, { day: DAY, stayCount: 1, dueAt: '2026-11-20T14:00:00Z' }] }),
      );
      renderLayer();

      const others = await screen.findByTestId('ticino-other-days');
      expect(within(others).getAllByTestId('ticino-pick-day')).toHaveLength(1);
      fireEvent.click(within(others).getByTestId('ticino-pick-day'));

      await waitFor(() => expect(screen.getByTestId('ticino-day-title')).toHaveTextContent('Arrivi di mercoledì 18 novembre'));
      expect(swissComplianceApi.getTicinoDay).toHaveBeenLastCalledWith(PROPERTY_ID, OTHER_DAY);
    });
  });

  describe('step 1: the guests', () => {
    const withIssue = () =>
      dayOf({ issues: [{ bookingId: OTHER_BOOKING_ID, position: 1, guestName: 'Anna Verdi', missing: ['birthDate'] }], rows: dayOf().rows });

    it('TicinoLayer_GuestsMissData_CompleteDataOpensTheFormOfTheGuestsInsideTheLayerAndTheDayIsReadAgainWhenItCloses', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(withIssue());
      renderLayer();

      fireEvent.click(await screen.findByTestId('ticino-complete-guest'));

      const dialog = await screen.findByTestId('stay-guests-edit-dialog');
      expect(dialog).toHaveTextContent(OTHER_BOOKING_ID);
      expect(alloggiatiApi.getGuestSummary).toHaveBeenCalledWith(OTHER_BOOKING_ID);
      expect(screen.getByTestId('ticino-layer')).toBeInTheDocument();
      const reads = vi.mocked(swissComplianceApi.getTicinoDay).mock.calls.length;

      fireEvent.click(within(dialog).getByText('chiudi-ospiti'));

      await waitFor(() => expect(screen.queryByTestId('stay-guests-edit-dialog')).not.toBeInTheDocument());
      await waitFor(() => expect(vi.mocked(swissComplianceApi.getTicinoDay).mock.calls.length).toBeGreaterThan(reads));
    });

    it('TicinoLayer_WhoMayNotWriteTheBookings_GetsALinkToTheBookingInsteadOfTheForm', async () => {
      permissions.granted = ['guest.read'];
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(withIssue());
      renderLayer();

      const link = await screen.findByRole('link', { name: 'Apri la prenotazione: Anna Verdi' });
      expect(link).toHaveAttribute('href', `/app/short-rent/bookings/${OTHER_BOOKING_ID}?tab=alloggiati`);
      expect(screen.queryByTestId('ticino-complete-guest')).not.toBeInTheDocument();
    });

    it('TicinoLayer_StaysWithAGroupAndMinorsWithoutAnAdult_ShowTheirNoticesAndTheLettersWrittenWithoutAccent', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(
        dayOf({
          rows: [{ bookingId: BOOKING_ID, guestName: 'Giulia Neri', personsOver14: 5, personsUnder14: 1, kind: 'group', groupSize: 7 }],
          warnings: [
            { bookingId: OTHER_BOOKING_ID, code: 'parental_authorization_needed' },
            { bookingId: BOOKING_ID, code: 'group_sheet_incomplete' },
            { bookingId: BOOKING_ID, code: 'something_from_the_future' },
          ],
          transliteratedCount: 2,
        }),
      );
      renderLayer();

      await screen.findByTestId('ticino-layer');
      openStep('guests');
      expect(screen.getByTestId('ticino-guests-ready')).toHaveTextContent('1 persona nel file');
      expect(screen.getByTestId('ticino-guests-ready')).not.toHaveTextContent('minor');
      expect(screen.getByTestId('ticino-guest-rows')).toHaveTextContent('Gruppo di 7 persone');
      expect(screen.getByTestId('ticino-warning-parental_authorization_needed')).toHaveTextContent(/autorizzazione scritta dei genitori/);
      expect(screen.getByTestId('ticino-warning-group_sheet_incomplete')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-warning-something_from_the_future')).not.toBeInTheDocument();
      expect(screen.getByTestId('ticino-transliterated')).toHaveTextContent('2 lettere dei nomi non hanno il loro accento nel file');
    });

    it('TicinoLayer_MinorsOnAParent_AreCountedInTheLineOfTheFile', async () => {
      renderLayer();

      await screen.findByTestId('ticino-layer');
      openStep('guests');
      expect(screen.getByTestId('ticino-guests-ready')).toHaveTextContent('1 persona nel file (più 1 minore conteggiato su un genitore)');
    });
  });

  describe('step 2: the file', () => {
    it('TicinoLayer_Download_AsksTheCsvOfTheDayWithoutConfirmationSavesItAndGoesToThePortal', async () => {
      renderLayer();

      fireEvent.click(await screen.findByTestId('ticino-download-csv'));

      await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'notifiche-ti-2026-11-19.csv'));
      expect(swissComplianceApi.downloadTicinoFile).toHaveBeenCalledWith(PROPERTY_ID, { reportDate: DAY, format: 'csv', confirmRegenerate: false });
      await waitFor(() => expect(isOpen('portal')).toBe(true));
    });

    it('TicinoLayer_TheXmlIsOfferedOnlyWhenTheDayFitsIt', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ xmlAvailable: false }));
      renderLayer();

      await screen.findByTestId('ticino-download-csv');
      expect(screen.queryByTestId('ticino-download-xml')).not.toBeInTheDocument();
    });

    it('TicinoLayer_Xml_AsksTheXmlFormat', async () => {
      renderLayer();

      fireEvent.click(await screen.findByTestId('ticino-download-xml'));

      await waitFor(() => expect(swissComplianceApi.downloadTicinoFile).toHaveBeenCalledWith(PROPERTY_ID, { reportDate: DAY, format: 'xml', confirmRegenerate: false }));
    });

    it('TicinoLayer_ADeclaredDay_AsksForConfirmationBeforeGeneratingTheFileAgain_AndSendsConfirmRegenerate', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay());
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('file');
      expect(screen.getByTestId('ticino-file-duplicates')).toHaveTextContent(/Già caricato il 19 novembre.*da Luca Bianchi\. Se carichi di nuovo il file, il portale potrebbe creare delle notifiche doppie/);

      fireEvent.click(screen.getByTestId('ticino-download-csv'));

      const dialog = await screen.findByRole('dialog', { name: 'Scaricare di nuovo il file?' });
      expect(dialog).toHaveTextContent(/Già caricato il 19 novembre.*da Luca Bianchi/);
      expect(dialog).toHaveTextContent('Gli ospiti già notificati potrebbero comparire due volte sul portale.');
      expect(swissComplianceApi.downloadTicinoFile).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Scarica di nuovo' }));

      await waitFor(() => expect(swissComplianceApi.downloadTicinoFile).toHaveBeenCalledWith(PROPERTY_ID, { reportDate: DAY, format: 'csv', confirmRegenerate: true }));
      await waitFor(() => expect(saveBlobAs).toHaveBeenCalled());
    });

    it('TicinoLayer_ADeclaredDay_NoToTheConfirmation_AsksNothingAndSavesNothing', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay({ declaredAt: null, declaredBy: null, receiptCount: 1 }));
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('file');

      fireEvent.click(screen.getByTestId('ticino-download-csv'));
      const dialog = await screen.findByRole('dialog', { name: 'Scaricare di nuovo il file?' });
      expect(dialog).toHaveTextContent('Ricevuta del portale archiviata');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Non scaricare' }));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Scaricare di nuovo il file?' })).not.toBeInTheDocument());
      expect(swissComplianceApi.downloadTicinoFile).not.toHaveBeenCalled();
      expect(saveBlobAs).not.toHaveBeenCalled();
    });

    it('TicinoLayer_AnotherHostClosesTheDayMeanwhile_TheConflictOfTheServerOpensTheSameConfirmationAndReadsTheDayAgain', async () => {
      vi.mocked(swissComplianceApi.downloadTicinoFile).mockRejectedValueOnce(apiError(409, 'ticino_day_already_declared'));
      renderLayer();
      fireEvent.click(await screen.findByTestId('ticino-download-csv'));
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay());

      const dialog = await screen.findByRole('dialog', { name: 'Scaricare di nuovo il file?' });
      await waitFor(() => expect(dialog).toHaveTextContent(/Già caricato il 19 novembre.*da Luca Bianchi/));
      expect(saveBlobAs).not.toHaveBeenCalled();
    });

    it('TicinoLayer_AGroupOfSixOrMore_HasItsSheetToDownloadUnderTheNameTheServerGives', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(
        dayOf({ rows: [{ bookingId: BOOKING_ID, guestName: 'Giulia Neri', personsOver14: 5, personsUnder14: 1, kind: 'group', groupSize: 7 }] }),
      );
      vi.mocked(swissComplianceApi.downloadGroupSheet).mockResolvedValue({
        blob: new Blob(['sheet']),
        contentDisposition: 'attachment; filename="scheda-gruppo-ti-2026-11-19-AAAAA-BBBBB.csv"',
      });
      renderLayer();

      fireEvent.click(await screen.findByTestId('ticino-group-sheet'));

      await waitFor(() => expect(swissComplianceApi.downloadGroupSheet).toHaveBeenCalledWith(PROPERTY_ID, BOOKING_ID));
      await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(expect.any(Blob), 'scheda-gruppo-ti-2026-11-19-AAAAA-BBBBB.csv'));
    });

    it('TicinoLayer_NoGuestIsReady_SaysTheFileIsNotThereYetAndOffersNoDownload', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ rows: [], issues: [{ bookingId: BOOKING_ID, position: null, guestName: 'Mario Rossi', missing: ['guests'] }] }));
      renderLayer();

      await screen.findByTestId('ticino-layer');
      openStep('file');
      expect(screen.getByTestId('ticino-file-none')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-download-csv')).not.toBeInTheDocument();
      expect(screen.getByTestId('ticino-guests-none')).toBeInTheDocument();
    });

    it('TicinoLayer_AFailedDownload_IsToldInWordsAndTheLayerStays', async () => {
      const { toast } = await import('sonner');
      vi.mocked(swissComplianceApi.downloadTicinoFile).mockRejectedValueOnce(apiError(500));
      renderLayer();

      fireEvent.click(await screen.findByTestId('ticino-download-csv'));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Impossibile scaricare il file.'));
      expect(saveBlobAs).not.toHaveBeenCalled();
      expect(isOpen('file')).toBe(true);
    });
  });

  describe('step 3: the portal', () => {
    it('TicinoLayer_ThePortalLink_IsTheOneWayOut_AndComingBackLandsOnTheDeclaration', async () => {
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('portal');

      const link = screen.getByTestId('ticino-portal-link');
      expect(link).toHaveAttribute('href', 'https://www.notifiche.ti.ch');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(screen.getByTestId('ticino-portal')).toHaveTextContent(/CasaZen non accede al portale/);

      link.addEventListener('click', (event) => event.preventDefault());
      fireEvent.click(link);

      expect(isOpen('declare')).toBe(true);
    });

    it('TicinoLayer_APortalUrlThatIsNotHttps_IsNotOfferedAsALink', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ portalUrl: 'javascript:alert(1)' }));
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('portal');

      expect(screen.queryByTestId('ticino-portal-link')).not.toBeInTheDocument();
    });
  });

  describe('step 4: the declaration', () => {
    it('TicinoLayer_IHaveUploadedTheFile_DeclaresTheDayThenTheCockpitAndTheCounterReadAgain', async () => {
      const view = renderLayer();
      const invalidate = vi.spyOn(view.client, 'invalidateQueries');
      await screen.findByTestId('ticino-layer');
      openStep('declare');
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay());

      fireEvent.click(screen.getByTestId('ticino-declare-button'));

      await waitFor(() => expect(swissComplianceApi.declareTicinoDay).toHaveBeenCalledWith(PROPERTY_ID, { arrivalDay: DAY }));
      await waitFor(() => {
        const keys = invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
        expect(keys).toContainEqual(['compliance']);
        expect(keys).toContainEqual(['ticino-police', PROPERTY_ID]);
      });
      await waitFor(() => expect(screen.getByTestId('ticino-day-state')).toHaveTextContent(/Già caricato il 19 novembre.*da Luca Bianchi/));
      expect(isOpen('receipt')).toBe(true);
    });

    it('TicinoLayer_WhileARequestIsOnItsWay_EveryButtonOfTheLayerWaits', async () => {
      let release: () => void = () => undefined;
      vi.mocked(swissComplianceApi.declareTicinoDay).mockReturnValue(
        new Promise((resolve) => {
          release = () => resolve({ propertyId: PROPERTY_ID, arrivalDay: DAY, declaredAt: '2026-11-19T20:30:00Z', declaredBy: null, receiptId: null, created: true });
        }),
      );
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('receipt');
      fireEvent.change(screen.getByTestId('ticino-receipt-police-file'), { target: { files: [new File(['pdf'], 'riepilogo.pdf', { type: 'application/pdf' })] } });
      expect(screen.getByTestId('ticino-receipt-police-upload')).toBeEnabled();
      openStep('declare');

      fireEvent.click(screen.getByTestId('ticino-declare-button'));

      await waitFor(() => expect(screen.getByTestId('ticino-declare-button')).toBeDisabled());
      expect(screen.getByTestId('ticino-download-csv')).toBeDisabled();
      expect(screen.getByTestId('ticino-download-xml')).toBeDisabled();
      expect(screen.getByTestId('ticino-receipt-police-upload')).toBeDisabled();
      expect(screen.getByTestId('ticino-layer')).toHaveAttribute('aria-busy', 'true');

      await act(async () => release());
      await waitFor(() => expect(screen.getByTestId('ticino-download-csv')).toBeEnabled());
      expect(screen.getByTestId('ticino-receipt-police-upload')).toBeEnabled();
    });

    it('TicinoLayer_ADayDeclaredAlready_CanBeReopenedByWhoMayDeclare', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay());
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('declare');
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ fileGeneratedCount: 1 }));

      fireEvent.click(screen.getByTestId('ticino-undeclare'));

      await waitFor(() => expect(swissComplianceApi.undeclareTicinoDay).toHaveBeenCalledWith(PROPERTY_ID, DAY));
      await waitFor(() => expect(screen.getByTestId('ticino-day-state')).toHaveTextContent(/Da notificare entro/));
      expect(isOpen('declare')).toBe(true);
    });

    it('TicinoLayer_ADeclaredDayWithTheReceiptOfThePortal_OffersNoUndoBecauseTheReceiptKeepsTheDayClosed', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay({ receiptCount: 1 }));
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('declare');

      expect(screen.getByTestId('ticino-declared')).toHaveTextContent(/Già caricato il 19 novembre.*da Luca Bianchi/);
      expect(screen.queryByTestId('ticino-undeclare')).not.toBeInTheDocument();
    });

    it('TicinoLayer_NotUploadedYet_TheLinkGoesBackToThePortalStep', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ fileGeneratedCount: 1 }));
      renderLayer();
      await screen.findByTestId('ticino-layer');

      fireEvent.click(screen.getByRole('button', { name: /Non l'hai ancora caricato/ }));

      expect(isOpen('portal')).toBe(true);
    });

    it('TicinoLayer_ADayThatHasNotStarted_CannotBeDeclared', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ day: '2026-11-25' }));
      renderLayer(`${PROPERTY_ID}:2026-11-25`);
      await screen.findByTestId('ticino-layer');
      openStep('declare');

      expect(screen.getByTestId('ticino-declare-future')).toHaveTextContent(/Questo giorno non è ancora iniziato/);
      expect(screen.queryByTestId('ticino-declare-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('ticino-day-state')).toHaveTextContent(/non è ancora iniziato/);
    });

    it('TicinoLayer_TheFirstActionOnADayAskedWithoutADate_PinsItSoDeclaringItLeavesItOnScreenClosed', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockImplementation(async (_property, date) => {
        if (date === undefined) return dayOf({ day: DAY });
        return date === DAY ? declaredDay() : dayOf({ day: OTHER_DAY });
      });
      renderLayer(PROPERTY_ID);
      await screen.findByTestId('ticino-layer');
      openStep('declare');

      fireEvent.click(screen.getByTestId('ticino-declare-button'));

      await waitFor(() => expect(swissComplianceApi.declareTicinoDay).toHaveBeenCalledWith(PROPERTY_ID, { arrivalDay: DAY }));
      await waitFor(() => expect(screen.getByTestId('ticino-day-state')).toHaveTextContent(/Già caricato il 19 novembre/));
      expect(screen.getByTestId('ticino-day-title')).toHaveTextContent('Arrivi di giovedì 19 novembre');
      expect(vi.mocked(swissComplianceApi.getTicinoDay).mock.calls.filter(([, date]) => date === undefined)).toHaveLength(1);
    });

    it('TicinoLayer_ADeclarationThatFails_IsToldAndTheDayStaysToNotify', async () => {
      const { toast } = await import('sonner');
      vi.mocked(swissComplianceApi.declareTicinoDay).mockRejectedValueOnce(apiError(500));
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('declare');

      fireEvent.click(screen.getByTestId('ticino-declare-button'));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Impossibile registrare il caricamento. Riprova.'));
      expect(screen.getByTestId('ticino-day-state')).toHaveTextContent(/Da notificare entro/);
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('step 5: the receipt', () => {
    const chooseFile = (testId: string, file: File) => fireEvent.change(screen.getByTestId(testId), { target: { files: [file] } });

    it('TicinoLayer_TheReceiptOfThePortal_IsFiledForTheDayAndDeclaresItWithTheReceiptAttached', async () => {
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('receipt');
      const file = new File(['pdf'], 'riepilogo.pdf', { type: 'application/pdf' });
      chooseFile('ticino-receipt-police-file', file);

      fireEvent.click(screen.getByTestId('ticino-receipt-police-upload'));

      await waitFor(() => expect(swissComplianceApi.uploadReceipt).toHaveBeenCalledWith(PROPERTY_ID, { type: 'Police', reportDate: DAY, reference: REFERENCE, file }));
      await waitFor(() => expect(swissComplianceApi.declareTicinoDay).toHaveBeenCalledWith(PROPERTY_ID, { arrivalDay: DAY, receiptId: 'receipt-1' }));
      await waitFor(() => expect(screen.getByTestId('ticino-receipt-police-upload')).toBeDisabled());
    });

    it('TicinoLayer_TheReceiptIsFiledButTheDeclarationFails_TheReceiptStandsAndThePersonIsToldTheDeclarationIsMissing', async () => {
      const { toast } = await import('sonner');
      vi.mocked(swissComplianceApi.declareTicinoDay).mockRejectedValueOnce(apiError(422, 'ticino_declaration_day_in_future'));
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('receipt');
      chooseFile('ticino-receipt-police-file', new File(['pdf'], 'riepilogo.pdf', { type: 'application/pdf' }));

      fireEvent.click(screen.getByTestId('ticino-receipt-police-upload'));

      await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('La dichiarazione non è stata registrata')));
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('TicinoLayer_AReceiptTheServerRefuses_IsToldInWordsAndNothingIsDeclared', async () => {
      const { toast } = await import('sonner');
      vi.mocked(swissComplianceApi.uploadReceipt).mockRejectedValueOnce(apiError(400, 'swiss_receipt_file_invalid'));
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('receipt');
      chooseFile('ticino-receipt-police-file', new File(['pdf'], 'riepilogo.pdf', { type: 'application/pdf' }));

      fireEvent.click(screen.getByTestId('ticino-receipt-police-upload'));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Il file è vuoto oppure troppo grande: al massimo 10 MB.'));
      expect(swissComplianceApi.declareTicinoDay).not.toHaveBeenCalled();
      expect(screen.getByTestId('ticino-receipt-police-upload')).toBeEnabled();
    });

    it('TicinoLayer_AFileOverTenMegabytes_IsRefusedBeforeItIsSent', async () => {
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('receipt');
      const big = new File(['x'], 'enorme.pdf', { type: 'application/pdf' });
      Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });

      chooseFile('ticino-receipt-police-file', big);

      expect(screen.getByTestId('ticino-receipt-police-too-big')).toHaveTextContent('Il file è troppo grande: al massimo 10 MB.');
      expect(screen.getByTestId('ticino-receipt-police-upload')).toBeDisabled();
      expect(swissComplianceApi.uploadReceipt).not.toHaveBeenCalled();
    });

    it('TicinoLayer_MinorsWithoutAnAdult_TheAuthorizationOfTheParentsIsFiledAsItsOwnDocumentAndDeclaresNothing', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ warnings: [{ bookingId: OTHER_BOOKING_ID, code: 'parental_authorization_needed' }] }));
      vi.mocked(swissComplianceApi.uploadReceipt).mockResolvedValue({
        id: 'receipt-2',
        propertyId: PROPERTY_ID,
        type: 'ParentalAuthorization',
        reportDate: DAY,
        reference: `${REFERENCE}-${OTHER_BOOKING_ID}`,
        fileHash: 'hash',
        uploadedAt: '2026-11-19T20:30:00Z',
      });
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('receipt');
      const file = new File(['scan'], 'autorizzazione.pdf', { type: 'application/pdf' });
      chooseFile(`ticino-receipt-parental-${OTHER_BOOKING_ID}-file`, file);

      fireEvent.click(screen.getByTestId(`ticino-receipt-parental-${OTHER_BOOKING_ID}-upload`));

      await waitFor(() =>
        expect(swissComplianceApi.uploadReceipt).toHaveBeenCalledWith(PROPERTY_ID, {
          type: 'ParentalAuthorization',
          reportDate: DAY,
          reference: `${REFERENCE}-${OTHER_BOOKING_ID}`,
          file,
        }),
      );
      expect(swissComplianceApi.declareTicinoDay).not.toHaveBeenCalled();
    });

    it('TicinoLayer_TheSheetOfAGroup_IsFiledAsAGroupSheet', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(
        dayOf({ rows: [{ bookingId: BOOKING_ID, guestName: 'Giulia Neri', personsOver14: 5, personsUnder14: 1, kind: 'group', groupSize: 7 }] }),
      );
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('receipt');
      const file = new File(['sheet'], 'scheda.csv', { type: 'text/csv' });
      chooseFile(`ticino-receipt-group-${BOOKING_ID}-file`, file);

      fireEvent.click(screen.getByTestId(`ticino-receipt-group-${BOOKING_ID}-upload`));

      await waitFor(() =>
        expect(swissComplianceApi.uploadReceipt).toHaveBeenCalledWith(PROPERTY_ID, { type: 'GroupSheet', reportDate: DAY, reference: `${REFERENCE}-${BOOKING_ID}`, file }),
      );
      expect(swissComplianceApi.declareTicinoDay).not.toHaveBeenCalled();
    });

    it('TicinoLayer_AReceiptAlreadyFiled_SaysHowManyAreThere', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay({ receiptCount: 2 }));
      renderLayer();
      await screen.findByTestId('ticino-layer');

      expect(screen.getByTestId('ticino-receipt-count')).toHaveTextContent('2 ricevute archiviate per questo giorno.');
      expect(stepOf('receipt')).toHaveAttribute('data-state', 'done');
    });
  });

  describe('what each permission lets the person do (as the endpoints do)', () => {
    it('TicinoLayer_WithoutAlloggiatiSubmit_NoDeclarationAndNoDocumentIsOfferedAndTheLayerSaysWhoCan', async () => {
      permissions.granted = ['guest.read', 'booking.write'];
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ fileGeneratedCount: 1 }));
      renderLayer();
      await screen.findByTestId('ticino-layer');

      expect(screen.getByTestId('ticino-declare-needs-submit')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-declare-button')).not.toBeInTheDocument();
      openStep('receipt');
      expect(screen.getByTestId('ticino-receipt-needs-submit')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-receipt-police-upload')).not.toBeInTheDocument();
      expect(screen.getByTestId('ticino-download-csv')).toBeEnabled();
    });

    it('TicinoLayer_WithoutGuestRead_TheFileIsNotOffered', async () => {
      permissions.granted = ['alloggiati.submit'];
      renderLayer();

      expect(await screen.findByTestId('ticino-download-csv')).toBeDisabled();
      expect(screen.getByTestId('ticino-download-xml')).toBeDisabled();
      expect(screen.getByTestId('ticino-file-needs-guest-read')).toHaveTextContent('serve il permesso di leggere i dati degli ospiti');
    });

    it('TicinoLayer_AUndeclareIsOfferedOnlyToWhoMayDeclare', async () => {
      permissions.granted = ['guest.read'];
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(declaredDay());
      renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('declare');

      expect(screen.getByTestId('ticino-declared')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-undeclare')).not.toBeInTheDocument();
    });
  });

  describe('the identification number of the structure', () => {
    it('TicinoLayer_NoStructureNumber_AsksItInsteadOfTheStepsForWhoMayWriteTheProperty', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ structureId: null }));
      renderLayer();

      expect(await screen.findByTestId('ticino-structure-missing')).toBeInTheDocument();
      expect(screen.getByTestId('ticino-structure-id-form')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-steps')).not.toBeInTheDocument();
    });

    it('TicinoLayer_NoStructureNumberAndNoRightToWriteTheProperty_SaysWhoCanEnterIt', async () => {
      permissions.granted = ['guest.read'];
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf({ structureId: null }));
      renderLayer();

      expect(await screen.findByTestId('ticino-structure-readonly')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-structure-id-form')).not.toBeInTheDocument();
    });
  });

  describe('a day that cannot be read', () => {
    it.each([
      [404, 'Non troviamo questa struttura, oppure non hai accesso.'],
      [403, 'Non hai il permesso di vedere gli ospiti di questa struttura.'],
      [422, 'Questa struttura non risulta nel Canton Ticino'],
    ])('TicinoLayer_Answer%s_SaysWhatItIsInWords', async (status, words) => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockRejectedValue(apiError(status));
      renderLayer();

      expect(await screen.findByTestId('ticino-layer-problem')).toHaveTextContent(words);
      expect(screen.queryByTestId('ticino-layer')).not.toBeInTheDocument();
    });

    it('TicinoLayer_AFailureOfTheServer_OffersToTryAgainAndTheNextReadShowsTheDay', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockRejectedValueOnce(apiError(500));
      renderLayer();

      const error = await screen.findByTestId('ticino-layer-error');
      expect(error).toHaveTextContent('Impossibile caricare la notifica.');
      fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

      expect(await screen.findByTestId('ticino-layer')).toBeInTheDocument();
    });

    it('TicinoLayer_A404WhileTheOldDayIsStillInTheCache_IsNotFoundNeverTheOldDay', async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(['ticino-police', PROPERTY_ID, DAY], dayOf());
      vi.mocked(swissComplianceApi.getTicinoDay).mockRejectedValue(apiError(404));
      render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <TicinoLayerContent id={`${PROPERTY_ID}:${DAY}`} close={vi.fn()} />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(await screen.findByTestId('ticino-layer-problem')).toHaveTextContent('Non troviamo questa struttura');
      expect(screen.queryByTestId('ticino-layer')).not.toBeInTheDocument();
    });

    const readAgain = async (view: ReturnType<typeof renderLayer>) => {
      await act(async () => {
        await view.client.invalidateQueries({ queryKey: ['ticino-police', PROPERTY_ID] });
      });
    };

    it('TicinoLayer_AReadThatFailsWhileTheDayIsOnScreen_KeepsTheDayTheOpenStepAndTheFileChosen_AndOffersToReadAgain', async () => {
      const view = renderLayer();
      await screen.findByTestId('ticino-layer');
      openStep('receipt');
      fireEvent.change(screen.getByTestId('ticino-receipt-police-file'), { target: { files: [new File(['pdf'], 'riepilogo.pdf', { type: 'application/pdf' })] } });
      expect(screen.getByTestId('ticino-receipt-police-upload')).toBeEnabled();

      vi.mocked(swissComplianceApi.getTicinoDay).mockRejectedValue(apiError(500));
      await readAgain(view);

      const notice = await screen.findByTestId('ticino-layer-stale');
      expect(notice).toHaveTextContent('Non riusciamo ad aggiornare questo giorno');
      expect(screen.getByTestId('ticino-layer')).toBeInTheDocument();
      expect(screen.queryByTestId('ticino-layer-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ticino-layer-problem')).not.toBeInTheDocument();
      expect(isOpen('receipt')).toBe(true);
      expect(screen.getByTestId('ticino-receipt-police-upload')).toBeEnabled();

      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(dayOf());
      const retry = within(notice).getByRole('button', { name: 'Riprova' });
      await waitFor(() => expect(retry).toBeEnabled());
      fireEvent.click(retry);

      await waitFor(() => expect(screen.queryByTestId('ticino-layer-stale')).not.toBeInTheDocument());
      expect(isOpen('receipt')).toBe(true);
      expect(screen.getByTestId('ticino-receipt-police-upload')).toBeEnabled();
    });

    it('TicinoLayer_AReadThatFailsWhileTheFormOfTheGuestsIsOpen_LeavesTheFormWhereItIs', async () => {
      vi.mocked(swissComplianceApi.getTicinoDay).mockResolvedValue(
        dayOf({ issues: [{ bookingId: OTHER_BOOKING_ID, position: 1, guestName: 'Anna Verdi', missing: ['birthDate'] }] }),
      );
      const view = renderLayer();
      fireEvent.click(await screen.findByTestId('ticino-complete-guest'));
      expect(await screen.findByTestId('stay-guests-edit-dialog')).toBeInTheDocument();

      vi.mocked(swissComplianceApi.getTicinoDay).mockRejectedValue(apiError(503));
      await readAgain(view);

      await screen.findByTestId('ticino-layer-stale');
      expect(screen.getByTestId('stay-guests-edit-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('ticino-layer')).toBeInTheDocument();
    });

    it.each([
      [403, 'Non hai il permesso di vedere gli ospiti di questa struttura.'],
      [404, 'Non troviamo questa struttura, oppure non hai accesso.'],
      [422, 'Questa struttura non risulta nel Canton Ticino'],
    ])('TicinoLayer_Answer%sToTheReadThatRefreshesTheDayOnScreen_TakesTheDayAwayAtOnce', async (status, words) => {
      const view = renderLayer();
      await screen.findByTestId('ticino-layer');
      vi.mocked(swissComplianceApi.getTicinoDay).mockRejectedValue(apiError(status));

      await readAgain(view);

      expect(await screen.findByTestId('ticino-layer-problem')).toHaveTextContent(words);
      expect(screen.queryByTestId('ticino-layer')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ticino-layer-stale')).not.toBeInTheDocument();
    });

    it.each(['', 'a:b:c', 'not a property', '../x'])('TicinoLayer_AnIdTheLayerDoesNotMake_%s_IsNotFoundAndAsksNothing', (id) => {
      renderLayer(id);

      expect(screen.getByTestId('ticino-layer-problem')).toHaveTextContent('Non troviamo questa struttura');
      expect(swissComplianceApi.getTicinoDay).not.toHaveBeenCalled();
    });
  });

  describe('leaving', () => {
    it('TicinoLayer_ContinueLater_ClosesTheLayerAndLeavesTheDayAsItIs', async () => {
      const { close } = renderLayer();

      fireEvent.click(await screen.findByTestId('ticino-later'));

      expect(close).toHaveBeenCalledTimes(1);
      expect(swissComplianceApi.declareTicinoDay).not.toHaveBeenCalled();
    });

    it('TicinoLayer_English_SaysTheStepsInEnglish', async () => {
      await i18n.changeLanguage('en');
      renderLayer();

      expect(await screen.findByTestId('ticino-day-title')).toHaveTextContent('Arrivals of Thursday, November 19');
      expect(screen.getByTestId('ticino-step-guests-toggle')).toHaveTextContent('Guests to notify');
      expect(screen.getByTestId('ticino-step-declare-toggle')).toHaveTextContent('I uploaded the file');
    });
  });
});
