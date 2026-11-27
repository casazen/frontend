import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { ApiClient } from '@/api/client';
import { publicOrgApi } from '@/api/public-org.api';
import { publicBookingApi } from '@/api/public-booking.api';
import { freezeClock } from '@/test/clock';
import { addDays } from '@/lib/stay-dates';
import { PublicPropertyPage } from '../public-property-page';
import type { PublicCalendarDto, PublicOrgDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/api/public-org.api', () => ({
  publicOrgApi: { getOrgProperty: vi.fn(), getOrgProperties: vi.fn(), getOrgPropertyCalendar: vi.fn() },
}));
vi.mock('@/api/public-booking.api', () => ({
  publicBookingApi: { quoteDirectBooking: vi.fn() },
}));

configure({ asyncUtilTimeout: 5_000 });

const TODAY = '2026-10-05';
const org = { slug: 'demo-casazen', displayName: 'Demo Casazen Stays', contactEmail: null } as unknown as PublicOrgDto;
const PROPERTY_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';
const PROPERTY_SLUG = 'villa-mare';

const property: PublicPropertyDetailDto = {
  id: PROPERTY_ID,
  slug: PROPERTY_SLUG,
  name: 'Villa Mare',
  description: 'Vista mare.',
  city: 'Napoli',
  postalCode: '80100',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 100,
  cleaningFee: 40,
  amenities: [],
  photoUrls: [],
  cinCode: 'IT063049C2ABCDEFGH',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
  houseRules: '',
  cancellationPolicySummary: '',
  minNights: null,
  currency: 'EUR',
};

const calendar: PublicCalendarDto = {
  propertyId: PROPERTY_ID,
  startDate: TODAY,
  endDate: addDays(TODAY, 60),
  today: TODAY,
  currency: 'EUR',
  generatedAt: `${TODAY}T08:00:00Z`,
  days: Array.from({ length: 60 }, (_, offset) => ({ date: addDays(TODAY, offset), available: true, nightlyPriceCents: 10000, minNights: 1 })),
};

function renderPage(search = '', publicOrg = org) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/book/demo-casazen/property/${PROPERTY_SLUG}${search}`]}>
        <Routes>
          <Route path="/book/:orgSlug" element={<Outlet context={{ org: publicOrg }} />}>
            <Route path="property/:propertySlugOrId" element={<PublicPropertyPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PublicPropertyPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    freezeClock(`${TODAY}T10:00:00Z`);
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue(property);
    vi.mocked(publicOrgApi.getOrgProperties).mockResolvedValue([]);
    vi.mocked(publicOrgApi.getOrgPropertyCalendar).mockResolvedValue(calendar);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('PublicPropertyPage_SlugUrl_LoadsTheHomeAndItsCalendarWithoutAskingAQuote', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Villa Mare' });
    await waitFor(() => expect(publicOrgApi.getOrgPropertyCalendar).toHaveBeenCalledTimes(1));
    expect(publicOrgApi.getOrgProperty).toHaveBeenCalledWith('demo-casazen', PROPERTY_SLUG);
    expect(vi.mocked(publicOrgApi.getOrgPropertyCalendar).mock.calls[0][1]).toBe(PROPERTY_SLUG);
    expect(publicBookingApi.quoteDirectBooking).not.toHaveBeenCalled();
  });

  it('opens the contact form for a property that cannot be booked online, without exposing a host email', async () => {
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue({ ...property, acceptsBookings: false });
    renderPage('', { ...org, canContactHost: true });

    fireEvent.click(await screen.findByTestId('property-host-write'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('hostContact.nameLabel'))).toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('hostContact.emailLabel'))).toBeInTheDocument();
    expect(publicBookingApi.quoteDirectBooking).not.toHaveBeenCalled();
  });

  it('starts a pre-booking chat and displays the reply from the host', async () => {
    const post = vi.spyOn(ApiClient, 'post').mockResolvedValue(undefined);
    const get = vi.spyOn(ApiClient, 'get').mockResolvedValue([
      { id: 'guest', fromHost: false, text: 'Avete una culla?', sentAt: '2026-10-05T10:00:00Z' },
      { id: 'host', fromHost: true, text: 'Sì, su richiesta.', sentAt: '2026-10-05T10:01:00Z' },
    ]);
    const storageKey = `casazen:storefront-chat:${PROPERTY_ID}`;
    vi.mocked(publicOrgApi.getOrgProperty).mockResolvedValue({ ...property, acceptsBookings: false });
    renderPage('', { ...org, storefrontChatEnabled: true });

    try {
      fireEvent.click(await screen.findByTestId('property-host-chat'));
      fireEvent.change(screen.getByLabelText(i18n.t('hostContact.nameLabel')), { target: { value: 'Mario Rossi' } });
      fireEvent.change(screen.getByLabelText(i18n.t('hostContact.emailLabel')), { target: { value: 'mario@example.test' } });
      fireEvent.change(screen.getByLabelText(i18n.t('hostContact.messageLabel')), { target: { value: 'Avete una culla?' } });
      fireEvent.click(screen.getByRole('checkbox', { name: i18n.t('storefrontChat.consent') }));
      fireEvent.click(screen.getByRole('button', { name: i18n.t('hostContact.send') }));

      expect(await screen.findByText('Sì, su richiesta.')).toBeInTheDocument();
      expect(post).toHaveBeenCalledWith(`/public/orgs/demo-casazen/properties/${PROPERTY_ID}/chat`, {
        name: 'Mario Rossi', email: 'mario@example.test', text: 'Avete una culla?', consent: true,
      }, expect.objectContaining({ public: true, headers: expect.objectContaining({
        'X-Storefront-Chat': localStorage.getItem(storageKey),
      }) }));
    } finally {
      localStorage.removeItem(storageKey);
      post.mockRestore();
      get.mockRestore();
    }
  });

  it('PublicPropertyPage_HomeWithoutRichData_ShowsNoEmptyBlocks', async () => {
    renderPage();

    await screen.findByRole('heading', { level: 1, name: 'Villa Mare' });
    expect(screen.queryByTestId('property-energy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-floor-plan')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-zone')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-rules')).not.toBeInTheDocument();
    expect(screen.queryByTestId('property-host')).not.toBeInTheDocument();
  });
});
