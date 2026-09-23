import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { GuestsPage } from '../guests-page';
import { guestsApi } from '@/api/guests.api';
import type { GuestSummary, PagedResult } from '@/types';

vi.mock('@/api/guests.api', () => ({
  guestsApi: { getAll: vi.fn() },
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const guest = (id: string, firstName: string): GuestSummary => ({
  id,
  firstName,
  lastName: 'Rossi',
  email: `${id}@example.com`,
  phoneNumber: '',
  city: 'Roma',
  country: 'Italia',
  createdAt: '2026-09-20T10:00:00Z',
});

const page = (items: GuestSummary[], totalCount: number, pageNumber = 1): PagedResult<GuestSummary> => ({
  items,
  totalCount,
  page: pageNumber,
  pageSize: 20,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, null, createElement(GuestsPage)))),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('GuestsPage', () => {
  it('renders the items of the paged response', async () => {
    vi.mocked(guestsApi.getAll).mockResolvedValue(page([guest('g1', 'Mario')], 1));

    renderPage();

    expect(await screen.findByText('Mario Rossi')).toBeInTheDocument();
    expect(guestsApi.getAll).toHaveBeenCalledWith({ search: undefined, page: 1, pageSize: 20 });
    expect(screen.queryByText(i18n.t('guests.next'))).not.toBeInTheDocument();
  });

  it('requests the next page when there are more guests than a page', async () => {
    vi.mocked(guestsApi.getAll)
      .mockResolvedValueOnce(page([guest('g1', 'Mario')], 21))
      .mockResolvedValueOnce(page([guest('g21', 'Luigi')], 21, 2));

    renderPage();

    expect(await screen.findByText(i18n.t('guests.pagination', { page: 1, totalPages: 2, totalCount: 21 }))).toBeInTheDocument();
    fireEvent.click(screen.getByText(i18n.t('guests.next')));

    expect(await screen.findByText('Luigi Rossi')).toBeInTheDocument();
    await waitFor(() =>
      expect(guestsApi.getAll).toHaveBeenLastCalledWith({ search: undefined, page: 2, pageSize: 20 }),
    );
  });

  it('shows the error state, not an empty list, when the API fails', async () => {
    vi.mocked(guestsApi.getAll).mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByText(i18n.t('guests.loadError'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('guests.empty'))).not.toBeInTheDocument();
  });
});
