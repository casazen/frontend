import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertyIcalApi } from '@/api/property-ical.api';
import type { PropertyIcalFeed } from '@/types/property-ical';
import { IcalSettings } from '../ical-settings';

vi.mock('@/api/property-ical.api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PROPERTY_ID = 'prop-1';
const EXPORT_URL = 'https://api.example.com/api/public/ical/token-abc.ics';

const airbnb: PropertyIcalFeed = {
  id: 'feed-airbnb',
  channel: 'Airbnb',
  label: null,
  maskedImportUrl: 'www.airbnb.it/…9f3a',
  createdAt: '2026-09-01T10:00:00Z',
  lastImportAt: '2026-09-24T08:15:00Z',
  lastImportStatus: 'Success',
  lastErrorCode: null,
  lastError: null,
  blockCount: 3,
};

const booking: PropertyIcalFeed = {
  id: 'feed-booking',
  channel: 'BookingCom',
  label: 'Booking camera 2',
  maskedImportUrl: 'admin.booking.com/…9c0d',
  createdAt: '2026-09-02T10:00:00Z',
  lastImportAt: '2026-09-24T08:10:00Z',
  lastImportStatus: 'Failure',
  lastErrorCode: 'ical_unreachable',
  lastError: 'Server text that must not be shown when the code is known',
  blockCount: 1,
};

const syncingFeed: PropertyIcalFeed = {
  id: 'feed-other',
  channel: 'Other',
  label: null,
  maskedImportUrl: 'calendar.google.com/….ics',
  createdAt: '2026-09-03T10:00:00Z',
  lastImportAt: null,
  lastImportStatus: 'Syncing',
  lastErrorCode: null,
  lastError: null,
  blockCount: 0,
};

/** Failed API call as the axios client rejects it: ProblemDetails body with the stable `code` (FD-05). */
function problem(status: number, code?: string): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: code ? { status, title: 'One or more errors occurred.', code } : {},
  } as AxiosResponse);
}

let queryClient: QueryClient;

function renderSettings() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <IcalSettings propertyId={PROPERTY_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function feedRows() {
  return screen.findAllByTestId('ical-feed-row');
}

function typeImportUrl(value: string) {
  fireEvent.change(screen.getByLabelText('URL import (HTTPS)'), { target: { value } });
}

function submitAdd() {
  fireEvent.click(screen.getByRole('button', { name: 'Aggiungi e sincronizza' }));
}

describe('IcalSettings (PC-11, PC-13)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([airbnb, booking]);
    vi.mocked(propertyIcalApi.getExportUrl).mockResolvedValue({ exportUrl: EXPORT_URL });
  });

  afterEach(() => {
    vi.useRealTimers();
    queryClient?.clear();
  });

  describe('feed list', () => {
    it('renders_TwoFeeds_ShowsEachWithNameMaskedUrlTranslatedStatusLastSyncAndBlocks', async () => {
      renderSettings();

      const rows = await feedRows();
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText('Airbnb')).toBeInTheDocument();
      expect(within(rows[0]).getByText('www.airbnb.it/…9f3a')).toBeInTheDocument();
      expect(within(rows[0]).getByTestId('ical-feed-status')).toHaveTextContent('Sincronizzato');
      expect(within(rows[0]).getByText(/Ultima sync: 24\/09\/2026/)).toBeInTheDocument();
      expect(within(rows[0]).getByText(/3 periodi bloccati importati/)).toBeInTheDocument();
      // A label replaces the channel name, the channel stays as a badge.
      expect(within(rows[1]).getByText('Booking camera 2')).toBeInTheDocument();
      expect(within(rows[1]).getByText('Booking.com')).toBeInTheDocument();
    });

    it('renders_FailedFeed_ShowsTheErrorTranslatedFromItsCodeNotTheRawText', async () => {
      vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([booking]);

      renderSettings();

      const [row] = await feedRows();
      expect(within(row).getByTestId('ical-feed-status')).toHaveTextContent('Errore');
      expect(
        within(row).getByText(
          'Non è stato possibile scaricare il calendario: verifica che il link sia corretto e accessibile pubblicamente.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(booking.lastError!)).not.toBeInTheDocument();
      expect(screen.queryByText('Failure')).not.toBeInTheDocument();
    });

    it('renders_NoFeeds_ShowsTheEmptyState', async () => {
      vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([]);

      renderSettings();

      expect(await screen.findByText(/Nessun calendario collegato/)).toBeInTheDocument();
      expect(screen.queryAllByTestId('ical-feed-row')).toHaveLength(0);
    });

    it('renders_LoadError_ShowsErrorAndRetryNotAnEmptyList', async () => {
      vi.mocked(propertyIcalApi.getFeeds).mockRejectedValueOnce(problem(500)).mockResolvedValueOnce([airbnb]);

      renderSettings();

      expect(await screen.findByText('Impossibile caricare i calendari collegati.')).toBeInTheDocument();
      expect(screen.queryByText(/Nessun calendario collegato/)).not.toBeInTheDocument();
      const feedsSection = screen.getByRole('region', { name: 'Calendari collegati' });
      fireEvent.click(within(feedsSection).getByRole('button', { name: 'Riprova' }));
      expect(await feedRows()).toHaveLength(1);
    });

    it('renders_Loading_ShowsSpinnerNotTheEmptyState', () => {
      vi.mocked(propertyIcalApi.getFeeds).mockReturnValue(new Promise(() => {}));

      renderSettings();

      expect(screen.getByTestId('ical-feeds-loading')).toBeInTheDocument();
      expect(screen.queryByText(/Nessun calendario collegato/)).not.toBeInTheDocument();
    });
  });

  describe('Syncing state', () => {
    it('renders_SyncingFeed_TranslatesTheStateThenPollsUntilTheSyncEndsAndRefreshesTheCalendar', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(propertyIcalApi.getFeeds)
        .mockResolvedValueOnce([syncingFeed])
        .mockResolvedValue([{ ...syncingFeed, lastImportStatus: 'Success', lastImportAt: '2026-09-24T09:00:00Z', blockCount: 2 }]);

      renderSettings();
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

      const [row] = await feedRows();
      expect(within(row).getByTestId('ical-feed-status')).toHaveTextContent('Sincronizzazione in corso');
      expect(screen.queryByText('Syncing')).not.toBeInTheDocument();
      expect(within(row).getByRole('button', { name: /Sincronizzazione…/ })).toBeDisabled();
      expect(propertyIcalApi.getFeeds).toHaveBeenCalledTimes(1);

      // Light polling while the feed is syncing: the next read shows the result.
      await act(() => vi.advanceTimersByTimeAsync(3_000));

      await waitFor(() => expect(within(row).getByTestId('ical-feed-status')).toHaveTextContent('Sincronizzato'));
      expect(within(row).getByText(/2 periodi bloccati importati/)).toBeInTheDocument();
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bookings', 'calendar'] });

      // Sync over: no more polling.
      const reads = vi.mocked(propertyIcalApi.getFeeds).mock.calls.length;
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      expect(propertyIcalApi.getFeeds).toHaveBeenCalledTimes(reads);
    });
  });

  describe('sync now', () => {
    it('syncNow_click_QueuesThatFeedOnlyAndShowsItSyncing', async () => {
      vi.mocked(propertyIcalApi.syncFeed).mockResolvedValue({ ...booking, lastImportStatus: 'Syncing' });

      renderSettings();
      const rows = await feedRows();
      fireEvent.click(within(rows[1]).getByRole('button', { name: /Sincronizza ora/ }));

      await waitFor(() =>
        expect(within(rows[1]).getByTestId('ical-feed-status')).toHaveTextContent('Sincronizzazione in corso'),
      );
      expect(propertyIcalApi.syncFeed).toHaveBeenCalledTimes(1);
      expect(propertyIcalApi.syncFeed).toHaveBeenCalledWith(PROPERTY_ID, 'feed-booking');
      expect(within(rows[1]).getByRole('button', { name: /Sincronizzazione…/ })).toBeDisabled();
      expect(within(rows[0]).getByTestId('ical-feed-status')).toHaveTextContent('Sincronizzato');
      expect(toast.success).toHaveBeenCalledWith(
        'Sincronizzazione avviata: le date bloccate si aggiornano appena termina.',
      );
    });

    it('syncNow_feedAlreadyRemoved_ShowsTheReasonInTheRowAndReloadsTheList', async () => {
      vi.mocked(propertyIcalApi.syncFeed).mockRejectedValue(problem(404, 'ical_feed_not_found'));

      renderSettings();
      const rows = await feedRows();
      fireEvent.click(within(rows[0]).getByRole('button', { name: /Sincronizza ora/ }));

      const message = 'Calendario non trovato: potrebbe essere già stato scollegato.';
      expect(await within(rows[0]).findByRole('alert')).toHaveTextContent(message);
      expect(toast.error).toHaveBeenCalledWith(message);
      await waitFor(() => expect(propertyIcalApi.getFeeds).toHaveBeenCalledTimes(2));
    });
  });

  describe('disconnect', () => {
    it('remove_confirmed_ExplainsTheBlocksRemovesThatFeedAndClosesTheDialog', async () => {
      vi.mocked(propertyIcalApi.removeFeed).mockResolvedValue(undefined);

      renderSettings();
      const rows = await feedRows();
      fireEvent.click(within(rows[0]).getByRole('button', { name: /Scollega/ }));

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/importate da Airbnb tornano subito libere/)).toBeInTheDocument();
      expect(propertyIcalApi.removeFeed).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Scollega' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(propertyIcalApi.removeFeed).toHaveBeenCalledWith(PROPERTY_ID, 'feed-airbnb');
      expect(toast.success).toHaveBeenCalledWith('Calendario scollegato.');
    });

    it('remove_cancelled_KeepsTheFeed', async () => {
      renderSettings();
      const rows = await feedRows();
      fireEvent.click(within(rows[1]).getByRole('button', { name: /Scollega/ }));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annulla' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(propertyIcalApi.removeFeed).not.toHaveBeenCalled();
    });

    it('remove_serverError_KeepsTheDialogOpenWithTheReason', async () => {
      vi.mocked(propertyIcalApi.removeFeed).mockRejectedValue(problem(500));

      renderSettings();
      const rows = await feedRows();
      fireEvent.click(within(rows[0]).getByRole('button', { name: /Scollega/ }));
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Scollega' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('Impossibile scollegare il calendario.');
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Impossibile scollegare il calendario.');
    });
  });

  describe('link a calendar', () => {
    it('addFeed_success_SendsChannelLabelAndUrlThenEmptiesTheFields', async () => {
      vi.mocked(propertyIcalApi.addFeed).mockResolvedValue({ ...syncingFeed, id: 'feed-new' });

      renderSettings();
      await feedRows();
      fireEvent.change(screen.getByLabelText('Canale'), { target: { value: 'BookingCom' } });
      fireEvent.change(screen.getByLabelText('Etichetta (facoltativa)'), { target: { value: ' Camera 2 ' } });
      typeImportUrl(' https://admin.booking.com/ical.html?t=1 ');
      submitAdd();

      await waitFor(() => expect(screen.getByLabelText('URL import (HTTPS)')).toHaveValue(''));
      expect(propertyIcalApi.addFeed).toHaveBeenCalledWith(PROPERTY_ID, {
        channel: 'BookingCom',
        label: 'Camera 2',
        importUrl: 'https://admin.booking.com/ical.html?t=1',
      });
      expect(screen.getByLabelText('Etichetta (facoltativa)')).toHaveValue('');
      expect(toast.success).toHaveBeenCalledWith('Calendario collegato: la prima sincronizzazione è in corso.');
      // The list is read again to show the new feed.
      await waitFor(() => expect(propertyIcalApi.getFeeds).toHaveBeenCalledTimes(2));
    });

    it('addFeed_400InvalidUrl_ShowsTheTranslatedCodeInlineAndInAToastAndKeepsTheUrl', async () => {
      vi.mocked(propertyIcalApi.addFeed).mockRejectedValue(problem(400, 'ical_invalid_url'));

      renderSettings();
      await feedRows();
      typeImportUrl('http://www.airbnb.it/calendar/ical/1.ics');
      submitAdd();

      const message =
        "L'indirizzo del calendario non è valido: usa un link https pubblico (per esempio il link di esportazione iCal di Airbnb o Booking.com).";
      const form = screen.getByRole('form', { name: 'Collega un calendario' });
      expect(await within(form).findByRole('alert')).toHaveTextContent(message);
      expect(toast.error).toHaveBeenCalledWith(message);
      const input = screen.getByLabelText('URL import (HTTPS)');
      expect(input).toHaveValue('http://www.airbnb.it/calendar/ical/1.ics');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      // Correcting the URL hides the error of the previous attempt.
      typeImportUrl('https://www.airbnb.it/calendar/ical/1.ics');
      expect(within(form).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('addFeed_sameUrlAgain_IsNotASilentNoOp', async () => {
      vi.mocked(propertyIcalApi.addFeed).mockRejectedValue(problem(409, 'ical_feed_duplicate'));

      renderSettings();
      await feedRows();
      typeImportUrl('https://www.airbnb.it/calendar/ical/1.ics?s=9f3a');
      submitAdd();

      const form = screen.getByRole('form', { name: 'Collega un calendario' });
      expect(await within(form).findByRole('alert')).toHaveTextContent(
        'Questo calendario è già collegato alla proprietà.',
      );
    });

    it('addFeed_errorWithoutCode_ShowsTheGenericMessage', async () => {
      vi.mocked(propertyIcalApi.addFeed).mockRejectedValue(problem(500));

      renderSettings();
      await feedRows();
      typeImportUrl('https://www.airbnb.it/calendar/ical/1.ics');
      submitAdd();

      const form = screen.getByRole('form', { name: 'Collega un calendario' });
      expect(await within(form).findByRole('alert')).toHaveTextContent('Impossibile collegare il calendario.');
    });
  });

  describe('export link', () => {
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeText = vi.fn();
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    });

    it('copyExportUrl_click_WritesTheUrlToTheClipboard', async () => {
      writeText.mockResolvedValue(undefined);

      renderSettings();
      const exportSection = await screen.findByTestId('ical-export');
      expect(await within(exportSection).findByDisplayValue(EXPORT_URL)).toBeInTheDocument();
      fireEvent.click(within(exportSection).getByRole('button', { name: 'Copia' }));

      expect(await within(exportSection).findByRole('button', { name: 'Copiato' })).toBeInTheDocument();
      expect(writeText).toHaveBeenCalledWith(EXPORT_URL);
      // Where to paste it on the two main OTAs.
      expect(within(exportSection).getByText(/Sincronizzazione calendari → Importa calendario/)).toBeInTheDocument();
      expect(within(exportSection).getByText(/Tariffe e disponibilità → Sincronizza calendari/)).toBeInTheDocument();
    });

    it('copyExportUrl_clipboardRefused_ShowsAnErrorAndSelectsTheLink', async () => {
      writeText.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

      renderSettings();
      const input = (await screen.findByDisplayValue(EXPORT_URL)) as HTMLInputElement;
      fireEvent.click(within(screen.getByTestId('ical-export')).getByRole('button', { name: 'Copia' }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Copia non riuscita: seleziona il link e copialo a mano.'),
      );
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(EXPORT_URL.length);
      expect(screen.queryByRole('button', { name: 'Copiato' })).not.toBeInTheDocument();
    });

    it('exportUrl_loadError_ShowsErrorAndRetry', async () => {
      vi.mocked(propertyIcalApi.getExportUrl)
        .mockRejectedValueOnce(problem(500))
        .mockResolvedValueOnce({ exportUrl: EXPORT_URL });

      renderSettings();
      const exportSection = await screen.findByTestId('ical-export');
      expect(await within(exportSection).findByRole('alert')).toHaveTextContent(
        'Impossibile caricare il link di esportazione.',
      );
      fireEvent.click(within(exportSection).getByRole('button', { name: 'Riprova' }));

      expect(await within(exportSection).findByDisplayValue(EXPORT_URL)).toBeInTheDocument();
    });
  });
});
