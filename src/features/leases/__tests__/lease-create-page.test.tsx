import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import i18n from '@/i18n/config';
import { leasesApi } from '@/api/leases.api';
import { propertiesApi } from '@/api/properties.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { useProperties } from '@/queries/use-properties';
import type { LongRentRules } from '@/types';
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
vi.mock('@/api/leases.api', () => ({ leasesApi: { createDraft: vi.fn(), saveDraft: vi.fn(), getRules: vi.fn() } }));

/** What a save of a step answers: the version it made, the flow again and the ids of the parties. */
const SAVED = { version: 2, flow: { steps: [] }, landlordIds: [], tenantIds: [] };

/** The rules of the area as the server gives them today: the transitory type is made in CasaZen too, with the official model. */
const RULES: LongRentRules = {
  termMonths: { Libero: 48, Concordato: 36 },
  renewalMonths: { Libero: 48, Concordato: 24 },
  noticeMonths: 6,
  registrationDays: 30,
  depositMaxRents: 3,
  availableTypes: ['Libero', 'Concordato', 'Transitorio'],
  importedTypes: ['Libero', 'Concordato', 'Transitorio'],
  transitoryTermMonths: { min: 1, max: 18 },
  transitoryDocumentationAfterDays: 30,
  transitoryBandFromInhabitants: 10000,
};

/** The page of the service of the partner, where a canone concordato started from zero goes. */
function PaymentPage() {
  const { id } = useParams();
  return <p data-testid="lease-page">{id}</p>;
}

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderPage(path = '/app/long-rent/leases/new', { partner = true }: { partner?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, concordatoFacile: partner }, isLoading: false }}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/long-rent/leases/new" element={<><LeaseCreatePage /><Search /></>} />
            <Route path="/app/long-rent/leases/:id/concordatofacile" element={<PaymentPage />} />
          </Routes>
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

function chooseKind(kind: 'concordato' | 'libero' | 'transitorio') {
  fireEvent.click(screen.getByTestId(`lease-kind-${kind}`));
  fireEvent.click(screen.getByTestId('lease-kind-continue'));
}

function chooseWay(way: 'casazen' | 'documenti' | 'zero') {
  fireEvent.click(screen.getByTestId(`lease-way-${way}`));
  fireEvent.click(screen.getByTestId('lease-way-continue'));
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
    vi.mocked(leasesApi.getRules).mockResolvedValue(RULES);
  });

  it('asks the type of contract first, before any field', () => {
    renderPage();

    expect(screen.getByText(i18n.t('leaseWizard.start.kind.legend'))).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByTestId('lease-kind-continue')).toBeDisabled();
    expect(screen.queryByLabelText(i18n.t('leases.form.monthlyRentLabel'))).not.toBeInTheDocument();
  });

  it('asks how a libero is made, then opens the wizard on its first step', async () => {
    renderPage();

    chooseKind('libero');
    expect(screen.getByTestId('search')).toHaveTextContent('?tipo=libero');
    await waitFor(() => expect(screen.getByTestId('lease-way-casazen')).toBeEnabled());
    chooseWay('casazen');

    expect(screen.getByTestId('search')).toHaveTextContent('?tipo=libero&come=casazen');
    expect(screen.getByLabelText(i18n.t('leases.form.propertyLabel'))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('leases.form.monthlyRentLabel'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('leaseWizard.next', { step: i18n.t('leaseWizard.steps.2.label') }) })).toBeInTheDocument();
  });

  it('saves a concordato draft with only its property and goes to the page of the service, with no APE asked', async () => {
    renderPage('/app/long-rent/leases/new?propertyId=prop-1');

    chooseKind('concordato');
    expect(screen.getByTestId('search')).toHaveTextContent('?propertyId=prop-1&tipo=concordato');
    chooseWay('zero');
    expect(screen.getByTestId('search')).toHaveTextContent('?propertyId=prop-1&tipo=concordato&come=zero');
    // The property of the link "new contract" of a property page is already chosen.
    await waitFor(() => expect(screen.getByLabelText(i18n.t('leases.form.propertyLabel'))).toHaveValue('prop-1'));
    fireEvent.click(screen.getByTestId('concordato-draft-create'));

    expect(await screen.findByTestId('lease-page')).toHaveTextContent('lease-cf-1');
    expect(leasesApi.createDraft).toHaveBeenCalledWith('prop-1');
    expect(leasesApi.saveDraft).toHaveBeenCalledWith('lease-cf-1', { version: 1, step: 3, values: { contractType: 'Concordato' } });
    expect(propertiesApi.getDocuments).not.toHaveBeenCalled();
  });

  it('retries on the same draft when saving its type failed: one click, one contract', async () => {
    vi.mocked(leasesApi.saveDraft).mockRejectedValueOnce(httpError()).mockResolvedValueOnce(SAVED);
    renderPage();
    chooseKind('concordato');
    chooseWay('zero');
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });

    fireEvent.click(screen.getByTestId('concordato-draft-create'));
    await waitFor(() => expect(leasesApi.saveDraft).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('concordato-draft-create')).not.toHaveAttribute('aria-busy'));
    fireEvent.click(screen.getByTestId('concordato-draft-create'));

    expect(await screen.findByTestId('lease-page')).toHaveTextContent('lease-cf-1');
    expect(leasesApi.createDraft).toHaveBeenCalledTimes(1);
    expect(leasesApi.saveDraft).toHaveBeenCalledTimes(2);
  });

  it('closes the way from zero while ConcordatoFacile is off: the card is disabled and the address alone does not open it', () => {
    renderPage('/app/long-rent/leases/new?tipo=concordato&come=zero', { partner: false });

    // The page asks again instead of opening the form that leads to the payment; having the documents stays open.
    expect(screen.getByTestId('lease-way-zero')).toBeDisabled();
    expect(screen.getByText(i18n.t('leaseWizard.start.concordato.zero.soon'))).toBeInTheDocument();
    expect(screen.queryByTestId('concordato-draft-start')).not.toBeInTheDocument();
    expect(screen.getByTestId('lease-way-documenti')).toBeEnabled();
  });
});
