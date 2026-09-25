import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierServiceRequest } from '@/types/service-request';
import type { SupplierInboxParams, SupplierInboxResponse } from '@/types/supplier';
import { SupplierInboxPage } from '../supplier-inbox-page';

const api = vi.hoisted(() => ({ fetchSupplierInbox: vi.fn() }));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));

const OPEN_ITEM: SupplierServiceRequest = {
  id: 'r-open',
  rentalContext: 'ShortRent',
  status: 'Richiesto',
  category: 'cleaning',
  urgency: 'Normal',
  notes: null,
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
  propertyId: 'p-1',
  propertyName: 'Villa Rosa',
  city: 'Roma',
  postalCode: '00184',
  address: null,
  scheduledFor: '2026-10-12',
  stay: { bookingId: 'b-1', checkIn: '2026-10-09', checkOut: '2026-10-12' },
  contactDisclosed: false,
  hostContact: null,
};

const REJECTED_ITEM: SupplierServiceRequest = {
  ...OPEN_ITEM,
  id: 'r-rejected',
  status: 'Rifiutato',
  rejectionReason: 'Non disponibile',
  updatedAt: '2026-09-21T10:00:00Z',
};

function page(items: SupplierServiceRequest[], total = items.length, pageNumber = 1): SupplierInboxResponse {
  return { items, total, page: pageNumber, pageSize: 20 };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SupplierInboxPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function lastParams(): SupplierInboxParams {
  return api.fetchSupplierInbox.mock.calls.at(-1)?.[0] as SupplierInboxParams;
}

describe('SupplierInboxPage (SU-08, A4-14)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.fetchSupplierInbox.mockImplementation(async (params: SupplierInboxParams) =>
      params.status === 'open' ? page([OPEN_ITEM]) : page([REJECTED_ITEM]),
    );
    await i18n.changeLanguage('it');
  });

  it('SupplierInboxPage_OpenTab_ShowsComuneDayQuickActionsAndDetailLink', async () => {
    renderPage();

    const card = await screen.findByTestId('inbox-item-r-open');
    expect(lastParams()).toEqual({ status: 'open', page: 1, pageSize: 20 });
    expect(within(card).getByTestId('inbox-city-r-open')).toHaveTextContent('Roma (00184)');
    expect(within(card).getByTestId('inbox-day-r-open')).toHaveTextContent('Giorno: 12 ottobre 2026');
    expect(within(card).getByTestId('take-r-open')).toBeInTheDocument();
    expect(within(card).getByTestId('open-r-open')).toHaveAttribute('href', '/app/supplier/inbox/r-open');
  });

  it('SupplierInboxPage_HistoryTab_FiltersByStatusAndPeriodOnTheServer', async () => {
    renderPage();
    await screen.findByTestId('inbox-item-r-open');

    fireEvent.click(screen.getByTestId('supplier-inbox-tab-history'));
    const card = await screen.findByTestId('inbox-item-r-rejected');
    expect(lastParams()).toEqual({ status: 'history', from: undefined, to: undefined, page: 1, pageSize: 20 });
    expect(card).toHaveTextContent('Rifiutato il 21 settembre 2026');
    expect(within(card).queryByTestId('take-r-rejected')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('supplier-inbox-status'), { target: { value: 'Rifiutato' } });
    fireEvent.change(screen.getByTestId('supplier-inbox-from'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByTestId('supplier-inbox-to'), { target: { value: '2026-09-30' } });

    await waitFor(() =>
      expect(lastParams()).toEqual({ status: 'Rifiutato', from: '2026-09-01', to: '2026-09-30', page: 1, pageSize: 20 }),
    );
  });

  it('SupplierInboxPage_HistoryPagination_AsksTheServerForTheNextPage', async () => {
    api.fetchSupplierInbox.mockImplementation(async (params: SupplierInboxParams) =>
      page([REJECTED_ITEM], 45, params.page ?? 1),
    );
    renderPage();
    await screen.findByTestId('inbox-item-r-rejected');
    fireEvent.click(screen.getByTestId('supplier-inbox-tab-history'));

    expect(await screen.findByTestId('supplier-inbox-page-info')).toHaveTextContent('Pagina 1 di 3 · 45 incarichi');
    fireEvent.click(screen.getByTestId('supplier-inbox-next'));

    await waitFor(() => expect(lastParams()).toMatchObject({ status: 'history', page: 2 }));
    expect(await screen.findByText(/Pagina 2 di 3/)).toBeInTheDocument();
  });

  it('SupplierInboxPage_PeriodStartAfterEnd_ShowsErrorAndDoesNotQuery', async () => {
    renderPage();
    await screen.findByTestId('inbox-item-r-open');
    fireEvent.click(screen.getByTestId('supplier-inbox-tab-history'));
    await screen.findByTestId('inbox-item-r-rejected');
    const calls = api.fetchSupplierInbox.mock.calls.length;

    fireEvent.change(screen.getByTestId('supplier-inbox-from'), { target: { value: '2026-09-30' } });
    fireEvent.change(screen.getByTestId('supplier-inbox-to'), { target: { value: '2026-09-01' } });

    expect(await screen.findByTestId('supplier-inbox-period-invalid')).toHaveTextContent(
      'La data di inizio non può essere successiva alla data di fine.',
    );
    // Only the "from" change was asked: the invalid period is never sent.
    expect(api.fetchSupplierInbox.mock.calls.length).toBeLessThanOrEqual(calls + 1);
    expect(api.fetchSupplierInbox.mock.calls.some(([p]) => (p as SupplierInboxParams).to === '2026-09-01')).toBe(false);
  });

  it('SupplierInboxPage_ApiError_ShowsErrorWithRetryNotAnEmptyList', async () => {
    api.fetchSupplierInbox.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(page([OPEN_ITEM]));
    renderPage();

    const error = await screen.findByTestId('supplier-inbox-error');
    expect(error).toHaveTextContent('Impossibile caricare gli incarichi.');
    expect(screen.queryByTestId('supplier-inbox-empty')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('inbox-item-r-open')).toBeInTheDocument();
  });

  it('SupplierInboxPage_NoRequest_ShowsEmptyStateOfTheTab', async () => {
    api.fetchSupplierInbox.mockResolvedValue(page([]));
    renderPage();

    expect(await screen.findByTestId('supplier-inbox-empty')).toHaveTextContent('Nessun incarico aperto.');
    fireEvent.click(screen.getByTestId('supplier-inbox-tab-history'));
    await waitFor(() =>
      expect(screen.getByTestId('supplier-inbox-empty')).toHaveTextContent('Nessun incarico nello storico per questi filtri.'),
    );
  });
});
