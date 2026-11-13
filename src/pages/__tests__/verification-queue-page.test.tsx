import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { verificationApi } from '@/api/verification.api';
import { expectNoAxeViolations } from '@/test/axe';
import type { PendingVerification, VerificationMetrics } from '@/types/verification.types';
import { VerificationQueuePage } from '../VerificationQueuePage';

vi.mock('@/api/verification.api', () => ({
  verificationApi: {
    getPending: vi.fn(),
    getMetrics: vi.fn(),
    requestNewPhoto: vi.fn(),
    recordVerification: vi.fn(),
    rejectVerification: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const BOOKING_A = '11111111-1111-4111-8111-111111111111';
const BOOKING_B = '22222222-2222-4222-8222-222222222222';
const BOOKING_C = '33333333-3333-4333-8333-333333333333';

const uncertain: PendingVerification = {
  bookingId: BOOKING_A,
  propertyId: 'p-1',
  propertyName: 'Villa Demo',
  checkInDate: '2099-10-10T00:00:00Z',
  checkOutDate: '2099-10-12T00:00:00Z',
  guestName: 'Mario Rossi',
  guestEmail: 'mario@example.test',
  biometricOutcome: 'Escalate',
  biometricAttempts: 1,
  raisedAt: '2099-10-01T08:00:00Z',
  provisional: true,
  reasons: [
    { check: 'quality', result: 'passed' },
    { check: 'liveness', result: 'passed', value: 0.93, threshold: 0.8 },
    { check: 'document_validity', result: 'passed' },
    { check: 'mrz_consistency', result: 'passed' },
    { check: 'similarity', result: 'between_thresholds', value: 0.78, threshold: 0.85 },
  ],
};

const asked: PendingVerification = {
  bookingId: BOOKING_B,
  propertyId: 'p-2',
  propertyName: 'Casa Mare',
  checkInDate: '2020-01-05T00:00:00Z',
  checkOutDate: '2020-01-07T00:00:00Z',
  guestName: 'Anna Verdi',
  guestEmail: null,
  biometricOutcome: null,
  biometricAttempts: 0,
  raisedAt: '2020-01-01T08:00:00Z',
  reasons: [],
  provisional: false,
};

const broken: PendingVerification = {
  bookingId: BOOKING_C,
  propertyId: 'p-3',
  propertyName: 'Loft Centro',
  checkInDate: '2099-11-01T00:00:00Z',
  checkOutDate: '2099-11-03T00:00:00Z',
  guestName: 'Luca Neri',
  guestEmail: 'luca@example.test',
  biometricOutcome: 'Escalate',
  biometricAttempts: 1,
  raisedAt: '2099-10-20T08:00:00Z',
  reasons: [{ check: 'processing', result: 'unavailable' }],
};

const metrics: VerificationMetrics = {
  from: '2099-09-15',
  to: '2099-10-14',
  ok: 12,
  review: 3,
  notOk: 2,
  operatorApproved: 3,
  operatorRejected: 1,
  operatorDecisions: 4,
  operatorShare: 0.25,
};

function httpError(status: number, data?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <VerificationQueuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

function card(propertyName: string) {
  return within(screen.getByText(propertyName).closest('[data-testid="verification-item"]') as HTMLElement);
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(verificationApi.getPending).mockResolvedValue([uncertain, asked, broken]);
  vi.mocked(verificationApi.getMetrics).mockResolvedValue(metrics);
  vi.mocked(verificationApi.recordVerification).mockResolvedValue(undefined);
  vi.mocked(verificationApi.rejectVerification).mockResolvedValue(undefined);
  vi.mocked(verificationApi.requestNewPhoto).mockResolvedValue(undefined);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('VerificationQueuePage (E03/F04/US03/T02)', () => {
  it('VerificationQueuePage_PendingVerifications_ShowsPropertyArrivalWhyAndEveryCheckWithValueAndThreshold', async () => {
    renderPage();
    await screen.findByText('Villa Demo');

    const villa = card('Villa Demo');
    // The property and the arrival and departure of the stay (read as written, no shift of the day).
    expect(villa.getByText(/10 ottobre 2099/)).toBeInTheDocument();
    expect(villa.getByText(/12 ottobre 2099/)).toBeInTheDocument();
    // Why it is here: the comparison fell between the two thresholds.
    expect(villa.getByTestId('verification-why')).toHaveAttribute('data-reason', 'uncertain');
    expect(villa.getByTestId('verification-why')).toHaveTextContent(i18n.t('verification.why.uncertain'));
    // Every check of the automatic outcome, with its value and its threshold where it has them.
    const reasons = villa.getAllByTestId('verification-reason');
    expect(reasons).toHaveLength(5);
    expect(reasons[0]).toHaveTextContent('Qualità della foto: superato');
    expect(reasons[1]).toHaveTextContent('Ripresa dal vivo: superato (valore 0,93, soglia 0,8)');
    expect(reasons[4]).toHaveTextContent('Confronto del volto: tra le due soglie: decide una persona (valore 0,78, soglia 0,85)');

    expect(card('Loft Centro').getByTestId('verification-why')).toHaveAttribute('data-reason', 'technical_error');
    expect(card('Casa Mare').getByTestId('verification-why')).toHaveAttribute('data-reason', 'operator_requested');
  });

  it('VerificationQueuePage_NoAutomaticOutcome_SaysTheGuestAskedForAPersonAndListsNoChecks', async () => {
    renderPage();
    await screen.findByText('Casa Mare');

    const casa = card('Casa Mare');
    expect(casa.getByTestId('verification-why')).toHaveTextContent(i18n.t('verification.why.operator_requested'));
    expect(casa.queryByTestId('verification-checks')).not.toBeInTheDocument();
    // Without an address on file the operator is sent to the booking to find the contact.
    expect(casa.queryByTestId('verification-guest-email')).not.toBeInTheDocument();
    expect(casa.getByTestId('verification-contact-hint')).toHaveTextContent(i18n.t('verification.guest.noContact'));
    expect(casa.getByRole('link', { name: new RegExp(i18n.t('verification.guest.openBooking')) })).toHaveAttribute(
      'href',
      `/app/short-rent/bookings/${BOOKING_B}`,
    );
  });

  it('VerificationQueuePage_GuestWithAnEmail_ShowsTheContactAsALinkForTheCallOutsideCasaZen', async () => {
    renderPage();
    await screen.findByText('Villa Demo');

    const villa = card('Villa Demo');
    expect(villa.getByTestId('verification-guest-email')).toHaveAttribute('href', 'mailto:mario@example.test');
    expect(villa.getByTestId('verification-contact-hint')).toHaveTextContent(i18n.t('verification.guest.contactHint'));
  });

  it('VerificationQueuePage_ThresholdsNotCalibrated_ShowsTheProvisionalBadgeOnThatItemOnly', async () => {
    renderPage();
    await screen.findByText('Villa Demo');

    expect(card('Villa Demo').getByTestId('verification-provisional')).toHaveTextContent('Soglie provvisorie');
    expect(card('Casa Mare').queryByTestId('verification-provisional')).not.toBeInTheDocument();
    expect(card('Loft Centro').queryByTestId('verification-provisional')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('verification-provisional')).toHaveLength(1);
  });

  it('VerificationQueuePage_Metrics_ShowsOkReviewedNotOkAndTheShareDecidedByAnOperator', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId('verification-metric-ok')).toHaveTextContent('12'));
    expect(screen.getByTestId('verification-metric-review')).toHaveTextContent('3');
    expect(screen.getByTestId('verification-metric-not-ok')).toHaveTextContent('2');
    expect(screen.getByTestId('verification-metric-operator-share')).toHaveTextContent('25%');
    expect(screen.getByTestId('verification-metrics')).toHaveTextContent(/15 set/);
  });

  it('VerificationQueuePage_MetricsCannotBeRead_SaysSoInsteadOfShowingZeros', async () => {
    vi.mocked(verificationApi.getMetrics).mockRejectedValue(httpError(400));
    renderPage();

    await screen.findByTestId('verification-metrics-error');
    expect(screen.queryByTestId('verification-metric-ok')).not.toBeInTheDocument();
    // The queue is still usable.
    expect(screen.getByText('Villa Demo')).toBeInTheDocument();
  });

  it('VerificationQueuePage_QueueCannotBeRead_ShowsTheErrorNotAnEmptyQueue', async () => {
    vi.mocked(verificationApi.getPending).mockRejectedValue(httpError(400));
    renderPage();

    expect(await screen.findByText(i18n.t('verification.queue.loadError'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('verification.queue.emptyQueue'))).not.toBeInTheDocument();
  });

  it('VerificationQueuePage_ReasonFilter_KeepsOnlyTheVerificationsOfThatReason', async () => {
    renderPage();
    await screen.findByText('Villa Demo');

    fireEvent.change(screen.getByLabelText(i18n.t('verification.filter.reason')), { target: { value: 'technical_error' } });

    expect(screen.queryByText('Villa Demo')).not.toBeInTheDocument();
    expect(screen.queryByText('Casa Mare')).not.toBeInTheDocument();
    expect(screen.getByText('Loft Centro')).toBeInTheDocument();
  });

  it('VerificationQueuePage_DeadlineFilter_ReadsTheArrivalAsAStayDateInRome', async () => {
    renderPage();
    await screen.findByText('Villa Demo');

    fireEvent.change(screen.getByLabelText(i18n.t('verification.filter.deadline')), { target: { value: 'past' } });

    expect(screen.getByText('Casa Mare')).toBeInTheDocument();
    expect(screen.queryByText('Villa Demo')).not.toBeInTheDocument();
    expect(screen.queryByText('Loft Centro')).not.toBeInTheDocument();
  });

  it('VerificationQueuePage_Approve_RecordsTheDecisionWithNoNoteAndSaysTheCodeWasSent', async () => {
    renderPage();
    await screen.findByText('Villa Demo');

    fireEvent.click(card('Villa Demo').getByTestId('verification-decide'));
    fireEvent.click(await screen.findByTestId('verification-approve'));

    await waitFor(() => expect(verificationApi.recordVerification).toHaveBeenCalledWith(BOOKING_A, { outcome: true, note: undefined }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('verification.action.verified')));
    expect(i18n.t('verification.action.verified')).toMatch(/codice di accesso/);
  });

  it('VerificationQueuePage_NotVerified_NeedsANoteBeforeItCanBeSent', async () => {
    renderPage();
    await screen.findByText('Villa Demo');

    fireEvent.click(card('Villa Demo').getByTestId('verification-decide'));
    const notVerified = await screen.findByTestId('verification-not-verified');
    expect(notVerified).toBeDisabled();

    fireEvent.change(screen.getByLabelText(i18n.t('verification.dialog.noteLabel')), { target: { value: '  Foto diversa dal documento  ' } });
    expect(notVerified).toBeEnabled();
    fireEvent.click(notVerified);

    await waitFor(() =>
      expect(verificationApi.recordVerification).toHaveBeenCalledWith(BOOKING_A, { outcome: false, note: 'Foto diversa dal documento' }),
    );
  });

  it('VerificationQueuePage_RejectCheckIn_NeedsAReason', async () => {
    renderPage();
    await screen.findByText('Villa Demo');

    fireEvent.click(card('Villa Demo').getByTestId('verification-reject'));
    const confirm = await screen.findByTestId('verification-confirm-reject');
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText(i18n.t('verification.dialog.reasonLabel')), { target: { value: 'Documento contraffatto' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(verificationApi.rejectVerification).toHaveBeenCalledWith(BOOKING_A, { reason: 'Documento contraffatto' }));
  });

  it('VerificationQueuePage_AWriteIsInFlight_EveryButtonOfThatCardStaysDisabledAndTheOtherCardsAreFree', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(verificationApi.requestNewPhoto).mockReturnValue(
      new Promise<undefined>((resolve) => {
        finish = () => resolve(undefined);
      }),
    );
    renderPage();
    await screen.findByText('Villa Demo');

    const villa = card('Villa Demo');
    fireEvent.click(villa.getByRole('button', { name: i18n.t('verification.action.request_photo') }));

    await waitFor(() => expect(villa.getByTestId('verification-decide')).toBeDisabled());
    for (const button of villa.getAllByRole('button')) expect(button).toBeDisabled();
    // Another card is a card of its own.
    expect(card('Casa Mare').getByTestId('verification-decide')).toBeEnabled();

    finish();
    await waitFor(() => expect(villa.getByTestId('verification-decide')).toBeEnabled());
  });

  it('VerificationQueuePage_DecisionFails_ShowsTheErrorAndKeepsTheNote', async () => {
    vi.mocked(verificationApi.recordVerification).mockRejectedValue(httpError(404, { code: 'no_pending_verification' }));
    renderPage();
    await screen.findByText('Villa Demo');

    fireEvent.click(card('Villa Demo').getByTestId('verification-decide'));
    fireEvent.change(await screen.findByLabelText(i18n.t('verification.dialog.noteLabel')), { target: { value: 'Controllato a voce' } });
    fireEvent.click(screen.getByTestId('verification-approve'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByLabelText(i18n.t('verification.dialog.noteLabel'))).toHaveValue('Controllato a voce');
  });

  it('VerificationQueuePage_Rendered_HasNoAccessibilityViolations', async () => {
    const { container } = renderPage();
    await screen.findByText('Villa Demo');
    await waitFor(() => expect(screen.getByTestId('verification-metric-ok')).toBeInTheDocument());

    await expectNoAxeViolations(container);
  });
});
