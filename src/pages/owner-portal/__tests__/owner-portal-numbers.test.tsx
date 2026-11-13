import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
