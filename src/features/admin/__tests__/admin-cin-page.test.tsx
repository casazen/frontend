import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { AdminApi } from '@/api/admin.api';
import type { CinComplianceItem } from '@/types/admin.types';
import { AdminCinPage } from '../admin-cin-page';

vi.mock('@/api/admin.api', () => ({
  AdminApi: { getCinCompliance: vi.fn() },
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
}));

const validItem: CinComplianceItem = {
  propertyId: 'p-1',
  propertyName: 'Casa Verdi',
  ownerId: 'auth0|owner-1',
  ownerEmail: 'owner1@example.com',
  cinCode: 'IT058091C27G5FFZDZ',
  cinStatus: 'valid',
  city: 'Roma',
};

const missingItem: CinComplianceItem = {
  propertyId: 'p-2',
  propertyName: 'Casa Rossi',
  ownerId: 'auth0|owner-2',
  ownerEmail: 'owner2@example.com',
  cinCode: null,
  cinStatus: 'missing',
  city: 'Milano',
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(AdminCinPage)));
}

// A1-16: the admin CIN audit page was unreachable and untested; these tests cover its table, filter and error state.
describe('AdminCinPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(AdminApi.getCinCompliance).mockResolvedValue({
      items: [validItem, missingItem],
      totalCount: 2,
      page: 1,
      pageSize: 20,
    });
  });

  it('render_Items_ShowsTableRowsWithOwnerAndCin', async () => {
    renderPage();

    expect(await screen.findByText('Casa Verdi')).toBeInTheDocument();
    expect(screen.getByText('Casa Rossi')).toBeInTheDocument();
    expect(screen.getByText('owner1@example.com')).toBeInTheDocument();
    expect(screen.getByText('IT058091C27G5FFZDZ')).toBeInTheDocument();
    expect(AdminApi.getCinCompliance).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('changeFilter_Missing_RequestsServerSideFilteredFirstPage', async () => {
    renderPage();
    await screen.findByText('Casa Verdi');

    vi.mocked(AdminApi.getCinCompliance).mockResolvedValue({
      items: [missingItem],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    });
    fireEvent.change(screen.getByTestId('cin-status-filter'), { target: { value: 'missing' } });

    await waitFor(() =>
      expect(AdminApi.getCinCompliance).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, cinStatus: 'missing' }),
    );
    await waitFor(() => expect(screen.queryByText('Casa Verdi')).not.toBeInTheDocument());
    expect(screen.getByText('Casa Rossi')).toBeInTheDocument();
  });

  it('render_LoadError_ShowsErrorWithRetryNotEmptyTable', async () => {
    vi.mocked(AdminApi.getCinCompliance).mockRejectedValue(new Error('500'));

    renderPage();

    expect(await screen.findByText(i18n.t('admin.cin.loadError'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('admin.cin.table.empty'))).not.toBeInTheDocument();

    vi.mocked(AdminApi.getCinCompliance).mockResolvedValue({
      items: [validItem],
      totalCount: 1,
      page: 1,
      pageSize: 20,
    });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('admin.cin.retry') }));

    expect(await screen.findByText('Casa Verdi')).toBeInTheDocument();
  });
});
