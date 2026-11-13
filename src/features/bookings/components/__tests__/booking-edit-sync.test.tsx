import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { Booking, BookingOctorateSync } from '@/types';
import { expectNoAxeViolations } from '@/test/axe';
import { BookingEditSync } from '../booking-edit-sync';

const booking = (sync: BookingOctorateSync | null | undefined): Booking => ({
  id: 'b0c1d2e3-0000-4000-8000-000000000001',
  propertyId: 'property-1',
  userId: 'auth0|host',
  checkInDate: '2027-10-01T00:00:00Z',
  checkOutDate: '2027-10-05T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 450,
  currency: 'EUR',
  status: 'Confirmed',
  source: 'Direct',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '+393331234567', country: 'IT' },
  createdAt: '2027-09-24T08:00:00Z',
  updatedAt: '2027-09-24T08:00:00Z',
  ...(sync === undefined ? {} : { octorateSync: sync }),
});

const sync = (overrides: Partial<BookingOctorateSync> = {}): BookingOctorateSync => ({
  state: 'Synced',
  lastOperation: 'Update',
  lastSyncedAt: '2027-09-24T08:01:00Z',
  errorCode: null,
  canRetry: false,
  ...overrides,
});

interface Handlers {
  busy?: boolean;
  retryError?: string | null;
  onRetry?: (overwrite: boolean) => void;
  onUseChannelVersion?: () => void;
  waitOver?: boolean;
  onCheckAgain?: () => void;
  checking?: boolean;
}

function renderSync(value: Booking, { busy = false, retryError = null, onRetry = vi.fn(), onUseChannelVersion, waitOver, onCheckAgain, checking }: Handlers = {}) {
  return render(
    <BookingEditSync
      booking={value}
      busy={busy}
      retryError={retryError}
      onRetry={onRetry}
      onUseChannelVersion={onUseChannelVersion}
      waitOver={waitOver}
      onCheckAgain={onCheckAgain}
      checking={checking}
    />,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(cleanup);

describe('BookingEditSync (where the push of an edit stands, NF-75 and NF-74)', () => {
  it.each([
    ['Synced', sync()],
    ['a booking that is not mirrored', null],
    ['an answer that says nothing', undefined],
  ])('render_%s_SaysNothingExtra', (_name, value) => {
    const { container } = renderSync(booking(value));

    expect(container).toBeEmptyDOMElement();
  });

  it('render_Pending_SaysTheChangeIsBeingSentAndHasNoButton', () => {
    renderSync(booking(sync({ state: 'Pending' })));

    expect(screen.getByTestId('booking-sync-pending')).toHaveTextContent('Sto inviando la modifica al tuo channel manager');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('render_PendingThatThePageStoppedWaitingFor_SaysNoAnswerYetAndOffersCheckAgain', () => {
    const onCheckAgain = vi.fn();
    renderSync(booking(sync({ state: 'Pending' })), { waitOver: true, onCheckAgain });

    // Neither "being sent" nor a failure nor a success: what the page knows is that nothing has come back.
    expect(screen.getByTestId('booking-sync-waiting')).toHaveTextContent('non ha ancora risposto');
    expect(screen.getByTestId('booking-sync-waiting')).toHaveTextContent("l'invio non risulta ancora concluso");
    expect(screen.queryByTestId('booking-sync-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-sync-failed')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Controlla di nuovo' }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
  });

  it('render_WaitOverWhileBusy_DisablesCheckAgain', () => {
    renderSync(booking(sync({ state: 'Pending' })), { waitOver: true, onCheckAgain: vi.fn(), busy: true });

    expect(screen.getByRole('button', { name: 'Controlla di nuovo' })).toBeDisabled();
  });

  it.each([
    ['Synced', null],
    ['Failed', 'octorate_rejected'],
  ] as const)('render_WaitOverButTheRowIsNotPending_%s_SaysWhatTheRowSays', (state, errorCode) => {
    const { container } = renderSync(booking(sync({ state, errorCode })), { waitOver: true, onCheckAgain: vi.fn() });

    expect(screen.queryByTestId('booking-sync-waiting')).not.toBeInTheDocument();
    if (state === 'Synced') expect(container).toBeEmptyDOMElement();
    else expect(screen.getByTestId('booking-sync-failed')).toBeInTheDocument();
  });

  it('render_NotAllowedByTheChannel_SaysNothingWasSent', () => {
    renderSync(booking(sync({ state: 'NotAllowedByChannel' })));

    expect(screen.getByTestId('booking-sync-not-allowed')).toHaveTextContent('al channel manager non è stato inviato nulla');
  });

  it('render_FailedThatTheServerRetries_SaysWhyAndThatItTriesAgainAndOffersRetryNow', () => {
    const onRetry = vi.fn();
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true })), { onRetry });

    const failed = screen.getByTestId('booking-sync-failed');
    expect(failed).toHaveAttribute('role', 'alert');
    expect(failed).toHaveTextContent('Salvata in CasaZen, non ancora nel tuo channel manager');
    expect(failed).toHaveTextContent('Il channel manager non ha risposto.');
    expect(failed).toHaveTextContent('Riproviamo in automatico.');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova ora' }));
    expect(onRetry).toHaveBeenCalledWith(false);
  });

  it('render_FailedThatWaitsForTheHost_DoesNotPromiseARetry', () => {
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_rejected', canRetry: true })));

    const failed = screen.getByTestId('booking-sync-failed');
    expect(failed).toHaveTextContent('Il channel manager ha rifiutato la richiesta');
    expect(failed).not.toHaveTextContent('Riproviamo in automatico');
    expect(failed).toHaveTextContent('riprova tu');
  });

  it('render_FailedPaymentsNotRecorded_DoesNotPromiseARetryTheServerMayNotMake', () => {
    const onRetry = vi.fn();
    renderSync(booking(sync({ state: 'Failed', lastOperation: 'Payment', errorCode: 'octorate_payments_not_recorded', canRetry: true })), { onRetry });

    const failed = screen.getByTestId('booking-sync-failed');
    expect(failed).toHaveTextContent('Nel channel manager non sono stati registrati tutti gli incassi');
    expect(failed).not.toHaveTextContent('Riproviamo in automatico');
    expect(failed).toHaveTextContent('riprova tu');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova ora' }));
    expect(onRetry).toHaveBeenCalledWith(false);
  });

  it('render_FailedWhoCannotWrite_HasNoButtonAndNoRequestToTryAgain', () => {
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_rejected', canRetry: false })));

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-sync-failed')).not.toHaveTextContent('riprova tu');
  });

  it('render_FailedWithACodeNobodyKnows_StillSaysItWasNotConfirmed', () => {
    renderSync(booking(sync({ state: 'Failed', errorCode: 'something_new', canRetry: true })));

    expect(screen.getByTestId('booking-sync-failed')).toHaveTextContent("Il channel manager non l'ha confermata.");
  });

  it('render_RetryBusy_DisablesTheButton', () => {
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true })), { busy: true });

    expect(screen.getByRole('button', { name: 'Riprova ora' })).toBeDisabled();
  });

  it('render_RetryRefused_ShowsTheSentenceNextToTheButton', () => {
    renderSync(booking(sync({ state: 'Failed', errorCode: 'octorate_unavailable', canRetry: true })), { retryError: 'Non c\'è un invio da ripetere.' });

    expect(screen.getByTestId('booking-sync-failed')).toHaveTextContent("Non c'è un invio da ripetere.");
  });

  describe('Conflict', () => {
    const conflict = sync({
      state: 'Conflict',
      errorCode: 'octorate_reservation_changed',
      canRetry: true,
      octorateVersion: { checkIn: '2027-10-03T00:00:00Z', checkOut: '2027-10-08T00:00:00Z', guests: 3 },
    });

    it('render_Conflict_IsAnAlertWithBothVersionsSideBySide', () => {
      renderSync(booking(conflict), { onUseChannelVersion: vi.fn() });

      const alert = screen.getByTestId('booking-sync-conflict');
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert).toHaveTextContent('La prenotazione è stata modificata nel tuo channel manager');
      const ours = within(screen.getByTestId('booking-conflict-casazen'));
      expect(ours.getByText(/1 ott 2027 → 5 ott 2027/)).toBeInTheDocument();
      expect(ours.getByText('2 ospiti')).toBeInTheDocument();
      const theirs = within(screen.getByTestId('booking-conflict-channel'));
      expect(theirs.getByText(/3 ott 2027 → 8 ott 2027/)).toBeInTheDocument();
      expect(theirs.getByText('3 ospiti')).toBeInTheDocument();
    });

    it('render_Conflict_OffersKeepCasazenThatWritesOverTheOtherVersion', () => {
      const onRetry = vi.fn();
      renderSync(booking(conflict), { onRetry, onUseChannelVersion: vi.fn() });

      fireEvent.click(screen.getByRole('button', { name: 'Tieni la versione di CasaZen' }));

      expect(onRetry).toHaveBeenCalledWith(true);
    });

    it('render_Conflict_OffersTheChannelManagerVersionThatOnlyOpensTheForm', () => {
      const onRetry = vi.fn();
      const onUseChannelVersion = vi.fn();
      renderSync(booking(conflict), { onRetry, onUseChannelVersion });

      fireEvent.click(screen.getByRole('button', { name: 'Usa la versione del channel manager' }));

      expect(onUseChannelVersion).toHaveBeenCalledTimes(1);
      // Choosing the other version writes nothing: neither version is lost before the host decides.
      expect(onRetry).not.toHaveBeenCalled();
    });

    it('render_ConflictWithTheChannelManagerNotKeepingItsDates_SaysNotAvailableInsteadOfInventingThem', () => {
      renderSync(booking({ ...conflict, octorateVersion: null }), { onUseChannelVersion: undefined });

      const theirs = within(screen.getByTestId('booking-conflict-channel'));
      expect(theirs.getAllByText(/non disponibile/).length).toBeGreaterThan(0);
      expect(screen.queryByRole('button', { name: 'Usa la versione del channel manager' })).not.toBeInTheDocument();
    });

    it.each(['Create', 'Payment', 'Cancel'] as const)('render_ConflictOf%s_IsAFailureThatSaysWhyAndOffersRetryNowOnly', (lastOperation) => {
      const onRetry = vi.fn();
      // The dates of a creation are taken in the channel manager: there is no reservation over there that changed, and no version of it to choose.
      const refused = sync({ state: 'Conflict', lastOperation, errorCode: 'octorate_dates_unavailable', canRetry: true });
      renderSync(booking(refused), { onRetry, onUseChannelVersion: vi.fn() });

      const failed = screen.getByTestId('booking-sync-failed');
      expect(failed).toHaveAttribute('role', 'alert');
      expect(failed).toHaveAttribute('data-state', 'Conflict');
      expect(failed).toHaveTextContent('Salvata in CasaZen, non ancora nel tuo channel manager');
      expect(failed).toHaveTextContent('Le date risultano già occupate nel channel manager');
      expect(screen.queryByTestId('booking-sync-conflict')).not.toBeInTheDocument();
      expect(screen.queryByText('La prenotazione è stata modificata nel tuo channel manager')).not.toBeInTheDocument();
      expect(screen.queryByTestId('booking-conflict-channel')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Tieni la versione di CasaZen' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Usa la versione del channel manager' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Riprova ora' }));
      expect(onRetry).toHaveBeenCalledWith(false);
    });

    it('render_ConflictWhoCannotWrite_HasNoChoiceToMake', () => {
      renderSync(booking({ ...conflict, canRetry: false }));

      expect(screen.queryByRole('button', { name: 'Tieni la versione di CasaZen' })).not.toBeInTheDocument();
    });

    it.each(["Conflict", "Failed", "Pending", "NotAllowedByChannel"] as const)('render_%s_HasNoAccessibilityViolation', async (state) => {
      const row = state === 'Conflict' ? conflict : sync({ state, errorCode: 'octorate_unavailable', canRetry: true });
      const { container } = renderSync(booking(row), { onUseChannelVersion: vi.fn() });

      await expectNoAxeViolations(container);
    });

    it('render_ConflictBusy_DisablesBothChoices', () => {
      renderSync(booking(conflict), { busy: true, onUseChannelVersion: vi.fn() });

      expect(screen.getByRole('button', { name: 'Tieni la versione di CasaZen' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Usa la versione del channel manager' })).toBeDisabled();
    });
  });
});
