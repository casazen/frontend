import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { propertiesApi } from '@/api/properties.api';
import { useProperties, useUpdateApeIdentification, useUploadPropertyDocument } from '@/queries/use-properties';
import type { PropertyDocumentDto } from '@/types';
import { LeaseCreateForm } from '../lease-create-form';

const PROPERTIES = [{ id: 'prop-1', name: 'Il Parco', city: 'Seveso' }];

vi.mock('@/queries/use-properties', async (importOriginal) => ({
  // The real reading of the APE (`useApeAutoRead`), on the mocked API below.
  ...(await importOriginal<typeof import('@/queries/use-properties')>()),
  useProperties: vi.fn(),
  // The APE is uploaded and identified from the form: the window and the two fields use these.
  useUploadPropertyDocument: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateApeIdentification: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useReadApeIdentification: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isSuccess: false })),
}));

vi.mock('@/api/properties.api', () => ({
  propertiesApi: {
    getDocuments: vi.fn(),
    // The form reads again an APE whose code and class are missing (OCR of the file and register of the region).
    readApeIdentification: vi.fn(),
  },
}));

/** The APE of the property, with the code and the class the contract states (LT-10). */
const APE: PropertyDocumentDto = {
  id: 'doc-1',
  fileName: 'ape.pdf',
  fileType: 'pdf',
  documentType: 'Ape',
  uploadedAt: '2026-10-01T10:00:00Z',
  downloadUrl: '',
  apeCode: '1610800012345/17',
  apeEnergyClass: 'F',
};

function setField(id: string, value: string) {
  fireEvent.change(document.getElementById(id)!, { target: { value } });
}

/** A party with a valid fiscal code (LT-14): `prefix` is `landlords.N` or `tenants.N`. */
function fillParty(prefix: string, fiscalCode: string) {
  setField(`${prefix}.firstName`, 'Nome');
  setField(`${prefix}.lastName`, 'Cognome');
  setField(`${prefix}.fiscalCode`, fiscalCode);
  setField(`${prefix}.citizenship`, 'IT');
  setField(`${prefix}.contactEmail`, `${prefix}@example.com`);
}

/** A complete Libero 4+4 lease with one landlord and one tenant, ready to submit once the APE check answered. */
async function fillLiberoLease() {
  fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });
  setField('startDate', '2026-09-01');
  setField('endDate', '2030-08-31');
  setField('monthlyRent', '900');
  fillParty('landlords.0', 'RSSMRA80A01H501U');
  fillParty('tenants.0', 'VRDLGU85B02F205C');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: i18n.t('leases.form.createDraft') })).toBeEnabled(),
  );
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

function renderForm(
  onSubmit = vi.fn(),
  defaultPropertyId?: string,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
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
  vi.mocked(propertiesApi.getDocuments).mockResolvedValue([APE]);
  // By default reading an APE again finds nothing more: the document comes back as it was. A new browser for every test.
  localStorage.clear();
  vi.mocked(propertiesApi.readApeIdentification).mockReset();
  vi.mocked(propertiesApi.readApeIdentification).mockResolvedValue({ ...APE, apeCode: null, apeEnergyClass: null, apeCheck: 'Incomplete' });
});

describe('LeaseCreateForm contract type and terms', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
  });

  it('LeaseCreateForm_ContractTypes_DoNotOfferTheConcordato', () => {
    // A canone concordato is chosen before this form and prepared with the partner (a draft with its leaseId).
    renderForm();

    const options = within(screen.getByLabelText(i18n.t('leases.form.contractTypeLabel'))).getAllByRole('option');
    expect(options.map((option) => (option as HTMLOptionElement).value)).toEqual(['Libero', 'Transitorio']);
  });

  it('LeaseCreateForm_LiberoWithDeposit_SendsTypeRegimeAndDeposit', async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    await fillLiberoLease();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.taxRegimeLabel')), { target: { value: 'Ordinario' } });
    setField('securityDeposit', '2700');

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const dto = onSubmit.mock.calls[0][0];
    expect(dto).toMatchObject({ contractType: 'Libero', taxRegime: 'Ordinario', securityDeposit: 2700 });
    expect(dto).not.toHaveProperty('canoneConcordato');
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

    const key = 'leases.validation.fiscalCode.required';
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

  it('LeaseCreateForm_PropertyWithoutApe_UploadsItHereWithoutLeavingTheForm', async () => {
    vi.mocked(propertiesApi.getDocuments).mockResolvedValue([
      { id: 'doc-2', fileName: 'planimetria.pdf', fileType: 'pdf', documentType: 'FloorPlan', uploadedAt: '', downloadUrl: '' },
    ]);

    renderForm();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), {
      target: { value: 'prop-1' },
    });
    setField('monthlyRent', '900');

    expect(await screen.findByText(i18n.t('leases.form.apeMissingError'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('leases.form.createDraft') })).toBeDisabled();
    // A button that opens the upload over the form, not a link to the property page (what was typed would be lost).
    expect(screen.queryByRole('link', { name: i18n.t('leases.form.uploadApe') })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.form.uploadApe') }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(i18n.t('shared.documentUpload.uploadApe'))).toBeInTheDocument();
    expect(within(dialog).getByTestId('document-drop-zone')).toBeInTheDocument();
    // Only the APE: no type of document to choose.
    expect(within(dialog).queryByLabelText(i18n.t('shared.documentUpload.documentType'))).not.toBeInTheDocument();
    // Still the same page under the window, with what was typed.
    expect(document.getElementById('monthlyRent')).toHaveValue(900);
  });

  it('LeaseCreateForm_ApeUploaded_TheWindowStaysOpenForItsCodeAndClass', async () => {
    // Once the APE is on file the "APE missing" box goes away: the window opened from it must not go with it.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const stored = { ...APE, apeCode: null, apeEnergyClass: null };
    vi.mocked(propertiesApi.getDocuments).mockResolvedValue([]);
    vi.mocked(useUploadPropertyDocument).mockReturnValue({
      mutateAsync: vi.fn(async () => {
        vi.mocked(propertiesApi.getDocuments).mockResolvedValue([stored]);
        await client.invalidateQueries({ queryKey: ['properties', 'prop-1', 'documents'] });
        return { ...stored, apeCheck: 'Incomplete', apeUnreadFields: ['data di scadenza valida'] };
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useUploadPropertyDocument>);

    renderForm(vi.fn(), undefined, client);
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });
    fireEvent.click(await screen.findByRole('button', { name: i18n.t('leases.form.uploadApe') }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(i18n.t('documentPages.select')), {
      target: { files: [new File(['%PDF-1.7'], 'APE.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('shared.documentUpload.upload') }));

    expect(await screen.findByTestId('ape-check-Incomplete')).toHaveTextContent('data di scadenza valida');
    await waitFor(() => expect(screen.queryByTestId('lease-ape-missing')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('LeaseCreateForm_ApeWithoutCodeAndClass_AsksForThemAndWaitsForThem', async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateApeIdentification).mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof useUpdateApeIdentification>);
    vi.mocked(propertiesApi.getDocuments).mockResolvedValue([{ ...APE, apeCode: null, apeEnergyClass: null }]);

    renderForm();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), {
      target: { value: 'prop-1' },
    });

    expect(await screen.findByTestId('lease-ape-identification')).toHaveTextContent(i18n.t('leases.form.apeIdentificationRequired'));
    // The fields come only after the server read the file again and found nothing more.
    expect(propertiesApi.readApeIdentification).toHaveBeenCalledWith('prop-1', 'doc-1');
    expect(screen.getByRole('button', { name: i18n.t('leases.form.createDraft') })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(i18n.t('property.documents.apeCode')), { target: { value: '1610800012345/17' } });
    fireEvent.change(screen.getByLabelText(i18n.t('property.documents.apeEnergyClass')), { target: { value: 'F' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('property.documents.apeIdentificationSave') }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ propertyId: 'prop-1', docId: 'doc-1', data: { code: '1610800012345/17', energyClass: 'F' } }),
    );
  });

  it('LeaseCreateForm_ApeWithoutCodeAndClass_ReadsThemFromTheDocumentWithNothingToType', async () => {
    // An APE uploaded before the automatic reading: the form has the server read it (the file, then the register of the region).
    let finishReading: (document: PropertyDocumentDto) => void = () => {};
    vi.mocked(propertiesApi.getDocuments).mockResolvedValue([{ ...APE, apeCode: null, apeEnergyClass: null }]);
    vi.mocked(propertiesApi.readApeIdentification).mockImplementation(
      () => new Promise<PropertyDocumentDto>((resolve) => { finishReading = resolve; }),
    );

    renderForm();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });

    expect(await screen.findByTestId('lease-ape-reading')).toHaveTextContent(i18n.t('leases.form.apeReadingFromDocument'));
    expect(screen.queryByLabelText(i18n.t('property.documents.apeCode'))).not.toBeInTheDocument();
    vi.mocked(propertiesApi.getDocuments).mockResolvedValue([APE]);
    finishReading({ ...APE, apeCheck: 'Verified', apeIdentificationSource: 'Registry' });

    expect(await screen.findByTestId('lease-ape-ready')).toHaveTextContent(
      i18n.t('leases.form.apeReady', { code: '1610800012345/17', energyClass: 'F' }),
    );
    expect(propertiesApi.readApeIdentification).toHaveBeenCalledTimes(1);
    expect(propertiesApi.readApeIdentification).toHaveBeenCalledWith('prop-1', 'doc-1');
    expect(screen.queryByTestId('lease-ape-identification')).not.toBeInTheDocument();
  });

  it('LeaseCreateForm_ApeReadingFoundNothing_OpenedAgainAsksAtOnceWithoutReadingTheFileAgain', async () => {
    // A minute of OCR on the server each time: a file whose reading found nothing is not read again by a page opened again.
    vi.mocked(propertiesApi.getDocuments).mockResolvedValue([{ ...APE, apeCode: null, apeEnergyClass: null }]);
    const first = renderForm();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });
    expect(await screen.findByTestId('lease-ape-identification')).toBeInTheDocument();
    first.unmount();

    renderForm();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), { target: { value: 'prop-1' } });

    expect(await screen.findByTestId('lease-ape-identification')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-ape-reading')).not.toBeInTheDocument();
    expect(propertiesApi.readApeIdentification).toHaveBeenCalledTimes(1);
  });

  it('LeaseCreateForm_ApeWithCodeAndClass_SaysItIsReady', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), {
      target: { value: 'prop-1' },
    });

    expect(await screen.findByTestId('lease-ape-ready')).toHaveTextContent(
      i18n.t('leases.form.apeReady', { code: '1610800012345/17', energyClass: 'F' }),
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

describe('LeaseCreateForm several landlords and tenants (LT-14, A7-28)', () => {
  beforeEach(() => {
    void i18n.changeLanguage('it');
  });

  it('LeaseCreateForm_TwoLandlordsAndTwoTenants_SendsEveryPartyInOrderWithNormalizedFiscalCodes', async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    await fillLiberoLease();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.form.addLandlord') }));
    fillParty('landlords.1', ' bncmra70c10f205h ');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.form.addTenant') }));
    fillParty('tenants.1', '00123456782');
    expect(screen.getByText(i18n.t('leases.form.landlordNumber', { n: 2 }))).toBeInTheDocument();

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const parties = onSubmit.mock.calls[0][0].parties as Array<{ role: string; fiscalCode: string }>;
    expect(parties.map((p) => [p.role, p.fiscalCode])).toEqual([
      ['Landlord', 'RSSMRA80A01H501U'],
      ['Landlord', 'BNCMRA70C10F205H'],
      ['Tenant', 'VRDLGU85B02F205C'],
      ['Tenant', '00123456782'],
    ]);
  });

  it('LeaseCreateForm_RemoveSecondLandlord_SendsOnlyTheFirst', async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    await fillLiberoLease();
    // A single party of a role cannot be removed.
    expect(
      screen.queryByRole('button', { name: i18n.t('leases.form.removeLandlord', { n: 1 }) }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.form.addLandlord') }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.form.removeLandlord', { n: 2 }) }));
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].parties.filter((p: { role: string }) => p.role === 'Landlord')).toHaveLength(1);
  });

  it('LeaseCreateForm_FiscalCodeWithWrongCheckCharacter_ShowsInvalidMessageAndBlocksSubmit', async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    await fillLiberoLease();
    setField('tenants.0.fiscalCode', 'VRDLGU85B02F205X');

    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText(i18n.t('leases.validation.fiscalCode.invalid'))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('LeaseCreateForm_SameFiscalCodeForTwoParties_ShowsDuplicateMessageAndBlocksSubmit', async () => {
    const onSubmit = vi.fn();
    const { container } = renderForm(onSubmit);
    await fillLiberoLease();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('leases.form.addTenant') }));
    fillParty('tenants.1', 'rssmra80a01h501u');

    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText(i18n.t('leases.validation.fiscalCode.duplicate'))).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('LeaseCreateForm_TenTenants_DisablesAddAndExplainsTheLimit', async () => {
    renderForm();
    const add = screen.getByRole('button', { name: i18n.t('leases.form.addTenant') });

    for (let i = 1; i < 10; i++) fireEvent.click(add);

    expect(await screen.findByTestId('lease-tenants-max')).toHaveTextContent(
      i18n.t('leases.form.partiesMax', { max: 10 }),
    );
    expect(add).toBeDisabled();
  });
});
