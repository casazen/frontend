import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { propertiesApi } from '@/api/properties.api';
import type { Booking, Property } from '@/types';
import { BookingsPage } from '../bookings-page';

vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getAll: vi.fn(), getApprovalRequests: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({
  propertiesApi: { getById: vi.fn() },
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: () => true }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
}));

const WAIT = { timeout: 5000 };

const booking = (id: string, firstName: string, source: string, propertyId = 'property-1'): Booking => ({
  id,
  propertyId,
  userId: 'auth0|host',
  checkInDate: '2027-10-01T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 450,
  currency: 'EUR',
  status: 'Confirmed',
  guest: { firstName, lastName: 'Rossi', email: `${id}@example.com`, phone: '', country: 'IT' },
  source,
  createdAt: '2026-09-24T08:00:00Z',
  updatedAt: '2026-09-24T08:00:00Z',
});

function renderPage(url = '/app/short-rent/bookings') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [url] }, createElement(BookingsPage)))),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue([]);
});

describe('BookingsPage', () => {
  it.each(['it', 'en'])('labels the host bookings as manual and the booking site ones as direct (%s)', async (lng) => {
    await i18n.changeLanguage(lng);
    vi.mocked(bookingsApi.getAll).mockResolvedValue([
      booking('bk-manual', 'Mario', 'Manual'),
      booking('bk-direct', 'Giulia', 'Direct'),
    ]);

    renderPage();

    await screen.findByText('Mario Rossi', undefined, WAIT);
    const sources = screen.getAllByTestId('booking-source').map((cell) => cell.textContent);
    expect(sources).toEqual([i18n.t('booking.source.Manual'), i18n.t('booking.source.Direct')]);
    expect(screen.getByText(i18n.t('booking.list.columns.source'))).toBeInTheDocument();
  });

  it('BookingsPage_OnSiteRequests_ShowTheApprovalBadgeAndThePanel', async () => {
    // BK-06: a "pay at the property" request is Pending until the host answers; the list says what it waits for.
    await i18n.changeLanguage('it');
    vi.mocked(bookingsApi.getAll).mockResolvedValue([
      { ...booking('bk-request', 'Giulia', 'Direct'), status: 'Pending', paymentOption: 'OnSite', onSiteRequestState: 'AwaitingHostApproval' },
      { ...booking('bk-unconfirmed', 'Luca', 'Direct'), status: 'Pending', paymentOption: 'OnSite', onSiteRequestState: 'AwaitingGuestEmail' },
      booking('bk-confirmed', 'Mario', 'Manual'),
    ]);

    renderPage();

    await screen.findByText('Giulia Rossi', undefined, { timeout: 5000 });
    const badges = screen.getAllByTestId('booking-request-badge').map((badge) => badge.textContent);
    expect(badges).toEqual(['Da approvare', 'Attesa conferma email ospite']);
    expect(await screen.findByTestId('booking-requests-panel')).toHaveTextContent('Richieste da approvare');
  });

  it('shows the error state, not an empty list, when the API fails', async () => {
    vi.mocked(bookingsApi.getAll).mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByText(i18n.t('booking.list.loadError'), undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('booking.list.noResults'))).not.toBeInTheDocument();
  });

  it('BookingsPage_PropertyIdInTheUrl_AsksTheBackendForThatPropertyAndOffersANewBookingForIt', async () => {
    vi.mocked(bookingsApi.getAll).mockResolvedValue([booking('bk-1', 'Mario', 'Manual')]);
    vi.mocked(propertiesApi.getById).mockResolvedValue({ id: 'property-1', name: 'Casa Mare' } as Property);

    renderPage('/app/short-rent/bookings?propertyId=property-1');

    await screen.findByText('Mario Rossi', undefined, WAIT);
    expect(bookingsApi.getAll).toHaveBeenCalledWith({ propertyId: 'property-1' });
    expect(await screen.findByText(i18n.t('booking.list.filteredByProperty', { name: 'Casa Mare' }), undefined, WAIT))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('booking.list.showAll') })).toHaveAttribute('href', '/app/short-rent/bookings');
    expect(screen.getByRole('link', { name: i18n.t('booking.list.newBooking') })).toHaveAttribute(
      'href',
      '/app/short-rent/bookings/create?propertyId=property-1',
    );
  });

  it('BookingsPage_NoPropertyInTheUrl_ListsEveryBookingWithoutFilter', async () => {
    vi.mocked(bookingsApi.getAll).mockResolvedValue([booking('bk-1', 'Mario', 'Manual')]);

    renderPage();

    await screen.findByText('Mario Rossi', undefined, WAIT);
    expect(bookingsApi.getAll).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId('bookings-property-filter')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: i18n.t('booking.list.newBooking') })).toHaveAttribute(
      'href',
      '/app/short-rent/bookings/create',
    );
    expect(propertiesApi.getById).not.toHaveBeenCalled();
  });
});
