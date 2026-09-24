import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import * as propertyQueries from '@/queries/use-properties';
import type { Property, PropertyDocumentDto } from '@/types';
import { LongRentPropertiesPage } from '../long-rent-properties-page';
import { LongRentPropertyDetailPage } from '../long-rent-property-detail-page';

vi.mock('@/queries/use-properties');

const PROPERTY = {
  id: 'prop-1',
  name: 'Bilocale Monza',
  address: 'Via Italia 1',
  postalCode: '20900',
  city: 'Monza',
  bedrooms: 2,
  bathrooms: 1,
  description: '',
} as unknown as Property;

function query<T>(result: Partial<{ data: T; isLoading: boolean; isError: boolean; error: unknown }>) {
  return { data: undefined, isLoading: false, isError: false, error: null, isFetching: false, refetch: vi.fn(), ...result };
}

function forbidden(): AxiosError {
  const error = new AxiosError('Request failed with status code 403');
  error.response = {
    status: 403,
    data: { status: 403, code: 'forbidden' },
    statusText: 'Forbidden',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/long-rent/properties" element={<LongRentPropertiesPage />} />
          <Route path="/app/long-rent/properties/:id" element={<LongRentPropertyDetailPage />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  void i18n.changeLanguage('it');
  vi.mocked(propertyQueries.useUploadPropertyDocument).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof propertyQueries.useUploadPropertyDocument>);
  vi.mocked(propertyQueries.useDeletePropertyDocument).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof propertyQueries.useDeletePropertyDocument>);
  vi.mocked(propertyQueries.useDownloadPropertyDocument).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof propertyQueries.useDownloadPropertyDocument>);
});

describe('LongRentPropertiesPage (A7-06)', () => {
  it('LongRentPropertiesPage_Forbidden_ShowsTheErrorNotAnEmptyList', () => {
    vi.mocked(propertyQueries.useProperties).mockReturnValue(
      query({ isError: true, error: forbidden() }) as unknown as ReturnType<typeof propertyQueries.useProperties>,
    );

    renderAt('/app/long-rent/properties');

    expect(screen.getByTestId('long-rent-properties-load-error')).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    expect(screen.queryByText(i18n.t('longRentProperties.list.emptyTitle'))).not.toBeInTheDocument();
  });

  it('LongRentPropertiesPage_NoProperties_OffersToAddOne', () => {
    vi.mocked(propertyQueries.useProperties).mockReturnValue(
      query({ data: [] }) as unknown as ReturnType<typeof propertyQueries.useProperties>,
    );

    renderAt('/app/long-rent/properties');

    expect(screen.getByText(i18n.t('longRentProperties.list.emptyTitle'))).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: i18n.t('longRentProperties.list.add') }).length).toBeGreaterThan(0);
  });

  it('LongRentPropertiesPage_WithProperties_LinksToTheLongRentDetail', () => {
    vi.mocked(propertyQueries.useProperties).mockReturnValue(
      query({ data: [PROPERTY] }) as unknown as ReturnType<typeof propertyQueries.useProperties>,
    );

    renderAt('/app/long-rent/properties');

    expect(screen.getByText('Bilocale Monza')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('longRentProperties.list.open') })).toHaveAttribute(
      'href',
      '/app/long-rent/properties/prop-1',
    );
  });
});

describe('LongRentPropertyDetailPage (A7-06)', () => {
  function mockDetail(documents: ReturnType<typeof query<PropertyDocumentDto[]>>) {
    vi.mocked(propertyQueries.useProperty).mockReturnValue(
      query({ data: PROPERTY }) as unknown as ReturnType<typeof propertyQueries.useProperty>,
    );
    vi.mocked(propertyQueries.usePropertyDocuments).mockReturnValue(
      documents as unknown as ReturnType<typeof propertyQueries.usePropertyDocuments>,
    );
  }

  it('LongRentPropertyDetailPage_WithoutApe_SaysItIsNeededAndOffersTheUpload', () => {
    mockDetail(query<PropertyDocumentDto[]>({ data: [] }));

    renderAt('/app/long-rent/properties/prop-1');

    expect(screen.getByTestId('long-rent-ape-status')).toHaveTextContent(i18n.t('longRentProperties.detail.apeMissing'));
    expect(screen.getByRole('button', { name: i18n.t('shared.documentUpload.uploadDocument') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('longRentProperties.detail.newLease') })).toHaveAttribute(
      'href',
      '/app/long-rent/leases/new?propertyId=prop-1',
    );
  });

  it('LongRentPropertyDetailPage_WithApe_ListsItWithItsType', () => {
    mockDetail(
      query<PropertyDocumentDto[]>({
        data: [
          {
            id: 'doc-1',
            fileName: 'ape-2026.pdf',
            fileType: 'pdf',
            documentType: 'Ape',
            uploadedAt: '2026-09-01T10:00:00Z',
            downloadUrl: '/api/properties/prop-1/documents/doc-1/download',
          },
        ],
      }),
    );

    renderAt('/app/long-rent/properties/prop-1');

    expect(screen.getByTestId('long-rent-ape-status')).toHaveTextContent(i18n.t('longRentProperties.detail.apePresent'));
    expect(screen.getByText('ape-2026.pdf')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^${i18n.t('shared.documentUpload.types.ape')} · PDF`))).toBeInTheDocument();
  });

  it('LongRentPropertyDetailPage_DocumentsForbidden_ShowsTheError', () => {
    mockDetail(query<PropertyDocumentDto[]>({ isError: true, error: forbidden() }));

    renderAt('/app/long-rent/properties/prop-1');

    expect(screen.getByTestId('long-rent-documents-load-error')).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    expect(screen.queryByTestId('long-rent-ape-status')).not.toBeInTheDocument();
  });
});
