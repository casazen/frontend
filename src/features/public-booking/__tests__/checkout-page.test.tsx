import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { CheckoutPage } from '../checkout-page';
import * as publicOrgQueries from '@/queries/use-public-org';
import * as publicBookingQueries from '@/queries/use-public-booking';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { DirectBookingResponse, PublicOrgDto, PublicPropertyDetailDto } from '@/types';

vi.mock('@/queries/use-public-org');
vi.mock('@/queries/use-public-booking');
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => new Promise(() => {})) }));

// The Radix checkbox of the consent measures itself with ResizeObserver, missing in jsdom.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const org: PublicOrgDto = {
  slug: 'demo-casazen',
  displayName: 'Demo Casazen Stays',
  logoUrl: null,
  themeColor: null,
  contactEmail: null,
} as unknown as PublicOrgDto;

const property = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  slug: 'trastevere-suite',
  name: 'Trastevere Suite',
  description: '',
  city: 'Roma',
  postalCode: '00153',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 165,
  cleaningFee: 55,
  amenities: [],
  photoUrls: [],
  cinCode: 'IT-12345-0123456789',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
  houseRules: '',
  cancellationPolicySummary: '',
  minNights: null,
  currency: 'EUR',
} as unknown as PublicPropertyDetailDto;

const checkIn = addDays(todayInRome(), 30);
const checkOut = addDays(checkIn, 3);
const mutateAsync = vi.fn();

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderCheckout(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/book/demo-casazen/property/trastevere-suite/checkout${search}`]}>
      <Routes>
        <Route path="/book/:orgSlug" element={<Outlet context={{ org }} />}>
          <Route path="property/:propertySlugOrId/checkout" element={<CheckoutPage />} />
        </Route>
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

function continueButton() {
  return screen.getByRole('button', { name: 'Continua' });
}

function fillGuest() {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Mario' } });
  fireEvent.change(screen.getByLabelText('Cognome'), { target: { value: 'Rossi' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'mario.rossi@example.com' } });
  fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '+49 30 1234567' } });
  fireEvent.change(screen.getByLabelText('Paese di residenza'), { target: { value: 'DE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Paga subito' }));
  fireEvent.click(screen.getByRole('checkbox'));
}

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), public: true };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
}

describe('CheckoutPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(publicOrgQueries.useOrgPublicProperty).mockReturnValue({
      data: property,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof publicOrgQueries.useOrgPublicProperty>);
    mutateAsync.mockReset();
    vi.mocked(publicBookingQueries.useCreateDirectBooking).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof publicBookingQueries.useCreateDirectBooking>);
  });

  afterEach(() => {
    cleanup();
  });

  it('CheckoutPage_WidgetDeepLink_PrefillsDatesAndGuestsAndEnablesContinue', async () => {
    mutateAsync.mockResolvedValue({
      bookingId: 'b1',
      clientSecret: 'pi_secret',
      connectedAccountPublishableContext: { publishableKey: 'pk_test', stripeAccountId: 'acct_test' },
      amount: 568,
      currency: 'EUR',
      touristTaxAmount: 18,
      basePrice: 550,
      freeRefundDeadline: '2026-10-01T00:00:00Z',
      paymentOption: 'Immediate',
    } satisfies DirectBookingResponse);
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=3`);

    expect(screen.getByLabelText('Check-in')).toHaveValue(checkIn);
    expect(screen.getByLabelText('Check-out')).toHaveValue(checkOut);
    expect(screen.getByLabelText('Adulti')).toHaveValue(3);
    expect(screen.getByLabelText('Bambini')).toHaveValue(0);
    expect(screen.getByTestId('checkout-stay-summary')).toHaveTextContent('(3 notti)');
    expect(within(screen.getByTestId('price-breakdown')).getByText('3 notti x 165,00 €')).toBeInTheDocument();
    expect(continueButton()).toBeDisabled();

    fillGuest();

    await waitFor(() => expect(continueButton()).toBeEnabled());
    fireEvent.click(continueButton());

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: property.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numberOfAdults: 3,
        numberOfChildren: 0,
        paymentOption: 'Immediate',
        guest: {
          firstName: 'Mario',
          lastName: 'Rossi',
          email: 'mario.rossi@example.com',
          phone: '+49 30 1234567',
          country: 'DE',
        },
      }),
    );
    expect(await screen.findByTestId('price-breakdown')).toHaveTextContent('568,00 €');
    expect(screen.queryByTestId('checkout-guest-step')).not.toBeInTheDocument();
  });

  it('CheckoutPage_LegacyCamelCaseLink_ReadsDatesAndChildren', () => {
    renderCheckout(`?checkIn=${checkIn}&checkOut=${checkOut}&guests=3&children=1`);

    expect(screen.getByLabelText('Check-in')).toHaveValue(checkIn);
    expect(screen.getByLabelText('Check-out')).toHaveValue(checkOut);
    expect(screen.getByLabelText('Adulti')).toHaveValue(2);
    expect(screen.getByLabelText('Bambini')).toHaveValue(1);
  });

  it('CheckoutPage_EditDatesAndGuests_UpdatesNightsAndUrl', async () => {
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    const newCheckOut = addDays(checkIn, 5);

    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: newCheckOut } });
    fireEvent.change(screen.getByLabelText('Bambini'), { target: { value: '1' } });

    await waitFor(() => expect(screen.getByTestId('checkout-stay-summary')).toHaveTextContent('(5 notti)'));
    const search = new URLSearchParams(screen.getByTestId('location').textContent?.split('?')[1]);
    expect(search.get('checkin')).toBe(checkIn);
    expect(search.get('checkout')).toBe(newCheckOut);
    expect(search.get('guests')).toBe('3');
    expect(search.get('children')).toBe('1');
  });

  it('CheckoutPage_NoDatesInLink_ShowsEmptyDateFieldsWithoutInvalidDate', () => {
    renderCheckout('');

    expect(screen.getByLabelText('Check-in')).toHaveValue('');
    expect(screen.getByLabelText('Check-in')).toHaveAttribute('min', todayInRome());
    expect(screen.getByLabelText('Adulti')).toHaveValue(2);
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('price-breakdown')).not.toBeInTheDocument();
  });

  it('CheckoutPage_PastCheckIn_ShowsErrorAndKeepsContinueDisabled', async () => {
    const pastCheckIn = addDays(todayInRome(), -2);
    renderCheckout(`?checkin=${pastCheckIn}&checkout=${addDays(pastCheckIn, 3)}&guests=2`);

    expect(await screen.findByText('La data di check-in non può essere nel passato')).toBeInTheDocument();
    fillGuest();
    await waitFor(() => expect(screen.getByLabelText('Paese di residenza')).toHaveValue('DE'));
    expect(continueButton()).toBeDisabled();
  });

  it('CheckoutPage_GuestsOverCapacity_ShowsTooManyGuests', async () => {
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=6`);

    expect(await screen.findByText('Il numero di ospiti supera la capienza della struttura')).toBeInTheDocument();
    expect(screen.getByText('Massimo 4 ospiti, bambini inclusi')).toBeInTheDocument();
  });

  it('CheckoutPage_InvalidEmailAfterBlur_ShowsEmailError', async () => {
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    const email = screen.getByLabelText('Email');

    fireEvent.change(email, { target: { value: 'mario.rossi@' } });
    fireEvent.blur(email);

    expect(await screen.findByText('Inserisci un indirizzo email valido')).toBeInTheDocument();
  });

  it('CheckoutPage_DatesUnavailableConflict_ShowsServerMessageNotGenericError', async () => {
    mutateAsync.mockRejectedValue(problemError(409, { error: 'Property not available for selected dates' }));
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    fillGuest();
    await waitFor(() => expect(continueButton()).toBeEnabled());

    fireEvent.click(continueButton());

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent('Property not available for selected dates');
    expect(screen.queryByText(/Impossibile avviare il checkout/)).not.toBeInTheDocument();
  });

  it('CheckoutPage_ServerErrorWithoutDetails_ShowsGenericError', async () => {
    mutateAsync.mockRejectedValue(problemError(500, { error: 'Payment initialization failed' }));
    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}&guests=2`);
    fillGuest();
    await waitFor(() => expect(continueButton()).toBeEnabled());

    fireEvent.click(continueButton());

    expect(await screen.findByTestId('checkout-error')).toHaveTextContent(
      'Impossibile avviare il checkout. Verifica i dati e riprova.',
    );
  });

  it('CheckoutPage_PropertyNotFound_ShowsErrorState', () => {
    vi.mocked(publicOrgQueries.useOrgPublicProperty).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof publicOrgQueries.useOrgPublicProperty>);

    renderCheckout(`?checkin=${checkIn}&checkout=${checkOut}`);

    expect(screen.getByTestId('checkout-property-not-found')).toHaveTextContent('Struttura non trovata.');
    expect(screen.queryByTestId('direct-checkout-page')).not.toBeInTheDocument();
  });
});
