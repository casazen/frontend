import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { useComplianceFineCount } from '@/features/compliance/use-compliance';
import type { TodoActivity } from '@/api/internal-activities.api';
import { useActivities } from '@/queries/internalActivities';
import { DashboardPage } from '../dashboard-page';

vi.mock('@/api/dashboard.api', () => ({
  dashboardApi: {
    getToday: vi.fn(() => new Promise(() => {})),
    getOverview: vi.fn(() => new Promise(() => {})),
    getIcalFeeds: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/queries/use-properties', () => {
  const properties = [{ id: 'p-1', name: 'Casa Mare' }];
  return { useProperties: () => ({ data: properties, isSuccess: true }) };
});
vi.mock('@/queries/internalActivities', () => ({ useActivities: vi.fn(), useCloseActivity: vi.fn() }));
vi.mock('@/features/compliance/use-compliance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/compliance/use-compliance')>()),
  useComplianceFineCount: vi.fn(),
}));
vi.mock('@/features/compliance/components/compliance-urgent-block', () => ({ ComplianceUrgentBlock: () => null }));
vi.mock('../components/home-next-step', () => ({ HomeNextStep: () => null }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

function todo(overrides: Partial<TodoActivity> & { id: string }): TodoActivity {
  return {
    activityType: 'AlloggiatiDeadline',
    action: 'UploadAlloggiatiProof',
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

const LIST: TodoActivity[] = [
  todo({ id: 'first', activityType: 'AlloggiatiDeadline', urgency: 'High' }),
  todo({ id: 'second', activityType: 'ReceiptToRetrieve', urgency: 'High' }),
  todo({ id: 'third', activityType: 'FiscalDocument', action: 'ReviewBooking', urgency: 'Low' }),
];

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS }, isLoading: false }}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

// NF-07, ADR-026-R8: the Home shows the first item of the To do list in "Adesso", the next ones and the count of the urgent ones.
describe('DashboardPage To do list', () => {
  beforeEach(async () => {
    vi.mocked(useActivities).mockReturnValue({ data: LIST } as unknown as ReturnType<typeof useActivities>);
    vi.mocked(useComplianceFineCount).mockReturnValue(0);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('DashboardPage_ToDoItems_ShowsTheFirstInNowAndTheNextOnesWithTheUrgentCount', () => {
    renderDashboard();

    const focus = screen.getByTestId('home-todo-focus');
    expect(within(focus).getByRole('heading', { level: 2 })).toHaveTextContent('Alloggiati Web in scadenza');
    expect(focus).toHaveTextContent('Adesso');

    const summary = screen.getByTestId('home-todo-summary');
    // The first is in the focus block: the summary lists the two after it, and counts all three and the two urgent ones.
    expect(within(summary).getAllByRole('listitem')).toHaveLength(2);
    expect(within(summary).getByTestId('home-todo-counts')).toHaveTextContent('3 attività da fare');
    expect(within(summary).getByTestId('home-todo-urgent')).toHaveTextContent('2 urgenti');
    expect(within(summary).getByTestId('home-todo-see-all')).toHaveAttribute('href', '/app/short-rent/activities');
  });

  it('DashboardPage_NothingToDo_DrawsNothingForIt', () => {
    vi.mocked(useActivities).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActivities>);
    renderDashboard();

    expect(screen.getByTestId('sr-home')).toBeInTheDocument();
    expect(screen.queryByTestId('home-todo-focus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-todo-summary')).not.toBeInTheDocument();
  });

  it('DashboardPage_ListNotLoadedYet_DrawsNothingForIt', () => {
    vi.mocked(useActivities).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useActivities>);
    renderDashboard();

    expect(screen.queryByTestId('home-todo-focus')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-todo-summary')).not.toBeInTheDocument();
  });

  it('DashboardPage_RiskOfASanction_KeepsTheOneHighlightedBlockAndListsEverythingInTheSummary', () => {
    // What carries a risk of a sanction holds the one focus block of the Home: the To do list does not add a second one.
    vi.mocked(useComplianceFineCount).mockReturnValue(2);
    renderDashboard();

    expect(screen.queryByTestId('home-todo-focus')).not.toBeInTheDocument();
    const summary = screen.getByTestId('home-todo-summary');
    expect(within(summary).getAllByRole('listitem')).toHaveLength(3);
    expect(within(summary).getByTestId('home-todo-urgent')).toHaveTextContent('2 urgenti');
  });
});
