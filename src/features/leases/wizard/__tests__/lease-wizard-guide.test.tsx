import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { leasesApi } from '@/api/leases.api';
import type { LeaseDraft, LeaseDraftFlow, LeaseReview, LongRentRules } from '@/types';
import { LeaseWizard } from '../lease-wizard';
import { ReviewStep } from '../review-step';
import { toWizardValues } from '../wizard-model';

vi.mock('@/api/leases.api', () => ({ leasesApi: { saveDraft: vi.fn(), getReview: vi.fn(), confirmReview: vi.fn() } }));
vi.mock('@/queries/use-properties', () => ({
  useProperties: vi.fn(() => ({ data: [], isLoading: false, isError: false, error: null, isFetching: false, refetch: vi.fn() })),
  useProperty: vi.fn(() => ({ data: { id: 'prop-1', name: 'Casa Rossi', address: 'Via Roma 10', city: 'Seveso', rentalMode: 'Long' } })),
  useUploadPropertyDocument: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateApeIdentification: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useApeAutoRead: vi.fn(() => ({ isFetching: false, isSuccess: false })),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getDocuments: vi.fn(async () => []) } }));

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

/** A contract made in CasaZen with every data step done and the review not confirmed yet: every step can be opened. */
const OPEN_FLOW: LeaseDraftFlow = {
  steps: [
    { step: 1, state: 'Done', needs: [] },
    { step: 2, state: 'Done', needs: [] },
    { step: 3, state: 'Done', needs: [] },
    { step: 4, state: 'Done', needs: [] },
    { step: 5, state: 'Done', needs: [] },
    { step: 6, state: 'Todo', needs: [] },
    { step: 7, state: 'Todo', needs: [] },
    { step: 8, state: 'Locked', needs: [] },
  ],
};

const PARTY = { firstName: 'Mario', lastName: 'Rossi', fiscalCode: 'RSSMRA80A01H501U', citizenship: 'IT', residence: 'Seveso', contactEmail: null };

const DRAFT: LeaseDraft = {
  id: 'lease-1',
  version: 4,
  origin: 'Created',
  wizardMaxStep: 5,
  reviewConfirmedAt: null,
  sentForSignatureAt: null,
  updatedAt: '2026-10-25T08:00:00Z',
  values: {
    propertyId: 'prop-1',
    landlords: [{ id: 'landlord-1', ...PARTY }],
    tenants: [{ id: 'tenant-1', ...PARTY, firstName: 'Giulia', lastName: 'Verdi', fiscalCode: 'VRDGLI85B02F205A' }],
    contractType: 'Libero',
    taxRegime: 'CedolareSecca',
    monthlyRent: 650,
    securityDeposit: 1300,
    startDate: '2026-12-01',
  },
  flow: OPEN_FLOW,
};

function renderWizard(step: number, draft: LeaseDraft = DRAFT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/app/long-rent/leases/lease-1/edit?step=${step}`]}>
        <LeaseWizard draft={draft} defaults={null} rules={RULES} onReload={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LeaseWizard — the head of every step and the line for what is missing (LR-WIZ-1)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    await i18n.changeLanguage('it');
    vi.mocked(leasesApi.getReview).mockResolvedValue({ version: 4, reviewConfirmedAt: null, checks: [], counts: { block: 0, warn: 0, info: 0, ok: 0 } });
  });

  it.each<[number, string, string]>([
    [1, 'Scegli la casa', 'Salva e vai alle parti'],
    [2, 'Scrivi chi firma', 'Salva e vai alle condizioni'],
    [3, 'Indica canone e condizioni', 'Salva e vai alle date'],
    [4, 'Scegli le date', 'Salva e vai al controllo'],
  ])('step %i opens with its place, a title with a verb and what to have at hand, and a main button that says where it goes', (step, title, button) => {
    renderWizard(step);

    const head = screen.getByTestId('lease-wizard-header');
    // «Passo 3 di 7»: the steps that apply to a contract made in CasaZen are seven (the model has no screen).
    expect(within(head).getByTestId('lease-wizard-position')).toHaveTextContent(`Passo ${step} di 7`);
    expect(within(head).getByRole('heading', { level: 2 })).toHaveTextContent(title);
    expect(within(head).getByTestId('lease-wizard-in-hand')).toHaveTextContent(i18n.t('leaseWizardGuide.header.inHand'));
    expect(screen.getByTestId('lease-wizard-next')).toHaveTextContent(button);
    // The quiet second gesture is there, and it is not the strong one.
    expect(screen.getByTestId('lease-wizard-save')).toHaveTextContent('Salva e continua dopo');
  });

  it('the review and the signature open the same way', async () => {
    renderWizard(6);
    expect(await screen.findByTestId('lease-review')).toBeInTheDocument();
    expect(screen.getByTestId('lease-wizard-position')).toHaveTextContent('Passo 5 di 7');
    expect(screen.getByTestId('lease-wizard-in-hand')).toHaveTextContent(i18n.t('leaseWizardGuide.header.inHand'));
    expect(screen.getByTestId('lease-wizard-next')).toHaveTextContent('Conferma e vai alla firma');
  });

  it('with a thing missing the main button stays pressable, puts the focus on the first field and one line says what is missing', async () => {
    const missing: LeaseDraftFlow = {
      steps: OPEN_FLOW.steps.map((step) => (step.step === 3 ? { ...step, state: 'Todo', needs: [{ code: 'rent_missing' }] } : step)),
    };
    vi.mocked(leasesApi.saveDraft).mockResolvedValue({ version: 5, flow: missing, landlordIds: ['landlord-1'], tenantIds: ['tenant-1'] });
    renderWizard(3, { ...DRAFT, values: { ...DRAFT.values, monthlyRent: null }, flow: missing });

    // Before pressing anything the line is already there: one sentence, never a list.
    const note = screen.getByTestId('lease-wizard-remaining');
    expect(note).toHaveTextContent('Manca: il canone mensile');
    expect(screen.getByTestId('lease-wizard-next')).toBeEnabled();

    fireEvent.click(screen.getByTestId('lease-wizard-next'));

    await waitFor(() => expect(document.getElementById('lw-monthlyRent')).toHaveFocus());
    await waitFor(() => expect(screen.getByTestId('lease-wizard-remaining')).toHaveAttribute('data-pressed', 'true'));
    expect(screen.getByTestId('lease-wizard-remaining')).toHaveTextContent('Manca: il canone mensile');
    // The wizard did not go on, and nothing says «errore»: no alert but the sentence itself.
    expect(screen.getByTestId('lease-wizard-position')).toHaveTextContent('Passo 3 di 7');
    expect(screen.queryByTestId('lease-wizard-blocked')).not.toBeInTheDocument();
  });
});

describe('ReviewStep — the contract told in sentences before its data (LR-WIZ-1)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  const REVIEW: LeaseReview = {
    version: 4,
    reviewConfirmedAt: null,
    checks: [{ code: 'property_ok', severity: 'Ok', step: 1 }],
    counts: { block: 0, warn: 0, info: 0, ok: 1 },
  };

  it('says who lets what to whom, from when, for how much and with which taxes, then lists the data with a «Modifica» for each group', () => {
    const review = { data: REVIEW, isLoading: false, isError: false, error: null, refetch: vi.fn() } as unknown as UseQueryResult<LeaseReview>;
    render(
      <MemoryRouter>
        <ReviewStep review={review} hrefOfStep={(step) => `/edit?step=${step}`} values={toWizardValues(DRAFT.values)} rules={RULES} />
      </MemoryRouter>,
    );

    const story = screen.getByTestId('lease-review-story');
    expect(story).toHaveTextContent('Affitti Casa Rossi a Giulia Verdi.');
    expect(story).toHaveTextContent('Dal 1 dicembre 2026 per 4 anni, fino al 30 novembre 2030.');
    // The Italian way of writing 1300 has no dot of the thousands (a dot would not be wrong either).
    expect(story).toHaveTextContent(/650 € al mese, con 1\.?300 € di deposito\./);
    expect(story).toHaveTextContent('Canone libero (4+4), con la cedolare secca.');

    // The data come after the story, in four groups, each one edited at its own step.
    const data = screen.getByTestId('lease-review-data');
    expect(story.compareDocumentPosition(data) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const edits = within(data).getAllByRole('link', { name: /^Modifica:/ });
    expect(edits.map((link) => link.getAttribute('href'))).toEqual(['/edit?step=1', '/edit?step=2', '/edit?step=3', '/edit?step=4']);
  });
});
