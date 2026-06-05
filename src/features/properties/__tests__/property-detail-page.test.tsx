import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PropertyDetailPage } from '../property-detail-page';
import * as propertyQueries from '@/queries/use-properties';
import type { PropertyDetailDto } from '@/types';

vi.mock('@/queries/use-properties');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'app-shell' }, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
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
  cinCode: 'IT-12345-0123456789',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
  amenities: ['WiFi'],
  photoUrls: ['/photo.jpg'],
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        MemoryRouter,
        { initialEntries: [`/properties/${PROPERTY_ID}`] },
        createElement(PropertyDetailPage)
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
  });

  it('AC8: renders property name and section headings', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Test Villa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dettagli proprietà' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Integrazioni OTA' })).toBeInTheDocument();
    expect(screen.getByText('Booking.com')).toBeInTheDocument();
  });

  it('AC9: CIN badge shows tooltip on click', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Stato CIN: CIN valido/i }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('D.L. 145/2023');
  });

  it('AC12: does not render apiKey in OTA section', () => {
    renderPage();
    expect(screen.queryByText(/apikey/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/apisecret/i)).not.toBeInTheDocument();
  });
});
