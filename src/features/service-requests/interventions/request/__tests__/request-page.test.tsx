import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, type AxiosResponse } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { fetchHostSupplierServices, fetchHostSupplierSlots } from '@/api/host-supplier-catalog.api';
import { propertiesApi } from '@/api/properties.api';
import { fetchServiceCategories } from '@/api/service-categories.api';
import { createServiceRequest, fetchMarketplaceSuppliers, fetchSuppliersByProperty } from '@/api/service-requests.api';
import { NOON_UTC, freezeClock } from '@/test/clock';
import type { Booking, Property } from '@/types';
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
vi.mock('@/api/service-requests.api', () => ({
  createServiceRequest: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
  fetchMarketplaceSuppliers: vi.fn(),
}));
vi.mock('@/api/host-supplier-catalog.api', () => ({ fetchHostSupplierServices: vi.fn(), fetchHostSupplierSlots: vi.fn() }));

const PROPERTY_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const OTHER_PROPERTY_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4e';
const SUPPLIER_ID = '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a2b';
const SERVICE_ID = '3f2a9c1e-7b1d-4c3a-9e2f-0a1b2c3d4e5f';
const STAY_ID = '5b1d3f2a-9c1e-4c3a-8e2f-0a1b2c3d4e5f';
const WAIT = { timeout: 5000 };

const property = { id: PROPERTY_ID, name: 'Casa Mare', city: 'Rimini', address: 'Via Roma 1', comuneIstatCode: '099014' } as Property;
const otherProperty = { id: OTHER_PROPERTY_ID, name: 'Casa Monti', city: 'Cortina', address: 'Via Alta 2', comuneIstatCode: '025016' } as Property;
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
const stay = {
  id: STAY_ID,
  propertyId: PROPERTY_ID,
  checkInDate: '2026-09-26T00:00:00Z',
  checkOutDate: '2026-09-28T00:00:00Z',
  status: 'Confirmed',
  guest: { firstName: 'Mario', lastName: 'Rossi' },
} as Booking;

function refusal(status: number, code: string) {
  return new AxiosError('failed', AxiosError.ERR_BAD_REQUEST, undefined, undefined, { status, data: { code }, statusText: '', headers: {}, config: {} } as unknown as AxiosResponse);
}

// The test clock is 24 September 2026, 14:00 in Rome: the work is the day after, at 10:00 (08:00 UTC, summer time).
function renderPage(query = `propertyId=${PROPERTY_ID}&type=cleaning&date=2026-09-25`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const url = `/app/short-rent/interventions/request${query ? `?${query}` : ''}`;
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
const stepIs = (id: string) => waitFor(() => expect(screen.getByTestId('request-wizard')).toHaveAttribute('data-step', id), WAIT);

/** From the proposals (the address names the property and the kind of work) to the summary: the supplier, the slot. */
async function reachSummary() {
  fireEvent.click(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT));
  next();
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
  vi.mocked(fetchMarketplaceSuppliers).mockResolvedValue({ items: [supplier], totalCount: 1, page: 1, pageSize: 20 });
  vi.mocked(fetchHostSupplierServices).mockResolvedValue({ items: [service] });
  vi.mocked(fetchHostSupplierSlots).mockImplementation(async (_supplier, _service, params) => ({
    serviceId: SERVICE_ID,
    durationMinutes: 120,
    from: params.date ?? null,
    to: params.date ?? null,
    slots: [{ startUtc: `${params.date}T08:00:00Z`, endUtc: `${params.date}T10:00:00Z` }],
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RequestInterventionPage (SR-08b)', { timeout: 30000 }, () => {
  it('RequestInterventionPage_PropertyAndKindOfWorkInTheAddress_OpensOnTheProposals_AndSendsARequestForTheHouseAlone', async () => {
    vi.mocked(createServiceRequest).mockResolvedValue({ id: 'sr-1', status: 'Richiesto' } as ServiceRequest);
    renderPage();

    // The address answers the property and the service: the wizard opens where the host has something to choose.
    await stepIs('proposals');
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
    // The request is for the house: no stay was needed.
    expect(sent.bookingId).toBeUndefined();
    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toHaveAttribute('href', '/app/short-rent/interventions/sr-1');
  });

  it('RequestInterventionPage_AStayIsOnlyALink_ChosenAtTheEnd', async () => {
    vi.mocked(bookingsApi.getAll).mockResolvedValue([stay] as never);
    vi.mocked(createServiceRequest).mockResolvedValue({ id: 'sr-2', status: 'Richiesto' } as ServiceRequest);
    renderPage();

    fireEvent.click(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT));
    next();
    // The stay is offered, not asked: it is optional, and the day of the work follows its check-out when it is linked.
    const select = await screen.findByTestId('request-stay', undefined, WAIT);
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1), WAIT);
    fireEvent.change(select, { target: { value: STAY_ID } });
    await waitFor(() => expect(screen.getByTestId('request-day')).toHaveValue('2026-09-28'), WAIT);
    fireEvent.click(await screen.findByTestId('request-slot-10:00', undefined, WAIT));
    next();
    await screen.findByTestId('request-supplier-sees', undefined, WAIT);
    fireEvent.click(screen.getByTestId('request-finish'));

    await waitFor(() => expect(createServiceRequest).toHaveBeenCalledTimes(1), WAIT);
    expect(vi.mocked(createServiceRequest).mock.calls[0][0]).toMatchObject({ bookingId: STAY_ID, scheduledStartUtc: '2026-09-28T08:00:00.000Z' });
  });

  it('RequestInterventionPage_NoAddress_TwoProperties_StartsWithTheProperty_ThenWhoThenTheService', async () => {
    vi.mocked(propertiesApi.getAll).mockResolvedValue([property, otherProperty]);
    renderPage('');

    await stepIs('property');
    fireEvent.click(await screen.findByTestId(`request-property-${OTHER_PROPERTY_ID}`, undefined, WAIT));
    next();
    // CasaZen is the rule and it is advised.
    await stepIs('channel');
    expect(await screen.findByTestId('request-channel-casazen', undefined, WAIT)).toBeChecked();
    expect(screen.getByTestId('request-channel-casazen').closest('label')).toHaveTextContent('Consigliato');
    next();
    // The kind of work, as tiles with the number of suppliers around the property.
    await stepIs('service');
    const cleaning = await screen.findByTestId('request-category-cleaning', undefined, WAIT);
    await waitFor(() => expect(cleaning.closest('label')).toHaveTextContent('1 fornitore'), WAIT);
    expect(screen.getByTestId('request-category-plumbing').closest('label')).toHaveTextContent('Ancora nessun fornitore');
    expect(fetchMarketplaceSuppliers).toHaveBeenCalledWith(expect.objectContaining({ propertyId: OTHER_PROPERTY_ID }));
    fireEvent.click(cleaning);
    next();
    await stepIs('proposals');
    expect(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT)).toBeInTheDocument();
  });

  it('RequestInterventionPage_OnePropertyAndNoAddress_StartsOnWho', async () => {
    renderPage('');

    await stepIs('channel');
    expect(screen.queryByTestId('request-property-0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d')).not.toBeInTheDocument();
  });

  it('RequestInterventionPage_NextWithoutAnAnswer_StaysOnTheStepAndSaysWhatIsMissing', async () => {
    vi.mocked(propertiesApi.getAll).mockResolvedValue([property, otherProperty]);
    renderPage('');

    await screen.findByTestId(`request-property-${PROPERTY_ID}`, undefined, WAIT);
    next();

    // Said on the field and in the summary of what is missing.
    expect((await screen.findAllByText('Scegli l\'immobile.', undefined, WAIT)).length).toBeGreaterThan(0);
    expect(screen.getByTestId('request-wizard')).toHaveAttribute('data-step', 'property');
  });

  it('RequestInterventionPage_TheBestRankedSupplier_IsMarkedRecommended_AndOnlyThatOne', async () => {
    const other = { ...supplier, orgId: 'b1b2c3d4-0000-4000-8000-000000000002', legalName: 'Pulizie Bianchi' } as SupplierPicker;
    vi.mocked(fetchSuppliersByProperty).mockResolvedValue({ items: [{ ...supplier, recommended: true }, other], totalCount: 2, page: 1, pageSize: 20 });
    renderPage();

    const first = await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT);

    // The server decides it from the load and the reliability of the supplier and sends a word: only that card carries it.
    const badge = await screen.findByTestId('supplier-recommended-badge', undefined, WAIT);
    expect(screen.getAllByTestId('supplier-recommended-badge')).toHaveLength(1);
    expect(badge).toHaveTextContent('Consigliato');
    expect(first.closest('label')).toContainElement(badge);
    expect(screen.getByTestId('request-supplier-b1b2c3d4-0000-4000-8000-000000000002').closest('label')).not.toContainElement(badge);
    // The order is the server's, and the host is told what it means.
    expect(screen.getByText(/in ordine di affidabilità e disponibilità/)).toBeInTheDocument();
  });

  it('RequestInterventionPage_NoSupplierForTheService_SaysSoAndProposesThePartnersOfThatService', async () => {
    vi.mocked(fetchSuppliersByProperty).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    renderPage();

    const empty = await screen.findByTestId('request-no-suppliers', undefined, WAIT);
    expect(empty).toHaveTextContent("In questo territorio non c'è ancora una rete CasaZen per questa categoria.");
    // The partners of the cleaning: the ones the page lists for it, each with its own site.
    expect(within(empty).getByTestId('marketplace-partner-turno-link')).toHaveAttribute('href', 'https://turno.com/');
    expect(within(empty).queryByTestId('marketplace-partner-operto')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('request-go-partners'));
    await stepIs('partners');
    expect(await screen.findByTestId('request-partners')).toHaveTextContent('CasaZen non lo gestisce');
  });

  it('RequestInterventionPage_NoCasazenSupplierAroundTheProperty_StepsAsideToThePartnersAndSendsNothing', async () => {
    vi.mocked(fetchMarketplaceSuppliers).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    renderPage(`propertyId=${PROPERTY_ID}`);

    await stepIs('channel');
    // Nobody of CasaZen in the zone: the partners are the way, and the reason is said; CasaZen cannot be picked.
    expect(await screen.findByTestId('request-no-network', undefined, WAIT)).toHaveTextContent('non ci sono ancora fornitori CasaZen');
    await waitFor(() => expect(screen.getByTestId('request-channel-external')).toBeChecked(), WAIT);
    expect(screen.getByTestId('request-channel-casazen')).toBeDisabled();
    next();

    // Only the kinds of work an external partner covers.
    await stepIs('service');
    fireEvent.click(await screen.findByTestId('request-category-cleaning', undefined, WAIT));
    expect(screen.queryByTestId('request-category-plumbing')).not.toBeInTheDocument();
    next();

    await stepIs('partners');
    expect(await screen.findByTestId('marketplace-partner-doinn-link', undefined, WAIT)).toHaveAttribute('target', '_blank');
    // The wizard ends here: the work is organised on the partner's site, so nothing goes to CasaZen.
    fireEvent.click(screen.getByTestId('request-finish'));
    expect(await screen.findByText('Ora tocca al partner', undefined, WAIT)).toBeInTheDocument();
    expect(createServiceRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/short-rent/marketplace?propertyId=${PROPERTY_ID}`);
  });

  it('RequestInterventionPage_SupplierAndServiceInTheAddress_OpenOnTheDetailsWithTheServiceChosen', async () => {
    renderPage(`propertyId=${PROPERTY_ID}&type=cleaning&supplierOrgId=${SUPPLIER_ID}&serviceId=${SERVICE_ID}&date=2026-09-25`);

    await stepIs('details');
    // The page of a supplier gave the supplier and the service: the host only says when.
    expect(await screen.findByTestId(`request-service-${SERVICE_ID}`, undefined, WAIT)).toBeChecked();
    await waitFor(() => expect(screen.getByTestId('request-chosen-supplier')).toHaveTextContent('Pulizie Rossi'), WAIT);
    fireEvent.click(await screen.findByTestId('request-slot-10:00', undefined, WAIT));
    next();
    await screen.findByTestId('request-supplier-sees', undefined, WAIT);
  });

  it('RequestInterventionPage_SlotTakenMeanwhile_BringsTheHostBackToTheDetailsWithTheAnswersKept', async () => {
    vi.mocked(createServiceRequest).mockRejectedValue(refusal(409, 'supplier_slot_unavailable'));
    renderPage();

    await reachSummary();
    fireEvent.click(screen.getByTestId('request-finish'));

    expect(await screen.findByTestId('request-finish-error', undefined, WAIT)).toHaveTextContent('Questo orario è appena stato preso');
    // The router moves with a transition, a moment after the message: the step is the one of the slots.
    await stepIs('details');
    // The supplier and the service are still chosen: only the time has to be chosen again.
    expect(screen.getByTestId('request-chosen-supplier')).toHaveTextContent('Pulizie Rossi');
    expect(await screen.findByTestId(`request-service-${SERVICE_ID}`, undefined, WAIT)).toBeChecked();
    expect(screen.queryByTestId('wizard-done-primary')).not.toBeInTheDocument();
  });

  it('RequestInterventionPage_PropertiesCannotBeRead_SaysSoWithRetry_AndDoesNotOpenOnEmptyLists', async () => {
    vi.mocked(propertiesApi.getAll).mockRejectedValueOnce(new Error('boom')).mockResolvedValue([property]);
    renderPage();

    expect(await screen.findByText('Non riesco a preparare la richiesta.', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('request-wizard')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    await stepIs('proposals');
  });

  it('RequestInterventionPage_ChangeSupplier_GoesBackToTheProposals', async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT));
    next();
    fireEvent.click(await screen.findByTestId('request-change-supplier', undefined, WAIT));

    await stepIs('proposals');
    expect(await screen.findByTestId(`request-supplier-${SUPPLIER_ID}`, undefined, WAIT)).toBeChecked();
  });
});
