import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { CinComplianceSummary } from '@/types/cin.types';
import { PropertiesPage } from '../properties-page';

/**
 * The page of the properties is its title first and then what is due: the notice of the CIN is under the title, not above it (UX round 3).
 * What the list says has its own tests (`properties-list`); here the list and what it reads are plain stand-ins.
 */
const cin = vi.hoisted(() => ({ summary: undefined as undefined | CinComplianceSummary }));
vi.mock('@/queries/use-cin', () => ({ useCinCompliance: () => ({ data: cin.summary ? { summary: cin.summary } : undefined }) }));
vi.mock('@/queries/use-properties', () => ({
  SHORT_PROPERTIES_OVERVIEW: {},
  useProperties: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  usePauseProperty: () => ({ mutate: vi.fn(), isPending: false }),
  useActivateProperty: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProperty: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => ({ user: null, org: null }), useEntitlement: () => ({ data: undefined }) }));
vi.mock('@/queries/use-listing-status', () => ({ useListingStatusSummary: () => ({ data: [], isSuccess: false }) }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => null }));
vi.mock('@/hooks/use-billing-context', () => ({ usePlanPagePath: () => null }));
vi.mock('../properties-list', () => ({ usePropertiesList: () => ({}) }));
vi.mock('@/components/shared/list-view/list-view', () => ({ ListView: () => createElement('div', { 'data-testid': 'properties-list' }) }));

const NON_COMPLIANT: CinComplianceSummary = {
  valid: 1,
  missing: 1,
  invalid: 0,
  daysUntilDeadline: 30,
  deadline: '2027-01-01',
  deadlineStatus: 'upcoming',
  hasNonCompliant: true,
} as CinComplianceSummary;

function renderPage() {
  return render(
    <MemoryRouter>
      <PropertiesPage />
    </MemoryRouter>,
  );
}

describe('PropertiesPage notices', () => {
  beforeEach(async () => {
    cin.summary = undefined;
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('puts the notice of the CIN under the title of the page, before the list', () => {
    cin.summary = NON_COMPLIANT;
    renderPage();

    const title = screen.getByRole('heading', { level: 1 });
    const banner = screen.getByTestId('cin-deadline-banner');
    const list = screen.getByTestId('properties-list');
    expect(title.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(banner.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no notice when every property is in order', () => {
    cin.summary = { ...NON_COMPLIANT, missing: 0, hasNonCompliant: false } as CinComplianceSummary;
    renderPage();

    expect(screen.queryByTestId('cin-deadline-banner')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
