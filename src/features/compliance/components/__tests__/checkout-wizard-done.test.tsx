import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { expectNoAxeViolations } from '@/test/axe';
import type { Booking, BookingOctorateSync } from '@/types';
import type { CheckoutWizardCompleteResult, CheckoutWizardState } from '@/types/compliance.types';
import { CheckoutDone } from '../checkout-wizard-done';

vi.mock('@/api/bookings.api', () => ({
  asBookingPage: vi.fn(),
  bookingsApi: { getById: vi.fn(), retryOctorateSync: vi.fn() },
}));

const CLOSED_AT = '2026-09-24T10:00:00Z';

function wizard(overrides: Partial<CheckoutWizardState> = {}): CheckoutWizardState {
  return {
    bookingId: 'b-1',
    bookingStatus: 'CheckedOut',
    currentStep: 'property-ready',
    startedAt: '2026-09-24T09:00:00Z',
    completedAt: CLOSED_AT,
    steps: [],
    stay: {
      guestName: 'Mario Rossi',
      propertyId: 'p-1',
      propertyName: 'Villa Aurora',
      propertyCity: 'Roma',
      checkInDate: '2026-09-22T00:00:00Z',
      checkOutDate: '2026-09-24T00:00:00Z',
      nights: 2,
      numberOfGuests: 2,
      numberOfAdults: 2,
      numberOfChildren: 0,
      arrivedAt: null,
      source: 'Manual',
      departureConfirmed: true,
    },
    alloggiati: { status: 'InviatoManualmente', sent: true, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false, dataComplete: true },
    cleaning: { choice: 'Skip', supplierOrgId: null, category: null, notes: null, requestId: null },
    touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: 'CollectedAtProperty' },
    propertyReady: { ready: true, readyAt: null, notes: null },
    ...overrides,
  };
}

function result(overrides: Partial<CheckoutWizardCompleteResult> = {}, state: Partial<CheckoutWizardState> = {}): CheckoutWizardCompleteResult {
  return { propertyReady: true, bookingStatus: 'CheckedOut', serviceRequestId: null, wizard: wizard(state), ...overrides };
}

function sync(changes: Partial<BookingOctorateSync> = {}): BookingOctorateSync {
  return { state: 'Synced', lastOperation: 'Update', lastSyncedAt: '2026-09-24T10:05:00Z', errorCode: null, canRetry: false, ...changes };
}

/** `GET /bookings/:id`, the only answer that carries the mirror of the booking on the channel manager. */
function detail(mirror: Partial<BookingOctorateSync> | null): Booking {
  return { id: 'b-1', propertyId: 'p-1', octorateSync: mirror === null ? null : sync(mirror) } as Booking;
}

function renderDone(completion: CheckoutWizardCompleteResult, options: { connector?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const flags = { ...DEFAULT_FEATURE_FLAGS, octorateConnector: options.connector ?? false };
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client },
        createElement(FeatureFlagsContext.Provider, { value: { flags, isLoading: false } },
          createElement(MemoryRouter, null, createElement(CheckoutDone, { bookingId: 'b-1', guestName: 'Mario Rossi', result: completion }))))),
  );
}

const region = () => screen.getByRole('region', { name: 'Cosa succede ora' });
const points = () => within(region()).getAllByRole('listitem').map((item) => item.textContent);
const tones = () => within(region()).getAllByRole('listitem').map((item) => item.getAttribute('data-tone'));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('CheckoutDone', () => {
  it('CheckoutDone_StayClosed_ConfirmsItAndNamesTheGuest', () => {
    renderDone(result());

    expect(screen.getByRole('heading', { level: 2, name: 'Il soggiorno è chiuso' })).toBeInTheDocument();
    expect(screen.getByText('Il check-out di Mario Rossi è registrato.')).toBeInTheDocument();
  });

  it('CheckoutDone_EveryElementDone_HasOneLineForEachWithItsState', () => {
    renderDone(result({ serviceRequestId: 'sr-1' }));

    expect(points()).toEqual([
      'Nella prenotazione il soggiorno risulta concluso.',
      'La comunicazione Alloggiati risulta inviata.',
      'La richiesta di pulizia è stata inviata al fornitore: la trovi nel dettaglio della prenotazione.',
      'Imposta di soggiorno dichiarata: Riscossa in struttura.',
      "L'immobile è segnato come pronto per il prossimo ospite.",
    ]);
    expect(tones()).toEqual(['done', 'done', 'done', 'done', 'done']);
  });

  it('CheckoutDone_WhatIsNotCompleted_IsSaidAsSuchAndNeverAsDone', () => {
    renderDone(
      result(
        { propertyReady: false },
        {
          alloggiati: { status: 'DaInviareManualmente', sent: false, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: true, dataComplete: false },
          touristTax: { recordedAmount: 12, currency: 'EUR', collectedWithOnlinePayment: false, collection: 'NotCollected' },
        },
      ),
    );

    expect(points()).toEqual([
      'Nella prenotazione il soggiorno risulta concluso.',
      'La comunicazione Alloggiati non risulta ancora inviata: controllala dalla scheda della prenotazione.',
      'Pulizie: nessuna richiesta, il passaggio è stato saltato.',
      'Imposta di soggiorno: non riscossa. Va gestita secondo il regolamento del comune.',
      "L'immobile non è ancora pronto: resta nel riepilogo compliance finché non lo dichiari pronto.",
    ]);
    expect(tones()).toEqual(['done', 'attention', 'done', 'attention', 'attention']);
  });

  it('CheckoutDone_AlloggiatiRefusedByThePortal_IsAProblem', () => {
    renderDone(result({}, { alloggiati: { status: 'Rifiutato', sent: false, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false, dataComplete: true } }));

    expect(tones()[1]).toBe('problem');
  });

  it('CheckoutDone_CleaningAskedForButNoRequestMade_IsNotSaidToBeSkipped', () => {
    renderDone(result({ serviceRequestId: null }, { cleaning: { choice: 'Request', supplierOrgId: 's-1', category: 'cleaning', notes: null, requestId: null } }));

    expect(points()[2]).toBe('La richiesta di pulizia non risulta inviata: controllala nel dettaglio della prenotazione.');
    expect(tones()[2]).toBe('attention');
  });

  it('CheckoutDone_TouristTaxNotDeclared_IsNotCompleted', () => {
    renderDone(result({}, { touristTax: { recordedAmount: null, currency: 'EUR', collectedWithOnlinePayment: false, collection: null } }));

    expect(points()[3]).toBe('Imposta di soggiorno: riscossione non indicata.');
    expect(tones()[3]).toBe('attention');
  });

  it('CheckoutDone_TwoWaysOn_BackToTheBookingAndToTheComplianceSummary', () => {
    renderDone(result());

    expect(screen.getByRole('link', { name: 'Torna alla prenotazione' })).toHaveAttribute('href', '/app/short-rent/bookings/b-1');
    expect(screen.getByRole('link', { name: 'Vai agli adempimenti' })).toHaveAttribute('href', '/app/short-rent/compliance');
  });

  it('CheckoutDone_Text_NeverSaysTheCheckOutIsCompletedLikeTheToastDoes', () => {
    // The toast of the completion says it already ("Check-out completato…"), and the journey of the CI looks for that one text:
    // the screen must not repeat it, or the page would have two of them.
    const { container } = renderDone(result({ propertyReady: false }, { alloggiati: { status: 'Errore', sent: false, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false, dataComplete: true } }));

    expect(container.textContent).not.toMatch(/check-out completato/i);
  });

  it('CheckoutDone_EnglishLanguage_IsTranslated', async () => {
    await i18n.changeLanguage('en');

    renderDone(result());

    expect(screen.getByRole('heading', { level: 2, name: 'The stay is closed' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to compliance' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'What happens now' })).getAllByRole('listitem')).toHaveLength(5);
  });
});

describe('CheckoutDone: the next step', () => {
  it('CheckoutDone_AlloggiatiStillToSend_SuggestsItWithTheLinkToItsTab', () => {
    renderDone(result({}, { alloggiati: { status: 'DaInviareManualmente', sent: false, deadlineAt: '2026-09-22T22:00:00Z', isOverdue: false, dataComplete: true } }));

    const next = screen.getByTestId('checkout-done-next');
    expect(next).toHaveTextContent('Invia la comunicazione Alloggiati dalla scheda della prenotazione.');
    expect(within(next).getByRole('link')).toHaveAttribute('href', '/app/short-rent/bookings/b-1?tab=alloggiati');
  });

  it('CheckoutDone_OnlyThePropertyIsNotReady_SuggestsDeclaringItReady', () => {
    renderDone(result({ propertyReady: false }));

    expect(screen.getByTestId('checkout-done-next')).toHaveTextContent("Dichiara l'immobile pronto dagli adempimenti, quando lo è.");
  });

  it('CheckoutDone_EverythingDone_SaysThereIsNothingElse', () => {
    renderDone(result());

    expect(screen.getByTestId('checkout-done-next')).toHaveTextContent('Non resta altro da fare per questo soggiorno.');
    expect(screen.getAllByTestId('checkout-done-next')).toHaveLength(1);
  });
});

describe('CheckoutDone: the channel manager', () => {
  it('CheckoutDone_BookingNotMirrored_HasNoLineForTheChannelManager', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail(null));

    renderDone(result(), { connector: true });

    await waitFor(() => expect(bookingsApi.getById).toHaveBeenCalledWith('b-1'));
    expect(points()).toHaveLength(5);
    expect(screen.queryByTestId('checkout-done-channel-manager')).not.toBeInTheDocument();
  });

  it('CheckoutDone_ConnectorOff_ReadsNothingAndSaysNothingAboutTheChannelManager', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true }));

    renderDone(result(), { connector: false });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(bookingsApi.getById).not.toHaveBeenCalled();
    expect(points()).toHaveLength(5);
    expect(screen.queryByTestId('checkout-done-channel-manager')).not.toBeInTheDocument();
  });

  it('CheckoutDone_CheckOutBeingSent_IsNotDoneYet', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Pending', lastSyncedAt: null }));

    renderDone(result(), { connector: true });

    expect(await screen.findByText('Il check-out è in invio al channel manager.')).toBeInTheDocument();
    expect(tones()[1]).toBe('attention');
    expect(screen.queryByTestId('checkout-done-channel-manager-retry')).not.toBeInTheDocument();
  });

  it('CheckoutDone_SyncConfirmedAfterTheStayWasClosed_SaysTheCheckOutWasSent', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Synced', lastSyncedAt: '2026-09-24T10:05:00Z' }));

    renderDone(result(), { connector: true });

    expect(await screen.findByText('Il check-out è stato inviato al channel manager.')).toBeInTheDocument();
    expect(tones()[1]).toBe('done');
  });

  it('CheckoutDone_SyncConfirmedBeforeTheStayWasClosed_IsNotTakenForTheCheckOut', async () => {
    // The channel manager confirmed the creation of the booking, not the check-out: a success it has not given is never said.
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Synced', lastOperation: 'Create', lastSyncedAt: '2026-09-20T08:00:00Z' }));

    renderDone(result(), { connector: true });

    expect(await screen.findByText('Il check-out è in invio al channel manager.')).toBeInTheDocument();
    expect(screen.queryByText('Il check-out è stato inviato al channel manager.')).not.toBeInTheDocument();
    expect(tones()[1]).toBe('attention');
  });

  it('CheckoutDone_CheckOutFailed_SaysWhyAndRetriesNowFromHere', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true, lastSyncedAt: null }));
    vi.mocked(bookingsApi.retryOctorateSync).mockResolvedValue({ bookingId: 'b-1', state: 'Pending' });

    renderDone(result(), { connector: true });

    expect(await screen.findByText('Il check-out non è arrivato al channel manager.')).toBeInTheDocument();
    expect(tones()[1]).toBe('problem');
    expect(screen.getByTestId('checkout-done-channel-manager-reason')).not.toBeEmptyDOMElement();
    expect(screen.getByTestId('checkout-done-next')).toHaveTextContent("Riprova l'invio del check-out al channel manager.");

    const retry = screen.getByTestId('checkout-done-channel-manager-retry');
    expect(retry).toHaveTextContent('Riprova ora');
    fireEvent.click(retry);

    await waitFor(() => expect(bookingsApi.retryOctorateSync).toHaveBeenCalledWith('b-1', undefined));
    // The sync keeps its old state until the push starts: for a moment the line says it is on its way, not that it failed.
    expect(await screen.findByText('Il check-out è in invio al channel manager.')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-done-channel-manager-retry')).not.toBeInTheDocument();
  });

  it('CheckoutDone_RetryRefused_ShowsTheRefusalAndKeepsTheButton', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true, lastSyncedAt: null }));
    vi.mocked(bookingsApi.retryOctorateSync).mockRejectedValue(new Error('network'));

    renderDone(result(), { connector: true });

    fireEvent.click(await screen.findByTestId('checkout-done-channel-manager-retry'));

    expect(await screen.findByTestId('checkout-done-channel-manager-error')).toHaveTextContent('Non siamo riusciti a riprovare. Riprova tra un momento.');
    expect(screen.getByTestId('checkout-done-channel-manager-retry')).toBeEnabled();
  });

  it('CheckoutDone_CheckOutFailedAndCallerMayNotWriteTheBooking_HasNoRetryButton', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: false, lastSyncedAt: null }));

    renderDone(result(), { connector: true });

    expect(await screen.findByText('Il check-out non è arrivato al channel manager.')).toBeInTheDocument();
    expect(screen.queryByTestId('checkout-done-channel-manager-retry')).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-done-next')).toHaveTextContent('Controlla lo stato della prenotazione sul channel manager.');
  });

  it('CheckoutDone_BookingNotFoundWhenReadingTheMirror_IsSaidAsNotFoundWhateverTheCacheHolds', async () => {
    const notFound = Object.assign(new Error('Not found'), { isAxiosError: true, response: { status: 404, data: {} } });
    vi.mocked(bookingsApi.getById).mockRejectedValue(notFound);

    renderDone(result(), { connector: true });

    expect(await screen.findByText('Non troviamo la prenotazione: non possiamo dire se il check-out è nel channel manager.')).toBeInTheDocument();
    expect(tones()[1]).toBe('problem');
  });

  it('CheckoutDone_FailedLine_HasNoAccessibilityViolation', async () => {
    vi.mocked(bookingsApi.getById).mockResolvedValue(detail({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true, lastSyncedAt: null }));

    const { container } = renderDone(result({ propertyReady: false }), { connector: true });

    await screen.findByTestId('checkout-done-channel-manager-retry');
    await expectNoAxeViolations(container);
  });
});
