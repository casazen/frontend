import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { alloggiatiApi } from '@/api/alloggiati.api';
import type {
  AlloggiatiChannelManagerDto,
  AlloggiatiChannelManagerGuestDto,
  AlloggiatiRetryResultDto,
  AlloggiatiStatusDto,
  AlloggiatiWebStatus,
} from '@/types/alloggiati.types';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import { guestErrorKey, placeFieldsOf, retryOutcomeOf, stayChannelViewOf } from '../alloggiati-channel-manager';
import { AlloggiatiBookingPanel } from '../components/alloggiati-booking-panel';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/alloggiati.api', () => ({ alloggiatiApi: { getStatus: vi.fn(), retryOctorateWrite: vi.fn(), markSentManually: vi.fn() } }));
vi.mock('../components/alloggiati-guest-summary', () => ({ AlloggiatiGuestSummary: () => null }));
vi.mock('@/features/compliance/components/checkout-guest-data-subflow', () => ({
  CheckoutGuestDataSubflow: ({ open, description }: { open: boolean; description?: string }) =>
    open ? createElement('div', { 'data-testid': 'guests-layer' }, description) : null,
}));

const workspace = vi.hoisted(() => ({ granted: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => context === 'short-rent' && workspace.granted.includes(permission) }),
}));

const BOOKING_ID = 'b0c1d2e3-0000-4000-8000-000000000001';
const WAIT = { timeout: 5000 };

function guest(position: number, overrides: Partial<AlloggiatiChannelManagerGuestDto> = {}): AlloggiatiChannelManagerGuestDto {
  return { position, state: 'Sent', sentAsDraft: false, errorCode: null, errorFields: null, attempts: 1, lastAttemptAt: '2026-11-15T09:30:00Z', ...overrides };
}

function block(overrides: Partial<AlloggiatiChannelManagerDto> = {}): AlloggiatiChannelManagerDto {
  return {
    sender: 'ChannelManager',
    state: 'Entrusted',
    guests: [guest(0)],
    receiptCoverage: { archived: false, source: null, archivedAt: null },
    light: 'Yellow',
    reason: 'entrusted_to_channel_manager',
    actions: [],
    ...overrides,
  };
}

function statusOf(status: AlloggiatiWebStatus, channelManager: AlloggiatiChannelManagerDto | null, overrides: Partial<AlloggiatiStatusDto> = {}): AlloggiatiStatusDto {
  return {
    bookingId: BOOKING_ID,
    status,
    confirmationNumber: null,
    errorCode: null,
    reportedAt: null,
    deadlineAt: '2026-11-16T08:00:00Z',
    isShortStay: false,
    hoursUntilDeadline: 20,
    isOverdue: false,
    dataComplete: true,
    channelManager,
    ...overrides,
  };
}

function failedStatus(guests: AlloggiatiChannelManagerGuestDto[], actions: string[] = ['RetryOctorateWrite']): AlloggiatiStatusDto {
  return statusOf('ChannelManagerWriteFailed', block({ state: 'Failed', guests, light: 'Red', reason: 'alloggiati_failed', actions }));
}

const PLACE = guest(1, { state: 'Failed', errorCode: 'place_not_recognized', errorFields: 'birthComune,residenceComune', attempts: 1 });
const DOWN = guest(2, { state: 'Failed', errorCode: 'octorate_server', attempts: 3 });

function problem(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function renderPanel(
  status: AlloggiatiStatusDto | Error,
  client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
) {
  if (status instanceof Error) vi.mocked(alloggiatiApi.getStatus).mockRejectedValue(status);
  else vi.mocked(alloggiatiApi.getStatus).mockResolvedValue(status);
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(AlloggiatiBookingPanel, { bookingId: BOOKING_ID, checkInDate: '2026-11-15T00:00:00Z' })),
    ),
  );
}

const CHECK_IN_PATH = `/app/short-rent/bookings/${BOOKING_ID}/check-in`;

const badge = () => screen.findByTestId('alloggiati-status-badge', undefined, WAIT);

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

beforeEach(() => {
  vi.clearAllMocks();
  workspace.granted = ['booking.read', 'booking.write', 'guest.read', 'alloggiati.submit'];
});

afterEach(cleanup);

describe('AlloggiatiBookingPanel: a stay entrusted to the channel manager', () => {
  it('panel_EntrustedWithoutReceipt_IsYellowAndWaitingForTheReceiptNeverGreenAndNeverAManualSend', async () => {
    renderPanel(statusOf('EntrustedToChannelManager', block()));

    const label = await badge();
    expect(label).toHaveTextContent('Affidato al channel manager, in attesa della ricevuta');
    expect(label.className).not.toMatch(/green|success/);
    expect(label.className).toMatch(/yellow|warning/);
    expect(screen.getByTestId('alloggiati-entrusted-notice')).toHaveTextContent('solo quando la ricevuta è archiviata');
    expect(screen.queryByTestId('alloggiati-resend-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-manual-notice')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-alloggiati-deadline')).toBeInTheDocument();
  });

  it('panel_ReceiptArchived_IsGreenWithItsDateAndIsNotLateWhateverTheTermSays', async () => {
    const archived = block({ receiptCoverage: { archived: true, source: 'manual_upload', archivedAt: '2026-11-14T10:00:00Z' }, light: 'Green', reason: 'receipt_archived' });
    renderPanel(statusOf('EntrustedToChannelManager', archived, { isOverdue: true }));

    const label = await badge();
    expect(label).toHaveTextContent('Ricevuta archiviata');
    expect(label.className).toMatch(/green|success/);
    expect(screen.getByTestId('alloggiati-receipt-archived-notice')).toHaveTextContent('14 novembre 2026');
    expect(screen.queryByTestId('alloggiati-overdue-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-alloggiati-deadline')).not.toBeInTheDocument();
  });

  it.each(['DaInviare', 'DaInviareManualmente', 'InviatoManualmente'] as const)('manual receipt covers %s without another send action', async (status) => {
    renderPanel(statusOf(status, block({ sender: 'Manual', state: 'NotApplicable', guests: [], light: 'Green', reason: 'receipt_archived', receiptCoverage: { archived: true, source: 'manual_upload', archivedAt: '2026-11-14T12:00:00Z' } }), { isOverdue: true }));
    expect(await badge()).toHaveTextContent('Ricevuta archiviata');
    expect(screen.queryByText(i18n.t('alloggiati.waitingArrivalNotice'))).not.toBeInTheDocument();
    expect(screen.queryByText(i18n.t('alloggiati.declaredNotice'))).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-resend-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-manual-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-alloggiati-deadline')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-overdue-badge')).not.toBeInTheDocument();
  });

  // The brief and the dictionary of the states give the receipt that is missing no tone of its own: it has the one a red line has in the product (warning, danger once the term passed).
  it('panel_EntrustedAndTheServerSaysRed_IsToldAsAReceiptNotInTheArchiveInTheDangerToneOnceTheTermHasPassed', async () => {
    renderPanel(statusOf('EntrustedToChannelManager', block({ light: 'Red', reason: 'receipt_missing' }), { isOverdue: true }));

    const notice = await screen.findByTestId('alloggiati-receipt-missing', undefined, WAIT);
    expect(notice).toHaveTextContent('la ricevuta non è ancora in archivio');
    expect(notice).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('alloggiati-entrusted-notice')).not.toBeInTheDocument();
    expect((await badge()).className).not.toMatch(/green|success/);
    expect(screen.getByTestId('alloggiati-overdue-badge')).toBeInTheDocument();
  });

  it('panel_EntrustedAndTheServerSaysRedBeforeTheTermHasPassed_IsTheWarningToneNotTheDangerOne', async () => {
    renderPanel(statusOf('EntrustedToChannelManager', block({ light: 'Red', reason: 'receipt_missing' }), { isOverdue: false }));

    const notice = await screen.findByTestId('alloggiati-receipt-missing', undefined, WAIT);
    expect(notice).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('alloggiati-overdue-badge')).not.toBeInTheDocument();
  });

  it('panel_StayNotOnTheChannelManager_ReadsAsItAlwaysDidWhateverTheBlockHolds', async () => {
    renderPanel(statusOf('DaInviareManualmente', block({ sender: 'Manual', state: 'NotApplicable', guests: [], light: 'Red', reason: 'alloggiati_not_sent' })));

    expect(await badge()).toHaveTextContent('Da inviare manualmente');
    expect(screen.getByTestId('alloggiati-resend-button')).toBeInTheDocument();
    expect(screen.getByTestId('alloggiati-manual-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-channel-manager')).not.toBeInTheDocument();
  });
});

describe('AlloggiatiBookingPanel: a status that cannot be read', () => {
  it('panel_StatusRead404_IsNotFoundWhateverTheCacheStillHoldsAndOffersNoAction', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    client.setQueryData([ALLOGGIATI_KEY, 'status', BOOKING_ID], failedStatus([PLACE, DOWN]));
    renderPanel(problem(404, {}), client);

    expect(await screen.findByTestId('booking-alloggiati-not-found', undefined, WAIT)).toHaveTextContent('Non troviamo lo stato Alloggiati');
    expect(screen.queryByTestId('alloggiati-status-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-channel-manager')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-fix-guests')).not.toBeInTheDocument();
  });
});

describe('AlloggiatiBookingPanel: a guest the channel manager did not take', () => {
  it('panel_FailedWrite_IsToCorrectAndListsEachGuestByPositionWithItsReasonInPlainWords', async () => {
    renderPanel(failedStatus([PLACE, DOWN]));

    expect(await badge()).toHaveTextContent('Da correggere');
    expect((await badge()).className).toMatch(/destructive/);
    const place = screen.getByTestId('alloggiati-guest-error-1');
    expect(place).toHaveTextContent('Ospite 2');
    expect(place).toHaveTextContent('il comune di nascita e il comune di residenza');
    const down = screen.getByTestId('alloggiati-guest-error-2');
    expect(down).toHaveTextContent('Ospite 3');
    expect(down).toHaveTextContent('non risponde in questo momento');
    const text = screen.getByTestId('alloggiati-channel-manager').textContent ?? '';
    expect(text).not.toMatch(/octorate|place_not_recognized/i);
    expect(screen.queryByTestId('alloggiati-resend-button')).not.toBeInTheDocument();
  });

  it('panel_ErrorCodeOfAnotherVersion_GetsTheGenericWordsNeverTheRawCode', async () => {
    renderPanel(failedStatus([guest(0, { state: 'Failed', errorCode: 'something_new_of_a_later_version' })]));

    const row = await screen.findByTestId('alloggiati-guest-error-0', undefined, WAIT);
    expect(row).toHaveTextContent('non ha preso questo ospite');
    expect(row.textContent ?? '').not.toContain('something_new_of_a_later_version');
  });

  it('panel_PlaceNotRecognized_OpensTheGuestsOfTheStayInALayerAndTheHostStaysOnTheStay', async () => {
    renderPanel(failedStatus([PLACE], []));

    fireEvent.click(await screen.findByTestId('alloggiati-fix-guests', undefined, WAIT));

    const layer = await screen.findByTestId('guests-layer');
    expect(layer).toHaveTextContent('il tuo channel manager non riconosce');
    expect(layer).toHaveTextContent('Conferma e invia');
    expect(screen.getByTestId('booking-alloggiati-section')).toBeInTheDocument();
    // A place cannot be mended by asking again: the server offers no retry for it, and the page offers none.
    expect(screen.queryByTestId('alloggiati-retry-write')).not.toBeInTheDocument();
  });

  it('panel_PlaceNotRecognized_SaysWhatSendsTheCorrectedGuestAndLeadsToTheCheckInWizard', async () => {
    renderPanel(failedStatus([PLACE], []));

    expect(await screen.findByTestId('alloggiati-next-step', undefined, WAIT)).toHaveTextContent('Conferma e invia');
    expect(screen.getByTestId('alloggiati-open-check-in')).toHaveAttribute('href', CHECK_IN_PATH);
  });

  it('panel_PlaceNotRecognizedWithoutBookingWrite_SaysTheStepButOffersNoLinkToAPageItCannotOpen', async () => {
    workspace.granted = ['booking.read', 'guest.read', 'alloggiati.submit'];
    renderPanel(failedStatus([PLACE], []));

    expect(await screen.findByTestId('alloggiati-next-step', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-open-check-in')).not.toBeInTheDocument();
  });

  it('panel_FailureThatIsNotAPlace_HasNoCheckInStepAndNoLink', async () => {
    renderPanel(failedStatus([DOWN]));

    expect(await screen.findByTestId('alloggiati-guest-error-2', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-next-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-open-check-in')).not.toBeInTheDocument();
  });

  // The permission rule of the task: only who may send the guests' data (`alloggiati.submit`, the permission of the endpoints) can ask again or correct.
  it('panel_WithoutAlloggiatiSubmit_ShowsNoRetryAndNoCorrectionButAndSaysWhomToAsk_Test', async () => {
    workspace.granted = ['booking.read', 'booking.write', 'guest.read'];
    renderPanel(failedStatus([PLACE, DOWN]));

    expect(await screen.findByTestId('alloggiati-guest-error-2', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-retry-write')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-fix-guests')).not.toBeInTheDocument();
    expect(screen.getByTestId('alloggiati-retry-needs-permission')).toHaveTextContent('serve il permesso di inviare i dati degli ospiti');
    expect(screen.queryByTestId('alloggiati-next-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alloggiati-open-check-in')).not.toBeInTheDocument();
    expect(alloggiatiApi.retryOctorateWrite).not.toHaveBeenCalled();
  });

  it('panel_WithAlloggiatiSubmit_Retry_AsksTheServerOnceAndTheStayBecomesEntrustedWithWhatTheRetryDid', async () => {
    const answer: AlloggiatiRetryResultDto = { state: 'Sent', reason: null };
    vi.mocked(alloggiatiApi.retryOctorateWrite).mockResolvedValue({ ...statusOf('EntrustedToChannelManager', block()), retry: answer });
    renderPanel(failedStatus([DOWN]));

    fireEvent.click(await screen.findByRole('button', { name: 'Riprova' }, WAIT));

    await waitFor(() => expect(alloggiatiApi.retryOctorateWrite).toHaveBeenCalledTimes(1), WAIT);
    expect(alloggiatiApi.retryOctorateWrite).toHaveBeenCalledWith(BOOKING_ID);
    // What the retry did is told, and the status is the one the server answered: entrusted (yellow), never green.
    await waitFor(() => expect(screen.getByTestId('alloggiati-retry-result')).toHaveAttribute('data-outcome', 'sent'), WAIT);
    expect(screen.getByTestId('alloggiati-retry-result')).toHaveTextContent('sono passati al tuo channel manager');
    expect(await badge()).toHaveTextContent('Affidato al channel manager, in attesa della ricevuta');
    expect((await badge()).className).not.toMatch(/green|success/);
  });

  it('panel_RetryOnItsWay_KeepsEveryButtonOfTheBlockOffUntilItAnswersThenTellsTheRefusalInWords', async () => {
    let refuse: (error: unknown) => void = () => undefined;
    vi.mocked(alloggiatiApi.retryOctorateWrite).mockReturnValue(new Promise((_resolve, reject) => (refuse = reject)));
    renderPanel(failedStatus([PLACE, DOWN]));

    const retry = await screen.findByTestId('alloggiati-retry-write', undefined, WAIT);
    fireEvent.click(retry);

    await waitFor(() => expect(retry).toHaveAttribute('aria-busy', 'true'), WAIT);
    fireEvent.click(retry);
    expect(screen.getByTestId('alloggiati-fix-guests')).toBeDisabled();
    expect(screen.getByTestId('alloggiati-open-check-in')).toBeDisabled();
    expect(alloggiatiApi.retryOctorateWrite).toHaveBeenCalledTimes(1);

    refuse(problem(409, { code: 'alloggiati_write_in_progress' }));

    expect(await screen.findByTestId('alloggiati-retry-error', undefined, WAIT)).toHaveTextContent('stanno già passando al tuo channel manager');
    await waitFor(() => expect(screen.getByTestId('alloggiati-fix-guests')).toBeEnabled(), WAIT);
    await waitFor(() => expect(screen.getByTestId('alloggiati-open-check-in')).toHaveAttribute('href', CHECK_IN_PATH), WAIT);
    expect(screen.queryByTestId('alloggiati-retry-result')).not.toBeInTheDocument();
  });

  it('panel_RetryThatTriedNothing_SaysSoNeverThatItWorked', async () => {
    vi.mocked(alloggiatiApi.retryOctorateWrite).mockResolvedValue({ ...failedStatus([PLACE]), retry: { state: 'NothingToSend', reason: null } });
    renderPanel(failedStatus([PLACE, DOWN]));

    fireEvent.click(await screen.findByRole('button', { name: 'Riprova' }, WAIT));

    const result = await screen.findByTestId('alloggiati-retry-result', undefined, WAIT);
    expect(result).toHaveAttribute('data-outcome', 'nothingToSend');
    expect(result.textContent ?? '').not.toMatch(/^Fatto/);
    expect(await badge()).toHaveTextContent('Da correggere');
  });

  // A guest held back for a place is never tried again: the retry sends the other one («Sent») and the stay is still to correct, so the page must not say «Fatto».
  it('panel_RetrySentTheOthersButAGuestForAPlaceIsStillToCorrect_NeverSaysDone', async () => {
    vi.mocked(alloggiatiApi.retryOctorateWrite).mockResolvedValue({ ...failedStatus([PLACE]), retry: { state: 'Sent', reason: null } });
    renderPanel(failedStatus([PLACE, DOWN]));

    fireEvent.click(await screen.findByRole('button', { name: 'Riprova' }, WAIT));

    const result = await screen.findByTestId('alloggiati-retry-result', undefined, WAIT);
    expect(result).toHaveAttribute('data-outcome', 'partlyFailed');
    expect(result.textContent ?? '').not.toMatch(/Fatto/);
    expect(result).toHaveTextContent('altri no');
    expect(await badge()).toHaveTextContent('Da correggere');
    expect(screen.getByTestId('alloggiati-guest-error-1')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('alloggiati-guest-error-2')).not.toBeInTheDocument(), WAIT);
  });
});

describe('the words of the stay on the channel manager', () => {
  it('stayChannelViewOf_EachStatus_IsTheViewTheServerSaysNeverGreenWithoutAnArchivedReceipt', () => {
    const archived = block({ receiptCoverage: { archived: true, source: 'casazen_receipt', archivedAt: null }, light: 'Green' });

    expect(stayChannelViewOf(statusOf('EntrustedToChannelManager', block()))).toBe('entrusted');
    expect(stayChannelViewOf(statusOf('EntrustedToChannelManager', archived))).toBe('receiptArchived');
    expect(stayChannelViewOf(statusOf('EntrustedToChannelManager', block({ light: 'Red' })))).toBe('receiptMissing');
    expect(stayChannelViewOf(statusOf('EntrustedToChannelManager', null))).toBe('entrusted');
    expect(stayChannelViewOf({ status: 'EntrustedToChannelManager' })).toBe('entrusted');
    expect(stayChannelViewOf(statusOf('ChannelManagerWriteFailed', archived))).toBe('toCorrect');
    expect(stayChannelViewOf(statusOf('DaInviareManualmente', archived))).toBe('receiptArchived');
    expect(stayChannelViewOf(statusOf('Inviato', null))).toBeNull();
  });

  it('placeFieldsOf_NamesOfTheRecord_AreKeptInItsOrderAndAnUnknownOneIsLeftOut', () => {
    expect(placeFieldsOf('residenceComune, birthComune')).toEqual(['birthComune', 'residenceComune']);
    expect(placeFieldsOf('documentIssuePlace,somethingNew')).toEqual(['documentIssuePlace']);
    expect(placeFieldsOf(null)).toEqual([]);
    expect(placeFieldsOf('toString')).toEqual([]);
  });

  it('retryOutcomeOf_EachStateOfTheServer_IsOneOfTheFiveOutcomesTheScreenHasWordsFor', () => {
    const outcomes = (['Sent', 'PartlyFailed', 'Failed', 'NothingToSend', 'NotApplicable', 'NotMirrored'] as const).map((state) =>
      retryOutcomeOf({ state, reason: null }, 'EntrustedToChannelManager'),
    );

    expect(outcomes).toEqual(['sent', 'partlyFailed', 'failed', 'nothingToSend', 'notApplicable', 'notApplicable']);
  });

  it('retryOutcomeOf_SentWhileTheStayIsNotEntrusted_IsNeverDone', () => {
    // «Sent» is what the retry tried: a guest held back for a place is never tried again, so the stay can still be to correct (or not entrusted yet).
    expect(retryOutcomeOf({ state: 'Sent', reason: null }, 'ChannelManagerWriteFailed')).toBe('partlyFailed');
    expect(retryOutcomeOf({ state: 'Sent', reason: null }, 'DaInviareManualmente')).toBe('partlyFailed');
    expect(retryOutcomeOf({ state: 'Sent', reason: null }, 'EntrustedToChannelManager')).toBe('sent');
  });

  it.each(['it', 'en'] as const)('texts_%s_EveryCodeAndStateHasItsWordsAndNoneNamesTheSupplier', async (language) => {
    await i18n.changeLanguage(language);
    const t = i18n.getFixedT(language);
    const keys = [
      ...['place_not_recognized', 'octorate_auth', 'octorate_conflict', 'octorate_guest_rejected', 'octorate_not_found', 'octorate_rate_limited', 'octorate_server', null, 'a_code_of_a_later_version'].map(guestErrorKey),
      ...['birthComune', 'residenceComune', 'documentIssuePlace', 'unknown'].map((field) => `alloggiati.channelManager.field.${field}`),
      ...['sent', 'partlyFailed', 'failed', 'nothingToSend', 'notApplicable', 'error'].map((outcome) => `alloggiati.channelManager.retryResult.${outcome}`),
      ...['EntrustedToChannelManager', 'ChannelManagerWriteFailed'].map((status) => `alloggiati.statusLabel.${status}`),
      'alloggiati.channelManager.receiptArchivedLabel',
      'alloggiati.channelManager.fixLayer',
      'alloggiati.channelManager.nextStep',
      'alloggiati.channelManager.reconfirm',
      'apiErrors.codes.alloggiatiWriteInProgress',
    ];

    for (const key of keys) {
      expect(i18n.exists(key, { lng: language }), key).toBe(true);
      expect(t(key, { fields: 'x' }), key).not.toMatch(/octorate/i);
    }
    await i18n.changeLanguage('it');
  });
});
