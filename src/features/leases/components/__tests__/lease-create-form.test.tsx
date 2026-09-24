import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { propertiesApi } from '@/api/properties.api';
import { canoneConcordatoApi, type CanoneConcordatoEligibility } from '@/api/canone-concordato.api';
import { useProperties } from '@/queries/use-properties';
import { LeaseCreateForm } from '../lease-create-form';

const PROPERTIES = [{ id: 'prop-1', name: 'Il Parco', city: 'Seveso' }];

vi.mock('@/queries/use-properties', () => ({
  useProperties: vi.fn(),
}));

vi.mock('@/api/properties.api', () => ({
  propertiesApi: {
    getDocuments: vi.fn(),
  },
}));

vi.mock('@/api/canone-concordato.api', () => ({
  canoneConcordatoApi: {
    getEligibility: vi.fn(),
    getAttestationGuidance: vi.fn(),
  },
}));

/** Seveso, 65 mq, sub-fascia 2, 3 years, as the API returns it (LT-10). */
function apiRange(overrides: Partial<CanoneConcordatoEligibility> = {}): CanoneConcordatoEligibility {
  return {
    available: true,
    reason: null,
    reasonCode: null,
    comune: 'Seveso',
    zone: 'Unica',
    subFascia: 2,
    canoneMinAnnuo: 1300,
    canoneMaxAnnuo: 5525,
    canoneMinMensile: 108.34,
    canoneMaxMensile: 460.41,
    dataCompleteness: 'Complete',
    imuAppliesTheoretical: true,
    ataApplies: false,
    attestationRequired: true,
    disclaimer: 'Informativa',
    contractYears: 3,
    usableSqm: 65,
    bandMinSqm: 50,
    bandMaxSqm: 74,
    indicative: false,
    warnings: [],
    sourceUrl: 'https://example.org/accordo.pdf',
    lastVerifiedAt: '2026-09-23T00:00:00Z',
    subFascia3QualifyingTypeDElements: 'D1,D2,D4,D6,D7,D9',
    ...overrides,
  };
}

function setField(id: string, value: string) {
  fireEvent.change(document.getElementById(id)!, { target: { value } });
}

/** Property, concordato 3+2 from 1/9/2026 to 31/8/2029, valid parties. */
function fillConcordatoLease(monthlyRent: string) {
  fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });
  fireEvent.change(screen.getByLabelText(i18n.t('leases.form.contractTypeLabel')), { target: { value: 'Concordato' } });
  setField('startDate', '2026-09-01');
  setField('endDate', '2029-08-31');
  setField('monthlyRent', monthlyRent);
  for (const [prefix, cf] of [['landlord', 'RSSMRA80A01H501U'], ['tenant', 'VRDLGU85B02F205X']] as const) {
    setField(`${prefix}.firstName`, 'Nome');
    setField(`${prefix}.lastName`, 'Cognome');
    setField(`${prefix}.fiscalCode`, cf);
    setField(`${prefix}.citizenship`, 'IT');
    setField(`${prefix}.contactEmail`, `${prefix}@example.com`);
  }
}

type PropertiesQuery = ReturnType<typeof useProperties>;

function mockProperties(result: Partial<PropertiesQuery>) {
  vi.mocked(useProperties).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
    ...result,
  } as unknown as PropertiesQuery);
}

function forbidden(): AxiosError {
  const error = new AxiosError('Request failed with status code 403');
  error.response = {
    status: 403,
    data: { status: 403, code: 'forbidden', title: 'Forbidden' },
    statusText: 'Forbidden',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

function renderForm(onSubmit = vi.fn(), defaultPropertyId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <LeaseCreateForm onSubmit={onSubmit} defaultPropertyId={defaultPropertyId} />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockProperties({ data: PROPERTIES });
  vi.mocked(propertiesApi.getDocuments).mockResolvedValue([
    { id: 'doc-1', fileName: 'ape.pdf', fileType: 'pdf', documentType: 'Ape', uploadedAt: '', downloadUrl: '' },
  ]);
});

describe('LeaseCreateForm canone concordato', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
    vi.mocked(canoneConcordatoApi.getEligibility).mockReset();
  });

  it('shows the calculator when the concordato contract type is selected with a property', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), {
      target: { value: 'prop-1' },
    });
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.contractTypeLabel')), {
      target: { value: 'Concordato' },
    });

    expect(await screen.findByText(i18n.t('leases.canoneConcordato.title'))).toBeInTheDocument();
    expect(screen.getByTestId('lease-term-rule')).toHaveTextContent(i18n.t('leases.form.termRule.Concordato'));
    // No year count on the client: the API derives the term from the dates (A7-12).
    expect(screen.queryByLabelText(/Durata \(anni\)/)).not.toBeInTheDocument();
  });

  it('LeaseCreateForm_ConcordatoRangeFromApi_SendsDatesThenSubmitsCharacteristicsWithoutYears', async () => {
    vi.mocked(canoneConcordatoApi.getEligibility).mockResolvedValue(apiRange());
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    fillConcordatoLease('400');

    fireEvent.click(await screen.findByRole('button', { name: i18n.t('leases.canoneConcordato.calculate') }));

    expect(await screen.findByTestId('concordato-range')).toBeInTheDocument();
    expect(canoneConcordatoApi.getEligibility).toHaveBeenCalledWith(
      'prop-1',
      expect.objectContaining({ sqm: 65, typeACount: 2, typeBCount: 3, startDate: '2026-09-01', endDate: '2029-08-31' }),
    );
    expect(vi.mocked(canoneConcordatoApi.getEligibility).mock.calls[0][1]).not.toHaveProperty('years');
    expect(screen.getByTestId('lease-concordato-range-hint')).toHaveTextContent('108.34');
    expect(screen.getByTestId('lease-concordato-range-hint')).toHaveTextContent('460.41');
    expect(screen.queryByTestId('concordato-indicative')).not.toBeInTheDocument();

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const dto = onSubmit.mock.calls[0][0];
    expect(dto).toMatchObject({
      propertyId: 'prop-1',
      contractType: 'Concordato',
      taxRegime: 'CedolareSecca',
      startDate: '2026-09-01',
      endDate: '2029-08-31',
      monthlyRent: 400,
      canoneConcordato: expect.objectContaining({ sqm: 65, typeAElementCount: 2, typeBElementCount: 3 }),
    });
    expect(dto).not.toHaveProperty('fiscalRegime');
    expect(dto.canoneConcordato).not.toHaveProperty('contractYears');
  });

  it('LeaseCreateForm_IndicativeRangeAndRentOutside_WarnsAndStillSubmits', async () => {
    // A7-23: with Partial agreement data the range is a guide; the lease is not blocked.
    vi.mocked(canoneConcordatoApi.getEligibility).mockResolvedValue(
      apiRange({ dataCompleteness: 'Partial', indicative: true, warnings: ['partial_data'] }),
    );
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    fillConcordatoLease('900');

    fireEvent.click(await screen.findByRole('button', { name: i18n.t('leases.canoneConcordato.calculate') }));

    expect(await screen.findByTestId('concordato-indicative')).toHaveTextContent(
      i18n.t('leases.canoneConcordato.indicativeTitle'),
    );
    expect(screen.getByTestId('lease-concordato-out-of-range')).toHaveTextContent(
      i18n.t('leases.form.concordatoRentOutsideIndicativeRange'),
    );

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ contractType: 'Concordato', monthlyRent: 900 });
  });

  it('LeaseCreateForm_VerifiedRangeAndRentOutside_BlocksSubmit', async () => {
    vi.mocked(canoneConcordatoApi.getEligibility).mockResolvedValue(apiRange());
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    fillConcordatoLease('900');

    fireEvent.click(await screen.findByRole('button', { name: i18n.t('leases.canoneConcordato.calculate') }));
    await screen.findByTestId('concordato-range');
    fireEvent.submit(container.querySelector('form')!);

    // The hint under the rent and the alert of the refused submit.
    await waitFor(() =>
      expect(screen.getAllByText(i18n.t('leases.form.concordatoRentOutOfRange'))).toHaveLength(2),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('LeaseCreateForm_DatesChangedAfterCalculation_DiscardsTheRange', async () => {
    // A7-12: a range computed for other dates (or other inputs) is never kept.
    vi.mocked(canoneConcordatoApi.getEligibility).mockResolvedValue(apiRange());
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    fillConcordatoLease('400');
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('leases.canoneConcordato.calculate') }));
    await screen.findByTestId('concordato-range');

    setField('endDate', '2030-08-31');

    await waitFor(() => expect(screen.queryByTestId('concordato-range')).not.toBeInTheDocument());
    expect(screen.queryByTestId('lease-concordato-range-hint')).not.toBeInTheDocument();
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText(i18n.t('leases.form.concordatoRangeRequired'))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('LeaseCreateForm_RangeUnavailable_ShowsTheTranslatedReason', async () => {
    vi.mocked(canoneConcordatoApi.getEligibility).mockResolvedValue(
      apiRange({
        available: false,
        reason: 'zona o foglio catastale obbligatorio',
        reasonCode: 'zone_required',
        canoneMinAnnuo: null,
        canoneMaxAnnuo: null,
        canoneMinMensile: null,
        canoneMaxMensile: null,
      }),
    );
    renderForm();
    fillConcordatoLease('400');

    fireEvent.click(await screen.findByRole('button', { name: i18n.t('leases.canoneConcordato.calculate') }));

    expect(await screen.findByTestId('concordato-unavailable')).toHaveTextContent(
      i18n.t('leases.canoneConcordato.reason.zone_required'),
    );
  });

  it('LeaseCreateForm_LiberoWithDeposit_SendsTypeRegimeAndDeposit', async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    fillConcordatoLease('900');
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.contractTypeLabel')), { target: { value: 'Libero' } });
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.taxRegimeLabel')), { target: { value: 'Ordinario' } });
    setField('endDate', '2030-08-31');
    setField('securityDeposit', '2700');
    // The APE check of the property must have answered before the form can be sent.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: i18n.t('leases.form.createDraft') })).toBeEnabled(),
    );

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const dto = onSubmit.mock.calls[0][0];
    expect(dto).toMatchObject({ contractType: 'Libero', taxRegime: 'Ordinario', securityDeposit: 2700 });
    expect(dto).not.toHaveProperty('canoneConcordato');
    expect(canoneConcordatoApi.getEligibility).not.toHaveBeenCalled();
  });
});

describe('LeaseCreateForm validation messages (A7-25)', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
  });

  it('LeaseCreateForm_EmptyFiscalCode_ShowsTranslatedMessageNotI18nKey', async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);

    fireEvent.submit(container.querySelector('form')!);

    const key = 'leases.validation.fiscalCode.minLength';
    await waitFor(() => {
      expect(screen.getAllByText(i18n.t(key)).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(key)).not.toBeInTheDocument();
    expect(screen.queryByText(/^leases\.validation\./)).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('LeaseCreateForm properties of a long-term landlord (A7-06)', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
  });

  it('LeaseCreateForm_NoProperties_ShowsCreatePropertyLinkAndBlocksSubmit', () => {
    mockProperties({ data: [] });

    renderForm();

    expect(screen.getByTestId('lease-no-properties')).toHaveTextContent(i18n.t('leases.form.noProperties'));
    const link = screen.getByRole('link', { name: i18n.t('leases.form.createProperty') });
    expect(link).toHaveAttribute('href', '/app/long-rent/properties/new');
    expect(screen.getByRole('button', { name: i18n.t('leases.form.createDraft') })).toBeDisabled();
  });

  it('LeaseCreateForm_PropertiesForbidden_ShowsExplicitErrorInsteadOfEmptySelect', () => {
    const error = forbidden();
    mockProperties({ isError: true, error });

    renderForm();

    const alert = screen.getByTestId('lease-properties-error');
    expect(alert).toHaveTextContent(getProblemMessage(error, i18n.t)!);
    expect(alert).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    // No property picker at all: an empty drop-down would read as "you have no properties".
    expect(screen.queryByRole('combobox', { name: i18n.t('leases.form.propertyLabel') })).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('leases.form.selectProperty'))).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-no-properties')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('leases.form.createDraft') })).toBeDisabled();
  });

  it('LeaseCreateForm_PropertiesForbidden_RetryRefetches', () => {
    const refetch = vi.fn();
    mockProperties({ isError: true, error: forbidden(), refetch });

    renderForm();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.form.retry') }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('LeaseCreateForm_DocumentsForbidden_ShowsErrorAndBlocksSubmit', async () => {
    vi.mocked(propertiesApi.getDocuments).mockRejectedValue(forbidden());

    renderForm();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), {
      target: { value: 'prop-1' },
    });

    expect(await screen.findByTestId('lease-documents-error')).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    expect(screen.getByRole('button', { name: i18n.t('leases.form.createDraft') })).toBeDisabled();
  });

  it('LeaseCreateForm_PropertyWithoutApe_LinksToThePropertyPageToUploadIt', async () => {
    vi.mocked(propertiesApi.getDocuments).mockResolvedValue([
      { id: 'doc-2', fileName: 'planimetria.pdf', fileType: 'pdf', documentType: 'FloorPlan', uploadedAt: '', downloadUrl: '' },
    ]);

    renderForm();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), {
      target: { value: 'prop-1' },
    });

    expect(await screen.findByText(i18n.t('leases.form.apeMissingError'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('leases.form.uploadApe') })).toHaveAttribute(
      'href',
      '/app/long-rent/properties/prop-1',
    );
  });

  it('LeaseCreateForm_DefaultPropertyId_PreselectsTheProperty', async () => {
    renderForm(vi.fn(), 'prop-1');

    await waitFor(() => {
      expect(screen.getByLabelText(i18n.t('leases.form.propertyLabel'))).toHaveValue('prop-1');
    });
    await waitFor(() => expect(propertiesApi.getDocuments).toHaveBeenCalledWith('prop-1'));
  });
});
