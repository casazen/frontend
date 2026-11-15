import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import type { ContextBootstrapDto } from '@/api/contexts';
import { propertiesApi } from '@/api/properties.api';
import { routinesApi } from '@/api/routines.api';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { DEFAULT_FEATURE_FLAGS, isFeatureEnabled, parseFeatureFlags } from '@/config/feature-flags';
import {
  ROUTE_MANIFEST,
  getNavChildren,
  getSecondaryNavEntries,
  getVisibleNavEntries,
  hasEntryPermission,
  isEntryFeatureEnabled,
} from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { useWorkspace } from '@/hooks/use-workspace';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import type { Property, Routine, RoutineActionCatalogItem, RoutineExecution } from '@/types';
import { RoutinesPage } from '../RoutinesPage';

vi.mock('@/api/routines.api', () => ({
  routinesApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    setActive: vi.fn(),
    setTestMode: vi.fn(),
    getActionCatalog: vi.fn(),
    getExecutions: vi.fn(),
    simulate: vi.fn(),
  },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/hooks/use-empty-workspace-recovery', () => ({ useEmptyWorkspaceRecovery: () => false }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const ROUTINES_PATH = '/app/short-rent/automations';

/** What `GET /routines/actions` says today: the wait and the To do run, the others do not exist yet. */
const CATALOG: RoutineActionCatalogItem[] = [
  { type: 'MessageToGuest', available: false, code: 'routine_action_not_available' },
  { type: 'NotifyOwner', available: false, code: 'routine_action_not_available' },
  { type: 'NotifyStaff', available: false, code: 'routine_action_not_available' },
  { type: 'NotifyTeam', available: false, code: 'routine_action_not_available' },
  { type: 'CreateActivity', available: true, code: null },
  { type: 'SendAccessCode', available: false, code: 'routine_action_not_available' },
  { type: 'RequestReview', available: false, code: 'routine_action_not_available' },
  { type: 'AddTag', available: false, code: 'routine_action_not_available' },
  { type: 'Wait', available: true, code: null },
];

function routine(overrides: Partial<Routine> & { id: string }): Routine {
  return {
    orgId: 'org-1',
    name: 'Una routine',
    eventType: 'CheckoutOccurred',
    eventConfig: '{}',
    conditionJson: '{}',
    actionsJson: JSON.stringify([{ type: 'CreateActivity', config: { text: 'Prepara la pulizia' } }]),
    testMode: false,
    active: true,
    ...overrides,
  };
}

const CLEANING = routine({ id: 'r1', name: 'Pulizia al check-out' });
const IN_TEST = routine({
  id: 'r2',
  name: 'Istruzioni prima dell’arrivo',
  eventType: 'BeforeCheckin',
  eventConfig: '{"days":2,"hours":0}',
  actionsJson: JSON.stringify([{ type: 'MessageToGuest', config: { channel: 'email' } }]),
  testMode: true,
});
const OFF_WITH_NOTIFY = routine({
  id: 'r3',
  name: 'Avvisa il proprietario',
  eventType: 'BookingNew',
  actionsJson: JSON.stringify([{ type: 'NotifyOwner', config: {} }]),
  active: false,
});

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[ROUTINES_PATH]}>
        <Routes>
          <Route path={ROUTINES_PATH} element={<RoutinesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

/** Opens «Crea routine» and waits for the form. */
async function openCreateEditor() {
  fireEvent.click(await screen.findByTestId('create-routine-button'));
  return screen.findByTestId('routine-name-input');
}

describe('the routines page (E01/F04/US02/T01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(routinesApi.getAll).mockResolvedValue([CLEANING, IN_TEST, OFF_WITH_NOTIFY]);
    vi.mocked(routinesApi.getActionCatalog).mockResolvedValue(CATALOG);
    vi.mocked(routinesApi.getExecutions).mockResolvedValue([]);
    vi.mocked(propertiesApi.getAll).mockResolvedValue([{ id: 'p1', name: 'Casa Mare' }, { id: 'p2', name: 'Casa Monti' }] as Property[]);
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  describe('the list', () => {
    it('RoutinesPage_RoutinesOfTheApi_AreListedInTheTabOfTheirState', async () => {
      renderPage();

      expect(await screen.findByTestId('routine-card-r1')).toHaveTextContent('Pulizia al check-out');
      expect(screen.getByTestId('active-tab')).toHaveTextContent('Attive (1)');
      expect(screen.getByTestId('test-tab')).toHaveTextContent('Test (1)');
      expect(screen.getByTestId('inactive-tab')).toHaveTextContent('Inattive (1)');
      // The card names the event and its actions, as words and not as the codes of the API.
      expect(screen.getByTestId('routine-card-r1')).toHaveTextContent('Check-out effettuato');
      expect(screen.getByTestId('routine-card-r1')).toHaveTextContent('Crea attività');
      expect(screen.queryByTestId('routine-card-r2')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('test-tab'));
      expect(screen.getByTestId('routine-card-r2')).toHaveTextContent('Istruzioni prima dell’arrivo');
      expect(screen.getByTestId('test-mode-badge')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('inactive-tab'));
      expect(screen.getByTestId('routine-card-r3')).toHaveTextContent('Avvisa il proprietario');
    });

    it('RoutinesPage_RoutineHoldingAnActionThatCannotRunYet_SaysSoOnItsCard', async () => {
      renderPage();

      fireEvent.click(await screen.findByTestId('inactive-tab'));

      expect(await screen.findByTestId('routine-unavailable-r3')).toHaveTextContent(
        'Contiene azioni non ancora disponibili (Notifica proprietario): finché non lo sono, funziona solo in modalità test.',
      );
    });

    it('RoutinesPage_NoRoutine_SaysWhatRoutinesAreAndOffersTheLibrary', async () => {
      vi.mocked(routinesApi.getAll).mockResolvedValue([]);
      renderPage();

      expect(await screen.findByTestId('routines-empty')).toHaveTextContent('Nessuna routine per ora');
      // One sentence on what a routine is, under the title.
      expect(screen.getByText(/Una routine fa partire da sola un'azione quando succede qualcosa a un soggiorno/)).toBeInTheDocument();

      fireEvent.click(within(screen.getByTestId('routines-empty')).getByRole('button', { name: 'Apri la libreria' }));
      expect(await screen.findByTestId('library-template-0')).toBeInTheDocument();
    });

    it('RoutinesPage_ServerAnswers404BecauseItsFlagIsOff_IsACalmNoteAndNotAnError', async () => {
      vi.mocked(routinesApi.getAll).mockRejectedValue(httpError(404));
      vi.mocked(routinesApi.getActionCatalog).mockRejectedValue(httpError(404));
      renderPage();

      expect(await screen.findByTestId('routines-unavailable')).toHaveTextContent('Le automazioni non sono disponibili in questo momento');
      expect(screen.queryByTestId('routines-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('create-routine-button')).not.toBeInTheDocument();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('RoutinesPage_ReadingAgainFailsWithA404_NeverShowsTheOldRoutinesAsCurrent', async () => {
      const { client } = renderPage();
      expect(await screen.findByTestId('routine-card-r1')).toBeInTheDocument();

      // The flag went off while the page was open: the query keeps the old data on the error, the page must not.
      vi.mocked(routinesApi.getAll).mockRejectedValue(httpError(404));
      await client.refetchQueries({ queryKey: ['routines'] });

      expect(await screen.findByTestId('routines-unavailable')).toBeInTheDocument();
      expect(screen.queryByTestId('routine-card-r1')).not.toBeInTheDocument();
    });

    it('RoutinesPage_ReadingFailsOtherwise_IsAnErrorWithARetry', async () => {
      vi.mocked(routinesApi.getAll).mockRejectedValue(httpError(500));
      renderPage();

      expect(await screen.findByTestId('routines-error')).toBeInTheDocument();
      expect(screen.queryByTestId('routines-unavailable')).not.toBeInTheDocument();
    });

    it('RoutinesPage_List_HasNoAccessibilityViolation', async () => {
      const { container } = renderPage();

      await screen.findByTestId('routine-card-r1');
      await expectNoAxeViolations(container);
    });
  });

  describe('the editor', () => {
    it('RoutineEditor_ActionThatTheCatalogSaysCannotRun_IsListedButDisabledWithTheNoteAndTheHint', async () => {
      renderPage();
      await openCreateEditor();

      fireEvent.click(screen.getByTestId('add-action-button'));
      const select = await screen.findByTestId('action-type-select-0');

      // Every action is listed; the ones that cannot run yet are disabled and say it, the ones that run are not.
      expect(within(select).getAllByRole('option')).toHaveLength(9);
      expect(within(select).getByRole('option', { name: 'Notifica proprietario · Non ancora disponibile' })).toBeDisabled();
      expect(within(select).getByRole('option', { name: 'Invia messaggio all\'ospite · Non ancora disponibile' })).toBeDisabled();
      expect(within(select).getByRole('option', { name: 'Crea attività' })).toBeEnabled();
      expect(within(select).getByRole('option', { name: 'Attendi' })).toBeEnabled();
      expect(screen.getByTestId('action-unavailable-hint')).toHaveTextContent('Le azioni non ancora disponibili non si possono scegliere');
      // A new line starts from an action that runs.
      expect(select).toHaveValue('CreateActivity');
    });

    it('RoutineEditor_EventPicker_NeverOffersTheWeeklyRecurrence', async () => {
      renderPage();
      await openCreateEditor();

      const options = within(screen.getByTestId('event-type-select')).getAllByRole('option');
      expect(options.map((option) => (option as HTMLOptionElement).value)).not.toContain('WeeklyRecurrence');
      expect(options.length).toBeGreaterThan(5);
    });

    it('RoutineEditor_RoutineHoldingAnActionThatCannotRun_CannotBeSwitchedOnAndTheEditorSaysSo', async () => {
      vi.mocked(routinesApi.update).mockResolvedValue(OFF_WITH_NOTIFY);
      renderPage();

      fireEvent.click(await screen.findByTestId('inactive-tab'));
      fireEvent.click(await screen.findByTestId('edit-routine-r3'));

      const active = await screen.findByTestId('active-switch');
      expect(active).toBeDisabled();
      expect(active).not.toBeChecked();
      expect(screen.getByTestId('active-blocked')).toHaveTextContent('contiene azioni non ancora disponibili');
      expect(screen.getByTestId('action-unavailable-0')).toHaveTextContent('Non ancora disponibile');

      // It can still be saved, and it goes out as off: the server would refuse it on.
      fireEvent.click(screen.getByTestId('save-routine-button'));
      await waitFor(() => expect(routinesApi.update).toHaveBeenCalledTimes(1));
      expect(vi.mocked(routinesApi.update).mock.calls[0][1]).toMatchObject({ testMode: false, active: false });

      // In test mode the same routine may be on: it only simulates.
    });

    it('RoutineEditor_TestModeOnARoutineThatHoldsAnActionThatCannotRun_LetsItBeSwitchedOn', async () => {
      renderPage();

      fireEvent.click(await screen.findByTestId('inactive-tab'));
      fireEvent.click(await screen.findByTestId('edit-routine-r3'));
      fireEvent.click(await screen.findByTestId('test-mode-switch'));

      expect(screen.getByTestId('active-switch')).toBeEnabled();
      expect(screen.queryByTestId('active-blocked')).not.toBeInTheDocument();
    });

    it('RoutineEditor_Condition_OffersOnlyTheFiveFieldsARoutineReadsAndWritesValuesOfTheKindTheOperatorTakes', async () => {
      vi.mocked(routinesApi.create).mockResolvedValue(CLEANING);
      renderPage();
      fireEvent.change(await openCreateEditor(), { target: { value: 'Solo per i diretti' } });

      // A new routine has no condition: it runs for every booking.
      expect(screen.getByTestId('condition-none')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('add-condition-button'));
      expect(within(screen.getByTestId('condition-field-0')).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)).toEqual([
        'channel',
        'propertyId',
        'stayDuration',
        'guestCount',
        'bookingLeadTime',
      ]);

      // channel is one of a list: the names of the API, chosen and not typed.
      fireEvent.click(within(screen.getByTestId('condition-value-0')).getByLabelText('Sito diretto'));
      fireEvent.click(within(screen.getByTestId('condition-value-0')).getByLabelText('Inserita a mano'));

      // The nights are between two whole numbers: numbers, not texts.
      fireEvent.click(screen.getByTestId('add-condition-button'));
      fireEvent.change(screen.getByTestId('condition-field-1'), { target: { value: 'stayDuration' } });
      fireEvent.change(screen.getByTestId('condition-operator-1'), { target: { value: 'between' } });
      fireEvent.change(screen.getByTestId('condition-low-1'), { target: { value: '2' } });
      fireEvent.change(screen.getByTestId('condition-high-1'), { target: { value: '5' } });
      fireEvent.change(screen.getByTestId('condition-match'), { target: { value: 'OR' } });

      fireEvent.click(screen.getByTestId('add-action-button'));
      fireEvent.change(screen.getByTestId('activity-text-0'), { target: { value: 'Controlla la casa' } });
      fireEvent.change(screen.getByTestId('activity-due-0'), { target: { value: '1' } });
      fireEvent.click(screen.getByTestId('save-routine-button'));

      await waitFor(() => expect(routinesApi.create).toHaveBeenCalledTimes(1));
      expect(routinesApi.create).toHaveBeenCalledWith({
        name: 'Solo per i diretti',
        eventType: 'BookingConfirmed',
        eventConfig: {},
        condition: {
          version: '1.0',
          groups: [
            {
              operator: 'OR',
              rules: [
                { fieldId: 'channel', operator: 'in', value: ['Direct', 'Manual'] },
                { fieldId: 'stayDuration', operator: 'between', value: [2, 5] },
              ],
            },
          ],
        },
        actions: [{ type: 'CreateActivity', config: { text: 'Controlla la casa', dueInDays: 1 } }],
        testMode: false,
        active: true,
      });
    });

    it('RoutineEditor_PropertyRule_ChoosesAmongThePropertiesOfTheHostAndSendsTheirIds', async () => {
      vi.mocked(routinesApi.create).mockResolvedValue(CLEANING);
      renderPage();
      fireEvent.change(await openCreateEditor(), { target: { value: 'Solo Casa Mare' } });
      // The properties are not asked for until a rule needs them.
      expect(propertiesApi.getAll).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('add-condition-button'));
      fireEvent.change(screen.getByTestId('condition-field-0'), { target: { value: 'propertyId' } });
      // A property is one of a list: there is no «is equal to» for it.
      expect(within(screen.getByTestId('condition-operator-0')).getAllByRole('option').map((option) => (option as HTMLOptionElement).value)).toEqual(['in', 'notIn']);

      fireEvent.click(await within(screen.getByTestId('condition-value-0')).findByLabelText('Casa Mare'));
      expect(propertiesApi.getAll).toHaveBeenCalledWith({ mode: 'short' });
      fireEvent.click(screen.getByTestId('add-action-button'));
      fireEvent.change(screen.getByTestId('activity-text-0'), { target: { value: 'Controlla' } });
      fireEvent.click(screen.getByTestId('save-routine-button'));

      await waitFor(() => expect(routinesApi.create).toHaveBeenCalledTimes(1));
      expect(vi.mocked(routinesApi.create).mock.calls[0][0]).toMatchObject({
        condition: { version: '1.0', groups: [{ operator: 'AND', rules: [{ fieldId: 'propertyId', operator: 'in', value: ['p1'] }] }] },
      });
    });

    it('RoutineEditor_ConditionNotCompleted_CannotBeSavedAndSaysWhy', async () => {
      renderPage();
      fireEvent.change(await openCreateEditor(), { target: { value: 'Incompleta' } });
      fireEvent.click(screen.getByTestId('add-action-button'));
      fireEvent.change(screen.getByTestId('activity-text-0'), { target: { value: 'Qualcosa' } });
      expect(screen.getByTestId('save-routine-button')).toBeEnabled();

      // A rule on the channel with no channel chosen is not a condition the server takes.
      fireEvent.click(screen.getByTestId('add-condition-button'));

      expect(screen.getByTestId('save-routine-button')).toBeDisabled();
      expect(screen.getByTestId('condition-problem')).toHaveTextContent('Completa il valore di ogni condizione.');
    });

    it('RoutineEditor_WaitAndTimeOfAnEvent_AreSentAsNumbers', async () => {
      vi.mocked(routinesApi.create).mockResolvedValue(CLEANING);
      renderPage();
      fireEvent.change(await openCreateEditor(), { target: { value: 'Prima dell’arrivo' } });
      fireEvent.change(screen.getByTestId('event-type-select'), { target: { value: 'BeforeCheckin' } });
      fireEvent.change(screen.getByTestId('timing-days-input'), { target: { value: '2' } });
      fireEvent.change(screen.getByTestId('timing-hours-input'), { target: { value: '6' } });

      fireEvent.click(screen.getByTestId('add-action-button'));
      fireEvent.change(screen.getByTestId('action-type-select-0'), { target: { value: 'Wait' } });
      fireEvent.change(screen.getByTestId('wait-days-0'), { target: { value: '0' } });
      fireEvent.change(screen.getByTestId('wait-hours-0'), { target: { value: '3' } });
      fireEvent.click(screen.getByTestId('save-routine-button'));

      await waitFor(() => expect(routinesApi.create).toHaveBeenCalledTimes(1));
      expect(routinesApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'BeforeCheckin',
          eventConfig: { days: 2, hours: 6 },
          actions: [{ type: 'Wait', config: { days: 0, hours: 3 } }],
        }),
      );
    });

    it('RoutineEditor_TimeOfAnEventStoredInHours_IsShownInDaysAndWrittenBackAsTheSameOffset', async () => {
      // `{ hours: 50 }` and `{ days: 2, hours: 2 }` are the same offset to the server; the editor shows days and hours of the day.
      const stored = routine({ id: 'r7', name: 'Dopo due giorni', eventType: 'AfterCheckout', eventConfig: '{"hours":50}' });
      vi.mocked(routinesApi.getAll).mockResolvedValue([stored]);
      vi.mocked(routinesApi.update).mockResolvedValue(stored);
      renderPage();

      fireEvent.click(await screen.findByTestId('edit-routine-r7'));
      expect(await screen.findByTestId('timing-days-input')).toHaveValue(2);
      expect(screen.getByTestId('timing-hours-input')).toHaveValue(2);

      fireEvent.click(screen.getByTestId('save-routine-button'));
      await waitFor(() => expect(routinesApi.update).toHaveBeenCalledTimes(1));
      expect(vi.mocked(routinesApi.update).mock.calls[0][1]).toMatchObject({ eventType: 'AfterCheckout', eventConfig: { days: 2, hours: 2 } });
    });

    it('RoutineEditor_WaitOfNothing_CannotBeSaved', async () => {
      renderPage();
      fireEvent.change(await openCreateEditor(), { target: { value: 'Attesa' } });
      fireEvent.click(screen.getByTestId('add-action-button'));
      fireEvent.change(screen.getByTestId('action-type-select-0'), { target: { value: 'Wait' } });
      fireEvent.change(screen.getByTestId('wait-days-0'), { target: { value: '0' } });
      fireEvent.change(screen.getByTestId('wait-hours-0'), { target: { value: '0' } });

      expect(screen.getByTestId('save-routine-button')).toBeDisabled();
      expect(screen.getByTestId('action-problem-0')).toHaveTextContent('L\'attesa deve durare da 1 ora a 365 giorni.');
    });

    it('RoutineEditor_ConditionThatTheEditorCannotShowWhole_IsLeftAsItIsOnSave', async () => {
      // Two groups: a shape the editor does not draw. Saving the rest must not rewrite it (the server keeps what the body leaves out).
      const twoGroups = routine({
        id: 'r9',
        name: 'Con due gruppi',
        conditionJson: JSON.stringify({
          version: '1.0',
          groups: [
            { operator: 'AND', rules: [{ fieldId: 'guestCount', operator: 'greaterThan', value: 2 }] },
            { operator: 'OR', rules: [{ fieldId: 'stayDuration', operator: 'lessThan', value: 7 }] },
          ],
        }),
      });
      vi.mocked(routinesApi.getAll).mockResolvedValue([twoGroups]);
      vi.mocked(routinesApi.update).mockResolvedValue(twoGroups);
      renderPage();

      fireEvent.click(await screen.findByTestId('edit-routine-r9'));
      expect(await screen.findByTestId('condition-unsupported')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('save-routine-button'));

      await waitFor(() => expect(routinesApi.update).toHaveBeenCalledTimes(1));
      expect(vi.mocked(routinesApi.update).mock.calls[0][1]).not.toHaveProperty('condition');
    });

    it('RoutineEditor_StoredCondition_IsShownAndWrittenBackAsItWas', async () => {
      const stored = routine({
        id: 'r8',
        name: 'Solo gruppi grandi',
        conditionJson: JSON.stringify({ version: '1.0', groups: [{ operator: 'AND', rules: [{ fieldId: 'guestCount', operator: 'greaterThan', value: 4 }] }] }),
      });
      vi.mocked(routinesApi.getAll).mockResolvedValue([stored]);
      vi.mocked(routinesApi.update).mockResolvedValue(stored);
      renderPage();

      fireEvent.click(await screen.findByTestId('edit-routine-r8'));
      expect(await screen.findByTestId('condition-field-0')).toHaveValue('guestCount');
      expect(screen.getByTestId('condition-operator-0')).toHaveValue('greaterThan');
      expect(screen.getByTestId('condition-value-0')).toHaveValue(4);

      fireEvent.click(screen.getByTestId('save-routine-button'));
      await waitFor(() => expect(routinesApi.update).toHaveBeenCalledTimes(1));
      expect(vi.mocked(routinesApi.update).mock.calls[0][1]).toMatchObject({
        condition: { version: '1.0', groups: [{ operator: 'AND', rules: [{ fieldId: 'guestCount', operator: 'greaterThan', value: 4 }] }] },
      });
    });
  });

  describe('switching a routine on', () => {
    it('RoutinesPage_ServerRefusesToSwitchOnBecauseOfAnAction_ShowsTheMessageAndLeavesTheSwitchOff', async () => {
      vi.mocked(routinesApi.setActive).mockRejectedValue(httpError(422, { code: 'routine_action_not_available', actions: ['NotifyOwner'] }));
      renderPage();

      fireEvent.click(await screen.findByTestId('inactive-tab'));
      const toggle = await screen.findByTestId('toggle-active-r3');
      expect(toggle).not.toBeChecked();
      fireEvent.click(toggle);

      await waitFor(() => expect(routinesApi.setActive).toHaveBeenCalledWith('r3', true));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Non si può attivare: contiene azioni non ancora disponibili (Notifica proprietario). Puoi provarla in modalità test.',
        ),
      );
      // The switch shows what the server holds: still off, and the routine is still in the tab of the inactive ones.
      expect(screen.getByTestId('toggle-active-r3')).not.toBeChecked();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('RoutinesPage_RefusalWithNoNamesOfActions_SaysItInTheWordsOfTheCode', async () => {
      vi.mocked(routinesApi.setActive).mockRejectedValue(httpError(422, { code: 'routine_action_not_available' }));
      renderPage();

      fireEvent.click(await screen.findByTestId('inactive-tab'));
      fireEvent.click(await screen.findByTestId('toggle-active-r3'));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Questa routine contiene azioni non ancora disponibili: non si può attivare, ma puoi provarla in modalità test.',
        ),
      );
    });

    it('RoutinesPage_ChangeNeedingTheWholeOrganization_ToldInWords', async () => {
      vi.mocked(routinesApi.setActive).mockRejectedValue(httpError(403, { code: 'routines_need_org_scope' }));
      renderPage();

      fireEvent.click(await screen.findByTestId('inactive-tab'));
      fireEvent.click(await screen.findByTestId('toggle-active-r3'));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Le routine valgono per tutti gli immobili dell’organizzazione: per cambiarle serve poterli vedere tutti.'),
      );
    });

    it('RoutinesPage_WriteOnACardInFlight_DisablesEveryControlOfThatCardAndOnlyOfThatCard', async () => {
      const pending = deferred<Routine>();
      vi.mocked(routinesApi.getAll).mockResolvedValue([CLEANING, routine({ id: 'r5', name: 'Altra routine' })]);
      vi.mocked(routinesApi.setActive).mockReturnValue(pending.promise);
      renderPage();

      fireEvent.click(await screen.findByTestId('toggle-active-r1'));

      await waitFor(() => expect(screen.getByTestId('toggle-test-mode-r1')).toBeDisabled());
      expect(screen.getByTestId('toggle-active-r1')).toBeDisabled();
      expect(screen.getByTestId('edit-routine-r1')).toBeDisabled();
      expect(screen.getByTestId('delete-routine-r1')).toBeDisabled();
      // Another routine is not waiting for it.
      expect(screen.getByTestId('toggle-active-r5')).toBeEnabled();
      expect(screen.getByTestId('toggle-test-mode-r5')).toBeEnabled();

      pending.resolve({ ...CLEANING, active: false });
      await waitFor(() => expect(screen.getByTestId('toggle-test-mode-r1')).toBeEnabled());
    });

    it('RoutinesPage_WritesOnTwoCardsInFlightAtOnce_KeepEachCardWaitingUntilItsOwnAnswer', async () => {
      const first = deferred<Routine>();
      const second = deferred<Routine>();
      const other = routine({ id: 'r5', name: 'Altra routine' });
      vi.mocked(routinesApi.getAll).mockResolvedValue([CLEANING, other]);
      vi.mocked(routinesApi.setActive).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      renderPage();

      // A write on the first card and, while it is still on its way, one with the same hook on the second: a mutation hook follows only its last call.
      fireEvent.click(await screen.findByTestId('toggle-active-r1'));
      await waitFor(() => expect(screen.getByTestId('toggle-test-mode-r1')).toBeDisabled());
      fireEvent.click(screen.getByTestId('toggle-active-r5'));
      await waitFor(() => expect(screen.getByTestId('toggle-test-mode-r5')).toBeDisabled());

      // The first card still waits for its own answer.
      for (const control of ['toggle-active-r1', 'toggle-test-mode-r1', 'edit-routine-r1', 'delete-routine-r1']) {
        expect(screen.getByTestId(control), control).toBeDisabled();
      }

      // The answer of the second one frees the second card only.
      second.resolve({ ...other, active: false });
      await waitFor(() => expect(screen.getByTestId('toggle-test-mode-r5')).toBeEnabled());
      for (const control of ['toggle-active-r1', 'toggle-test-mode-r1', 'edit-routine-r1', 'delete-routine-r1']) {
        expect(screen.getByTestId(control), control).toBeDisabled();
      }

      first.resolve({ ...CLEANING, active: false });
      await waitFor(() => expect(screen.getByTestId('toggle-test-mode-r1')).toBeEnabled());
      expect(screen.getByTestId('edit-routine-r1')).toBeEnabled();
      expect(screen.getByTestId('delete-routine-r1')).toBeEnabled();
    });

    it('RoutinesPage_WritesOfDifferentKindsOnTwoCards_KeepEachCardWaitingUntilItsOwnAnswer', async () => {
      const activation = deferred<Routine>();
      const testMode = deferred<Routine>();
      const other = routine({ id: 'r5', name: 'Altra routine' });
      vi.mocked(routinesApi.getAll).mockResolvedValue([CLEANING, other]);
      vi.mocked(routinesApi.setActive).mockReturnValueOnce(activation.promise);
      vi.mocked(routinesApi.setTestMode).mockReturnValueOnce(testMode.promise);
      renderPage();

      fireEvent.click(await screen.findByTestId('toggle-active-r1'));
      await waitFor(() => expect(screen.getByTestId('edit-routine-r1')).toBeDisabled());
      fireEvent.click(screen.getByTestId('toggle-test-mode-r5'));
      await waitFor(() => expect(screen.getByTestId('edit-routine-r5')).toBeDisabled());
      expect(screen.getByTestId('edit-routine-r1')).toBeDisabled();

      testMode.resolve({ ...other, testMode: true });
      await waitFor(() => expect(screen.getByTestId('edit-routine-r5')).toBeEnabled());
      expect(screen.getByTestId('edit-routine-r1')).toBeDisabled();

      activation.resolve({ ...CLEANING, active: false });
      await waitFor(() => expect(screen.getByTestId('edit-routine-r1')).toBeEnabled());
    });
  });

  describe('the library', () => {
    it('RoutineLibrary_TemplateWithAnActionThatCannotRun_IsCreatedInTestModeOnlyAndSaysWhy', async () => {
      vi.mocked(routinesApi.create).mockResolvedValue(IN_TEST);
      renderPage();

      fireEvent.click(await screen.findByTestId('open-library-button'));
      // The cleaning is a To do, which runs; the instructions need a message, which does not exist yet.
      expect(await screen.findByTestId('activate-template-0')).toBeEnabled();
      expect(screen.queryByTestId('template-unavailable-0')).not.toBeInTheDocument();
      expect(screen.getByTestId('template-unavailable-1')).toHaveTextContent('Non ancora disponibile');
      expect(screen.getByTestId('template-unavailable-1')).toHaveTextContent('puoi crearla solo in modalità test');
      // There is no way to create it on.
      expect(screen.queryByTestId('activate-template-1')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('test-template-1'));

      await waitFor(() => expect(routinesApi.create).toHaveBeenCalledTimes(1));
      expect(routinesApi.create).toHaveBeenCalledWith({
        name: 'Istruzioni prima dell\'arrivo',
        eventType: 'BeforeCheckin',
        eventConfig: { days: 2, hours: 0 },
        actions: [{ type: 'MessageToGuest', config: { channel: 'email' } }],
        testMode: true,
        active: true,
      });
      // What was just made is in the tab of the tests.
      await waitFor(() => expect(screen.getByTestId('test-tab')).toHaveAttribute('aria-pressed', 'true'));
    });

    it('RoutineLibrary_TemplateWhoseActionsRun_IsCreatedOnWithTheConfigurationTheServerTakes', async () => {
      vi.mocked(routinesApi.create).mockResolvedValue(CLEANING);
      renderPage();

      fireEvent.click(await screen.findByTestId('open-library-button'));
      fireEvent.click(await screen.findByTestId('activate-template-0'));

      await waitFor(() => expect(routinesApi.create).toHaveBeenCalledTimes(1));
      // The To do has the words the server asks for (`text`), not a type of activity the server does not read.
      expect(routinesApi.create).toHaveBeenCalledWith({
        name: 'Pulizia al check-out',
        eventType: 'CheckoutOccurred',
        actions: [{ type: 'CreateActivity', config: { text: 'Organizza la pulizia dell\'immobile dopo il check-out' } }],
        testMode: false,
        active: true,
      });
    });

    it('RoutineLibrary_NoTemplateHasAConditionTheServerRefuses', async () => {
      renderPage();

      fireEvent.click(await screen.findByTestId('open-library-button'));
      await screen.findByTestId('test-template-3');
      // The reminder of the documents had a condition on a field a routine does not read: it has none, and its text says that it goes to every guest.
      expect(screen.getByTestId('library-template-3')).toHaveTextContent('le routine non leggono ancora lo stato dei documenti');
      fireEvent.click(screen.getByTestId('test-template-3'));

      await waitFor(() => expect(routinesApi.create).toHaveBeenCalledTimes(1));
      expect(vi.mocked(routinesApi.create).mock.calls[0][0]).not.toHaveProperty('condition');
    });

    it('RoutineLibrary_CatalogThatCannotBeRead_MarksNothingAndTheServerDecidesWithoutAFalseSuccess', async () => {
      vi.mocked(routinesApi.getActionCatalog).mockRejectedValue(httpError(500));
      vi.mocked(routinesApi.create).mockRejectedValue(httpError(422, { code: 'routine_action_not_available', actions: ['MessageToGuest'] }));
      renderPage();

      fireEvent.click(await screen.findByTestId('open-library-button'));
      // Nothing is known of the actions, so nothing is marked; the activation is the server's to refuse, and it does.
      fireEvent.click(await screen.findByTestId('activate-template-1'));
      expect(screen.queryByTestId('template-unavailable-1')).not.toBeInTheDocument();

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Invia messaggio all\'ospite')));
      expect(toast.success).not.toHaveBeenCalled();
      // The library stays open on the same template: nothing was made.
      expect(screen.getByTestId('library-template-1')).toBeInTheDocument();
    });

    it('RoutineLibrary_CreationInFlight_DisablesEveryButtonOfTheLibrary', async () => {
      const pending = deferred<Routine>();
      vi.mocked(routinesApi.create).mockReturnValue(pending.promise);
      renderPage();

      fireEvent.click(await screen.findByTestId('open-library-button'));
      fireEvent.click(await screen.findByTestId('activate-template-0'));

      await waitFor(() => expect(screen.getByTestId('test-template-1')).toBeDisabled());
      expect(screen.getByTestId('activate-template-0')).toBeDisabled();
      pending.resolve(CLEANING);
    });
  });

  describe('the log and the deletion', () => {
    it('ExecutionLog_ActionsOfARunInTestMode_AreToldAsSimulatedAndAWaitIsNotAFailure', async () => {
      const waiting: RoutineExecution = {
        id: 'e1',
        orgId: 'org-1',
        routineId: 'r1',
        eventId: 'ev-1',
        startedAt: '2026-11-10T08:00:00Z',
        completedAt: null,
        outcome: 'Waiting',
        resumeAt: '2026-11-11T08:00:00Z',
        resultJson: JSON.stringify({ actions: [{ index: 0, type: 'Wait', outcome: 'waiting' }], nextActionIndex: 1 }),
      };
      const simulated: RoutineExecution = {
        id: 'e2',
        orgId: 'org-1',
        routineId: 'r1',
        eventId: 'ev-2',
        startedAt: '2026-11-09T08:00:00Z',
        completedAt: '2026-11-09T08:00:01Z',
        outcome: 'Success',
        resumeAt: null,
        resultJson: JSON.stringify({ actions: [{ index: 0, type: 'CreateActivity', outcome: 'simulated' }], nextActionIndex: 1 }),
      };
      const blocked: RoutineExecution = {
        ...simulated,
        id: 'e3',
        eventId: 'ev-3',
        outcome: 'Failed',
        resultJson: JSON.stringify({ actions: [{ index: 0, type: 'SendAccessCode', outcome: 'failed', code: 'routine_action_not_available' }], nextActionIndex: 0 }),
      };
      vi.mocked(routinesApi.getExecutions).mockResolvedValue([waiting, simulated, blocked]);
      renderPage();

      fireEvent.click(await screen.findByTestId('show-log-r1'));

      const waitingRow = await screen.findByTestId('execution-e1');
      expect(waitingRow).toHaveTextContent('In attesa');
      expect(waitingRow).toHaveTextContent('Riprende il');
      expect(screen.getByTestId('execution-actions-e2')).toHaveTextContent('Crea attività: Simulata: non è stato fatto nulla');
      expect(screen.getByTestId('execution-e3')).toHaveTextContent('Non riuscita');
      expect(screen.getByTestId('execution-actions-e3')).toHaveTextContent('L\'azione non è ancora disponibile: non ha fatto nulla.');
      // Never the raw words of the API.
      for (const row of [waitingRow, screen.getByTestId('execution-e2'), screen.getByTestId('execution-e3')]) {
        expect(row).not.toHaveTextContent(/Success|Failed|Waiting|routine_action_not_available/);
      }
    });

    it('RoutinesPage_DeleteAfterConfirming_DeletesTheRoutineAndSaysThatItsLogGoesToo', async () => {
      vi.mocked(routinesApi.delete).mockResolvedValue(undefined);
      renderPage();

      fireEvent.click(await screen.findByTestId('delete-routine-r1'));

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Vuoi eliminare la routine «Pulizia al check-out»?');
      expect(dialog).toHaveTextContent('Si cancella anche il registro delle sue esecuzioni.');
      expect(routinesApi.delete).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
      await waitFor(() => expect(routinesApi.delete).toHaveBeenCalledWith('r1'));
    });
  });
});

describe('the route of the routines page (E01/F04/US02/T01, behind the flag routines)', () => {
  const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === ROUTINES_PATH);
  const holding =
    (...granted: string[]) =>
    (_context: string, permission: string) =>
      granted.includes(permission);

  const ON = { routines: true };

  it('RoutinesRoute_Manifest_IsATabOfImpostazioniThatNeedsToWriteTheProperties', () => {
    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.requiredPermissions).toEqual(['property.write']);
    expect(entry?.featureFlag).toBe('routines');
    expect(entry?.navKey).toBe('nav.routines');
    expect(entry?.navParent).toBe('/app/short-rent/settings/organization');
    // Not in "Altro" for who may open «Impostazioni»: the menus have no such section any more.
    expect(entry?.navPlacement).toBeUndefined();
    expect(i18n.getFixedT('it')('nav.routines')).toBe('Automazioni');
    expect(i18n.getFixedT('en')('nav.routines')).toBe('Automations');
  });

  it('RoutinesRoute_Flag_IsOffByDefaultWhileLoadingAndWhenTheAnswerIsNotTrue', () => {
    expect(DEFAULT_FEATURE_FLAGS.routines).toBe(false);
    expect(parseFeatureFlags(undefined).routines).toBe(false);
    expect(parseFeatureFlags({ routines: 'true' }).routines).toBe(false);
    expect(parseFeatureFlags({ routines: true }).routines).toBe(true);
    expect(isFeatureEnabled(undefined, 'routines')).toBe(false);
  });

  it('RoutinesRoute_FlagOff_TheEntryIsInNoMenuForAnyone', () => {
    const everything = holding('property.read', 'property.write', 'booking.read', 'booking.write', 'approval.decide', 'org.billing.admin');

    for (const features of [undefined, {}, { routines: false }]) {
      expect(entry && isEntryFeatureEnabled(entry, features)).toBe(false);
      expect(getVisibleNavEntries('short-rent', everything, features).map((page) => page.path)).not.toContain(ROUTINES_PATH);
      expect(getSecondaryNavEntries('short-rent', everything, features).map((page) => page.path)).not.toContain(ROUTINES_PATH);
      expect(getNavChildren('/app/short-rent/settings/organization', everything, features).map((page) => page.path)).not.toContain(ROUTINES_PATH);
    }
  });

  it('RoutinesRoute_FlagOn_IsReachableOnlyForWhoMayWriteTheProperties', () => {
    const admin = holding('property.read', 'property.write', 'booking.read', 'org.billing.admin');
    const writer = holding('property.read', 'property.write', 'booking.read');
    const reader = holding('property.read', 'booking.read');

    expect(entry && isEntryFeatureEnabled(entry, ON)).toBe(true);
    expect(entry && hasEntryPermission(entry, writer)).toBe(true);
    expect(entry && hasEntryPermission(entry, reader)).toBe(false);
    // The organization administrator finds it as a tab of «Impostazioni»; who may write the properties but not open «Impostazioni» finds it in "Altro".
    expect(getNavChildren('/app/short-rent/settings/organization', admin, ON).map((page) => page.path)).toContain(ROUTINES_PATH);
    expect(getSecondaryNavEntries('short-rent', admin, ON).map((page) => page.path)).not.toContain(ROUTINES_PATH);
    expect(getSecondaryNavEntries('short-rent', writer, ON).map((page) => page.path)).toContain(ROUTINES_PATH);
    expect(getSecondaryNavEntries('short-rent', reader, ON).map((page) => page.path)).not.toContain(ROUTINES_PATH);
  });

  it('RoutinesRoute_LoadsAPageThatIsAComponent', async () => {
    const loaded = await entry!.component();

    expect(typeof loaded.default).toBe('function');
  }, 30_000);

  describe('as the app builds it: the page of the manifest behind its guard (permissions and flag)', () => {
    const shortRent: ContextBootstrapDto = {
      contextKey: 'short-rent',
      displayName: 'Affitti brevi',
      roleKey: 'property_owner',
      permissions: ['property.read', 'property.write'],
      defaultRoute: '/app/short-rent',
    };

    function Address() {
      const { pathname } = useLocation();
      return <p data-testid="address">{pathname}</p>;
    }

    function renderRoute(flags: { routines: boolean; isLoading?: boolean }, permissions: string[] = ['property.read', 'property.write']) {
      vi.mocked(useWorkspace).mockReturnValue({
        contexts: [{ ...shortRent, permissions }],
        activeContext: 'short-rent',
        isReady: true,
        setActiveContext: vi.fn(),
        hasPermission: (_context, permission) => permissions.includes(permission),
        getDefaultRoute: () => '/app/short-rent',
      });
      return render(
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, routines: flags.routines }, isLoading: flags.isLoading ?? false }}>
          <MemoryRouter initialEntries={[ROUTINES_PATH]}>
            <Routes>
              <Route path="/app/short-rent" element={<p>home of the area</p>} />
              <Route
                path={ROUTINES_PATH}
                element={
                  <ContextRouteGuard contextKey="short-rent" requiredPermissions={entry!.requiredPermissions} featureFlag={entry!.featureFlag}>
                    <p>routines page</p>
                  </ContextRouteGuard>
                }
              />
            </Routes>
            <Address />
          </MemoryRouter>
        </FeatureFlagsContext.Provider>,
      );
    }

    beforeEach(() => vi.clearAllMocks());
    afterEach(() => cleanup());

    it('RoutinesRoute_FlagOn_OpensThePage', () => {
      renderRoute({ routines: true });

      expect(screen.getByText('routines page')).toBeInTheDocument();
    });

    it('RoutinesRoute_FlagOff_NoPageAndTheAddressGoesToTheHomeOfTheArea', () => {
      renderRoute({ routines: false });

      expect(screen.queryByText('routines page')).not.toBeInTheDocument();
      expect(screen.getByTestId('address')).toHaveTextContent('/app/short-rent');
      expect(screen.getByText('home of the area')).toBeInTheDocument();
      expect(routinesApi.getAll).not.toHaveBeenCalled();
    });

    it('RoutinesRoute_FlagStillLoading_WaitsBeforeDeciding', () => {
      renderRoute({ routines: false, isLoading: true });

      expect(screen.queryByText('routines page')).not.toBeInTheDocument();
      expect(screen.queryByText('home of the area')).not.toBeInTheDocument();
    });

    it('RoutinesRoute_FlagOnButNoPermissionToWrite_NoPage', () => {
      renderRoute({ routines: true }, ['property.read']);

      expect(screen.queryByText('routines page')).not.toBeInTheDocument();
    });
  });
});
