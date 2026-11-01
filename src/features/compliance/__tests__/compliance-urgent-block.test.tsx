import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { fetchComplianceSummary } from '@/api/compliance.api';
import type { AppContextKey } from '@/config/route-manifest';
import { freezeClock, NOON_UTC } from '@/test/clock';
import type { ComplianceSummaryItem, ComplianceSummaryResult } from '@/types/compliance.types';
import { ComplianceUrgentBlock } from '../components/compliance-urgent-block';

vi.mock('@/api/compliance.api', () => ({
  fetchComplianceSummary: vi.fn(),
  fetchComplianceActivation: vi.fn(),
  completeComplianceActivation: vi.fn(),
  startCheckoutWizard: vi.fn(),
  completeCheckoutWizard: vi.fn(),
}));
vi.mock('@/queries/use-dashboard', () => ({ useDashboardToday: () => ({ data: undefined }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: undefined }) }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (contextKey: AppContextKey) => contextKey === 'short-rent' }),
}));

const empty = { count: 0, items: [] };
const summaryOf = (parts: Partial<ComplianceSummaryResult>): ComplianceSummaryResult => ({
  propertiesPending: empty,
  guestCheckInsIncomplete: empty,
  checkoutsDue: empty,
  alloggiatiFailures: empty,
  alloggiatiManualRequired: empty,
  turnoversPending: empty,
  ...parts,
});
const stay = (id: string, label: string, dueAt?: string): ComplianceSummaryItem => ({
  id,
  label,
  action: 'SendAlloggiati',
  propertyId: null,
  bookingId: id,
  dueAt,
});

function renderBlock() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(ComplianceUrgentBlock))),
  );
}

describe('ComplianceUrgentBlock (the Home)', () => {
  beforeEach(() => {
    freezeClock(NOON_UTC);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    cleanup();
  });

  it('ComplianceUrgentBlock_AThingTheLawDates_ShowsItFirstInRedWithItsDeadlineAndTheButton', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({ alloggiatiManualRequired: { count: 3, items: [stay('b1', 'Mario Rossi', '2026-09-21T10:00:00Z'), stay('b2', 'Anna Verdi', '2026-09-24T14:30:00Z')] } }),
    );
    renderBlock();

    const block = await screen.findByTestId('home-compliance-block');
    expect(block).toHaveTextContent('Rischi una sanzione');
    expect(block).toHaveTextContent('Alloggiati Web da inviare: Mario Rossi');
    expect(block).toHaveTextContent('Scaduto da 3 giorni');
    expect(block).toHaveTextContent('Poi: ancora 2 con scadenza di legge');
    expect(block).toHaveAttribute('data-tone', 'danger');
    expect(screen.getByTestId('home-compliance-cta')).toHaveAttribute('href', '/app/short-rent/bookings/b1?tab=alloggiati');
    expect(screen.getByTestId('home-compliance-all')).toHaveAttribute('href', '/app/short-rent/compliance');
  });

  it('ComplianceUrgentBlock_OnlyThePropertiesToActivate_ShowsNothing', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(
      summaryOf({ propertiesPending: { count: 21, items: [{ id: 'p1', label: 'Casa Como', action: 'ActivateProperty', propertyId: 'p1', bookingId: null }] } }),
    );
    renderBlock();

    // What only keeps a property from starting is on the page of the adempimenti: the Home keeps the red for the law.
    await vi.waitFor(() => expect(fetchComplianceSummary).toHaveBeenCalled());
    expect(screen.queryByTestId('home-compliance-block')).not.toBeInTheDocument();
  });

  it('ComplianceUrgentBlock_NothingPending_ShowsNothing', async () => {
    vi.mocked(fetchComplianceSummary).mockResolvedValue(summaryOf({}));
    renderBlock();

    await vi.waitFor(() => expect(fetchComplianceSummary).toHaveBeenCalled());
    expect(screen.queryByTestId('home-compliance-block')).not.toBeInTheDocument();
  });

  it('ComplianceUrgentBlock_SummaryFails_ShowsNothingAndSaysNothing', async () => {
    vi.mocked(fetchComplianceSummary).mockRejectedValue(new Error('boom'));
    renderBlock();

    await vi.waitFor(() => expect(fetchComplianceSummary).toHaveBeenCalled());
    expect(screen.queryByTestId('home-compliance-block')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
