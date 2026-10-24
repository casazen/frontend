import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import i18n from '@/i18n/config';
import { leasesApi } from '@/api/leases.api';
import { propertiesApi } from '@/api/properties.api';
import { useProperties } from '@/queries/use-properties';
import { LeaseCreatePage } from '../lease-create-page';
import { httpError } from './lease-test-utils';

vi.mock('@/queries/use-properties', () => ({
  useProperties: vi.fn(),
  useProperty: vi.fn(() => ({ data: undefined })),
  useUploadPropertyDocument: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateApeIdentification: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useApeAutoRead: vi.fn(() => ({ isFetching: false, isSuccess: false })),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getDocuments: vi.fn() } }));
vi.mock('@/api/leases.api', () => ({ leasesApi: { createDraft: vi.fn(), saveDraft: vi.fn() } }));

/** What a save of a step answers: the version it made, the flow again and the ids of the parties. */
const SAVED = { version: 2, flow: { steps: [] }, landlordIds: [], tenantIds: [] };

function LeasePage() {
  const { id } = useParams();
  return <p data-testid="lease-page">{id}</p>;
}

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderPage(path = '/app/long-rent/leases/new') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/long-rent/leases/new" element={<><LeaseCreatePage /><Search /></>} />
          <Route path="/app/long-rent/leases/:id" element={<LeasePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function choose(kind: 'concordato' | 'altro') {
  fireEvent.click(screen.getByTestId(kind === 'concordato' ? 'lease-kind-concordato' : 'lease-kind-other'));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.kind.continue') }));
}

describe('LeaseCreatePage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(useProperties).mockReturnValue({
      data: [{ id: 'prop-1', name: 'Il Parco', city: 'Seveso' }],
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useProperties>);
    vi.mocked(propertiesApi.getDocuments).mockResolvedValue([]);
    vi.mocked(leasesApi.createDraft).mockResolvedValue({ id: 'lease-cf-1', version: 1, flow: { steps: [] } });
    vi.mocked(leasesApi.saveDraft).mockResolvedValue(SAVED);
  });

  it('asks the type of contract first, before any field', () => {
    renderPage();

    expect(screen.getByText(i18n.t('leases.kind.legend'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('leases.kind.continue') })).toBeDisabled();
    expect(screen.queryByLabelText(i18n.t('leases.form.monthlyRentLabel'))).not.toBeInTheDocument();
  });

  it('opens the wizard on its first step for a contract that is not a concordato', () => {
    renderPage();

    choose('altro');

    expect(screen.getByTestId('search')).toHaveTextContent('?tipo=altro');
    expect(screen.getByLabelText(i18n.t('leases.form.propertyLabel'))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('leases.form.monthlyRentLabel'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('leaseWizard.next', { step: i18n.t('leaseWizard.steps.2.label') }) })).toBeInTheDocument();
  });

  it('saves a concordato draft with only its property and opens it, with no APE asked', async () => {
    renderPage('/app/long-rent/leases/new?propertyId=prop-1');

    choose('concordato');
    expect(screen.getByTestId('search')).toHaveTextContent('?propertyId=prop-1&tipo=concordato');
    // The property of the link "new contract" of a property page is already chosen.
    await waitFor(() => expect(screen.getByLabelText(i18n.t('leases.form.propertyLabel'))).toHaveValue('prop-1'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.concordato.create') }));

    expect(await screen.findByTestId('lease-page')).toHaveTextContent('lease-cf-1');
    expect(leasesApi.createDraft).toHaveBeenCalledWith('prop-1');
    expect(leasesApi.saveDraft).toHaveBeenCalledWith('lease-cf-1', { version: 1, step: 3, values: { contractType: 'Concordato' } });
    expect(propertiesApi.getDocuments).not.toHaveBeenCalled();
  });

  it('retries on the same draft when saving its type failed: one click, one contract', async () => {
    vi.mocked(leasesApi.saveDraft).mockRejectedValueOnce(httpError()).mockResolvedValueOnce(SAVED);
    renderPage();
    choose('concordato');
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });

    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.concordato.create') }));
    await waitFor(() => expect(leasesApi.saveDraft).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: i18n.t('leases.concordato.create') })).not.toHaveAttribute('aria-busy'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.concordato.create') }));

    expect(await screen.findByTestId('lease-page')).toHaveTextContent('lease-cf-1');
    expect(leasesApi.createDraft).toHaveBeenCalledTimes(1);
    expect(leasesApi.saveDraft).toHaveBeenCalledTimes(2);
  });
});
