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
vi.mock('@/api/leases.api', () => ({ leasesApi: { createDraft: vi.fn(), createCfDraft: vi.fn(), saveDraft: vi.fn(), getRules: vi.fn() } }));

/** What a save of a step answers: the version it made, the flow again and the ids of the parties. */
const SAVED = { version: 2, flow: { steps: [] }, landlordIds: [], tenantIds: [] };

/** What the route of the draft for the partner answers: the draft (an imported one, marked as the partner's) with its id. */
const CF_DRAFT = { id: 'lease-cf-1', propertyId: 'prop-1', status: 'Draft' } as const;

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

/** The sheet of the contract, where a canone concordato started from zero lands (CF-FLOW): the payment and the guided form follow from it. */
function LeaseSheetStub() {
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
            <Route path="/app/long-rent/leases/:id" element={<LeaseSheetStub />} />
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
    vi.mocked(leasesApi.createDraft).mockResolvedValue({ id: 'lease-1', version: 1, flow: { steps: [] } });
    vi.mocked(leasesApi.createCfDraft).mockResolvedValue(CF_DRAFT);
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

  it('names the transitory type with the term the server states, and moves the focus to the title when the question changes', async () => {
    vi.mocked(leasesApi.getRules).mockResolvedValue({ ...RULES, transitoryTermMonths: { min: 2, max: 12 } });
    renderPage();

    // The term is the server's (here 2 to 12), not written in the interface; until the rules arrive the card has the bare name.
    expect(await screen.findByText('Transitorio (da 2 a 12 mesi)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveFocus();

    // Next question: the card that was clicked is gone from under the person, the focus is on the title (read by a screen reader).
    chooseKind('transitorio');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
    expect(screen.getByText('Transitorio (da 2 a 12 mesi)')).toBeInTheDocument();

    // And back to the first question: the same.
    fireEvent.click(screen.getByTestId('lease-start-back'));
    expect(await screen.findByTestId('lease-kind-choice')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
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
    expect(screen.getByRole('button', { name: i18n.t('leaseWizardGuide.next.to.2') })).toBeInTheDocument();
  });

  it('saves the draft for the partner with only its property and lands on the sheet of the contract, with no APE asked', async () => {
    renderPage('/app/long-rent/leases/new?propertyId=prop-1');

    chooseKind('concordato');
    expect(screen.getByTestId('search')).toHaveTextContent('?propertyId=prop-1&tipo=concordato');
    chooseWay('zero');
    expect(screen.getByTestId('search')).toHaveTextContent('?propertyId=prop-1&tipo=concordato&come=zero');
    // The property of the link "new contract" of a property page is already chosen.
    await waitFor(() => expect(screen.getByLabelText(i18n.t('leases.form.propertyLabel'))).toHaveValue('prop-1'));
    fireEvent.click(screen.getByTestId('concordato-draft-create'));

    expect(await screen.findByTestId('lease-page')).toHaveTextContent('lease-cf-1');
    // The sheet is the centre (the only route of the test that matches): its main button leads on to the privacy notice, the payment and the form.
    // One call to the route of the draft for the partner (an imported draft marked as theirs, typed as a concordato by the server):
    // not the generic draft, and nothing saved after it.
    expect(leasesApi.createCfDraft).toHaveBeenCalledWith('prop-1');
    expect(leasesApi.createDraft).not.toHaveBeenCalled();
    expect(leasesApi.saveDraft).not.toHaveBeenCalled();
    expect(propertiesApi.getDocuments).not.toHaveBeenCalled();
  });

  it('opens nothing when making the draft failed, and the next click asks again: the server gives back the draft it made', async () => {
    vi.mocked(leasesApi.createCfDraft).mockRejectedValueOnce(httpError()).mockResolvedValueOnce(CF_DRAFT);
    renderPage();
    chooseKind('concordato');
    chooseWay('zero');
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });

    fireEvent.click(screen.getByTestId('concordato-draft-create'));
    await waitFor(() => expect(leasesApi.createCfDraft).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('concordato-draft-create')).not.toHaveAttribute('aria-busy'));
    expect(screen.queryByTestId('lease-page')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('concordato-draft-create'));

    expect(await screen.findByTestId('lease-page')).toHaveTextContent('lease-cf-1');
    expect(leasesApi.createCfDraft).toHaveBeenCalledTimes(2);
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
