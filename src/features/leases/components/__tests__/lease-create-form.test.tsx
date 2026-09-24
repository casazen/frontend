import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { propertiesApi } from '@/api/properties.api';
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
  });

  it('shows the calculator when CanoneConcordato is selected with a property', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.propertyLabel')), {
      target: { value: 'prop-1' },
    });
    fireEvent.change(screen.getByLabelText(i18n.t('leases.form.fiscalRegimeLabel')), {
      target: { value: 'CanoneConcordato' },
    });

    expect(await screen.findByText(i18n.t('leases.canoneConcordato.title'))).toBeInTheDocument();
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
