import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import type { Booking } from '@/types';
import { ServiceRequestForm } from '../service-request-form';

const api = vi.hoisted(() => ({
  createServiceRequest: vi.fn(),
  createLongRentServiceRequest: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
  fetchLongRentSuppliers: vi.fn(),
  fetchServiceCategories: vi.fn(),
  getBookings: vi.fn(),
}));

// Real query hooks around mocked network calls: the form behaves as in the app.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/service-categories.api', () => ({ fetchServiceCategories: api.fetchServiceCategories }));
vi.mock('@/api/service-requests.api', () => ({
  createServiceRequest: api.createServiceRequest,
  createLongRentServiceRequest: api.createLongRentServiceRequest,
  fetchSuppliersByProperty: api.fetchSuppliersByProperty,
  fetchLongRentSuppliers: api.fetchLongRentSuppliers,
}));
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getAll: api.getBookings } }));

const CATALOG = ['cleaning', 'maintenance', 'plumbing', 'laundry', 'linen', 'check-in'];

const SUPPLIERS = {
  items: [
    { orgId: 'sup-1', legalName: 'Pulizie Express Srl', phone: '', email: '', categories: ['cleaning'], comuni: [], photoUrls: [] },
    { orgId: 'sup-2', legalName: 'Idraulica Rossi', phone: '', email: '', categories: ['cleaning'], comuni: [], photoUrls: [] },
  ],
  totalCount: 2,
  page: 1,
  pageSize: 2,
};

function stay(id: string, checkIn: string, checkOut: string, overrides: Partial<Booking> = {}): Booking {
  return {
    id,
    propertyId: 'prop-1',
    checkInDate: `${checkIn}T00:00:00Z`,
    checkOutDate: `${checkOut}T00:00:00Z`,
    status: 'Confirmed',
    guest: { firstName: 'Mario', lastName: id, email: '', phone: '', country: 'IT' },
    ...overrides,
  } as Booking;
}

function renderForm(props: Partial<React.ComponentProps<typeof ServiceRequestForm>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <ServiceRequestForm propertyId="prop-1" open onOpenChange={vi.fn()} hideTrigger {...props} />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

describe('ServiceRequestForm', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    api.createServiceRequest.mockResolvedValue({ id: 'sr-1' });
    api.createLongRentServiceRequest.mockResolvedValue({ id: 'sr-lr' });
    api.fetchServiceCategories.mockResolvedValue(CATALOG);
    api.fetchSuppliersByProperty.mockResolvedValue(SUPPLIERS);
    api.fetchLongRentSuppliers.mockResolvedValue(SUPPLIERS);
    api.getBookings.mockResolvedValue([]);
    await i18n.changeLanguage('en');
  });

  // ─── D2 (SU-07): short-rent requests are for a stay ───

  it('ServiceRequestForm_MarketplaceSupplierWithoutStay_AsksTheStayAndSendsItsBookingId', async () => {
    const onOpenChange = vi.fn();
    api.getBookings.mockResolvedValue([stay('b-next', '2099-10-01', '2099-10-05')]);
    renderForm({ supplierOrgId: 'sup-chosen', preselectedCategory: 'plumbing', onOpenChange });

    const staySelect = await screen.findByTestId('service-request-stay');
    expect(api.getBookings).toHaveBeenCalledWith({ propertyId: 'prop-1' });
    // No stay chosen yet: nothing can be sent without one.
    expect(screen.getByTestId('submit-service-request')).toBeDisabled();

    fireEvent.change(staySelect, { target: { value: 'b-next' } });
    fireEvent.change(screen.getByLabelText(i18n.t('serviceRequest.notes')), {
      target: { value: 'Keys at the front desk' },
    });
    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() => expect(api.createServiceRequest).toHaveBeenCalledTimes(1));
    expect(api.createServiceRequest.mock.calls[0][0]).toEqual({
      propertyId: 'prop-1',
      bookingId: 'b-next',
      supplierOrgId: 'sup-chosen',
      category: 'plumbing',
      urgency: 'Normal',
      notes: 'Keys at the front desk',
    });
    expect(api.createLongRentServiceRequest).not.toHaveBeenCalled();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('ServiceRequestForm_StaysOfTheProperty_OffersCurrentFirstAndNeverCancelled', async () => {
    api.getBookings.mockResolvedValue([
      stay('b-past', '2020-01-01', '2020-01-03'),
      stay('b-later', '2099-12-01', '2099-12-05'),
      stay('b-cancelled', '2099-06-01', '2099-06-03', { status: 'Cancelled' }),
      stay('b-sooner', '2099-10-01', '2099-10-05'),
    ]);
    renderForm({ supplierOrgId: 'sup-chosen' });

    const staySelect = (await screen.findByTestId('service-request-stay')) as HTMLSelectElement;
    expect(Array.from(staySelect.options).map((o) => o.value)).toEqual(['', 'b-sooner', 'b-later', 'b-past']);
    expect(within(staySelect).getByText(/Mario b-sooner · .*2099.* → .*2099/)).toBeInTheDocument();
  });

  it('ServiceRequestForm_PropertyWithoutStays_ExplainsAndCannotSubmit', async () => {
    renderForm({ supplierOrgId: 'sup-chosen' });

    expect(await screen.findByTestId('service-request-no-stays')).toHaveTextContent(i18n.t('serviceRequest.noStays'));
    expect(screen.getByTestId('submit-service-request')).toBeDisabled();
  });

  it('ServiceRequestForm_StaysFail_ShowsTheErrorNotAnEmptyList', async () => {
    api.getBookings.mockRejectedValue(new Error('network'));
    renderForm({ supplierOrgId: 'sup-chosen' });

    expect(await screen.findByTestId('service-request-stays-error')).toHaveTextContent(i18n.t('serviceRequest.staysLoadError'));
    expect(screen.queryByTestId('service-request-no-stays')).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-service-request')).toBeDisabled();
  });

  it('ServiceRequestForm_FromBookingDetail_SendsThatStayAndLetsTheHostPickTheSupplier', async () => {
    renderForm({ bookingId: 'b-detail' });

    const supplierSelect = await screen.findByTestId('service-request-supplier');
    expect(screen.queryByTestId('service-request-stay')).not.toBeInTheDocument();
    expect(api.getBookings).not.toHaveBeenCalled();
    expect(api.fetchSuppliersByProperty).toHaveBeenCalledWith('prop-1', 'cleaning');
    // The supplier is chosen by the host, never the first result by default.
    expect(screen.getByTestId('submit-service-request')).toBeDisabled();

    fireEvent.change(supplierSelect, { target: { value: 'sup-2' } });
    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() => expect(api.createServiceRequest).toHaveBeenCalledTimes(1));
    expect(api.createServiceRequest.mock.calls[0][0]).toMatchObject({
      propertyId: 'prop-1',
      bookingId: 'b-detail',
      supplierOrgId: 'sup-2',
      category: 'cleaning',
    });
  });

  it('ServiceRequestForm_SuppliersFail_ShowsTheErrorNotAnEmptyList', async () => {
    api.fetchSuppliersByProperty.mockRejectedValue(new Error('network'));
    renderForm({ bookingId: 'b-detail' });

    expect(await screen.findByTestId('service-request-suppliers-error')).toHaveTextContent(
      i18n.t('serviceRequest.suppliersLoadError'),
    );
    expect(screen.queryByTestId('service-request-no-suppliers')).not.toBeInTheDocument();
  });

  it('ServiceRequestForm_LongRent_SendsThePropertyOnlyThroughTheLongRentApi', async () => {
    renderForm({ context: 'long-rent', preselectedCategory: 'plumbing' });

    const supplierSelect = await screen.findByTestId('service-request-supplier');
    expect(screen.getByText(i18n.t('serviceRequest.longRentScopedDescription'))).toBeInTheDocument();
    expect(screen.queryByTestId('service-request-stay')).not.toBeInTheDocument();
    expect(api.fetchLongRentSuppliers).toHaveBeenCalledWith('prop-1', 'plumbing');
    expect(api.fetchSuppliersByProperty).not.toHaveBeenCalled();

    fireEvent.change(supplierSelect, { target: { value: 'sup-1' } });
    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() => expect(api.createLongRentServiceRequest).toHaveBeenCalledTimes(1));
    const payload = api.createLongRentServiceRequest.mock.calls[0][0];
    expect(payload).toEqual({ propertyId: 'prop-1', supplierOrgId: 'sup-1', category: 'plumbing', urgency: 'Normal', notes: undefined });
    expect(payload).not.toHaveProperty('bookingId');
    expect(api.createServiceRequest).not.toHaveBeenCalled();
    expect(api.getBookings).not.toHaveBeenCalled();
  });

  // ─── Catalog and AI (SU-03, FD-21) ───

  it('ServiceRequestForm_Opened_ShowsNoAiMatchOrExternalSuggestions', async () => {
    renderForm({ bookingId: 'b-detail', supplierOrgId: 'sup-chosen' });

    await screen.findByLabelText(i18n.t('serviceRequest.category'));
    // D11: AI supplier discovery is off; nothing presents LLM output as "top rated on Google".
    expect(screen.queryByTestId('ai-recommended-supplier')).not.toBeInTheDocument();
    expect(screen.queryByText(/Google/i)).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('serviceRequest.stayScopedDescription'))).toBeInTheDocument();
  });

  it('ServiceRequestForm_CatalogLoaded_OffersEveryCodeWithTranslatedLabel', async () => {
    renderForm({ bookingId: 'b-detail', supplierOrgId: 'sup-chosen' });

    const category = (await screen.findByLabelText(i18n.t('serviceRequest.category'))) as HTMLSelectElement;
    expect(Array.from(category.options).map((o) => o.value)).toEqual(CATALOG);
    expect(Array.from(category.options).map((o) => o.textContent)).toContain('Guest check-in');
  });

  it('ServiceRequestForm_PreselectedCategoryNotACode_SubmitsFirstCatalogCode', async () => {
    renderForm({ bookingId: 'b-detail', supplierOrgId: 'sup-chosen', preselectedCategory: 'Pulizie' });

    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() => expect(api.createServiceRequest).toHaveBeenCalledTimes(1));
    expect(api.createServiceRequest.mock.calls[0][0].category).toBe('cleaning');
  });

  it('ServiceRequestForm_CatalogFails_ShowsErrorWithoutSubmitting', async () => {
    api.fetchServiceCategories.mockRejectedValue(new Error('network'));
    renderForm({ bookingId: 'b-detail', supplierOrgId: 'sup-chosen' });

    expect(await screen.findByTestId('service-categories-error')).toHaveTextContent(i18n.t('serviceCategories.loadError'));
    expect(screen.getByTestId('submit-service-request')).toBeDisabled();
  });

  it('ServiceRequestForm_CreateFails_KeepsDialogOpen', async () => {
    const onOpenChange = vi.fn();
    api.createServiceRequest.mockRejectedValue(new Error('network'));
    renderForm({ bookingId: 'b-detail', supplierOrgId: 'sup-chosen', onOpenChange });

    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    fireEvent.click(screen.getByTestId('submit-service-request'));

    await waitFor(() => expect(api.createServiceRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('submit-service-request')).toBeEnabled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
