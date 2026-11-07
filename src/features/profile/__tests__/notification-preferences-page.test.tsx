import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { notificationPreferencesApi } from '@/api/notification-preferences.api';
import { expectNoAxeViolations } from '@/test/axe';
import { stubViewportWidth } from '@/test/viewport';
import { NOTIFICATION_EVENT_TYPES, type NotificationPreferences, type SaveNotificationPreferencesRequest } from '@/types';
import { NOTIFICATION_PREFERENCES_PATH } from '../notification-preferences-model';
import { NotificationPreferencesPage } from '../notification-preferences-page';
import { defaultPreferences, withChosen } from './notification-preferences-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/notification-preferences.api', () => ({ notificationPreferencesApi: { get: vi.fn(), save: vi.fn() } }));

const LEGAL_SENTENCE = 'Le scadenze di legge non si possono spegnere del tutto: lascia attivo almeno un canale.';
const SAVED_TOAST = { id: 'notification-preferences-saved' };

/** The API as a stand-in: it keeps the settings of the user, and a save changes them the way the real one does. */
let server: NotificationPreferences;

function applySave(request: SaveNotificationPreferencesRequest): NotificationPreferences {
  server = {
    ...server,
    quietHours: request.quietHours ? { ...server.quietHours, ...request.quietHours } : server.quietHours,
    events: server.events.map((event) => {
      const change = request.events?.find((candidate) => candidate.eventType === event.eventType);
      return change ? { ...event, channels: change.channels, isDefault: false } : event;
    }),
  };
  return structuredClone(server);
}

function problem(status: number, data: Record<string, unknown>) {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: {} } as InternalAxiosRequestConfig,
    data,
  });
}

/** A client with the defaults of the app (`src/lib/query-client.ts`): what it read is fresh for 5 minutes and is not read again on mount. */
function appLikeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 5 * 60 * 1000, refetchOnMount: false, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}

function renderPage(client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[NOTIFICATION_PREFERENCES_PATH]}>
        <NotificationPreferencesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const switchOf = (eventType: string, channel: string) => screen.getByTestId(`notification-switch-${eventType}-${channel}`);
const lastSave = () => vi.mocked(notificationPreferencesApi.save).mock.calls.at(-1)?.[0];

describe('NotificationPreferencesPage (E05/F03/US02, NF-65)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    server = defaultPreferences();
    vi.mocked(notificationPreferencesApi.get).mockImplementation(async () => structuredClone(server));
    vi.mocked(notificationPreferencesApi.save).mockImplementation(async (request) => applySave(request));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('the matrix', () => {
    it('render_NewUser_ShowsTheEightEventsInOrderWithTheDefaultsOfPo10MarkedAsSuch', async () => {
      renderPage();
      await screen.findByTestId('notification-table');

      const rows = screen.getAllByTestId(/^notification-row-/).map((row) => row.getAttribute('data-testid'));
      expect(rows).toEqual(NOTIFICATION_EVENT_TYPES.map((type) => `notification-row-${type}`));
      expect(screen.getAllByText('Predefinito')).toHaveLength(8);
      expect(screen.getByText('Nuovo messaggio di un ospite')).toBeInTheDocument();
      expect(screen.getByText('Scadenza di legge')).toBeInTheDocument();

      // A new guest message is a push on the phone and the counter of the bell (AC-NF65-2), and nothing else.
      expect(switchOf('NewGuestMessage', 'MobilePush')).toBeChecked();
      expect(switchOf('NewGuestMessage', 'CounterOnly')).toBeChecked();
      expect(switchOf('NewGuestMessage', 'Email')).not.toBeChecked();
      // A legal deadline adds the email; a cancellation is the counter only.
      expect(switchOf('LegalDeadline', 'Email')).toBeChecked();
      expect(switchOf('BookingCancelled', 'CounterOnly')).toBeChecked();
      expect(switchOf('BookingCancelled', 'MobilePush')).not.toBeChecked();
    });

    it('render_EveryChannelHasAColumnAndEveryEventARowHeaderAndEverySwitchTheNameOfBoth', async () => {
      renderPage();
      await screen.findByTestId('notification-table');

      const table = screen.getByRole('table', { name: 'Come vuoi essere avvisato, evento per evento' });
      expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
        'Cosa succede',
        'Notifica sul telefono',
        'Notifica nel browser' + 'Non ancora disponibile',
        'Email',
        'Campanella',
      ]);
      expect(within(table).getAllByRole('rowheader')).toHaveLength(8);
      expect(screen.getByRole('switch', { name: 'Nuova prenotazione: Email' })).toBe(switchOf('NewBooking', 'Email'));
      expect(screen.getAllByRole('switch')).toHaveLength(32);
    });

    it('render_BrowserPush_IsOffAndDisabledWithTheReasonUnderItsName', async () => {
      renderPage();
      await screen.findByTestId('notification-table');

      for (const type of NOTIFICATION_EVENT_TYPES) {
        const toggle = switchOf(type, 'BrowserPush');
        expect(toggle).toBeDisabled();
        expect(toggle).not.toBeChecked();
        expect(toggle).toHaveAccessibleDescription('Non ancora disponibile');
      }
      // The others are free.
      expect(switchOf('NewBooking', 'Email')).toBeEnabled();
    });

    it('switch_Moved_SavesThatEventOnlyAndReadsTheSettingsAgain', async () => {
      renderPage();
      await screen.findByTestId('notification-table');
      expect(screen.getByTestId('notification-default-NewBooking')).toBeInTheDocument();

      fireEvent.click(switchOf('NewBooking', 'Email'));

      await waitFor(() => expect(notificationPreferencesApi.save).toHaveBeenCalledTimes(1));
      // Per event and channel (AC-NF65-1): only the channels of this event, in the order of the columns; the other events are not in the request.
      expect(lastSave()).toEqual({ events: [{ eventType: 'NewBooking', channels: ['MobilePush', 'Email', 'CounterOnly'] }] });
      // The settings are read again and the row is no longer the default; the others still are.
      await waitFor(() => expect(notificationPreferencesApi.get).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByTestId('notification-default-NewBooking')).not.toBeInTheDocument());
      expect(switchOf('NewBooking', 'Email')).toBeChecked();
      expect(screen.getAllByText('Predefinito')).toHaveLength(7);
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Preferenze salvate.', SAVED_TOAST));
    });

    it('switch_MovedWhileTheSaveIsOnItsWay_ShowsTheNewValueAtOnceAndNeverFlipsBack', async () => {
      let finish: () => void = () => undefined;
      vi.mocked(notificationPreferencesApi.save).mockImplementationOnce(
        (request) =>
          new Promise<NotificationPreferences>((resolve) => {
            finish = () => resolve(applySave(request));
          }),
      );
      renderPage();
      await screen.findByTestId('notification-table');

      fireEvent.click(switchOf('NewBooking', 'Email'));

      // The server has not answered: the row already shows what is being saved.
      await waitFor(() => expect(switchOf('NewBooking', 'Email')).toBeChecked());
      expect(screen.getByTestId('notification-row-NewBooking')).toHaveAttribute('aria-busy', 'true');
      finish();
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('notification-row-NewBooking')).not.toHaveAttribute('aria-busy'));
      expect(switchOf('NewBooking', 'Email')).toBeChecked();
    });

    it('switch_SecondOneMovedWhileTheFirstSaveIsOnItsWay_BuildsOnItAndTheRequestHasBothChanges', async () => {
      const answers: Array<() => void> = [];
      vi.mocked(notificationPreferencesApi.save).mockImplementation(
        (request) =>
          new Promise<NotificationPreferences>((resolve) => {
            answers.push(() => resolve(applySave(request)));
          }),
      );
      renderPage();
      await screen.findByTestId('notification-table');

      // A new booking is a push and the bell: the email goes on, and before the server has answered the push goes off.
      fireEvent.click(switchOf('NewBooking', 'Email'));
      await waitFor(() => expect(switchOf('NewBooking', 'Email')).toBeChecked());
      fireEvent.click(switchOf('NewBooking', 'MobilePush'));
      await waitFor(() => expect(switchOf('NewBooking', 'MobilePush')).not.toBeChecked());

      // The second request starts from the first one (the email is still in it), not from what the server had before the first.
      expect(notificationPreferencesApi.save).toHaveBeenCalledTimes(2);
      expect(vi.mocked(notificationPreferencesApi.save).mock.calls.map(([request]) => request)).toEqual([
        { events: [{ eventType: 'NewBooking', channels: ['MobilePush', 'Email', 'CounterOnly'] }] },
        { events: [{ eventType: 'NewBooking', channels: ['Email', 'CounterOnly'] }] },
      ]);
      expect(switchOf('NewBooking', 'Email')).toBeChecked();
      expect(switchOf('NewBooking', 'CounterOnly')).toBeChecked();

      for (const answer of answers) answer();
      await waitFor(() => expect(screen.getByTestId('notification-row-NewBooking')).not.toHaveAttribute('aria-busy'));
      expect(switchOf('NewBooking', 'MobilePush')).not.toBeChecked();
      expect(switchOf('NewBooking', 'Email')).toBeChecked();
      expect(switchOf('NewBooking', 'CounterOnly')).toBeChecked();
    });

    it('switch_LastChannelOfAnEventThatIsNotLegal_CanBeSwitchedOffAndNothingIsLeft', async () => {
      renderPage();
      await screen.findByTestId('notification-table');

      fireEvent.click(switchOf('BookingCancelled', 'CounterOnly'));

      await waitFor(() => expect(lastSave()).toEqual({ events: [{ eventType: 'BookingCancelled', channels: [] }] }));
      await waitFor(() => expect(switchOf('BookingCancelled', 'CounterOnly')).not.toBeChecked());
    });

    it('save_Refused_ShowsTheMessageOfTheApiAndTheSwitchGoesBack', async () => {
      vi.mocked(notificationPreferencesApi.save).mockRejectedValueOnce(
        problem(422, { code: 'notification_legal_channel_required', detail: 'Messaggio del server che non si deve vedere.' }),
      );
      renderPage();
      await screen.findByTestId('notification-table');

      fireEvent.click(switchOf('NewBooking', 'Email'));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Le scadenze di legge non possono restare senza un canale: lascia attivo almeno un canale.'),
      );
      await waitFor(() => expect(switchOf('NewBooking', 'Email')).not.toBeChecked());
      expect(toast.success).not.toHaveBeenCalled();
      // Nothing changed on the server, so the settings were not read again.
      expect(notificationPreferencesApi.get).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('notification-default-NewBooking')).toBeInTheDocument();
    });

    it('save_FailsWithoutAMessage_SaysItInGeneralTermsAndTheSwitchGoesBack', async () => {
      vi.mocked(notificationPreferencesApi.save).mockRejectedValueOnce(problem(500, {}));
      renderPage();
      await screen.findByTestId('notification-table');

      fireEvent.click(switchOf('NewBooking', 'Email'));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Non siamo riusciti a salvare la scelta. Riprova.'));
      await waitFor(() => expect(switchOf('NewBooking', 'Email')).not.toBeChecked());
    });
  });

  describe('the legal deadline (AC-NF65-3)', () => {
    it('legalDeadline_EverySwitchOfTheRowAnsweredUntilOneChannelIsLeft_ThenThatOneIsLockedWithTheReason', async () => {
      renderPage();
      await screen.findByTestId('notification-table');
      // The rule is written in the row from the start, not only when it blocks.
      expect(within(screen.getByTestId('notification-row-LegalDeadline')).getByText(LEGAL_SENTENCE)).toBeInTheDocument();

      // Three channels: any of them can go.
      fireEvent.click(switchOf('LegalDeadline', 'MobilePush'));
      await waitFor(() => expect(lastSave()).toEqual({ events: [{ eventType: 'LegalDeadline', channels: ['Email', 'CounterOnly'] }] }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
      expect(switchOf('LegalDeadline', 'MobilePush')).not.toBeChecked();
      expect(switchOf('LegalDeadline', 'Email')).toBeEnabled();

      fireEvent.click(switchOf('LegalDeadline', 'Email'));
      await waitFor(() => expect(lastSave()).toEqual({ events: [{ eventType: 'LegalDeadline', channels: ['CounterOnly'] }] }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));

      // One is left: it stays on, cannot be moved, and the sentence that says why is its description.
      const last = switchOf('LegalDeadline', 'CounterOnly');
      await waitFor(() => expect(last).toBeDisabled());
      expect(last).toBeChecked();
      expect(last).toHaveAccessibleDescription(LEGAL_SENTENCE);
      const saves = vi.mocked(notificationPreferencesApi.save).mock.calls.length;
      fireEvent.click(last);
      expect(notificationPreferencesApi.save).toHaveBeenCalledTimes(saves);

      // The others of the row can still be switched on, and no save ever left the legal deadline without a channel.
      expect(switchOf('LegalDeadline', 'Email')).toBeEnabled();
      for (const [request] of vi.mocked(notificationPreferencesApi.save).mock.calls) {
        for (const event of request.events ?? []) expect(event.channels.length).toBeGreaterThan(0);
      }
    });

    it('legalDeadline_SwitchesMovedWhileTheFirstSaveIsOnItsWay_NeverLeaveItWithoutAChannelAndTheLastOneSendsNothing', async () => {
      const answers: Array<() => void> = [];
      vi.mocked(notificationPreferencesApi.save).mockImplementation(
        (request) =>
          new Promise<NotificationPreferences>((resolve) => {
            answers.push(() => resolve(applySave(request)));
          }),
      );
      renderPage();
      await screen.findByTestId('notification-table');

      // Three channels. The push goes off, then the email, and the server has answered neither.
      fireEvent.click(switchOf('LegalDeadline', 'MobilePush'));
      await waitFor(() => expect(switchOf('LegalDeadline', 'MobilePush')).not.toBeChecked());
      fireEvent.click(switchOf('LegalDeadline', 'Email'));
      await waitFor(() => expect(switchOf('LegalDeadline', 'Email')).not.toBeChecked());

      // The row is built on what is being saved, so the bell is already the last channel: locked, on, with the sentence that says why.
      const last = switchOf('LegalDeadline', 'CounterOnly');
      expect(last).toBeDisabled();
      expect(last).toBeChecked();
      expect(last).toHaveAccessibleDescription(LEGAL_SENTENCE);
      fireEvent.click(last);

      // The second request carries both changes, the third click sends nothing, and no request is empty.
      expect(notificationPreferencesApi.save).toHaveBeenCalledTimes(2);
      const requests = vi.mocked(notificationPreferencesApi.save).mock.calls.map(([request]) => request);
      expect(requests).toEqual([
        { events: [{ eventType: 'LegalDeadline', channels: ['Email', 'CounterOnly'] }] },
        { events: [{ eventType: 'LegalDeadline', channels: ['CounterOnly'] }] },
      ]);
      for (const request of requests) {
        for (const event of request.events ?? []) expect(event.channels.length).toBeGreaterThan(0);
      }

      for (const answer of answers) answer();
      await waitFor(() => expect(screen.getByTestId('notification-row-LegalDeadline')).not.toHaveAttribute('aria-busy'));
      expect(switchOf('LegalDeadline', 'CounterOnly')).toBeChecked();
      expect(switchOf('LegalDeadline', 'CounterOnly')).toBeDisabled();
      expect(notificationPreferencesApi.save).toHaveBeenCalledTimes(2);
    });

    it('legalDeadline_ASetWithOnlyOneChannelFromTheStart_IsLockedToo', async () => {
      server = withChosen(server, 'LegalDeadline', ['Email']);
      renderPage();
      await screen.findByTestId('notification-table');

      expect(switchOf('LegalDeadline', 'Email')).toBeDisabled();
      expect(switchOf('LegalDeadline', 'Email')).toBeChecked();
      // Any other kind of event with one channel is not.
      expect(switchOf('SyncError', 'CounterOnly')).toBeEnabled();
    });
  });

  describe('the quiet hours', () => {
    it('quietHours_ShowTheTimesOfTheServerAndSaveBothAsHoursMinutesAndSeconds', async () => {
      renderPage();
      await screen.findByTestId('quiet-hours');
      const start = screen.getByLabelText('Dalle');
      const end = screen.getByLabelText('Alle');
      const save = screen.getByTestId('quiet-hours-save');

      expect(start).toHaveValue('22:00');
      expect(end).toHaveValue('08:00');
      expect(save).toBeDisabled();
      // The page says that a legal deadline still alerts, and that the times are the Italian ones.
      expect(screen.getByTestId('quiet-hours-legal')).toHaveTextContent('Le scadenze di legge ti avvisano comunque, anche in queste ore.');
      expect(screen.getByText(/Gli orari sono quelli italiani/)).toBeInTheDocument();

      fireEvent.change(start, { target: { value: '23:30' } });
      expect(save).toBeEnabled();
      fireEvent.click(save);

      await waitFor(() => expect(notificationPreferencesApi.save).toHaveBeenCalledTimes(1));
      expect(lastSave()).toEqual({ quietHours: { start: '23:30:00', end: '08:00:00' } });
      // Saved: the fields show what the server has, and there is nothing left to save.
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Preferenze salvate.', SAVED_TOAST));
      await waitFor(() => expect(screen.getByTestId('quiet-hours-save')).toBeDisabled());
      expect(screen.getByLabelText('Dalle')).toHaveValue('23:30');
    });

    it('quietHours_AFieldIsCleared_SaysWhatIsMissingAndSavesNothing', async () => {
      renderPage();
      await screen.findByTestId('quiet-hours');

      fireEvent.change(screen.getByLabelText('Alle'), { target: { value: '' } });

      expect(screen.getByText("Indica sia l'ora di inizio sia quella di fine.")).toBeInTheDocument();
      expect(screen.getByTestId('quiet-hours-save')).toBeDisabled();
      fireEvent.submit(screen.getByTestId('quiet-hours-form'));
      expect(notificationPreferencesApi.save).not.toHaveBeenCalled();
    });

    it('quietHours_SameStartAndEnd_SayThereAreNoQuietHours', async () => {
      renderPage();
      await screen.findByTestId('quiet-hours');
      expect(screen.queryByTestId('quiet-hours-none')).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Alle'), { target: { value: '22:00' } });

      expect(screen.getByTestId('quiet-hours-none')).toHaveTextContent("Con inizio e fine uguali non c'è nessun silenzio.");
      expect(screen.getByTestId('quiet-hours-save')).toBeEnabled();
    });

    it('quietHours_ServerSaysLegalDeadlinesDoNotOverrideThem_PageDoesNotClaimTheyDo', async () => {
      server = { ...server, quietHours: { ...server.quietHours, legalAlertsOverride: false } };
      renderPage();
      await screen.findByTestId('quiet-hours');

      expect(screen.queryByTestId('quiet-hours-legal')).not.toBeInTheDocument();
    });
  });

  describe('the page', () => {
    it('render_WhileLoading_ShowsAPlaceholderAndThenTheMatrix', async () => {
      renderPage();

      expect(screen.getByRole('status')).toHaveTextContent('Carico le tue notifiche…');
      expect(await screen.findByTestId('notification-table')).toBeInTheDocument();
    });

    it('render_LoadFails_SaysSoAndOffersToTryAgain', async () => {
      vi.mocked(notificationPreferencesApi.get).mockRejectedValueOnce(problem(500, {}));
      renderPage();

      expect(await screen.findByText('Non riusciamo a caricare le tue notifiche.')).toBeInTheDocument();
      expect(screen.queryByTestId('notification-table')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

      expect(await screen.findByTestId('notification-table')).toBeInTheDocument();
    });

    it('page_OpenedAgainWhileTheAppStillHasTheSettingsFresh_ReadsThemAgain', async () => {
      // The app keeps what it read for 5 minutes and does not read again on mount: the page asks for the opposite, because a row is
      // built from the settings and would write over a choice made on another device.
      const client = appLikeClient();
      const first = renderPage(client);
      await screen.findByTestId('notification-table');
      expect(notificationPreferencesApi.get).toHaveBeenCalledTimes(1);
      expect(switchOf('NewBooking', 'MobilePush')).toBeChecked();
      first.unmount();

      server = withChosen(server, 'NewBooking', ['CounterOnly']);
      renderPage(client);

      await waitFor(() => expect(notificationPreferencesApi.get).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(switchOf('NewBooking', 'MobilePush')).not.toBeChecked());
      expect(screen.queryByTestId('notification-default-NewBooking')).not.toBeInTheDocument();
    });

    it('page_WindowComesBack_ReadsTheSettingsAgainBeforeARowIsBuiltFromThem', async () => {
      renderPage(appLikeClient());
      await screen.findByTestId('notification-table');
      expect(notificationPreferencesApi.get).toHaveBeenCalledTimes(1);
      expect(switchOf('NewBooking', 'MobilePush')).toBeChecked();

      // A choice is changed on another device, and the person comes back to this window (TanStack Query listens to `visibilitychange`).
      server = withChosen(server, 'NewBooking', ['CounterOnly']);
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));

      await waitFor(() => expect(notificationPreferencesApi.get).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(switchOf('NewBooking', 'MobilePush')).not.toBeChecked());
      expect(screen.queryByTestId('notification-default-NewBooking')).not.toBeInTheDocument();
    });

    it('render_IsTheSecondTabOfTheProfile', async () => {
      renderPage();

      const tabs = within(screen.getByRole('navigation', { name: 'Sezioni di Profilo' })).getAllByRole('link');
      expect(tabs.map((tab) => [tab.textContent, tab.getAttribute('href')])).toEqual([
        ['Profilo', '/app/short-rent/profile'],
        ['Notifiche', '/app/short-rent/profile/notifications'],
      ]);
      expect(tabs[1]).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('heading', { level: 1, name: 'Notifiche' })).toBeInTheDocument();
      await screen.findByTestId('notification-table');
    });

    it('render_InEnglish_UsesTheEnglishTextsOnly', async () => {
      await i18n.changeLanguage('en');
      renderPage();
      await screen.findByTestId('notification-table');

      expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
      expect(screen.getByText('New guest message')).toBeInTheDocument();
      expect(screen.getByText('Quiet hours')).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'New booking: Phone notification' })).toBeChecked();
      expect(screen.getAllByText('Default')).toHaveLength(8);
      expect(screen.queryByText('Predefinito')).not.toBeInTheDocument();
    });

    it('render_Table_HasNoAccessibilityViolationThatAxeCanFindWithoutABrowser', async () => {
      const { container } = renderPage();
      await screen.findByTestId('notification-table');

      await expectNoAxeViolations(container);
    });
  });

  describe('on a phone', () => {
    it('render_Phone_ShowsACardForEachEventWithItsFourNamedSwitchesAndSavesLikeTheTable', async () => {
      stubViewportWidth(375);
      renderPage();
      await screen.findByTestId('notification-cards');

      expect(screen.queryByTestId('notification-table')).not.toBeInTheDocument();
      expect(screen.getAllByTestId(/^notification-row-/)).toHaveLength(8);
      expect(screen.getAllByRole('switch')).toHaveLength(32);
      const card = screen.getByTestId('notification-row-LegalDeadline');
      expect(within(card).getByText(LEGAL_SENTENCE)).toBeInTheDocument();
      expect(within(card).getByRole('group', { name: 'Scadenza di legge' })).toBeInTheDocument();
      // Browser push says why it is off, in each card.
      expect(switchOf('NewBooking', 'BrowserPush')).toBeDisabled();
      expect(switchOf('NewBooking', 'BrowserPush')).toHaveAccessibleDescription('Non ancora disponibile');

      fireEvent.click(screen.getByRole('switch', { name: 'Nuova prenotazione: Email' }));

      await waitFor(() => expect(lastSave()).toEqual({ events: [{ eventType: 'NewBooking', channels: ['MobilePush', 'Email', 'CounterOnly'] }] }));
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Nuova prenotazione: Email' })).toBeChecked());
    });

    it('render_Phone_LastChannelOfTheLegalDeadlineIsLockedInItsCardToo', async () => {
      stubViewportWidth(375);
      server = withChosen(server, 'LegalDeadline', ['MobilePush']);
      renderPage();
      await screen.findByTestId('notification-cards');

      const lock = switchOf('LegalDeadline', 'MobilePush');
      expect(lock).toBeDisabled();
      expect(lock).toHaveAccessibleDescription(LEGAL_SENTENCE);
    });

    it('render_Phone_HasNoAccessibilityViolationThatAxeCanFindWithoutABrowser', async () => {
      stubViewportWidth(375);
      const { container } = renderPage();
      await screen.findByTestId('notification-cards');

      await expectNoAxeViolations(container);
    });
  });
});
