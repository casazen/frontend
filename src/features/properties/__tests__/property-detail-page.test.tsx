import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PropertyDetailPage } from '../property-detail-page';
import * as propertyQueries from '@/queries/use-properties';
import type { PropertyDetailDto } from '@/types';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';

vi.mock('@/queries/use-properties');
vi.mock('@/queries/use-cin', () => ({
  useUpdatePropertyCin: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'app-shell' }, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
}));
vi.mock('../components/ical-settings', () => ({
  IcalSettings: () => createElement('div', { 'data-testid': 'ical-settings' }),
}));
vi.mock('@/components/shared/loading-screen', () => ({
  LoadingScreen: ({ message }: { message: string }) =>
    createElement('div', { 'data-testid': 'loading' }, message),
}));

const PROPERTY_ID = 'prop-test-detail';

const mockDetail: PropertyDetailDto = {
  id: PROPERTY_ID,
  ownerId: 'auth0|owner',
  name: 'Test Villa',
  description: 'A nice place',
  address: 'Via Roma 1',
  city: 'Roma',
  postalCode: '00100',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 100,
  cleaningFee: 30,
  damageDeposit: 150,
  cinCode: 'IT058091C27G5FFZDZ',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
  amenities: ['WiFi'],
  photoUrls: ['https://ref.supabase.co/storage/v1/object/public/casazen-test-public/properties/p/photos/a.jpg'],
  houseRules: '',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  documents: [],
  otaIntegrations: [
    {
      id: 'ota-1',
      platform: 'Booking.com',
      syncStatus: 'Success',
      lastSyncAt: '2026-06-01T00:00:00Z',
      isActive: true,
      syncEnabled: true,
    },
  ],
  bookingsSummary: {
    totalBookings: 5,
    upcomingBookings: 2,
    activeBookings: 1,
    nextCheckIn: '2026-06-10T00:00:00Z',
    nextCheckOut: null,
  },
  pricingAdapterSummary: {
    isEnabled: false,
    lastAdaptedAt: null,
    nextScheduledRunAt: null,
  },
};

function renderPage(otaPartnerApi = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        FeatureFlagsContext.Provider,
        { value: { flags: { ...DEFAULT_FEATURE_FLAGS, otaPartnerApi }, isLoading: false } },
        createElement(
          MemoryRouter,
          { initialEntries: [`/properties/${PROPERTY_ID}`] },
          createElement(PropertyDetailPage)
        )
      )
    )
  );
}

describe('PropertyDetailPage', () => {
  beforeEach(() => {
    vi.mocked(propertyQueries.usePropertyDetail).mockReturnValue({
      data: mockDetail,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof propertyQueries.usePropertyDetail>);
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

  it('AC8: renders property name and section headings', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Test Villa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Dettagli proprietà/i })).toBeInTheDocument();
    expect(screen.getByText(/Attiva/i)).toBeInTheDocument();
  });

  it('AC9: CIN badge opens edit dialog on click', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Stato CIN: CIN valido/i }));
    expect(screen.getByRole('dialog', { name: 'Codice CIN' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Codice CIN' })).toHaveValue('IT058091C27G5FFZDZ');
  });

  it('AC12: does not render apiKey in OTA section', () => {
    renderPage(true);
    fireEvent.click(screen.getByRole('button', { name: 'Canali OTA' }));
    expect(screen.getByText('Integrazioni OTA')).toBeInTheDocument();
    expect(screen.queryByText(/apikey/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/apisecret/i)).not.toBeInTheDocument();
  });

  // FD-20 / D10: with the OTA partner API off the tab keeps only the iCal calendars.
  it('shows only the iCal calendars, without the OTA card, when the otaPartnerApi flag is off', () => {
    renderPage(false);
    expect(screen.queryByRole('button', { name: 'Canali OTA' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Calendari iCal' }));

    expect(screen.getByTestId('ical-settings')).toBeInTheDocument();
    expect(screen.queryByText('Integrazioni OTA')).not.toBeInTheDocument();
    expect(screen.queryByText('Booking.com')).not.toBeInTheDocument();
  });
});
