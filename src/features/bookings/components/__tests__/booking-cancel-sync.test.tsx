import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { Booking, BookingOctorateSync } from '@/types';
import { expectNoAxeViolations } from '@/test/axe';
import { BookingCancelSync } from '../booking-cancel-sync';

const booking = (sync: BookingOctorateSync | null | undefined): Booking => ({
  id: 'b0c1d2e3-0000-4000-8000-000000000001',
  propertyId: 'property-1',
  userId: 'auth0|host',
  checkInDate: '2027-10-01T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 450,
  currency: 'EUR',
  status: 'Cancelled',
  source: 'Direct',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '', country: 'IT' },
  createdAt: '2027-09-24T08:00:00Z',
  updatedAt: '2027-09-24T08:00:00Z',
  ...(sync === undefined ? {} : { octorateSync: sync }),
});

const sync = (overrides: Partial<BookingOctorateSync> = {}): BookingOctorateSync => ({
  state: 'Synced',
  lastOperation: 'Cancel',
  lastSyncedAt: '2027-09-24T08:01:00Z',
  errorCode: null,
  canRetry: false,
  ...overrides,
});

interface Handlers {
  busy?: boolean;
  retryError?: string | null;
  onRetry?: () => void;
  waitOver?: boolean;
  onCheckAgain?: () => void;
  checking?: boolean;
}

function renderSync(value: Booking, { busy = false, retryError = null, onRetry = vi.fn(), waitOver, onCheckAgain, checking }: Handlers = {}) {
  return render(
    <BookingCancelSync booking={value} busy={busy} retryError={retryError} onRetry={onRetry} waitOver={waitOver} onCheckAgain={onCheckAgain} checking={checking} />,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('BookingCancelSync (the channel manager line of a cancellation, NF-76)', () => {
  it.each([
    ['a booking that is not mirrored', null],
    ['an answer that says nothing', undefined],
  ])('render_%s_SaysNothing', (_name, value) => {
    const { container } = renderSync(booking(value));

    expect(container).toBeEmptyDOMElement();
  });

  it('render_CancellationConfirmedByTheChannelManager_SaysItIsCancelledThereToo', () => {
    renderSync(booking(sync()));

    expect(screen.getByTestId('booking-cancel-sync-synced')).toHaveTextContent('Annullata anche nel tuo channel manager.');
  });

  it('render_CancellationBeingSent_SaysSo', () => {
    renderSync(booking(sync({ state: 'Pending' })));

    expect(screen.getByTestId('booking-cancel-sync-pending')).toHaveTextContent('Sto annullando la prenotazione nel tuo channel manager');
  });

  it('render_CancellationStillPendingWhenTheDialogStoppedWaiting_SaysNoAnswerYetAndOffersCheckAgain', () => {
    const onCheckAgain = vi.fn();
    renderSync(booking(sync({ state: 'Pending' })), { waitOver: true, onCheckAgain });

    // Neither "being cancelled" nor a failure nor a success: what the dialog knows is that nothing has come back.
    expect(screen.getByTestId('booking-cancel-sync-waiting')).toHaveTextContent('non ha ancora risposto');
    expect(screen.getByTestId('booking-cancel-sync-waiting')).toHaveTextContent("l'annullamento non è ancora confermato lì");
    expect(screen.queryByTestId('booking-cancel-sync-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-cancel-sync-synced')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Controlla di nuovo' }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
  });

  it('render_WaitOverWhileBusy_DisablesCheckAgain', () => {
    renderSync(booking(sync({ state: 'Pending' })), { waitOver: true, onCheckAgain: vi.fn(), busy: true });

    expect(screen.getByRole('button', { name: 'Controlla di nuovo' })).toBeDisabled();
  });

  it.each(['Synced', 'Failed'] as const)('render_WaitOverButTheRowIsNotPending_%s_SaysWhatTheRowSays', (state) => {
    renderSync(booking(sync({ state, errorCode: state === 'Failed' ? 'octorate_rejected' : null })), { waitOver: true, onCheckAgain: vi.fn() });

    expect(screen.queryByTestId('booking-cancel-sync-waiting')).not.toBeInTheDocument();
    expect(screen.getByTestId(state === 'Synced' ? 'booking-cancel-sync-synced' : 'booking-cancel-sync-failed')).toBeInTheDocument();
  });

  it.each([
    ['Synced', 'Update'],
    ['Synced', 'Create'],
    ['Pending', 'Payment'],
    ['Failed', 'Update'],
    ['Conflict', 'Update'],
  ] as const)('render_RowStillSaysAnOlderOperation_%s_%s_NeverClaimsTheCancellationWasSent', (state, lastOperation) => {
    renderSync(booking(sync({ state, lastOperation, errorCode: 'octorate_rejected', canRetry: true })));

    expect(screen.getByTestId('booking-cancel-sync-unconfirmed')).toHaveTextContent("non ha ancora confermato l'annullamento");
    expect(screen.queryByTestId('booking-cancel-sync-synced')).not.toBeInTheDocument();
    // The failure of an older operation is not the failure of this one: no reason, no button.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('render_FailedThatTheServerRetries_SaysWhyAndThatItTriesAgain', () => {
    const onRetry = vi.fn();
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true })), { onRetry });

    const failed = screen.getByTestId('booking-cancel-sync-failed');
    expect(failed).toHaveAttribute('role', 'alert');
    expect(failed).toHaveTextContent('Annullata in CasaZen, non ancora nel tuo channel manager');
    expect(failed).toHaveTextContent('Il channel manager non ha risposto.');
    expect(failed).toHaveTextContent('Riproviamo in automatico.');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova ora' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('render_FailedThatWaitsForTheHost_DoesNotPromiseARetry', () => {
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_not_mirrored', canRetry: true })));

    const failed = screen.getByTestId('booking-cancel-sync-failed');
    expect(failed).toHaveTextContent("L'immobile non è collegato al channel manager");
    expect(failed).not.toHaveTextContent('Riproviamo in automatico');
    expect(failed).toHaveTextContent('riprova tu');
  });

  it('render_FailedForWhoCannotWrite_HasNoButton', () => {
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_rejected', canRetry: false })));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-cancel-sync-failed')).not.toHaveTextContent('riprova tu');
  });

  it('render_Conflict_SaysTheCancellationInCasazenStandsAndOffersRetryNow', () => {
    renderSync(booking(sync({ state: 'Conflict', errorCode: 'octorate_reservation_changed', canRetry: true })));

    const failed = screen.getByTestId('booking-cancel-sync-failed');
    expect(failed).toHaveTextContent("Il tuo channel manager non ha accettato l'annullamento");
    expect(failed).toHaveTextContent("L'annullamento in CasaZen resta valido");
    expect(screen.getByRole('button', { name: 'Riprova ora' })).toBeInTheDocument();
  });

  it('render_NotAllowedByTheChannel_SaysNothingWasSent', () => {
    renderSync(booking(sync({ state: 'NotAllowedByChannel' })));

    expect(screen.getByTestId('booking-cancel-sync-not-allowed')).toHaveTextContent('al channel manager non è stato inviato nulla');
  });

  it.each(["Synced", "Pending", "Failed", "Conflict", "NotAllowedByChannel"] as const)('render_%s_HasNoAccessibilityViolation', async (state) => {
    const { container } = renderSync(booking(sync({ state, errorCode: 'octorate_unavailable', canRetry: true })));

    await expectNoAxeViolations(container);
  });

  it('render_RetryBusyOrRefused_DisablesTheButtonAndSaysWhy', () => {
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true })), {
      busy: true,
      retryError: "Non c'è un invio da ripetere.",
    });

    expect(screen.getByRole('button', { name: 'Riprova ora' })).toBeDisabled();
    expect(screen.getByTestId('booking-cancel-sync-failed')).toHaveTextContent("Non c'è un invio da ripetere.");
  });
});
