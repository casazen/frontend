import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { copyTextToClipboard } from '@/lib/utils';
import { bookingMirrorKey } from '@/queries/use-bookings';
import { expectNoAxeViolations } from '@/test/axe';
import type { Booking, BookingOctorateSync, BookingPaymentLink, ManualBooking } from '@/types';
import { emptyNewBooking, type NewBookingResult, type NewBookingValues } from '../../lib/new-booking-model';
import { NewBookingDone } from '../new-booking-done';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/bookings.api', () => ({
  asBookingPage: vi.fn(),
  bookingsApi: { getById: vi.fn(), retryOctorateSync: vi.fn(), createPaymentLink: vi.fn() },
}));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [{ id: 'property-1', name: 'Casa Mare' }] }) }));
vi.mock('@/lib/utils', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/utils')>()), copyTextToClipboard: vi.fn() }));

let permissions = new Set<string>();
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permissions.has(permission) }),
}));

const LINK = 'https://example.test/book/casa/booking/booking-1?token=secret-token';
const NEW_LINK = 'https://example.test/book/casa/booking/booking-1?token=second-token';
const ALL_PERMISSIONS = ['booking.read', 'booking.write', 'payment.read', 'payment.write'];

function sync(changes: Partial<BookingOctorateSync> = {}): BookingOctorateSync {
  return { state: 'Synced', lastOperation: 'Create', lastSyncedAt: null, errorCode: null, canRetry: false, ...changes };
}

/** `GET /bookings/:id`, the only answer that carries the mirror on the channel manager. */
function detail(mirror: Partial<BookingOctorateSync> | null): Booking {
  return { id: 'booking-1', propertyId: 'property-1', octorateSync: mirror === null ? null : sync(mirror) } as Booking;
}

function http(status: number, data: unknown = {}): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function values(changes: Partial<NewBookingValues> = {}): NewBookingValues {
  return {
    ...emptyNewBooking('property-1'),
    checkInDate: '2027-10-01',
    checkOutDate: '2027-10-05',
    guest: { name: 'Mario Rossi', email: 'mario.rossi@example.com', phone: '' },
    paymentArrangement: 'onSite',
    ...changes,
  };
}

function renderDone(options: {
  channelManager?: boolean | null;
  booking?: Partial<ManualBooking>;
  values?: Partial<NewBookingValues>;
  connector?: boolean;
  client?: QueryClient;
} = {}) {
  const client = options.client ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const result: NewBookingResult = {
    booking: { id: 'booking-1', propertyId: 'property-1', status: 'Confirmed', ...options.booking } as ManualBooking,
    channelManager: options.channelManager === undefined ? false : options.channelManager,
  };
  const flags = { ...DEFAULT_FEATURE_FLAGS, octorateConnector: options.connector ?? true };
  return {
    client,
    ...render(
      createElement(I18nextProvider, { i18n },
        createElement(QueryClientProvider, { client },
          createElement(FeatureFlagsContext.Provider, { value: { flags, isLoading: false } },
            createElement(MemoryRouter, null, createElement(NewBookingDone, { result, values: values(options.values) }))))),
    ),
  };
}

const line = () => screen.getByTestId('booking-done-channel-manager');
const queryLine = () => screen.queryByTestId('booking-done-channel-manager');
const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

beforeEach(async () => {
  vi.clearAllMocks();
  permissions = new Set(ALL_PERMISSIONS);
  await i18n.changeLanguage('it');
});

describe('the result of the new booking, one line for each part', () => {
  it('NewBookingDone_PropertyNotConnected_HasTheBookingAndNoLineOfTheChannelManager', () => {
    renderDone({ channelManager: false });

    expect(screen.getByTestId('booking-done-booking')).toHaveAttribute('data-state', 'created');
    expect(queryLine()).not.toBeInTheDocument();
    // Nothing is asked about a connection that is not there.
    expect(bookingsApi.getById).not.toHaveBeenCalled();
  });

  it('NewBookingDone_ConnectorOff_NothingChanges_NoLineAndNoRead', () => {
    renderDone({ channelManager: true, connector: false });

    expect(queryLine()).not.toBeInTheDocument();
    expect(bookingsApi.getById).not.toHaveBeenCalled();
  });

  it('NewBookingDone_CallerWhoMayNotReadTheBooking_AsksNothing', () => {
    // A read they may not make would send them to the page of no access.
    permissions = new Set(['booking.write']);
    renderDone({ channelManager: true });

    expect(bookingsApi.getById).not.toHaveBeenCalled();
    expect(queryLine()).not.toBeInTheDocument();
  });

  it('NewBookingDone_MirroredProperty_IsBeingSentFromTheFirstMomentEvenBeforeTheFirstReadAnswers', () => {
    vi.mocked(bookingsApi.getById).mockReturnValue(new Promise(() => undefined));
    renderDone({ channelManager: true });

    expect(line()).toHaveAttribute('data-state', 'pending');
    expect(line()).toHaveTextContent(text('booking.create.done.channelManager.pending'));
  });

  it('NewBookingDone_MirroredPropertyAnswersSynced_SaysTheDatesAreClosedOnEveryChannel', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Synced' }));
    renderDone({ channelManager: true });

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'synced'));
    expect(line()).toHaveTextContent(text('booking.create.done.channelManager.synced'));
    expect(screen.queryByTestId('booking-done-channel-manager-retry')).not.toBeInTheDocument();
  });

  it('NewBookingDone_PropertyOfWhichNothingIsKnown_SaysNothingWhileTheBookingHasNoMirror', async () => {
    // A draft taken up at the summary: the wizard never checked the availability of this stay, so it asks the booking (and goes on asking, see below) and says only what is there.
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(null));
    renderDone({ channelManager: null });

    await waitFor(() => expect(bookingsApi.getById).toHaveBeenCalled());
    expect(queryLine()).not.toBeInTheDocument();
  });

  it('NewBookingDone_MirrorFoundWhenNothingWasKnown_IsShown', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Synced' }));
    renderDone({ channelManager: null });

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'synced'));
  });
});

describe('the line of the channel manager changes by itself', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // The time passes; then, one `act` after the other, the notifications the reads queued at its end are flushed: the client tells the screen with a timer of 0,
  // which the fake clock makes 1 ms while it is ticking, and React shows what changed when the `act` that holds the notification is left.
  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
  };

  it('NewBookingDone_BeingSent_TurnsIntoItsOutcomeWithoutAReload', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValueOnce(detail({ state: 'Pending' })).mockResolvedValue(detail({ state: 'Synced' }));
    renderDone({ channelManager: true });

    await advance(0);
    expect(line()).toHaveAttribute('data-state', 'pending');

    await advance(3_000);
    expect(line()).toHaveAttribute('data-state', 'synced');
    expect(bookingsApi.getById).toHaveBeenCalledTimes(2);

    // Settled: it stops asking.
    await advance(30_000);
    expect(bookingsApi.getById).toHaveBeenCalledTimes(2);
  });

  it('NewBookingDone_PropertyOfWhichNothingIsKnown_ShowsTheLineWhenTheRowComesAfterTheFirstRead', async () => {
    // The push writes its row a moment after the booking, so the first read finds none; nothing says the property is connected (a draft taken up at the summary).
    // A failure of the channel manager that comes after it must still be shown: the result keeps asking while the time it waits is not over.
    vi.mocked(bookingsApi.getById)
      .mockResolvedValueOnce(detail(null))
      .mockResolvedValue(detail({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true }));
    renderDone({ channelManager: null });

    await advance(0);
    expect(queryLine()).not.toBeInTheDocument();
    expect(bookingsApi.getById).toHaveBeenCalledTimes(1);

    await advance(3_000);
    expect(line()).toHaveAttribute('data-state', 'failed');
    expect(screen.getByTestId('booking-done-channel-manager-retry')).toBeInTheDocument();
  });

  it('NewBookingDone_PropertyOfWhichNothingIsKnownAndNoRowEver_SaysNothingAndStopsAskingWhenTheTimeIsOver', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(null));
    renderDone({ channelManager: null });

    await advance(95_000);
    expect(queryLine()).not.toBeInTheDocument();
    const reads = vi.mocked(bookingsApi.getById).mock.calls.length;
    expect(reads).toBeGreaterThan(1);

    await advance(30_000);
    expect(queryLine()).not.toBeInTheDocument();
    expect(bookingsApi.getById).toHaveBeenCalledTimes(reads);
  });

  it('NewBookingDone_PropertyNotConnected_NeverAsksTheBooking', async () => {
    renderDone({ channelManager: false });

    await advance(30_000);
    expect(bookingsApi.getById).not.toHaveBeenCalled();
  });

  it('NewBookingDone_NoAnswerInTheTimeItWaits_IsNotACompletedStateAndOffersToCheckAgain', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(null));
    renderDone({ channelManager: true });

    await advance(0);
    expect(line()).toHaveAttribute('data-state', 'pending');

    await advance(95_000);
    expect(line()).toHaveAttribute('data-state', 'waiting');
    expect(line()).toHaveTextContent(text('booking.create.done.channelManager.waiting'));
    expect(screen.getByTestId('booking-done-channel-manager-refresh')).toBeInTheDocument();

    const reads = vi.mocked(bookingsApi.getById).mock.calls.length;
    await advance(30_000);
    expect(bookingsApi.getById).toHaveBeenCalledTimes(reads);
  });

  it('NewBookingDone_StillBeingSentAfterTheTimeItWaits_StopsClaimingItAndFollowsAgainWhenAskedToCheck', async () => {
    // The server keeps saying "being sent": after a minute and a half the result stops asking and says no answer has come; «Check again» reads at once and
    // follows it for the time it waits once more, so the outcome is shown without a second press.
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Pending' }));
    renderDone({ channelManager: true });

    await advance(0);
    expect(line()).toHaveAttribute('data-state', 'pending');
    await advance(95_000);
    expect(line()).toHaveAttribute('data-state', 'waiting');

    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Synced' }));
    const reads = vi.mocked(bookingsApi.getById).mock.calls.length;
    fireEvent.click(screen.getByTestId('booking-done-channel-manager-refresh'));
    await advance(0);

    expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBeGreaterThan(reads);
    expect(line()).toHaveAttribute('data-state', 'synced');
  });

  it('NewBookingDone_CheckAgainThatStillFindsNoAnswer_GoesBackToBeingSentAndFollowsItAgain', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(null));
    renderDone({ channelManager: true });
    await advance(95_000);
    expect(line()).toHaveAttribute('data-state', 'waiting');

    fireEvent.click(screen.getByTestId('booking-done-channel-manager-refresh'));
    await advance(0);
    expect(line()).toHaveAttribute('data-state', 'pending');

    // It asks again by itself from then on, and says no answer has come once more when the time is over.
    const reads = vi.mocked(bookingsApi.getById).mock.calls.length;
    await advance(6_000);
    expect(vi.mocked(bookingsApi.getById).mock.calls.length).toBeGreaterThan(reads);
    await advance(95_000);
    expect(line()).toHaveAttribute('data-state', 'waiting');
  });
});

describe('«Retry» of the channel manager', () => {
  const failed = { state: 'Failed', errorCode: 'octorate_dates_unavailable', canRetry: true } as const;

  it('NewBookingDone_Failed_SaysItIsNotDoneWithItsReasonAndOffersRetry', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(failed));
    renderDone({ channelManager: true });

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'failed'));
    expect(line()).toHaveAttribute('data-tone', 'problem');
    expect(line()).toHaveTextContent(text('booking.create.done.channelManager.failed'));
    expect(screen.getByTestId('booking-done-channel-manager-reason')).toHaveTextContent(text('booking.create.done.channelManager.reasons.datesUnavailable'));
    expect(screen.getByTestId('booking-done-channel-manager-retry')).toBeEnabled();
    // The reason is in plain words: never a code, never the name of the supplier.
    expect(line()).not.toHaveTextContent(/octorate/i);
  });

  it('NewBookingDone_Conflict_IsNotDoneEitherAndKeepsItsRetry', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Conflict', errorCode: 'octorate_reservation_changed', canRetry: true }));
    renderDone({ channelManager: true });

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'conflict'));
    expect(line()).toHaveTextContent(text('booking.create.done.channelManager.conflict'));
    expect(screen.getByTestId('booking-done-channel-manager-retry')).toBeInTheDocument();
  });

  it('NewBookingDone_FailedForACallerWhoMayNotWriteTheBooking_HasNoRetry', async () => {
    // `canRetry` is the API's, narrowed by what the caller may do: the button is not for them.
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ ...failed, canRetry: false }));
    renderDone({ channelManager: true });

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'failed'));
    expect(screen.queryByTestId('booking-done-channel-manager-retry')).not.toBeInTheDocument();
  });

  it('NewBookingDone_RetryPressed_AsksTheApiAndSaysBeingSentInsteadOfTheOldFailure', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(failed));
    vi.mocked(bookingsApi.retryOctorateSync).mockResolvedValue({ bookingId: 'booking-1', state: 'Pending' });
    renderDone({ channelManager: true });
    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'failed'));

    fireEvent.click(screen.getByTestId('booking-done-channel-manager-retry'));

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'pending'));
    expect(bookingsApi.retryOctorateSync).toHaveBeenCalledWith('booking-1', undefined);
    // The booking is read again, and the row still holds the failure until the push starts: the line does not go back to it.
    await waitFor(() => expect(bookingsApi.getById).toHaveBeenCalledTimes(2));
    expect(line()).toHaveAttribute('data-state', 'pending');
    expect(screen.queryByTestId('booking-done-channel-manager-retry')).not.toBeInTheDocument();
  });

  it('NewBookingDone_RetryRefusedBecauseThereIsNothingToRetry_ShowsTheReasonOfTheApiAndTheCurrentState', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(failed));
    vi.mocked(bookingsApi.retryOctorateSync).mockRejectedValue(http(409, { status: 409, code: 'octorate_sync_not_retryable' }));
    renderDone({ channelManager: true });
    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'failed'));

    fireEvent.click(screen.getByTestId('booking-done-channel-manager-retry'));

    expect(await screen.findByTestId('booking-done-channel-manager-error')).toHaveTextContent(text('apiErrors.codes.octorateSyncNotRetryable'));
    expect(line()).toHaveAttribute('data-state', 'failed');
  });

  it('NewBookingDone_RequestOfTheCardInFlight_DisablesEveryButtonOfTheCard', async () => {
    // A second press would not be a second try: it would be a second link, or a second push.
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(failed));
    vi.mocked(bookingsApi.retryOctorateSync).mockReturnValue(new Promise(() => undefined));
    renderDone({ channelManager: true, booking: { paymentLinkUrl: LINK }, values: { paymentArrangement: 'paymentLink' } });
    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'failed'));

    fireEvent.click(screen.getByTestId('booking-done-channel-manager-retry'));

    await waitFor(() => expect(screen.getByTestId('booking-done-payment-send')).toBeDisabled());
    expect(screen.getByTestId('booking-done-payment-copy')).toBeDisabled();
    // The retry button is still on screen while its own request is on its way, and cannot be pressed again.
    expect(vi.mocked(bookingsApi.retryOctorateSync)).toHaveBeenCalledTimes(1);
  });

  it('NewBookingDone_PaymentLinkRequestInFlight_DisablesRetryToo', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(failed));
    vi.mocked(bookingsApi.createPaymentLink).mockReturnValue(new Promise(() => undefined));
    renderDone({ channelManager: true, booking: { paymentLinkUrl: LINK }, values: { paymentArrangement: 'paymentLink' } });
    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'failed'));

    fireEvent.click(screen.getByTestId('booking-done-payment-send'));

    await waitFor(() => expect(screen.getByTestId('booking-done-channel-manager-retry')).toBeDisabled());
    expect(screen.getByTestId('booking-done-payment-copy')).toBeDisabled();
  });
});

describe('what is left of the channel manager when it cannot be read', () => {
  it('NewBookingDone_BookingNotFound_IsNotFoundEvenWithItsStateStillInTheCache', async () => {
    // A query keeps its old data when a later read fails: a 404 must not show the state the booking used to have.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData(bookingMirrorKey('booking-1'), { octorateSync: sync({ state: 'Synced' }) });
    vi.mocked(bookingsApi.getById).mockRejectedValue(http(404, { status: 404 }));
    renderDone({ channelManager: true, client });

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'notFound'));
    expect(line()).toHaveTextContent(text('booking.create.done.channelManager.notFound'));
    expect(line()).not.toHaveTextContent(text('booking.create.done.channelManager.synced'));
  });

  it('NewBookingDone_ReadThatFailsAndNoMirrorYet_SaysItCannotReadAndAsksAgainOnRequest', async () => {
    vi.mocked(bookingsApi.getById).mockRejectedValueOnce(http(500)).mockResolvedValue(detail({ state: 'Synced' }));
    renderDone({ channelManager: true });

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'unreadable'));
    fireEvent.click(screen.getByTestId('booking-done-channel-manager-refresh'));

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'synced'));
  });
});

describe('the payment link', () => {
  beforeEach(() => {
    vi.mocked(copyTextToClipboard).mockResolvedValue(undefined);
  });

  const withLink = { booking: { paymentLinkUrl: LINK }, values: { paymentArrangement: 'paymentLink' } } as const;

  it('NewBookingDone_LinkSent_SaysSoAndTheLinkItselfIsNotPrintedOnTheScreen', () => {
    renderDone(withLink);

    const payment = screen.getByTestId('booking-done-payment');
    expect(payment).toHaveAttribute('data-state', 'linkSent');
    expect(payment).toHaveTextContent(text('booking.create.done.paymentLink.sent'));
    // A credential: it is copied, never shown.
    expect(document.body).not.toHaveTextContent('secret-token');
    expect(document.body.innerHTML).not.toContain('secret-token');
  });

  it('NewBookingDone_CopyLink_CopiesTheLinkOfTheCreationAnswer', async () => {
    renderDone(withLink);

    fireEvent.click(screen.getByTestId('booking-done-payment-copy'));

    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(LINK));
    expect(await screen.findByTestId('booking-done-payment-copy')).toHaveTextContent(text('booking.create.done.paymentLink.copied'));
  });

  it('NewBookingDone_BrowserWillNotCopy_ShowsTheLinkInAFieldToCopyByHand', async () => {
    vi.mocked(copyTextToClipboard).mockRejectedValue(new Error('denied'));
    renderDone(withLink);

    fireEvent.click(screen.getByTestId('booking-done-payment-copy'));

    expect(await screen.findByTestId('booking-done-payment-field')).toHaveValue(LINK);
    expect(screen.getByTestId('booking-done-payment-fallback')).toHaveTextContent(text('booking.create.done.paymentLink.copyFailed'));
  });

  it('NewBookingDone_SendAgain_ReplacesTheLinkAndCopiesTheNewOne', async () => {
    vi.mocked(bookingsApi.createPaymentLink).mockResolvedValue({ bookingId: 'booking-1', paymentLinkUrl: NEW_LINK, emailSent: true } as BookingPaymentLink);
    renderDone(withLink);

    fireEvent.click(screen.getByTestId('booking-done-payment-send'));

    await waitFor(() => expect(bookingsApi.createPaymentLink).toHaveBeenCalledWith('booking-1'));
    await waitFor(() => expect(screen.getByTestId('booking-done-payment-send')).toBeEnabled());
    fireEvent.click(screen.getByTestId('booking-done-payment-copy'));
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(NEW_LINK));
  });

  it('NewBookingDone_NewLinkWhoseEmailDidNotGoOut_IsNotSaidToBeSent', async () => {
    vi.mocked(bookingsApi.createPaymentLink).mockResolvedValue({ bookingId: 'booking-1', paymentLinkUrl: NEW_LINK, emailSent: false } as BookingPaymentLink);
    renderDone(withLink);

    fireEvent.click(screen.getByTestId('booking-done-payment-send'));

    await waitFor(() => expect(screen.getByTestId('booking-done-payment')).toHaveAttribute('data-state', 'linkNotEmailed'));
    expect(screen.getByTestId('booking-done-payment')).toHaveAttribute('data-tone', 'problem');
    expect(screen.getByTestId('booking-done-payment')).toHaveTextContent(text('booking.create.done.paymentLink.notEmailed'));
  });

  it('NewBookingDone_LinkNotMade_IsAProblemWithTheReasonOfTheApiAndAWayToSendIt', async () => {
    vi.mocked(bookingsApi.createPaymentLink).mockResolvedValue({ bookingId: 'booking-1', paymentLinkUrl: NEW_LINK, emailSent: true } as BookingPaymentLink);
    renderDone({ booking: { paymentLinkUrl: null, paymentLinkError: 'payment_provider_error' }, values: { paymentArrangement: 'paymentLink' } });

    const payment = screen.getByTestId('booking-done-payment');
    expect(payment).toHaveAttribute('data-state', 'linkMissing');
    expect(payment).toHaveAttribute('data-tone', 'problem');
    expect(screen.getByTestId('booking-done-payment-reason')).toHaveTextContent(text('apiErrors.codes.paymentProviderError'));

    fireEvent.click(screen.getByTestId('booking-done-payment-send'));

    await waitFor(() => expect(screen.getByTestId('booking-done-payment')).toHaveAttribute('data-state', 'linkSent'));
  });

  it('NewBookingDone_SendRefusedByTheApi_ShowsItsReasonNextToTheLink', async () => {
    vi.mocked(bookingsApi.createPaymentLink).mockRejectedValue(http(422, { status: 422, code: 'payment_link_unavailable' }));
    renderDone(withLink);

    fireEvent.click(screen.getByTestId('booking-done-payment-send'));

    expect(await screen.findByTestId('booking-done-payment-error')).toHaveTextContent(text('apiErrors.codes.paymentLinkUnavailable'));
    expect(screen.getByTestId('booking-done-payment')).toHaveAttribute('data-state', 'linkSent');
  });

  it('NewBookingDone_CallerWithoutPaymentWrite_CannotSendTheLinkAgain', () => {
    permissions = new Set(['booking.read', 'booking.write']);
    renderDone(withLink);

    expect(screen.queryByTestId('booking-done-payment-send')).not.toBeInTheDocument();
  });
});

describe('accessibility of the result (UI-07)', () => {
  it('NewBookingDone_EveryLineAtOnce_HasNoViolationAxeCanFind', async () => {
    // The worst case on one screen: the channel manager failed (with its button), the link is there (copy, send again) and the copy fallback is open.
    vi.mocked(copyTextToClipboard).mockRejectedValue(new Error('denied'));
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true }));
    const { container } = renderDone({ channelManager: true, booking: { paymentLinkUrl: LINK }, values: { paymentArrangement: 'paymentLink' } });
    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'failed'));
    fireEvent.click(screen.getByTestId('booking-done-payment-copy'));
    await screen.findByTestId('booking-done-payment-field');

    await expectNoAxeViolations(container);
  });
});

describe('the way of paying done by hand, and the one next step', () => {
  it.each([
    ['onSite', 'booking.create.done.paymentOnSite'],
    ['bankTransfer', 'booking.create.done.paymentBankTransfer'],
  ] as const)('NewBookingDone_%s_SaysTheHostRecordsTheIncomeAndSuggestsIt', (arrangement, key) => {
    renderDone({ values: { paymentArrangement: arrangement } });

    expect(screen.getByTestId('booking-done-payment')).toHaveAttribute('data-state', arrangement);
    expect(screen.getByTestId('booking-done-payment')).toHaveTextContent(text(key));
    expect(screen.getByText(text('booking.create.done.next.recordIncome'))).toBeInTheDocument();
    // No link, no button to send one: nothing was started.
    expect(screen.queryByTestId('booking-done-payment-copy')).not.toBeInTheDocument();
  });

  it('NewBookingDone_PortalReservation_SaysThePortalCollectsAndHasNoChannelManagerLine', () => {
    renderDone({
      values: {
        paymentArrangement: '',
        linkedBlock: { blockId: 'block-1', channel: 'Airbnb', propertyId: 'property-1', checkInDate: '2027-10-01', checkOutDate: '2027-10-05' },
      },
    });

    expect(screen.getByTestId('booking-done-payment')).toHaveTextContent(text('booking.create.done.paymentPortal', { portal: 'Airbnb' }));
    expect(queryLine()).not.toBeInTheDocument();
  });

  it('NewBookingDone_ChannelManagerFailed_TheNextStepIsToRetryItBeforeAnythingElse', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true }));
    renderDone({ channelManager: true });

    await waitFor(() => expect(line()).toHaveAttribute('data-state', 'failed'));
    expect(screen.getByText(text('booking.create.done.next.retryChannelManager'))).toBeInTheDocument();
  });

  it('NewBookingDone_EverythingDone_TheNextStepIsTheCheckInOfTheGuest', () => {
    renderDone({ booking: { paymentLinkUrl: LINK }, values: { paymentArrangement: 'paymentLink' } });

    expect(screen.getByText(text('booking.create.done.checkin', { name: 'Mario' }))).toBeInTheDocument();
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', '/app/short-rent/bookings/booking-1');
  });
});
