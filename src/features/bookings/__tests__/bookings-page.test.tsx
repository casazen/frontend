import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { propertiesApi } from '@/api/properties.api';
import { alloggiatiApi } from '@/api/alloggiati.api';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { Booking, Property } from '@/types';
import { BookingsPage } from '../bookings-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getAll: vi.fn(), getApprovalRequests: vi.fn(), checkIn: vi.fn() },
}));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getStatus: vi.fn() } }));
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [url] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/bookings', element: createElement(BookingsPage) }),
            createElement(Route, {
              path: '/app/short-rent/bookings/:id',
              element: createElement('div', { 'data-testid': 'booking-detail-stub' }),
            }),
          )))),
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

  it('BookingsPage_StayInProgressNotCheckedIn_RegistersTheArrivalFromTheRow', async () => {
    // CO-08: "Registra arrivo" from the list, only for a confirmed stay whose check-in day has come.
    const today = todayInRome();
    const inProgress = {
      ...booking('bk-arrival', 'Mario', 'Manual'),
      checkInDate: `${today}T00:00:00Z`,
      checkOutDate: `${addDays(today, 2)}T00:00:00Z`,
    };
    vi.mocked(bookingsApi.getAll).mockResolvedValue([inProgress, booking('bk-future', 'Giulia', 'Direct')]);
    vi.mocked(alloggiatiApi.getStatus).mockResolvedValue({ dataComplete: true } as Awaited<ReturnType<typeof alloggiatiApi.getStatus>>);
    vi.mocked(bookingsApi.checkIn).mockResolvedValue({ ...inProgress, status: 'CheckedIn', guestDataComplete: true });

    renderPage();

    await screen.findByText('Giulia Rossi', undefined, WAIT);
    const buttons = screen.getAllByTestId('booking-row-register-arrival');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    const dialog = await screen.findByRole('dialog');
    // The row click (open the detail) is not triggered by the action.
    expect(screen.queryByTestId('booking-detail-stub')).not.toBeInTheDocument();
    expect(await within(dialog).findByTestId('guest-data-complete', undefined, WAIT)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByTestId('register-arrival-submit'));

    await waitFor(() => expect(bookingsApi.checkIn).toHaveBeenCalledWith('bk-arrival'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WAIT);
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
