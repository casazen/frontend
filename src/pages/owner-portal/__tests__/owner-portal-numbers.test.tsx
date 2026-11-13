import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { OwnerPortalShell } from '@/features/owner-portal/owner-portal-shell';
import { OwnerDashboard } from '../OwnerDashboard';
import { OwnerProperties } from '../OwnerProperties';

vi.mock('@/api/ownerPortal.api', () => ({
  ownerPortalApi: {
    getProperties: vi.fn(),
    listContacts: vi.fn(),
    getOverview: vi.fn(),
    getTrend: vi.fn(),
  },
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import { ownerPortalApi } from '@/api/ownerPortal.api';

const api = vi.mocked(ownerPortalApi);

/**
 * What the properties of the owner say today: the sums are the whole price the guests paid for every booking that is not cancelled (not the share of the owner, not net of
 * the commission) and carry no currency, the occupancy is the placeholder 0 of a service that answers nothing under the request of an owner. Distinct figures, so that a
 * page that writes any of them is found out.
 */
const PROPERTY = {
  propertyId: 'p1',
  propertyName: 'Casa Mare',
  address: 'Via del Mare 1, Rimini',
  totalBookings: 7,
  totalRevenue: 123456.78,
  occupancyRate: 61.5,
  recentBookings: [
    { bookingId: 'b1', checkInDate: '2026-10-01T00:00:00Z', checkOutDate: '2026-10-05T00:00:00Z', channel: 'Direct', totalAmount: 987.65, status: 'Confirmed' },
    { bookingId: 'b2', checkInDate: '2026-11-10T00:00:00Z', checkOutDate: '2026-11-12T00:00:00Z', channel: 'Airbnb', totalAmount: 543.21, status: 'Pending' },
  ],
};

/** Any sign of a currency and any of the figures above. */
const FIGURES = /€|\$|£|\bEUR\b|\bCHF\b|123[.,]?456|987[.,]65|543[.,]21/;
/** The same, and the word that names an amount of money. */
const MONEY = new RegExp(`${FIGURES.source}|\\bricavi\\b|\\brevenue\\b`, 'i');

function renderPortal(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portale-proprietari" element={<OwnerPortalShell />}>
            <Route index element={<OwnerDashboard />} />
            <Route path="immobili/:propertyId" element={<OwnerProperties />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.getProperties.mockResolvedValue([PROPERTY]);
  api.listContacts.mockResolvedValue([]);
  api.getOverview.mockReturnValue(new Promise(() => {}));
  api.getTrend.mockReturnValue(new Promise(() => {}));
});

afterEach(() => {
  cleanup();
});

describe('the properties of the owner say no amount of money (the answer has no currency and no share of the owner)', () => {
  it('OwnerPortal_PropertyCards_ShowNoCurrencyAndNoAmount_OnlyCounts', async () => {
    renderPortal('/portale-proprietari');
    const list = await screen.findByTestId('owner-properties');

    // The card says how many bookings the property has, never how much they came to.
    expect(list.textContent).toContain('Casa Mare');
    expect(list.textContent).toContain('7');
    expect(list.textContent ?? '').not.toMatch(MONEY);
    expect(screen.getByRole('main').textContent ?? '').not.toMatch(FIGURES);
  });

  it('OwnerPortal_PropertyPage_ShowsNoCurrencyAndNoAmountInTheSummaryOrInTheRowsOfTheBookings', async () => {
    renderPortal('/portale-proprietari/immobili/p1');
    const bookings = await screen.findByTestId('owner-recent-bookings');

    // The rows keep what is true of a booking (channel and state); no row carries an amount.
    expect(bookings.textContent).toContain('Direct');
    expect(bookings.textContent).toContain('Airbnb');
    expect(bookings.textContent ?? '').not.toMatch(MONEY);
    expect(screen.getByRole('main').textContent ?? '').not.toMatch(MONEY);
  });
});

describe('a figure that is missing is never a zero in its place (the Home service answers nothing for an owner)', () => {
  it('OwnerPortal_Dashboard_SaysTheNumbersAreNotAvailableYet_NoTilesNoChartNoOccupancyAndNoRequestForThem', async () => {
    renderPortal('/portale-proprietari');
    const notice = await screen.findByTestId('owner-numbers-unavailable');
    await screen.findByTestId('owner-properties');

    expect(notice.textContent).toContain('non sono ancora disponibili');
    // No tile, no trend, no period to pick: nothing that could read 0% or €0 for an owner whose numbers are not there.
    expect(screen.queryByTestId('owner-overview')).toBeNull();
    expect(screen.queryByTestId('owner-tiles')).toBeNull();
    expect(screen.queryByTestId('owner-trend')).toBeNull();
    expect(screen.queryByTestId('owner-period')).toBeNull();
    expect(api.getOverview).not.toHaveBeenCalled();
    expect(api.getTrend).not.toHaveBeenCalled();
    // The occupancy of the property is the placeholder 0 of the service: it is not drawn, not as a percentage and not as a word.
    expect(screen.getByRole('main').textContent ?? '').not.toMatch(/%|\b61[.,]5\b|\bRevPAR\b|\bADR\b/);
    expect(screen.getByTestId('owner-properties').textContent ?? '').not.toMatch(/occupazione/i);
  });

  it('OwnerPortal_Dashboard_AnOwnerWithNoPropertyHasNoNoticeAboutNumbers_JustTheEmptyList', async () => {
    api.getProperties.mockResolvedValue([]);
    renderPortal('/portale-proprietari');

    expect(await screen.findByText('Non ci sono immobili disponibili')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-numbers-unavailable')).toBeNull();
  });

  it('OwnerPortal_PropertyPage_DrawsNoOccupancy_TheFieldIsAPlaceholderZero', async () => {
    renderPortal('/portale-proprietari/immobili/p1');
    await screen.findByTestId('owner-recent-bookings');

    const text = screen.getByRole('main').textContent ?? '';
    expect(text).not.toMatch(/%|\b61[.,]5\b/);
    expect(text).not.toMatch(/occupazione/i);
    // What the page does say: how many bookings the property has.
    expect(text).toContain('Prenotazioni totali');
  });
});

describe('the days of a booking are the days the answer writes, none of them moved by the time zone', () => {
  it('OwnerPortal_PropertyPage_DrawsTheDatesOfTheBookings_FirstOfJanuaryLastOfDecemberAndTheDayTheClockChanged', async () => {
    // The answer writes a booking day as an instant: the stored UTC midnight of the day (2026-12-28T00:00:00Z), or the same without the zone. A page that read it as an
    // instant of the browser would move the first of January to the 31st of December in America, and one that only takes a plain day draws nothing.
    const booking = (bookingId: string, checkInDate: string, checkOutDate: string) => ({ bookingId, checkInDate, checkOutDate, channel: 'Direct', totalAmount: 1, status: 'Confirmed' });
    api.getProperties.mockResolvedValue([
      {
        ...PROPERTY,
        recentBookings: [
          booking('n1', '2026-12-28T00:00:00Z', '2027-01-01T00:00:00Z'),
          booking('n2', '2026-12-31T00:00:00', '2027-01-02T00:00:00'),
          booking('n3', '2026-12-30T00:00:00Z', '2026-12-31T00:00:00Z'),
          booking('n4', '2026-03-28T00:00:00Z', '2026-03-29T00:00:00Z'),
          booking('n5', '2026-11-10', '2026-11-12'),
        ],
      },
    ]);
    renderPortal('/portale-proprietari/immobili/p1');
    const rows = within(await screen.findByTestId('owner-recent-bookings')).getAllByRole('listitem');

    const days = rows.map((row) => row.querySelector('span.font-medium')?.textContent);
    expect(days).toEqual([
      '28 dicembre 2026 - 1 gennaio 2027',
      '31 dicembre 2026 - 2 gennaio 2027',
      '30 dicembre 2026 - 31 dicembre 2026',
      '28 marzo 2026 - 29 marzo 2026',
      '10 novembre 2026 - 12 novembre 2026',
    ]);
  });
});
