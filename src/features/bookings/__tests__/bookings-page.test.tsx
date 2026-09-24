import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import type { Booking } from '@/types';
import { BookingsPage } from '../bookings-page';

vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getAll: vi.fn() },
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const booking = (id: string, firstName: string, source: string): Booking => ({
  id,
  propertyId: 'property-1',
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, null, createElement(BookingsPage)))),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
});

describe('BookingsPage', () => {
  it.each(['it', 'en'])('labels the host bookings as manual and the booking site ones as direct (%s)', async (lng) => {
    await i18n.changeLanguage(lng);
    vi.mocked(bookingsApi.getAll).mockResolvedValue([
      booking('bk-manual', 'Mario', 'Manual'),
      booking('bk-direct', 'Giulia', 'Direct'),
    ]);

    renderPage();

    await screen.findByText('Mario Rossi');
    const sources = screen.getAllByTestId('booking-source').map((cell) => cell.textContent);
    expect(sources).toEqual([i18n.t('booking.source.Manual'), i18n.t('booking.source.Direct')]);
    expect(screen.getByText(i18n.t('booking.list.columns.source'))).toBeInTheDocument();
  });

  it('shows the error state, not an empty list, when the API fails', async () => {
    await i18n.changeLanguage('it');
    vi.mocked(bookingsApi.getAll).mockRejectedValue(new Error('boom'));

    renderPage();

    expect(await screen.findByText(i18n.t('booking.list.loadError'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('booking.list.noResults'))).not.toBeInTheDocument();
  });
});
