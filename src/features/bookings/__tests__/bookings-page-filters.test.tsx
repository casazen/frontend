import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { recallList } from '@/lib/list-return';
import type { Booking } from '@/types';
import { BookingsPage } from '../bookings-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getAll: vi.fn(), getApprovalRequests: vi.fn(), checkIn: vi.fn() },
}));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getStatus: vi.fn() } }));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getById: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), action),
}));

const LIST = '/app/short-rent/bookings';
const WAIT = { timeout: 5000 };

const booking = (id: string, firstName: string, status: Booking['status'], propertyId = 'property-1'): Booking => ({
  id,
  propertyId,
  userId: 'auth0|host',
  checkInDate: '2027-10-01T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 450,
  currency: 'EUR',
  status,
  guest: { firstName, lastName: 'Rossi', email: `${id}@example.com`, phone: '', country: 'IT' },
  source: 'Manual',
  createdAt: '2026-09-24T08:00:00Z',
  updatedAt: '2026-09-24T08:00:00Z',
});

/** Where the router is, and how it got there (`REPLACE` for a change of filter, `PUSH` for a page opened). */
function Where() {
  const { pathname, search } = useLocation();
  const type = useNavigationType();
  return createElement('p', { 'data-testid': 'where', 'data-type': type }, `${pathname}${search}`);
}

function renderPage(url = LIST) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [url] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: LIST, element: createElement(BookingsPage) }),
            createElement(Route, { path: `${LIST}/:id`, element: createElement('div', { 'data-testid': 'booking-detail-stub' }) }),
          ),
          createElement(Where),
        ),
      ),
    ),
  );
}

const where = () => screen.getByTestId('where').textContent;
const howItGotThere = () => screen.getByTestId('where').getAttribute('data-type');
const guests = () => screen.queryAllByText(/Rossi$/).map((cell) => cell.textContent);

describe('BookingsPage filters in the address (UI-05)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    await i18n.changeLanguage('it');
    vi.mocked(bookingsApi.getApprovalRequests).mockResolvedValue([]);
    vi.mocked(bookingsApi.getAll).mockResolvedValue([
      booking('bk-1', 'Mario', 'Confirmed'),
      booking('bk-2', 'Giulia', 'Pending'),
      booking('bk-3', 'Luca', 'Cancelled'),
    ]);
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('BookingsPage_StatusTab_GoesIntoTheAddressAndFiltersTheList', async () => {
    renderPage();
    await screen.findByText('Mario Rossi', undefined, WAIT);
    expect(guests()).toEqual(['Mario Rossi', 'Giulia Rossi', 'Luca Rossi']);

    fireEvent.click(screen.getByRole('button', { name: 'Confermata' }));

    expect(where()).toBe(`${LIST}?status=Confirmed`);
    expect(guests()).toEqual(['Mario Rossi']);
  });

  it('BookingsPage_AllTab_TakesTheStatusOutOfTheAddress', async () => {
    renderPage(`${LIST}?status=Pending`);
    await screen.findByText('Giulia Rossi', undefined, WAIT);
    expect(guests()).toEqual(['Giulia Rossi']);

    fireEvent.click(screen.getByRole('button', { name: 'Tutte' }));

    expect(where()).toBe(LIST);
    expect(guests()).toEqual(['Mario Rossi', 'Giulia Rossi', 'Luca Rossi']);
  });

  it('BookingsPage_AddressWithFilters_OpensTheListAsItWasLeft', async () => {
    renderPage(`${LIST}?status=Pending&q=giul`);

    await screen.findByText('Giulia Rossi', undefined, WAIT);

    expect(guests()).toEqual(['Giulia Rossi']);
    expect(screen.getByRole('textbox')).toHaveValue('giul');
  });

  it('BookingsPage_Search_GoesIntoTheAddressWithoutLosingTheOtherFilters', async () => {
    renderPage(`${LIST}?status=Confirmed&propertyId=property-1`);
    await screen.findByText('Mario Rossi', undefined, WAIT);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mar' } });

    expect(where()).toBe(`${LIST}?status=Confirmed&propertyId=property-1&q=mar`);
    expect(guests()).toEqual(['Mario Rossi']);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(where()).toBe(`${LIST}?status=Confirmed&propertyId=property-1`);
  });

  it('BookingsPage_UnknownStatusInTheAddress_ShowsAllTheBookings', async () => {
    renderPage(`${LIST}?status=Nonsense`);

    await screen.findByText('Mario Rossi', undefined, WAIT);

    expect(guests()).toEqual(['Mario Rossi', 'Giulia Rossi', 'Luca Rossi']);
  });

  it('BookingsPage_FilterChanged_ReplacesTheEntryOfTheHistoryInsteadOfAddingOne', async () => {
    renderPage();
    await screen.findByText('Mario Rossi', undefined, WAIT);

    fireEvent.click(screen.getByRole('button', { name: 'Confermata' }));
    expect(howItGotThere()).toBe('REPLACE');

    // Back leaves the list instead of undoing every keystroke of the search.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mar' } });
    expect(howItGotThere()).toBe('REPLACE');
  });

  it('BookingsPage_FiltersChange_AreRememberedForTheWayBackFromABooking', async () => {
    renderPage();
    await screen.findByText('Mario Rossi', undefined, WAIT);
    expect(recallList(LIST)).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Confermata' }));
    expect(recallList(LIST)).toBe('?status=Confirmed');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mar' } });
    expect(recallList(LIST)).toBe('?status=Confirmed&q=mar');

    // Back to "Tutte" and no search: the list is the plain one again, and that is what the way back leads to.
    fireEvent.click(screen.getByRole('button', { name: 'Tutte' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(recallList(LIST)).toBe('');
  });

  it('BookingsPage_RowOpened_LeavesTheListStateForTheWayBack', async () => {
    renderPage(`${LIST}?status=Confirmed`);
    fireEvent.click(await screen.findByText('Mario Rossi', undefined, WAIT));

    expect(await screen.findByTestId('booking-detail-stub')).toBeInTheDocument();
    expect(where()).toBe(`${LIST}/bk-1`);
    expect(recallList(LIST)).toBe('?status=Confirmed');
  });
});
