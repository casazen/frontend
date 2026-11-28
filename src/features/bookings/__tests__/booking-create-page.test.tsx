import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { ConnectApi } from '@/api/connect.api';
import { propertiesApi } from '@/api/properties.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { copyTextToClipboard } from '@/lib/utils';
import { NOON_UTC, freezeClock } from '@/test/clock';
import type { Booking, ManualBooking, Property, StayAvailability } from '@/types';
import type { DirectBookingQuote } from '@/types/direct-booking.types';
import { BookingCreatePage } from '../booking-create-page';
import { NEW_BOOKING_DRAFT_VERSION, emptyNewBooking, type NewBookingValues } from '../lib/new-booking-model';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-users', () => ({
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/bookings.api', () => ({
  asBookingPage: vi.fn(),
  bookingsApi: { createManual: vi.fn(), quote: vi.fn(), availability: vi.fn(), getById: vi.fn(), retryOctorateSync: vi.fn(), createPaymentLink: vi.fn() },
}));
vi.mock('@/api/connect.api', () => ({ ConnectApi: { getStatus: vi.fn() } }));
vi.mock('@/api/properties.api', () => ({
  propertiesApi: { getAll: vi.fn() },
}));
vi.mock('@/lib/utils', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/utils')>()), copyTextToClipboard: vi.fn() }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

let permissions = new Set<string>();
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permissions.has(permission) }),
}));

const property = { id: 'property-1', name: 'Casa Mare', city: 'Rimini', maxGuests: 6 } as Property;
const WAIT = { timeout: 5000 };
const ALL_PERMISSIONS = ['booking.read', 'booking.write', 'payment.read', 'payment.write'];
const LINK = 'https://example.test/book/casa/booking/booking-1?token=secret-token';
const NO_CHANNEL_MANAGER = '00000000-0000-0000-0000-000000000000';

function conflict(data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status: 409,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

const freeStay: StayAvailability = {
  propertyId: property.id,
  from: '2027-10-01',
  to: '2027-10-05',
  state: 'ok',
  invalidReason: null,
  nights: 4,
  minNights: null,
  conflicts: [],
  nearestFreeWindow: null,
  linkableBlockId: null,
};

const freeOnChannelManager: StayAvailability = { ...freeStay, channelManagerChecked: true };

function hostQuote(ageRules: boolean, status: DirectBookingQuote['touristTax']['status'] = 'Calculated'): DirectBookingQuote {
  return {
    propertyId: property.id,
    checkInDate: '2027-10-01',
    checkOutDate: '2027-10-05',
    nights: 4,
    nightlyRate: 100,
    lodgingTotal: 400,
    cleaningFee: 50,
    basePrice: 450,
    touristTax: {
      status,
      amount: status === 'Calculated' ? 24 : null,
      taxableNights: 4,
      ageRulesApply: ageRules,
      categories: [],
    },
    totalPrice: status === 'Calculated' ? 474 : 450,
    currency: 'EUR',
  } as DirectBookingQuote;
}

function renderPage(url = '/app/short-rent/bookings/new', options: { connector?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const flags = { ...DEFAULT_FEATURE_FLAGS, octorateConnector: options.connector ?? false };
  return {
    client,
    ...render(
      createElement(I18nextProvider, { i18n },
        createElement(QueryClientProvider, { client },
          createElement(FeatureFlagsContext.Provider, { value: { flags, isLoading: false } },
            createElement(MemoryRouter, { initialEntries: [url] },
              createElement(Routes, null,
                createElement(Route, { path: '/app/short-rent/bookings/new', element: createElement(BookingCreatePage) }),
                createElement(Route, { path: '/app/short-rent/bookings', element: createElement('p', null, 'bookings-list') }),
                createElement(Route, { path: '/app/short-rent/properties/:id', element: createElement('p', null, 'property-page') }),
              ))))),
    ),
  };
}

const next = () => fireEvent.click(screen.getByTestId('booking-wizard-next'));
const label = (key: string) => screen.getByLabelText(i18n.t(key));

async function fillStay() {
  const select = await screen.findByLabelText(i18n.t('booking.create.stay.property'), undefined, WAIT);
  await screen.findByRole('option', { name: 'Casa Mare · Rimini' }, WAIT);
  fireEvent.change(select, { target: { value: property.id } });
  fireEvent.change(label('booking.create.stay.checkIn'), { target: { value: '2027-10-01' } });
  fireEvent.change(label('booking.create.stay.checkOut'), { target: { value: '2027-10-05' } });
}

async function fillGuest() {
  const name = await screen.findByLabelText(i18n.t('booking.create.guest.name'), undefined, WAIT);
  fireEvent.change(name, { target: { value: 'Mario Rossi' } });
  fireEvent.change(label('booking.create.guest.email'), { target: { value: 'mario.rossi@example.com' } });
}

async function choosePayment(arrangement: 'paymentLink' | 'onSite' | 'bankTransfer' = 'onSite') {
  fireEvent.click(await screen.findByTestId(`booking-payment-${arrangement}`, undefined, WAIT));
}

async function reachPayment() {
  await fillStay();
  next();
  await fillGuest();
  next();
  await screen.findByTestId('booking-price-total', undefined, WAIT);
  next();
  await screen.findByTestId('booking-payment-step', undefined, WAIT);
}

async function reachSummary(arrangement: 'paymentLink' | 'onSite' | 'bankTransfer' = 'onSite') {
  await reachPayment();
  await choosePayment(arrangement);
  next();
  await screen.findByTestId('booking-summary-what-happens', undefined, WAIT);
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  freezeClock(NOON_UTC);
  permissions = new Set(ALL_PERMISSIONS);
  await i18n.changeLanguage('it');
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property]);
  vi.mocked(bookingsApi.quote).mockResolvedValue(hostQuote(false));
  vi.mocked(bookingsApi.availability).mockResolvedValue(freeStay);
  vi.mocked(ConnectApi.getStatus).mockResolvedValue({ connectedAccountId: 'acct_1', chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true, requirementsDue: [] });
  vi.mocked(copyTextToClipboard).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BookingCreatePage', { timeout: 20000 }, () => {
  it('shows the 409 on overlapping dates above the buttons and stays on the summary', async () => {
    vi.mocked(bookingsApi.createManual).mockRejectedValue(
      conflict({ status: 409, code: 'booking_dates_unavailable', detail: "L'immobile non è disponibile." }),
    );
    renderPage();

    await reachSummary();
    expect(screen.getByTestId('booking-summary-happens-casazen')).toHaveTextContent(i18n.t('booking.create.summary.willHappen.casazen'));
    fireEvent.click(screen.getByTestId('booking-create-button'));

    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.bookingDatesUnavailable'),
    );
    expect(bookingsApi.createManual).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: property.id,
      checkInDate: '2027-10-01',
      checkOutDate: '2027-10-05',
      adults: 2,
      children: 0,
      guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario.rossi@example.com' },
      paymentArrangement: 'onSite',
    }));
    expect(screen.queryByTestId('wizard-done-primary')).not.toBeInTheDocument();
  });

  it('confirms with what happens now and a link to the booking once it is created', async () => {
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Manual' } as ManualBooking);
    renderPage();

    await reachPayment();
    await choosePayment('bankTransfer');
    next();
    await screen.findByTestId('booking-summary-what-happens', undefined, WAIT);
    expect(screen.getByText(/474,00/)).toBeInTheDocument();
    expect(screen.getByText(i18n.t('booking.create.summary.paymentValue.bankTransfer'))).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('booking-create-button'));

    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toHaveAttribute('href', '/app/short-rent/bookings/booking-1');
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/short-rent/bookings');
    expect(screen.getByTestId('booking-done-booking')).toHaveAttribute('data-state', 'created');
    expect(bookingsApi.createManual).toHaveBeenCalledWith(expect.objectContaining({ paymentArrangement: 'bankTransfer' }));
    expect(screen.queryByTestId('booking-done-channel-manager')).not.toBeInTheDocument();
    expect(bookingsApi.getById).not.toHaveBeenCalled();
  });

  it('BookingCreatePage_RatesExemptMinorsByAge_AsksMinorsAndAgesAndSendsThem', async () => {
    vi.mocked(bookingsApi.quote).mockResolvedValue(hostQuote(true));
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Manual' } as ManualBooking);
    renderPage();

    await fillStay();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('qty.increase', { label: i18n.t('booking.create.stay.minors') }) }));
    const age = await screen.findByLabelText(i18n.t('touristTaxRules.childAgeLabel', { index: 1 }), undefined, WAIT);

    next();
    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(i18n.t('booking.form.childrenAgesMissing'));
    expect(screen.queryByLabelText(i18n.t('booking.create.guest.name'))).not.toBeInTheDocument();

    fireEvent.change(age, { target: { value: '8' } });
    next();
    await fillGuest();
    next();
    await screen.findByTestId('booking-price-total', undefined, WAIT);
    next();
    await choosePayment();
    next();
    await screen.findByTestId('booking-summary-what-happens', undefined, WAIT);
    fireEvent.click(screen.getByTestId('booking-create-button'));

    await waitFor(() => expect(bookingsApi.createManual).toHaveBeenCalledWith(expect.objectContaining({
      adults: 2,
      children: 1,
      childrenAges: [8],
    })), WAIT);
    expect(bookingsApi.quote).toHaveBeenCalledWith(expect.objectContaining({
      propertyId: property.id,
      numberOfGuests: 3,
      numberOfChildren: 1,
      childrenAges: [8],
    }));
  });

  it('BookingCreatePage_OpenedFromAProperty_PreselectsItAndCancelGoesBackToIt', async () => {
    renderPage(`/app/short-rent/bookings/new?propertyId=${property.id}`);

    await screen.findByRole('option', { name: 'Casa Mare · Rimini' }, WAIT);
    await waitFor(() => expect(label('booking.create.stay.property')).toHaveValue(property.id), WAIT);
    fireEvent.click(screen.getByTestId('wizard-exit'));

    expect(await screen.findByText('property-page', undefined, WAIT)).toBeInTheDocument();
    expect(bookingsApi.createManual).not.toHaveBeenCalled();
  });

  it('recovers the property list in place and selects the only property', async () => {
    vi.mocked(propertiesApi.getAll).mockRejectedValueOnce(new Error('boom')).mockResolvedValue([property]);
    renderPage();

    expect(await screen.findByTestId('booking-properties-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('booking.form.propertiesLoadError'),
    );
    expect(screen.queryByTestId('booking-properties-empty')).not.toBeInTheDocument();
    await waitFor(() => expect(label('booking.create.stay.property')).toBeDisabled(), WAIT);
    fireEvent.click(within(screen.getByTestId('booking-properties-error')).getByRole('button'));
    await waitFor(() => expect(label('booking.create.stay.property')).toHaveValue(property.id), WAIT);
    expect(screen.queryByTestId('booking-properties-error')).not.toBeInTheDocument();
  });
});

describe('the draft of the browser and the address', { timeout: 20000 }, () => {
  const DRAFT_KEY = 'casazen.wizardDraft:user-1:org-1:sr-new-booking';

  function keepDraft(values: Partial<NewBookingValues>, version = NEW_BOOKING_DRAFT_VERSION, step = 'stay') {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ step, version, savedAt: Date.now(), values: { ...emptyNewBooking(''), ...values } }),
    );
  }

  it('BookingCreatePage_DraftOfTheSamePropertyAsTheAddress_IsTakenUp', async () => {
    keepDraft({ propertyId: property.id, checkInDate: '2027-10-01', checkOutDate: '2027-10-05' });
    renderPage(`/app/short-rent/bookings/new?propertyId=${property.id}`);

    await screen.findByRole('option', { name: 'Casa Mare · Rimini' }, WAIT);
    await waitFor(() => expect(label('booking.create.stay.checkIn')).toHaveValue('2027-10-01'), WAIT);
    expect(label('booking.create.stay.property')).toHaveValue(property.id);
  });

  it('BookingCreatePage_DraftOfAnotherProperty_GivesWayToTheAddressAndItsAnswersAreNotTaken', async () => {
    keepDraft({ propertyId: 'property-2', checkInDate: '2027-10-01', checkOutDate: '2027-10-05' });
    renderPage(`/app/short-rent/bookings/new?propertyId=${property.id}`);

    await screen.findByRole('option', { name: 'Casa Mare · Rimini' }, WAIT);
    await waitFor(() => expect(label('booking.create.stay.property')).toHaveValue(property.id), WAIT);
    expect(label('booking.create.stay.checkIn')).toHaveValue('');
    expect(label('booking.create.stay.checkOut')).toHaveValue('');
  });

  it('BookingCreatePage_DraftOfTheThreeStepsOfBefore_IsNotReadBack', async () => {
    // Version 2 has no answer about how the guest pays: the draft is of another shape and is ignored, so that no payment answer is ever made up for the host.
    keepDraft({ propertyId: property.id, checkInDate: '2027-10-01', checkOutDate: '2027-10-05' }, 2);
    renderPage(`/app/short-rent/bookings/new?propertyId=${property.id}`);

    await screen.findByRole('option', { name: 'Casa Mare · Rimini' }, WAIT);
    await waitFor(() => expect(label('booking.create.stay.property')).toHaveValue(property.id), WAIT);
    expect(label('booking.create.stay.checkIn')).toHaveValue('');
  });

  const keepDraftOfTheSummary = () =>
    keepDraft(
      {
        propertyId: property.id,
        checkInDate: '2027-10-01',
        checkOutDate: '2027-10-05',
        guest: { name: 'Mario Rossi', email: '', phone: '' },
        paymentArrangement: 'onSite',
      },
      NEW_BOOKING_DRAFT_VERSION,
      'summary',
    );

  it('BookingCreatePage_DraftTakenUpAtTheSummary_ConnectorOn_SaysAsAConditionThatItIsCreatedInTheChannelManager', async () => {
    keepDraftOfTheSummary();
    renderPage(`/app/short-rent/bookings/new?propertyId=${property.id}&step=summary`, { connector: true });

    expect(await screen.findByTestId('booking-summary-happens-channelManagerMaybe', undefined, WAIT)).toHaveTextContent(
      i18n.t('booking.create.summary.willHappen.channelManagerMaybe'),
    );
  });

  it('BookingCreatePage_DraftTakenUpAtTheSummary_ConnectorOff_SaysNothingOfTheChannelManager', async () => {
    keepDraftOfTheSummary();
    renderPage(`/app/short-rent/bookings/new?propertyId=${property.id}&step=summary`);

    await screen.findByTestId('booking-summary-what-happens', undefined, WAIT);
    expect(screen.queryByTestId('booking-summary-happens-channelManagerMaybe')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-summary-happens-channelManager')).not.toBeInTheDocument();
  });
});

describe('the price step', { timeout: 20000 }, () => {
  it('BookingCreatePage_PriceStep_HasThePriceOfTheQuoteAndTheTotalTheHostMayAgreeWithItsNote', async () => {
    renderPage();

    await fillStay();
    next();
    await fillGuest();
    next();

    expect(await screen.findByTestId('booking-price-total', undefined, WAIT)).toHaveTextContent('474,00');
    expect(screen.getByTestId('booking-agreed-price')).toBeInTheDocument();
    expect(label('booking.create.price.note')).toBeInTheDocument();
  });

  it('BookingCreatePage_AgreedTotal_IsSentAndSaidOnTheSummaryAsAgreed', async () => {
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Manual' } as ManualBooking);
    renderPage();

    await fillStay();
    next();
    await fillGuest();
    next();
    await screen.findByTestId('booking-price-total', undefined, WAIT);
    fireEvent.change(label('booking.create.price.total'), { target: { value: '450' } });
    fireEvent.change(label('booking.create.price.note'), { target: { value: 'Sconto per amici' } });
    next();
    await choosePayment();
    next();
    await screen.findByTestId('booking-summary-what-happens', undefined, WAIT);

    expect(screen.getByText(new RegExp(`450,00.*${i18n.t('booking.create.summary.priceAgreed')}`))).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('booking-create-button'));

    await waitFor(() => expect(bookingsApi.createManual).toHaveBeenCalledWith(expect.objectContaining({ totalPrice: 450, priceNote: 'Sconto per amici' })), WAIT);
  });
});

describe('the payment step (NF-74)', { timeout: 20000 }, () => {
  it('BookingCreatePage_PaymentStep_NothingChosen_DoesNotMoveOnAndAsksForAChoice', async () => {
    renderPage();

    await reachPayment();
    // Three ways, none of them chosen: there is no default, because the choice decides money.
    for (const arrangement of ['paymentLink', 'onSite', 'bankTransfer']) {
      expect(screen.getByTestId(`booking-payment-${arrangement}`)).not.toBeChecked();
    }
    next();

    expect((await screen.findAllByText(i18n.t('booking.validation.paymentArrangement.required'), undefined, WAIT)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('booking-summary-what-happens')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-payment-step')).toBeInTheDocument();
  });

  it('BookingCreatePage_PaymentLink_AccountReady_IsOfferedAndSent', async () => {
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Manual', paymentLinkUrl: LINK } as ManualBooking);
    renderPage();

    await reachPayment();
    await waitFor(() => expect(screen.getByTestId('booking-payment-paymentLink')).toBeEnabled(), WAIT);
    await choosePayment('paymentLink');
    next();
    await screen.findByTestId('booking-summary-what-happens', undefined, WAIT);
    expect(screen.getByTestId('booking-summary-happens-payment')).toHaveTextContent(i18n.t('booking.create.summary.willHappen.paymentLink'));
    fireEvent.click(screen.getByTestId('booking-create-button'));

    expect(await screen.findByTestId('booking-done-payment', undefined, WAIT)).toHaveAttribute('data-state', 'linkSent');
    expect(bookingsApi.createManual).toHaveBeenCalledWith(expect.objectContaining({ paymentArrangement: 'paymentLink' }));
    fireEvent.click(screen.getByTestId('booking-done-payment-copy'));
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(LINK));
    expect(document.body.innerHTML).not.toContain('secret-token');
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('secret-token');
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain('secret-token');
  });

  it('BookingCreatePage_PaymentLink_StripeAccountNotReady_IsDisabledWithItsReasonAndNothingIsHidden', async () => {
    vi.mocked(ConnectApi.getStatus).mockResolvedValue({ connectedAccountId: null, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false, requirementsDue: [] });
    renderPage();

    await reachPayment();

    await waitFor(() => expect(screen.getByTestId('booking-payment-paymentLink')).toBeDisabled(), WAIT);
    expect(screen.getByText(i18n.t('booking.create.payment.reason.account'))).toBeInTheDocument();
    expect(screen.getByTestId('booking-payment-onSite')).toBeEnabled();
    expect(screen.getByTestId('booking-payment-bankTransfer')).toBeEnabled();
    expect(within(screen.getByTestId('booking-payment-step')).queryAllByRole('link')).toHaveLength(0);
  });

  it('BookingCreatePage_PaymentLink_AccountStillBeingVerified_IsNotReadyEither', async () => {
    vi.mocked(ConnectApi.getStatus).mockResolvedValue({ connectedAccountId: 'acct_1', chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: true, requirementsDue: ['x'] });
    renderPage();

    await reachPayment();

    await waitFor(() => expect(screen.getByTestId('booking-payment-paymentLink')).toBeDisabled(), WAIT);
  });

  it('BookingCreatePage_PaymentLink_CallerWithoutPaymentWrite_IsDisabledAndTheAccountIsNotEvenAsked', async () => {
    permissions = new Set(['booking.read', 'booking.write']);
    renderPage();

    await reachPayment();

    expect(screen.getByTestId('booking-payment-paymentLink')).toBeDisabled();
    expect(screen.getByText(i18n.t('booking.create.payment.reason.permission'))).toBeInTheDocument();
    expect(ConnectApi.getStatus).not.toHaveBeenCalled();
  });

  it('BookingCreatePage_PaymentLink_AccountThatCannotBeRead_IsOfferedAndTheApiHasTheLastWord', async () => {
    vi.mocked(ConnectApi.getStatus).mockRejectedValue(new Error('boom'));
    renderPage();

    await reachPayment();

    await waitFor(() => expect(ConnectApi.getStatus).toHaveBeenCalled());
    expect(screen.getByTestId('booking-payment-paymentLink')).toBeEnabled();
  });

  it('BookingCreatePage_PaymentLink_ChosenThenTotalOfZeroAgreed_IsRefusedWithItsReason', async () => {
    renderPage();

    await fillStay();
    next();
    await fillGuest();
    next();
    await screen.findByTestId('booking-price-total', undefined, WAIT);
    next();
    await choosePayment('paymentLink');
    fireEvent.click(screen.getByTestId('booking-wizard-back'));
    fireEvent.change(await screen.findByLabelText(i18n.t('booking.create.price.total'), undefined, WAIT), { target: { value: '0' } });
    next();
    await screen.findByTestId('booking-payment-step', undefined, WAIT);

    expect(screen.getByTestId('booking-payment-paymentLink')).toBeDisabled();
    next();
    expect((await screen.findAllByText(i18n.t('booking.create.payment.reason.nothingToPay'), undefined, WAIT)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('booking-summary-what-happens')).not.toBeInTheDocument();
  });

  it('BookingCreatePage_SummaryEdit_LinksGoBackToTheStepOfThePriceAndOfThePayment', async () => {
    renderPage();

    await reachSummary();

    const price = screen.getByRole('link', { name: i18n.t('wizard.summary.editField', { field: i18n.t('booking.create.summary.price') }) });
    const payment = screen.getByRole('link', { name: i18n.t('wizard.summary.editField', { field: i18n.t('booking.create.summary.payment') }) });
    expect(price.getAttribute('href')).toContain('step=price');
    expect(payment.getAttribute('href')).toContain('step=payment');
  });
});

describe('a reservation of a portal that the host completes', { timeout: 20000 }, () => {
  it('BookingCreatePage_PortalReservation_HasNoPaymentStepAndSendsNoWayOfPaying', async () => {
    const block: StayAvailability = {
      ...freeStay,
      state: 'linkableBlock',
      linkableBlockId: 'block-1',
      conflicts: [{ id: 'block-1', type: 'ical', title: 'Airbnb', channel: 'Airbnb', from: '2027-10-01', to: '2027-10-05' }],
    };
    vi.mocked(bookingsApi.availability).mockResolvedValue(block);
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'booking-1', status: 'Confirmed', source: 'Airbnb' } as ManualBooking);
    renderPage();

    await fillStay();
    fireEvent.click(await screen.findByTestId('booking-availability-link', undefined, WAIT));
    next();
    await fillGuest();
    next();
    expect(await screen.findByTestId('booking-portal-payment', undefined, WAIT)).toBeInTheDocument();
    next();
    await screen.findByTestId('booking-summary-what-happens', undefined, WAIT);
    expect(screen.queryByTestId('booking-payment-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-summary-happens-payment')).toHaveTextContent('Airbnb');
    fireEvent.click(screen.getByTestId('booking-create-button'));

    await waitFor(() => expect(bookingsApi.createManual).toHaveBeenCalledTimes(1), WAIT);
    const sent = vi.mocked(bookingsApi.createManual).mock.calls[0][0];
    expect(sent.blockId).toBe('block-1');
    expect(sent).not.toHaveProperty('paymentArrangement');
  });
});

describe('the channel manager at the stay step (NF-74, NF-80)', { timeout: 20000 }, () => {
  const takenOnChannelManager = (title: string | null): StayAvailability => ({
    ...freeStay,
    state: 'occupied',
    conflicts: [{ id: NO_CHANNEL_MANAGER, type: 'channelManager', title, channel: null, from: '2027-10-01', to: '2027-10-05' }],
    channelManagerChecked: true,
  });

  it('BookingCreatePage_ChannelManagerSaysTheDatesAreTaken_StopsTheStepWithAPlainExplanation', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue(takenOnChannelManager(null));
    renderPage();

    await fillStay();
    expect(await screen.findByTestId('booking-availability-channel-manager', undefined, WAIT)).toHaveTextContent(i18n.t('booking.create.availability.channelManagerBlocked'));
    next();

    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(i18n.t('booking.create.availability.channelManagerBlocked'));
    expect(screen.queryByLabelText(i18n.t('booking.create.guest.name'))).not.toBeInTheDocument();
  });

  it('BookingCreatePage_ChannelManagerNamesTheChannel_TheExplanationNamesItToo', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue(takenOnChannelManager('Booking.com'));
    renderPage();

    await fillStay();
    next();

    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('booking.create.availability.channelManagerBlockedNamed', { channel: 'Booking.com' }),
    );
  });

  it('BookingCreatePage_ChannelManagerAndCasaZenBothTakeTheDates_ListsEachAndStopsTheStep', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue({
      ...freeStay,
      state: 'occupied',
      conflicts: [
        { id: 'b-1', type: 'booking', title: 'Anna', channel: 'Direct', from: '2027-10-02', to: '2027-10-04' },
        { id: NO_CHANNEL_MANAGER, type: 'channelManager', title: null, channel: null, from: '2027-10-01', to: '2027-10-05' },
      ],
      channelManagerChecked: true,
    });
    renderPage();

    await fillStay();

    const notice = await screen.findByTestId('booking-availability', undefined, WAIT);
    expect(notice).toHaveTextContent('Anna');
    expect(notice.querySelectorAll('li')).toHaveLength(2);
    next();
    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toBeInTheDocument();
  });

  it('BookingCreatePage_ChannelManagerCouldNotBeAsked_SaysSoWithoutBlockingAndTheWizardGoesOn', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue({ ...freeStay, channelManagerChecked: false });
    renderPage();

    await fillStay();

    expect(await screen.findByTestId('booking-availability-unchecked', undefined, WAIT)).toHaveTextContent(i18n.t('booking.create.availability.channelManagerUnchecked'));
    expect(screen.getByTestId('booking-availability')).toHaveAttribute('data-state', 'ok');
    next();
    expect(await screen.findByLabelText(i18n.t('booking.create.guest.name'), undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('booking-submit-error')).not.toBeInTheDocument();
  });

  it('BookingCreatePage_ChannelManagerCouldNotBeAskedWhileCasaZenCalendarIsTaken_DoesNotSayTheHostCanGoOn', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue({
      ...freeStay,
      state: 'occupied',
      conflicts: [{ id: 'b-1', type: 'booking', title: 'Anna', channel: 'Direct', from: '2027-10-02', to: '2027-10-04' }],
      channelManagerChecked: false,
    });
    renderPage();

    await fillStay();

    expect(await screen.findByTestId('booking-availability', undefined, WAIT)).toHaveAttribute('data-state', 'occupied');
    expect(screen.queryByTestId('booking-availability-unchecked')).not.toBeInTheDocument();
    next();
    expect(await screen.findByTestId('booking-submit-error', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('booking.create.guest.name'))).not.toBeInTheDocument();
  });

  it('BookingCreatePage_ChannelManagerCouldNotBeAskedAndTheStayIsUnderTheMinimum_StillSaysTheHostCanGoOn', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue({ ...freeStay, state: 'belowMinimum', minNights: 7, channelManagerChecked: false });
    renderPage();

    await fillStay();

    expect(await screen.findByTestId('booking-availability-unchecked', undefined, WAIT)).toHaveTextContent(i18n.t('booking.create.availability.channelManagerUnchecked'));
    expect(screen.getByTestId('booking-availability')).toHaveAttribute('data-state', 'belowMinimum');
  });

  it('BookingCreatePage_PropertyNotConnected_SaysNothingOfTheChannelManager', async () => {
    renderPage();

    await fillStay();

    expect(await screen.findByTestId('booking-availability', undefined, WAIT)).toHaveAttribute('data-state', 'ok');
    expect(screen.queryByTestId('booking-availability-unchecked')).not.toBeInTheDocument();
  });

  it('BookingCreatePage_Summary_ConnectedProperty_SaysItIsCreatedInTheChannelManagerToo', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue(freeOnChannelManager);
    renderPage('/app/short-rent/bookings/new', { connector: true });

    await reachSummary();

    expect(screen.getByTestId('booking-summary-happens-channelManager')).toHaveTextContent(i18n.t('booking.create.summary.willHappen.channelManager'));
  });

  it('BookingCreatePage_Summary_ConnectedPropertyButConnectorOff_DoesNotMentionTheChannelManager', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue(freeOnChannelManager);
    renderPage();

    await reachSummary();

    expect(screen.queryByTestId('booking-summary-happens-channelManager')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-summary-happens-channelManagerMaybe')).not.toBeInTheDocument();
  });

  it('BookingCreatePage_Summary_PropertyNotConnected_DoesNotMentionTheChannelManager', async () => {
    renderPage();

    await reachSummary();

    expect(screen.queryByTestId('booking-summary-happens-channelManager')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-summary-happens-channelManagerMaybe')).not.toBeInTheDocument();
  });

  it('BookingCreatePage_ConnectedProperty_ResultFollowsTheChannelManagerAndDoesNotLeaveTheWizard', async () => {
    vi.mocked(bookingsApi.availability).mockResolvedValue(freeOnChannelManager);
    vi.mocked(bookingsApi.createManual).mockResolvedValue({ id: 'booking-1', propertyId: property.id, status: 'Confirmed', source: 'Manual' } as ManualBooking);
    vi.mocked(bookingsApi.getById).mockResolvedValue({ id: 'booking-1', octorateSync: { state: 'Synced', lastOperation: 'Create', lastSyncedAt: null, errorCode: null, canRetry: false } } as Booking);
    renderPage('/app/short-rent/bookings/new', { connector: true });

    await reachSummary();
    fireEvent.click(screen.getByTestId('booking-create-button'));

    const line = await screen.findByTestId('booking-done-channel-manager', undefined, WAIT);
    await waitFor(() => expect(line).toHaveAttribute('data-state', 'synced'), WAIT);
    expect(line).toHaveTextContent(i18n.t('booking.create.done.channelManager.synced'));
    expect(bookingsApi.getById).toHaveBeenCalledWith('booking-1');
    expect(screen.getByTestId('booking-wizard')).toHaveAttribute('data-step', 'fatto');
  });
});
