import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { fetchHostSupplierServices, fetchHostSupplierSlots } from '@/api/host-supplier-catalog.api';
import { propertiesApi } from '@/api/properties.api';
import { fetchServiceCategories } from '@/api/service-categories.api';
import { createServiceRequest, fetchSuppliersByProperty } from '@/api/service-requests.api';
import { NOON_UTC, freezeClock } from '@/test/clock';
import type { Property } from '@/types';
import type { ServiceRequest, SupplierPicker } from '@/types/service-request';
import { RequestInterventionPage } from '../request-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/api/bookings.api', () => ({
  asBookingPage: (data: unknown) => ({ items: Array.isArray(data) ? data : [], totalCount: 0, page: 1, pageSize: 10 }),
  bookingsApi: { getAll: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: vi.fn() }));
vi.mock('@/api/service-requests.api', () => ({ createServiceRequest: vi.fn(), fetchSuppliersByProperty: vi.fn() }));
vi.mock('@/api/host-supplier-catalog.api', () => ({ fetchHostSupplierServices: vi.fn(), fetchHostSupplierSlots: vi.fn() }));

const PROPERTY_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const SUPPLIER_ID = '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b';
const SERVICE_ID = '3f2a9c1e-7b1d-4c3a-9e2f-0a1b2c3d4e5f';
const WAIT = { timeout: 5000 };

const property = { id: PROPERTY_ID, name: 'Casa Mare', city: 'Rimini' } as Property;
const supplier = {
  orgId: SUPPLIER_ID,
  legalName: 'Pulizie Rossi',
  phone: '',
  email: '',
  categories: ['cleaning'],
  comuni: ['Rimini'],
  photoUrls: [],
  priceFromCents: 6000,
  priceFromUnit: 'PerJob',
  medianResponseMinutes: 120,
} as SupplierPicker;
const service = {
  id: SERVICE_ID,
  name: 'Pulizia di fine soggiorno',
  category: 'cleaning',
  durationMinutes: 120,
  priceFromCents: 6000,
  priceUnit: 'PerJob' as const,
  requiresQuote: false,
  estimatedAmountCents: 6000,
};

function refusal(status: number, code: string) {
  return new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, { status, data: { code }, statusText: '', headers: {}, config: {} } as unknown as AxiosResponse);
}

// The test clock is 24 September 2026, 14:00 in Rome: the work is the day after, at 10:00 (08:00 UTC, summer time).
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const url = `/app/short-rent/interventions/request?propertyId=${PROPERTY_ID}&type=cleaning&date=2026-09-25`;
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(MemoryRouter, { initialEntries: [url] },
          createElement(Routes, null,
            createElement(Route, { path: '/app/short-rent/interventions/request', element: createElement(RequestInterventionPage) }),
          )))),
  );
}

const next = () => fireEvent.click(screen.getByTestId('request-next'));

/** Through the first three steps to the summary: the kind of job and the day come from the address, the host chooses the supplier and the slot. */
async function reachSummary() {
  await screen.findByTestId('request-category', undefined, WAIT);
  next();
  await screen.findByTestId('request-day', undefined, WAIT);
  next();
  fireEvent.click(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT));
  fireEvent.click(await screen.findByTestId('request-slot-10:00', undefined, WAIT));
  next();
  await screen.findByTestId('request-supplier-sees', undefined, WAIT);
}

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  freezeClock(NOON_UTC);
  await i18n.changeLanguage('it');
  vi.mocked(fetchServiceCategories).mockResolvedValue(['cleaning', 'plumbing']);
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property]);
  vi.mocked(bookingsApi.getAll).mockResolvedValue([] as never);
  vi.mocked(fetchSuppliersByProperty).mockResolvedValue({ items: [supplier], totalCount: 1, page: 1, pageSize: 20 });
  vi.mocked(fetchHostSupplierServices).mockResolvedValue({ items: [service] });
  vi.mocked(fetchHostSupplierSlots).mockResolvedValue({
    serviceId: SERVICE_ID,
    durationMinutes: 120,
    from: '2026-09-25',
    to: '2026-10-08',
    slots: [{ startUtc: '2026-09-25T08:00:00Z', endUtc: '2026-09-25T10:00:00Z' }],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RequestInterventionPage (SR-08b)', { timeout: 30000 }, () => {
  it('RequestInterventionPage_ServiceOfTheCatalogWithASlot_SendsTheServiceAndTheSlotAndNoLength', async () => {
    vi.mocked(createServiceRequest).mockResolvedValue({ id: 'sr-1', status: 'Richiesto' } as ServiceRequest);
    renderPage();

    await reachSummary();
    // What the supplier will see is said before the host sends; a guest is never among it.
    expect(screen.getByTestId('request-supplier-sees')).toHaveTextContent('Non vede mai i dati dei tuoi ospiti');
    fireEvent.click(screen.getByTestId('request-finish'));

    await waitFor(() => expect(createServiceRequest).toHaveBeenCalledTimes(1), WAIT);
    const sent = vi.mocked(createServiceRequest).mock.calls[0][0];
    expect(sent).toMatchObject({
      propertyId: PROPERTY_ID,
      supplierOrgId: SUPPLIER_ID,
      category: 'cleaning',
      urgency: 'Normal',
      serviceListingId: SERVICE_ID,
      scheduledStartUtc: '2026-09-25T08:00:00.000Z',
    });
    // The server takes the length from the service: a length of the host would stop it checking the slot.
    expect(sent.durationMinutes).toBeUndefined();
    expect(sent.bookingId).toBeUndefined();
    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toHaveAttribute('href', '/app/short-rent/interventions/sr-1');
  });

  it('RequestInterventionPage_SlotTakenMeanwhile_BringsTheHostBackToTheSlotsWithTheAnswersKept', async () => {
    vi.mocked(createServiceRequest).mockRejectedValue(refusal(409, 'supplier_slot_unavailable'));
    renderPage();

    await reachSummary();
    fireEvent.click(screen.getByTestId('request-finish'));

    expect(await screen.findByTestId('request-finish-error', undefined, WAIT)).toHaveTextContent('Questo orario è appena stato preso');
    // The router moves with a transition, a moment after the message: the step is the one of the slots.
    await waitFor(() => expect(screen.getByTestId('request-wizard')).toHaveAttribute('data-step', 'who'), WAIT);
    // The supplier and the service are still chosen: only the time has to be chosen again.
    expect(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT)).toBeChecked();
    expect(screen.queryByTestId('wizard-done-primary')).not.toBeInTheDocument();
  });
});
