import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { problemError } from '@/features/onboarding/__tests__/onboarding-fixtures';
import type { AdminAssistRequest, AssistQueueQuery, AssistRequestStatus, PagedAssistRequests } from '@/types/onboarding.types';
import { AdminAssistQueuePage } from '../admin-assist-queue-page';

vi.mock('@/api/onboarding.api', () => ({ onboardingApi: { listAssistQueue: vi.fn(), updateAssistRequest: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', null, description) : null),
}));

const workspace = vi.hoisted(() => ({
  hasPermission: (() => true) as (context: string, permission: string) => boolean,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

const R1 = '9d4f6a0e-2c1b-4c5d-8e7f-3a2b1c0d9e8f';
const R2 = '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';
const R3 = '5c6d7e8f-9a0b-4c1d-8e2f-3a4b5c6d7e8f';
const ORG = 'aa11bb22-cc33-4d44-8e55-ff6677889900';
const STAFF = 'auth0|6f7e8d9c0b1a2f3e4d5c';

function request(id: string, status: AssistRequestStatus, overrides: Partial<AdminAssistRequest> = {}): AdminAssistRequest {
  return {
    id,
    orgId: ORG,
    part: 'compliance',
    propertyId: '77777777-0000-4000-8000-000000000001',
    propertyName: 'Casa del Mare',
    comune: 'Rimini',
    context: 'panelPolice',
    status,
    requestedAt: '2026-11-12T08:00:00Z',
    updatedAt: '2026-11-12T08:00:00Z',
    completedAt: null,
    assignedToUserId: null,
    staffNote: null,
    draftWizardType: null,
    draftEntityId: null,
    ...overrides,
  };
}

function page(items: AdminAssistRequest[], overrides: Partial<PagedAssistRequests> = {}): PagedAssistRequests {
  return { items, totalCount: items.length, page: 1, pageSize: 25, ...overrides };
}

/** What the server answers for each status of the queue. */
const queue = vi.hoisted(() => ({ byStatus: {} as Record<string, unknown> }));

function answerQueue(byStatus: Partial<Record<AssistRequestStatus | 'all', PagedAssistRequests>>) {
  queue.byStatus = byStatus;
  vi.mocked(onboardingApi.listAssistQueue).mockImplementation((query?: AssistQueueQuery) =>
    Promise.resolve((queue.byStatus[query?.status ?? 'all'] ?? page([])) as PagedAssistRequests),
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/admin/onboarding-assist']}>
          <AdminAssistQueuePage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  workspace.hasPermission = () => true;
  answerQueue({ Requested: page([request(R1, 'Requested')]), InProgress: page([request(R2, 'InProgress', { assignedToUserId: STAFF, staffNote: 'Ho chiamato il titolare.' })]) });
  vi.mocked(onboardingApi.updateAssistRequest).mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('AdminAssistQueuePage, the staff queue of the «Fallo per me» requests (E10/F03/US03/T03)', () => {
  it('AdminAssistQueuePage_WithoutThePermissionOfTheStaffQueue_SaysThereIsNoAccessAndSendsNoRequest', async () => {
    workspace.hasPermission = () => false;
    renderPage();

    expect(await screen.findByTestId('assist-no-access')).toHaveTextContent(i18n.t('onboardingPlan.assist.noAccess'));
    expect(onboardingApi.listAssistQueue).not.toHaveBeenCalled();
    expect(onboardingApi.updateAssistRequest).not.toHaveBeenCalled();
    expect(screen.queryByTestId('assist-filter')).not.toBeInTheDocument();
  });

  it('AdminAssistQueuePage_ByDefault_ListsTheOpenRequestsToTakeAndInProgressPagedByTheServer', async () => {
    renderPage();

    const requested = await screen.findByTestId('assist-requested-rows');
    const inProgress = await screen.findByTestId('assist-in-progress-rows');
    expect(onboardingApi.listAssistQueue).toHaveBeenCalledWith({ status: 'Requested', page: 1, pageSize: 25 });
    expect(onboardingApi.listAssistQueue).toHaveBeenCalledWith({ status: 'InProgress', page: 1, pageSize: 25 });
    expect(onboardingApi.listAssistQueue).toHaveBeenCalledTimes(2);
    // The context in words, with the property and the comune; the step; the status in words.
    const row = within(requested).getByTestId(`assist-row-${R1}`);
    expect(within(row).getByTestId('assist-row-title')).toHaveTextContent(
      i18n.t('onboardingPlan.assist.row.propertyComune', { context: i18n.t('onboardingPlan.assist.contexts.panelPolice'), property: 'Casa del Mare', comune: 'Rimini' }),
    );
    expect(within(row).getByTestId('assist-row-part')).toHaveTextContent(i18n.t('onboardingPlan.parts.compliance.title'));
    expect(within(row).getByTestId('assist-row-status')).toHaveTextContent(i18n.t('onboardingPlan.assist.status.requested'));
    expect(within(row).getByTestId('assist-row-when')).toHaveTextContent('2026');
    // The two lines the staff must know.
    expect(screen.getByTestId('assist-notes')).toHaveTextContent(i18n.t('onboardingPlan.assist.hostSees'));
    expect(screen.getByTestId('assist-notes')).toHaveTextContent(i18n.t('onboardingPlan.assist.askTheUser'));
    // The one in progress shows who has it (short id) and its note.
    const taken = within(inProgress).getByTestId(`assist-row-${R2}`);
    expect(within(taken).getByTestId('assist-row-id-assigned')).toHaveTextContent(STAFF.slice(0, 8));
    expect(within(taken).getByTestId('assist-row-id-assigned')).not.toHaveTextContent(STAFF);
    expect(within(taken).getByTestId('assist-row-note')).toHaveTextContent('Ho chiamato il titolare.');
  });

  it('AdminAssistQueuePage_NothingOpen_SaysNessunaRichiestaApertaNeverAnEmptyShell', async () => {
    answerQueue({});
    renderPage();

    expect(await screen.findByTestId('assist-empty')).toHaveTextContent(i18n.t('onboardingPlan.assist.empty'));
    expect(screen.queryByTestId('assist-requested')).not.toBeInTheDocument();
  });

  it('AdminAssistQueuePage_TheReadFails_SaysItFailedWithARetryNeverThatNothingIsOpen', async () => {
    vi.mocked(onboardingApi.listAssistQueue).mockRejectedValue(problemError(500, {}));
    renderPage();

    expect(await screen.findByTestId('assist-requested-error')).toHaveTextContent(i18n.t('onboardingPlan.assist.loadError'));
    expect(screen.queryByTestId('assist-empty')).not.toBeInTheDocument();
    // A retry reads it again.
    answerQueue({ Requested: page([request(R1, 'Requested')]) });
    fireEvent.click(within(screen.getByTestId('assist-requested-error')).getByRole('button', { name: i18n.t('shared.errorState.retry') }));
    expect(await screen.findByTestId('assist-requested-rows')).toBeInTheDocument();
  });

  it('AdminAssistQueuePage_AListOfManyRequests_IsPagedByTheServerAndNeverFetchedWhole', async () => {
    answerQueue({ Requested: page([request(R1, 'Requested')], { totalCount: 60, pageSize: 25 }), InProgress: page([]) });
    renderPage();

    expect(await screen.findByTestId('assist-requested-pager-status')).toHaveTextContent(i18n.t('onboardingPlan.bulk.pager.status', { page: 1, pages: 3, total: 60 }));
    fireEvent.click(screen.getByTestId('assist-requested-pager-next'));

    await waitFor(() => expect(onboardingApi.listAssistQueue).toHaveBeenCalledWith({ status: 'Requested', page: 2, pageSize: 25 }));
  });

  it('AdminAssistQueuePage_AStatusFilter_AsksTheServerForThatStatusOnlyAndAClosedRequestHasNoAction', async () => {
    answerQueue({ Done: page([request(R3, 'Done', { completedAt: '2026-11-12T09:00:00Z' })]) });
    renderPage();
    await screen.findByTestId('assist-requested');

    fireEvent.change(screen.getByTestId('assist-filter'), { target: { value: 'done' } });

    const rows = await screen.findByTestId('assist-list-rows');
    expect(onboardingApi.listAssistQueue).toHaveBeenCalledWith({ status: 'Done', page: 1, pageSize: 25 });
    const row = within(rows).getByTestId(`assist-row-${R3}`);
    expect(within(row).getByTestId('assist-row-status')).toHaveTextContent(i18n.t('onboardingPlan.assist.status.done'));
    expect(within(row).queryByRole('button', { name: i18n.t('onboardingPlan.assist.actions.take.label') })).not.toBeInTheDocument();
    expect(within(row).queryByTestId('assist-row-done')).not.toBeInTheDocument();
    expect(within(row).queryByTestId('assist-row-cancel')).not.toBeInTheDocument();
  });

  it('AdminAssistQueuePage_AStatusThisVersionDoesNotKnow_IsShownAsNotUnderstoodAndHasNoAction', async () => {
    answerQueue({ Requested: page([request(R1, 'Quarantined' as never)]) });
    renderPage();

    const row = await screen.findByTestId(`assist-row-${R1}`);
    expect(within(row).getByTestId('assist-row-status')).toHaveAttribute('data-state', 'unknown');
    expect(within(row).queryByTestId('assist-row-take')).not.toBeInTheDocument();
    expect(within(row).queryByTestId('assist-row-done')).not.toBeInTheDocument();
  });

  it('AssistRequestRow_IdentifiersAreShortAndCopyWholeAndNothingMoreThanTheBackendSendsIsShown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderPage();

    const row = await screen.findByTestId(`assist-row-${R1}`);
    expect(within(row).getByTestId('assist-row-id-request')).toHaveTextContent(R1.slice(0, 8));
    expect(within(row).getByTestId('assist-row-id-request')).not.toHaveTextContent(R1);
    fireEvent.click(within(within(row).getByTestId('assist-row-id-request')).getByRole('button'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(R1));
    expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.assist.copied'));
    // No draft, no credential, no person who asked: the row has no such thing to show.
    expect(row.textContent).not.toMatch(/password|token|secret|credenzial/i);
    expect(within(row).queryByTestId('assist-row-id-draft')).not.toBeInTheDocument();
  });

  it('AssistRequestRow_PrendiInCarico_OpensTheDialogWithTheCounterAndSendsTheStatusAndTheNote', async () => {
    vi.mocked(onboardingApi.updateAssistRequest).mockResolvedValue(request(R1, 'InProgress'));
    renderPage();

    fireEvent.click(await screen.findByTestId('assist-row-take'));

    const dialog = await screen.findByTestId('assist-dialog-take');
    expect(within(dialog).getByTestId('assist-note-counter')).toHaveTextContent('0/500');
    expect(dialog).toHaveTextContent(i18n.t('onboardingPlan.assist.note.hint'));
    expect(within(dialog).getByTestId('assist-note')).toHaveAttribute('maxlength', '500');
    fireEvent.change(within(dialog).getByTestId('assist-note'), { target: { value: 'Chiamo il titolare oggi.' } });
    expect(within(dialog).getByTestId('assist-note-counter')).toHaveTextContent('24/500');
    fireEvent.click(within(dialog).getByTestId('assist-dialog-confirm'));

    await waitFor(() => expect(onboardingApi.updateAssistRequest).toHaveBeenCalledWith(R1, { status: 'inProgress', note: 'Chiamo il titolare oggi.' }));
    await waitFor(() => expect(screen.queryByTestId('assist-dialog-take')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(i18n.t('onboardingPlan.assist.updated'));
    // The queue is read again: the list reflects the change.
    await waitFor(() => expect(vi.mocked(onboardingApi.listAssistQueue).mock.calls.length).toBeGreaterThan(2));
  });

  it('AssistRequestRow_NoNote_SendsTheStatusAloneAndSegnaComeFattaAndAnnullaAreOfferedToo', async () => {
    vi.mocked(onboardingApi.updateAssistRequest).mockResolvedValue(request(R2, 'Done'));
    renderPage();
    const taken = await screen.findByTestId(`assist-row-${R2}`);
    // A request in progress is not taken again; it can be done or cancelled.
    expect(within(taken).queryByTestId('assist-row-take')).not.toBeInTheDocument();
    expect(within(taken).getByTestId('assist-row-cancel')).toBeInTheDocument();

    fireEvent.click(within(taken).getByTestId('assist-row-done'));
    fireEvent.click(within(await screen.findByTestId('assist-dialog-done')).getByTestId('assist-dialog-confirm'));

    await waitFor(() => expect(onboardingApi.updateAssistRequest).toHaveBeenCalledWith(R2, { status: 'done' }));
  });

  it('AssistRequestRow_ANoteWithAnEmailAddress_IsRefusedAndTheServerMessageIsShownUnderTheFieldWhileTheDialogStaysOpen', async () => {
    vi.mocked(onboardingApi.updateAssistRequest).mockRejectedValue(problemError(422, { code: 'assist_note_invalid', detail: 'La nota non può contenere un indirizzo email.' }));
    renderPage();

    fireEvent.click(await screen.findByTestId('assist-row-take'));
    const dialog = await screen.findByTestId('assist-dialog-take');
    fireEvent.change(within(dialog).getByTestId('assist-note'), { target: { value: 'scrivimi a mario@example.com' } });
    fireEvent.click(within(dialog).getByTestId('assist-dialog-confirm'));

    expect(await within(dialog).findByTestId('assist-note-error')).toHaveTextContent('La nota non può contenere un indirizzo email.');
    expect(within(dialog).getByTestId('assist-note')).toHaveAttribute('aria-invalid', 'true');
    // The dialog stays open with the note, to fix it; nothing is toasted as a success.
    expect(within(dialog).getByTestId('assist-note')).toHaveValue('scrivimi a mario@example.com');
    expect(toast.success).not.toHaveBeenCalled();
    expect(within(dialog).getByTestId('assist-dialog-confirm')).toBeEnabled();
  });

  it('AssistRequestRow_WhileAnUpdateIsOnItsWay_EveryActionOfEveryRowIsOffAndASecondPressSendsNothing', async () => {
    let finish: (value: AdminAssistRequest) => void = () => undefined;
    vi.mocked(onboardingApi.updateAssistRequest).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPage();
    fireEvent.click(await screen.findByTestId('assist-row-take'));
    const dialog = await screen.findByTestId('assist-dialog-take');
    const confirm = within(dialog).getByTestId('assist-dialog-confirm');

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(onboardingApi.updateAssistRequest).toHaveBeenCalledTimes(1));
    // The dialog cannot be closed or pressed again while it is on its way, and the actions behind it are off.
    expect(within(dialog).getByTestId('assist-dialog-cancel')).toBeDisabled();
    expect(screen.getByTestId(`assist-row-${R2}`).querySelector('[data-testid="assist-row-done"]')).toBeDisabled();
    finish(request(R1, 'InProgress'));
    await waitFor(() => expect(screen.queryByTestId('assist-dialog-take')).not.toBeInTheDocument());
    expect(onboardingApi.updateAssistRequest).toHaveBeenCalledTimes(1);
  });

  it('AssistRequestRow_SomebodyClosedItFirst_SaysSoUnderTheNoteAndTheQueueIsReadAgain', async () => {
    vi.mocked(onboardingApi.updateAssistRequest).mockRejectedValue(problemError(409, { code: 'assist_request_closed', detail: 'La richiesta è già chiusa.' }));
    renderPage();
    fireEvent.click(await screen.findByTestId('assist-row-take'));
    const dialog = await screen.findByTestId('assist-dialog-take');

    fireEvent.click(within(dialog).getByTestId('assist-dialog-confirm'));

    expect(await within(dialog).findByTestId('assist-note-error')).toHaveTextContent('La richiesta è già chiusa.');
    await waitFor(() => expect(vi.mocked(onboardingApi.listAssistQueue).mock.calls.length).toBeGreaterThan(2));
  });
});
