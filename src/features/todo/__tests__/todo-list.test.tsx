import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { TodoActivity } from '@/api/internal-activities.api';
import { useActivities, useActivityCount, useCloseActivity } from '@/queries/internalActivities';
import { TodoListPage } from '../todo-list';

type PermissionCheck = (context: string, permission: string) => boolean;

// What the person may do: everything, unless a test narrows it to a role that only reads.
const workspace = vi.hoisted(() => {
  const hasPermission: PermissionCheck = () => true;
  return { hasPermission };
});
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => workspace.hasPermission(context, permission) }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement(
      'div',
      null,
      createElement('h1', null, title),
      description ? createElement('p', { 'data-testid': 'todo-page-description' }, description) : null,
    ),
}));
vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({
    data: [
      { id: 'p-1', name: 'Casa Mare' },
      { id: 'p-2', name: 'Villa Monti' },
    ],
  }),
}));
vi.mock('@/queries/internalActivities', () => ({ useActivities: vi.fn(), useActivityCount: vi.fn(), useCloseActivity: vi.fn() }));

function todo(overrides: Partial<TodoActivity> & { id: string }): TodoActivity {
  return {
    activityType: 'CheckInPending',
    action: 'ReviewBooking',
    entityType: 'Booking',
    entityId: 'b-1',
    propertyId: 'p-1',
    dueAt: null,
    urgency: 'Medium',
    reason: null,
    createdAt: '2026-11-01T08:00:00Z',
    ...overrides,
  };
}

/**
 * The array as the server sends it. The least urgent item is the first on purpose: the page keeps the order of the answer, it does
 * not sort by urgency or by deadline itself (ADR-026-R5).
 */
const LIST: TodoActivity[] = [
  todo({
    id: 'a',
    activityType: 'ReceiptToRetrieve',
    action: 'UploadAlloggiatiProof',
    entityId: 'b-2',
    propertyId: 'p-2',
    urgency: 'Low',
    dueAt: '2099-01-20T10:00:00Z',
  }),
  todo({ id: 'b', activityType: 'AlloggiatiDeadline', action: 'UploadAlloggiatiProof', urgency: 'High', dueAt: '2000-01-01T10:00:00Z' }),
  todo({
    id: 'c',
    activityType: 'CheckInPending',
    action: 'StartCheckIn',
    entityId: 'b-3',
    urgency: 'Medium',
    reason: 'Ospite in arrivo senza documenti',
  }),
  todo({
    id: 'd',
    activityType: 'ReconnectChannelManager',
    action: 'ReconnectChannel',
    entityType: 'Organization',
    entityId: '9f1c9a52-1111-4222-8333-944455556666',
    propertyId: null,
    urgency: 'High',
  }),
];

function answer(overrides: Record<string, unknown>) {
  vi.mocked(useActivities).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useActivities>);
}

/** The number of the menu (`GET /api/me/activities/count`): how many urgent items the account has, the whole of them. */
function menuCount(count: number | undefined) {
  vi.mocked(useActivityCount).mockReturnValue({ data: count === undefined ? undefined : { count } } as unknown as ReturnType<typeof useActivityCount>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TodoListPage />
    </MemoryRouter>,
  );
}

const cards = () => screen.getAllByTestId('todo-activity');
const urgencies = () => cards().map((card) => card.getAttribute('data-urgency'));

describe('TodoListPage (NF-07, ADR-026)', () => {
  const mutate = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();
    workspace.hasPermission = () => true;
    vi.mocked(useCloseActivity).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useCloseActivity>);
    menuCount(2);
    answer({ data: LIST });
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('TodoListPage_Answer_IsRenderedInTheOrderTheServerSent_NeverSortedAgain', () => {
    renderPage();

    // Low, High, Medium, High: neither by urgency nor by deadline, the array as it came (ADR-026-R5).
    expect(urgencies()).toEqual(['Low', 'High', 'Medium', 'High']);
    expect(cards().map((card) => within(card).getByTestId('todo-title').textContent)).toEqual([
      'Ricevuta da recuperare',
      'Alloggiati Web in scadenza',
      'Check-in da completare',
      'Riconnetti il gestionale dei canali',
    ]);
  });

  it('TodoListPage_Card_SaysWhatOnWhichObjectByWhenAndWhy', () => {
    renderPage();

    const [receipt, alloggiati, checkIn, channels] = cards();
    // On which object: the kind of entity and the property, whose name the list of properties gives (the item carries the id only).
    expect(within(receipt).getByTestId('todo-object')).toHaveTextContent('Prenotazione · Villa Monti');
    expect(within(alloggiati).getByTestId('todo-object')).toHaveTextContent('Prenotazione · Casa Mare');
    // An item of the whole account names no property.
    expect(within(channels).getByTestId('todo-object')).toHaveTextContent('Il tuo account');
    // By when: a deadline in the future, one that has passed (said in red and in words), and none.
    expect(within(receipt).getByTestId('todo-deadline').textContent).toMatch(/^Entro /);
    expect(within(alloggiati).getByTestId('todo-deadline').textContent).toMatch(/^Scaduta: /);
    expect(within(alloggiati).getByTestId('todo-deadline')).toHaveAttribute('data-overdue', 'true');
    expect(within(checkIn).queryByTestId('todo-deadline')).not.toBeInTheDocument();
    // Why, in one line: the words of the server when it wrote a sentence, the words of the type otherwise.
    expect(within(checkIn).getByTestId('todo-why')).toHaveTextContent('Ospite in arrivo senza documenti');
    expect(within(channels).getByTestId('todo-why')).toHaveTextContent('Il collegamento con il gestionale dei canali si è interrotto.');
  });

  it('TodoListPage_Urgency_IsToldWithAWordAndNotWithColorAlone', () => {
    renderPage();

    expect(cards().map((card) => within(card).getByTestId('todo-urgency').textContent)).toEqual([
      'Quando puoi',
      'Urgente',
      'Importante',
      'Urgente',
    ]);
  });

  it('TodoListPage_TypeOfALaterTask_UsesItsOwnWordsFromTheLocaleFilesAndTheGenericOnesWhenItHasNone', () => {
    // The task that raises a new type adds `activity.todo.type.<Type>.title` (and `.why`) to the locale files: this page needs no change.
    i18n.addResource('it', 'translation', 'activity.todo.type.LaterKind.title', 'Cosa nuova da fare');
    answer({ data: [todo({ id: 'n1', activityType: 'LaterKind' }), todo({ id: 'n2', activityType: 'KindWithoutWords' })] });
    renderPage();

    expect(cards().map((card) => within(card).getByTestId('todo-title').textContent)).toEqual(['Cosa nuova da fare', 'Attività da completare']);
    expect(within(cards()[1]).getByTestId('todo-why')).toHaveTextContent('Richiede la tua attenzione.');
  });

  it('TodoListPage_DoNow_OpensThePageWhereTheItemIsDone', () => {
    renderPage();

    const [, alloggiati, checkIn] = cards();
    expect(within(alloggiati).getByRole('link', { name: /^Fallo ora/ })).toHaveAttribute('href', '/app/short-rent/alloggiati');
    expect(within(checkIn).getByRole('link', { name: /^Fallo ora/ })).toHaveAttribute('href', '/app/short-rent/bookings/b-3?tab=guest');
  });

  it('TodoListPage_ActionThisVersionDoesNotKnow_HasNoDoNowButStillCanBeClosed', () => {
    answer({ data: [todo({ id: 'x', action: 'ActionOfALaterVersion' })] });
    renderPage();

    const [card] = cards();
    expect(within(card).queryByRole('link', { name: /^Fallo ora/ })).not.toBeInTheDocument();
    expect(within(card).getByTestId('todo-close')).toBeInTheDocument();
  });

  it('TodoListPage_Summary_CountsTheItemsAndTheUrgentOnes', () => {
    renderPage();

    expect(screen.getByTestId('todo-summary')).toHaveTextContent('4 attività da fare');
    expect(screen.getByTestId('todo-urgent-count')).toHaveTextContent('2 urgenti');
  });

  it('TodoListPage_ListCutByTheServer_SaysTheFirstOnesAndTakesTheUrgentCountFromTheMenu', () => {
    // The server sends 50 items at most while `/count` counts every urgent one: the page tells no total and counts nothing from the array.
    answer({ data: Array.from({ length: 50 }, (_, index) => todo({ id: `cut-${index}`, propertyId: index % 2 === 0 ? 'p-1' : 'p-2' })) });
    menuCount(61);
    renderPage();

    expect(screen.getByTestId('todo-summary')).toHaveTextContent('Le prime 50 attività da fare');
    expect(screen.getByTestId('todo-urgent-count')).toHaveTextContent('61 urgenti');
    expect(screen.getByTestId('todo-page-description')).toHaveTextContent('Le prime 50 cose da fare');

    // A filter leaves out items of those 50: the line counts what is left, and the number of the menu is not about them.
    fireEvent.change(screen.getByTestId('todo-filter-property'), { target: { value: 'p-1' } });
    expect(screen.getByTestId('todo-summary')).toHaveTextContent('25 tra le prime 50 attività da fare');
    expect(screen.queryByTestId('todo-urgent-count')).not.toBeInTheDocument();
  });

  it('TodoListPage_FilterByType_LeavesItemsOutAndKeepsTheirOrder', () => {
    renderPage();

    fireEvent.change(screen.getByTestId('todo-filter-type'), { target: { value: 'AlloggiatiDeadline' } });
    expect(cards().map((card) => within(card).getByTestId('todo-title').textContent)).toEqual(['Alloggiati Web in scadenza']);

    fireEvent.change(screen.getByTestId('todo-filter-type'), { target: { value: 'all' } });
    expect(cards()).toHaveLength(4);
  });

  it('TodoListPage_FilterByProperty_LeavesItemsOutAndKeepsTheirOrder', () => {
    renderPage();

    fireEvent.change(screen.getByTestId('todo-filter-property'), { target: { value: 'p-1' } });
    expect(cards().map((card) => within(card).getByTestId('todo-title').textContent)).toEqual([
      'Alloggiati Web in scadenza',
      'Check-in da completare',
    ]);

    // The items of the whole account have their own choice.
    fireEvent.change(screen.getByTestId('todo-filter-property'), { target: { value: 'account' } });
    expect(cards().map((card) => within(card).getByTestId('todo-title').textContent)).toEqual(['Riconnetti il gestionale dei canali']);
  });

  it('TodoListPage_FiltersThatMatchNothing_SayItAndOfferToShowEverything', () => {
    renderPage();

    fireEvent.change(screen.getByTestId('todo-filter-type'), { target: { value: 'ReconnectChannelManager' } });
    fireEvent.change(screen.getByTestId('todo-filter-property'), { target: { value: 'p-1' } });

    expect(screen.getByTestId('todo-no-match')).toHaveTextContent('Nessuna attività con questi filtri.');
    expect(screen.queryByTestId('todo-activity')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mostra tutte' }));
    expect(cards()).toHaveLength(4);
  });

  it('TodoListPage_OneTypeAndOneProperty_OffersNoFilterToChooseBetween', () => {
    answer({ data: [todo({ id: 'only' })] });
    renderPage();

    expect(screen.queryByTestId('todo-filter-type')).not.toBeInTheDocument();
    expect(screen.queryByTestId('todo-filter-property')).not.toBeInTheDocument();
  });

  it('TodoListPage_MarkAsDone_AsksFirstThenClosesTheItem', async () => {
    renderPage();

    fireEvent.click(within(cards()[0]).getByTestId('todo-close'));
    expect(screen.getByRole('dialog', { name: 'Segnare questa attività come fatta?' })).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Segna come fatto' }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
  });

  it('TodoListPage_RoleThatOnlyReads_SeesTheItemsButHasNoMarkAsDone', () => {
    // The Commercialista and a collaborator without the right to write hold `property.read`, which is all the page asks. Closing an item
    // takes it off the list of the whole organization, a deadline of the law included: it is offered to who may write the properties.
    workspace.hasPermission = (context, permission) => context === 'short-rent' && ['property.read', 'booking.read'].includes(permission);
    renderPage();

    expect(cards()).toHaveLength(4);
    expect(screen.queryByTestId('todo-close')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Segna come fatto/ })).not.toBeInTheDocument();
  });

  it('TodoListPage_NothingToDo_SaysSo', () => {
    answer({ data: [] });
    renderPage();

    expect(screen.getByTestId('todo-empty')).toHaveTextContent("Non c'è niente da fare");
    expect(screen.queryByTestId('todo-activity')).not.toBeInTheDocument();
  });

  it('TodoListPage_Loading_ShowsAStatusAndNoList', () => {
    answer({ isLoading: true });
    renderPage();

    expect(screen.getByTestId('todo-loading')).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('todo-list')).not.toBeInTheDocument();
  });

  it('TodoListPage_LoadFails_ShowsTheErrorWithRetryAndNeverAnEmptyList', () => {
    const refetch = vi.fn();
    answer({ isError: true, error: new Error('boom'), refetch });
    renderPage();

    expect(screen.getByTestId('todo-error')).toHaveTextContent('Non riusciamo a caricare le attività.');
    expect(screen.queryByTestId('todo-empty')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('TodoListPage_AnswerOfAnotherShape_IsAFailedLoadWithRetryAndNeverNothingToDo', () => {
    // A server or a proxy that answers with a page instead of the API: "nothing to do" would reassure about a list that may hold a deadline of the law.
    const refetch = vi.fn();
    answer({ data: '<!doctype html><html></html>', refetch });
    renderPage();

    expect(screen.getByTestId('todo-error')).toHaveTextContent('Non riusciamo a caricare le attività.');
    expect(screen.queryByTestId('todo-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('todo-activity')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('TodoListPage_English_ShowsTheEnglishWords', async () => {
    await i18n.changeLanguage('en');
    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('To-do list');
    expect(cards().map((card) => within(card).getByTestId('todo-urgency').textContent)).toEqual([
      'When you can',
      'Urgent',
      'Important',
      'Urgent',
    ]);
    expect(within(cards()[1]).getByRole('link', { name: /^Do it now/ })).toBeInTheDocument();
  });
});
