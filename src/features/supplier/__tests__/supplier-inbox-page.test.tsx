import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierServiceRequest } from '@/types/service-request';
import type { SupplierInboxCounts, SupplierInboxParams, SupplierInboxResponse } from '@/types/supplier';
import { SupplierInboxPage } from '../supplier-inbox-page';

const api = vi.hoisted(() => ({ fetchSupplierInbox: vi.fn(), fetchSupplierInboxCounts: vi.fn(), fetchSupplierProfile: vi.fn() }));
const requestsApi = vi.hoisted(() => ({ takeServiceRequest: vi.fn(), completeServiceRequest: vi.fn(), rejectServiceRequest: vi.fn() }));
const servicesApi = vi.hoisted(() => ({ fetchSupplierServices: vi.fn() }));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));
// The list also reads the catalog of the supplier, for the choices of its filter by service.
vi.mock('@/api/supplier-services.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/supplier-services.api')>()),
  ...servicesApi,
}));
vi.mock('@/api/service-requests.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/service-requests.api')>()),
  ...requestsApi,
}));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => ({ userId: 'tester', context: 'supplier' }) }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, primary }: { title: string; primary?: { label: string; to?: string; testId?: string } }) =>
    createElement('div', null, createElement('h1', null, title), primary?.to ? createElement('a', { href: primary.to, 'data-testid': primary.testId }, primary.label) : null),
}));

const OPEN_ITEM: SupplierServiceRequest = {
  id: 'r-open',
  rentalContext: 'ShortRent',
  status: 'Richiesto',
  phase: 'to_answer',
  category: 'cleaning',
  urgency: 'Normal',
  notes: null,
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
  propertyId: null,
  propertyName: null,
  city: 'Roma',
  postalCode: '00184',
  address: null,
  scheduledFor: '2026-10-12',
  scheduledStart: '2026-10-12T08:00:00Z',
  scheduledEnd: '2026-10-12T10:00:00Z',
  stay: null,
  contactDisclosed: false,
  hostContact: null,
  clientName: 'Zen Stays',
  price: { amountCents: 5000 },
};

const TAKEN_ITEM: SupplierServiceRequest = { ...OPEN_ITEM, id: 'r-taken', status: 'PresoInCarico', phase: 'scheduled', contactDisclosed: true };
const REJECTED_ITEM: SupplierServiceRequest = { ...OPEN_ITEM, id: 'r-rejected', status: 'Rifiutato', phase: 'rejected', rejectionReason: 'Non disponibile' };

const COUNTS: SupplierInboxCounts = { toAnswer: 1, awaitingCustomer: 0, scheduled: 1, toCollect: 0, archive: 1, paymentsLate: 0 };

function page(items: SupplierServiceRequest[], total = items.length): SupplierInboxResponse {
  return { items, total, page: 1, pageSize: 20 };
}

function renderPage(initial = '/app/supplier/inbox') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[initial]}>
          <SupplierInboxPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

/** The table of the list, once it is there: the page has the table and the cards of a phone, and a media query shows one. */
const findTable = () => screen.findByRole('table', { name: 'Richieste' });
/** What the list asked the server last (the page also asks, for its one action, for the first request to answer). */
const lastParams = () =>
  api.fetchSupplierInbox.mock.calls.map(([params]) => params as SupplierInboxParams).filter((params) => params.pageSize === 20).at(-1);

describe('SupplierInboxPage (SU-08, SP-08c)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    api.fetchSupplierInbox.mockImplementation(async (params: SupplierInboxParams) => {
      if (params.tab === 'programmate') return page([TAKEN_ITEM]);
      if (params.tab === 'archivio') return page([REJECTED_ITEM]);
      return page([OPEN_ITEM]);
    });
    api.fetchSupplierInboxCounts.mockResolvedValue(COUNTS);
    api.fetchSupplierProfile.mockResolvedValue({ status: 'Active' });
    servicesApi.fetchSupplierServices.mockResolvedValue({ items: [], total: 0, limit: 30 });
    requestsApi.takeServiceRequest.mockResolvedValue({});
    await i18n.changeLanguage('it');
  });

  it('SupplierInboxPage_Default_AsksTheTabToAnswerAndShowsTheRequestWithItsQuickAction', async () => {
    renderPage();

    const table = within(await findTable());
    // The name of the job is what opens the row in the drawer of the shell.
    expect(await table.findByRole('button', { name: 'Pulizie' })).toBeInTheDocument();
    expect(lastParams()).toEqual({ tab: 'da-rispondere', page: 1, pageSize: 20 });
    expect(table.getByText('Roma (00184)')).toBeInTheDocument();
    expect(table.getByText('Zen Stays')).toBeInTheDocument();
    expect(table.getByText('50 €')).toBeInTheDocument();
    expect(table.getByTestId('take-r-open')).toBeEnabled();
    // The number of what waits for an answer is on its chip, from the server; and the page offers the most urgent one.
    expect(screen.getByTestId('list-chip-da-rispondere')).toHaveTextContent('1');
    await waitFor(() => expect(screen.getByTestId('supplier-inbox-urgent')).toHaveAttribute('href', '/app/supplier/inbox/r-open'));
  });

  it('SupplierInboxPage_ChipsSearchAndFilters_AreAskedOfTheServer', async () => {
    const { unmount } = renderPage('/app/supplier/inbox?chip=tutte');
    await findTable();
    await waitFor(() => expect(lastParams()).toEqual({ status: 'all', page: 1, pageSize: 20 }));
    unmount();

    renderPage('/app/supplier/inbox?chip=archivio&q=pulizia&f_when=oggi&f_period=2026-09-01..2026-09-30');
    const table = within(await findTable());
    expect(await table.findByRole('button', { name: 'Pulizie' })).toBeInTheDocument();
    expect(lastParams()).toEqual({ tab: 'archivio', q: 'pulizia', when: 'oggi', from: '2026-09-01', to: '2026-09-30', page: 1, pageSize: 20 });
    // A closed request has no quick action: the row opens its drawer.
    expect(table.queryByTestId('take-r-rejected')).not.toBeInTheDocument();
    expect(table.queryByTestId('complete-r-rejected')).not.toBeInTheDocument();
  });

  it('SupplierInboxPage_OneLetterSearch_IsNotSentBecauseTheServerRefusesIt', async () => {
    renderPage('/app/supplier/inbox?q=p');
    await findTable();
    await waitFor(() => expect(api.fetchSupplierInbox).toHaveBeenCalled());
    expect(lastParams()).toEqual({ tab: 'da-rispondere', page: 1, pageSize: 20 });
  });

  it('SupplierInboxPage_Chip_ChangesTheTabAndTheQuickActionToComplete', async () => {
    renderPage();
    await within(await findTable()).findByTestId('take-r-open');

    fireEvent.click(screen.getByTestId('list-chip-programmate'));

    const table = within(await findTable());
    expect(await table.findByTestId('complete-r-taken')).toBeEnabled();
    expect(lastParams()).toEqual({ tab: 'programmate', page: 1, pageSize: 20 });
  });

  it('SupplierInboxPage_Take_CallsTheApi', async () => {
    renderPage();

    fireEvent.click(await within(await findTable()).findByTestId('take-r-open'));

    await waitFor(() => expect(requestsApi.takeServiceRequest).toHaveBeenCalledWith('r-open'));
  });

  it('SupplierInboxPage_ApiError_ShowsErrorWithRetryNotAnEmptyList', async () => {
    api.fetchSupplierInbox.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(page([OPEN_ITEM]));
    renderPage();

    const error = await screen.findByTestId('error-state');
    expect(error).toHaveTextContent('Impossibile caricare le richieste.');

    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await within(await findTable()).findByRole('button', { name: 'Pulizie' })).toBeInTheDocument();
  });

  it('SupplierInboxPage_NoRequestAtAll_ShowsWhatTheRequestsAreForAndHowToGetThem', async () => {
    api.fetchSupplierInboxCounts.mockResolvedValue({ ...COUNTS, toAnswer: 0, scheduled: 0, archive: 0 });
    api.fetchSupplierInbox.mockResolvedValue(page([]));
    renderPage();

    const empty = await screen.findByTestId('supplier-inbox-empty');
    expect(empty).toHaveTextContent('Qui arrivano le richieste');
    expect(within(empty).getByRole('link', { name: 'Imposta la disponibilità' })).toHaveAttribute('href', '/app/supplier/availability');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('SupplierInboxPage_SuspendedSupplier_DisablesTheQuickActions', async () => {
    api.fetchSupplierProfile.mockResolvedValue({ status: 'Suspended' });
    renderPage();

    const take = await within(await findTable()).findByTestId('take-r-open');
    await waitFor(() => expect(take).toBeDisabled());
  });
});
