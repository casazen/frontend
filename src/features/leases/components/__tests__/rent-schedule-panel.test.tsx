import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { freezeClock } from '@/test/clock';
import { RentSchedulePanel } from '../rent-schedule-panel';
import { httpError } from '../../__tests__/lease-test-utils';
import type { RentInstallment, RentLedger } from '@/types';

// LT-06 (#269, A7-07): the rent schedule of a lease. States come from the API: "paid" only when Stripe confirmed it or
// the landlord recorded an offline payment; an API error is a load error, never an empty schedule.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);
const put = vi.mocked(axios.put);

const RENT_URL = '/leases/lease-1/rent';

function installment(overrides: Partial<RentInstallment> = {}): RentInstallment {
  return {
    id: 'inst-1',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    dueDate: '2026-10-05',
    amount: 950,
    currency: 'EUR',
    status: 'Scheduled',
    isOverdue: false,
    paidVia: null,
    paidOn: null,
    offlinePaymentNote: null,
    paymentRequestedAt: null,
    failureCode: null,
    lastFailedAt: null,
    ...overrides,
  };
}

function ledger(overrides: Partial<RentLedger> = {}): RentLedger {
  return {
    leaseId: 'lease-1',
    monthlyRent: 950,
    canConfigure: true,
    onlinePaymentsAvailable: true,
    hasTenantEmail: true,
    schedule: { cadence: 'Monthly', billingDayOfMonth: 5, amount: 950, currency: 'EUR', isActive: true },
    installments: [installment()],
    partialFinalPeriod: null,
    ...overrides,
  };
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <RentSchedulePanel leaseId="lease-1" />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('RentSchedulePanel (LT-06)', () => {
  beforeEach(async () => {
    freezeClock('2026-10-10T08:00:00Z');
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it('render_LoadFails_ShowsErrorWithRetryNotAnEmptySchedule', async () => {
    get.mockRejectedValue(httpError(500));

    renderPanel();

    expect(await screen.findByTestId('rent-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('rent-no-installments')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rent-schedule-form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeEnabled();
  });

  it('render_LeaseNotSigned_ExplainsWhenTheScheduleCanBeSetUp', async () => {
    get.mockResolvedValue({ data: ledger({ canConfigure: false, schedule: null, installments: [] }) });

    renderPanel();

    expect(await screen.findByTestId('rent-not-signed')).toHaveTextContent('firmato da tutte le parti');
    expect(screen.queryByTestId('rent-schedule-form')).not.toBeInTheDocument();
  });

  it('createSchedule_DefaultsLeftEmpty_SendsOnlyTheCadenceSoTheServerUsesTheLease', async () => {
    get.mockResolvedValue({ data: ledger({ schedule: null, installments: [] }) });
    put.mockResolvedValue({ data: ledger() });

    renderPanel();

    const form = within(await screen.findByTestId('rent-schedule-form'));
    fireEvent.change(form.getByLabelText('Periodicità'), { target: { value: 'Quarterly' } });
    expect(form.getByText(/canone mensile del contratto/)).toHaveTextContent(/2\.?850,00/);
    fireEvent.click(form.getByRole('button', { name: 'Genera lo scadenziario' }));

    await waitFor(() => expect(put).toHaveBeenCalledWith(`${RENT_URL}/schedule`, { cadence: 'Quarterly' }, undefined));
    expect(toast.success).toHaveBeenCalledWith('Scadenziario del canone salvato');
  });

  it('createSchedule_BillingDayOutOfRange_BlocksTheSubmit', async () => {
    get.mockResolvedValue({ data: ledger({ schedule: null, installments: [] }) });

    renderPanel();

    const form = within(await screen.findByTestId('rent-schedule-form'));
    fireEvent.change(form.getByLabelText('Giorno di scadenza (1-28)'), { target: { value: '31' } });

    expect(form.getByRole('alert')).toHaveTextContent('tra 1 e 28');
    expect(form.getByRole('button', { name: 'Genera lo scadenziario' })).toBeDisabled();
  });

  it('render_Installments_ShowRealStatesOverdueAndHowTheyWerePaid', async () => {
    get.mockResolvedValue({
      data: ledger({
        installments: [
          installment({ id: 'a', status: 'Paid', paidVia: 'Stripe', paidOn: '2026-09-04', periodStart: '2026-09-01', periodEnd: '2026-09-30' }),
          installment({ id: 'b', status: 'Paid', paidVia: 'Offline', paidOn: '2026-10-03', offlinePaymentNote: 'Bonifico' }),
          installment({ id: 'c', status: 'Failed', failureCode: 'card_declined', isOverdue: true }),
          installment({ id: 'd', status: 'Processing' }),
          installment({ id: 'e', status: 'Scheduled' }),
        ],
      }),
    });

    renderPanel();

    const rows = await screen.findAllByTestId('rent-installment');
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByTestId('rent-installment-status')).toHaveTextContent('Pagata');
    expect(rows[0]).toHaveTextContent('Pagata online il 04/09/2026 (confermato da Stripe)');
    expect(rows[1]).toHaveTextContent('Incasso registrato da te: pagata il 03/10/2026 · Bonifico');
    expect(within(rows[2]).getByTestId('rent-installment-status')).toHaveTextContent('Pagamento non riuscito');
    expect(within(rows[2]).getByTestId('rent-installment-overdue')).toHaveTextContent('Scaduta');
    expect(rows[2]).toHaveTextContent('card_declined');
    expect(within(rows[3]).getByTestId('rent-installment-status')).toHaveTextContent('Pagamento in corso');
    expect(within(rows[4]).getByTestId('rent-installment-status')).toHaveTextContent('Da incassare');
    // Paid or in flight: no action; to collect or failed: link and offline payment.
    expect(within(rows[0]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(rows[3]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(rows[2]).getByRole('button', { name: 'Segna come pagata' })).toBeInTheDocument();
    expect(within(rows[4]).getByRole('button', { name: 'Invia link di pagamento' })).toBeInTheDocument();
  });

  it('render_WithoutStripeAccount_OffersOnlyTheOfflinePaymentAndLinksToPayments', async () => {
    get.mockResolvedValue({ data: ledger({ onlinePaymentsAvailable: false }) });

    renderPanel();

    const notice = await screen.findByTestId('rent-online-unavailable');
    expect(within(notice).getByRole('link', { name: 'Vai a Pagamenti' })).toHaveAttribute('href', '/app/short-rent/settings/payments');
    const row = screen.getByTestId('rent-installment');
    expect(within(row).queryByRole('button', { name: 'Invia link di pagamento' })).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Segna come pagata' })).toBeInTheDocument();
  });

  it('markPaid_DateAndNote_PostsTheOfflinePayment', async () => {
    get.mockResolvedValue({ data: ledger() });
    post.mockResolvedValue({ data: installment({ status: 'Paid', paidVia: 'Offline', paidOn: '2026-10-08' }) });

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Segna come pagata' }));
    const dialog = within(await screen.findByTestId('mark-rent-paid-dialog'));
    fireEvent.change(dialog.getByLabelText('Data del pagamento'), { target: { value: '2026-10-08' } });
    fireEvent.change(dialog.getByLabelText('Nota (facoltativa)'), { target: { value: ' Bonifico ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Registra il pagamento' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `${RENT_URL}/installments/inst-1/mark-paid`,
        { paidOn: '2026-10-08', note: 'Bonifico' },
        undefined,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Pagamento registrato');
  });

  it('markPaid_DateInTheFuture_CannotBeSubmitted', async () => {
    get.mockResolvedValue({ data: ledger() });

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Segna come pagata' }));
    const dialog = within(await screen.findByTestId('mark-rent-paid-dialog'));
    fireEvent.change(dialog.getByLabelText('Data del pagamento'), { target: { value: '2026-10-11' } });

    expect(dialog.getByRole('alert')).toHaveTextContent('non successiva a oggi');
    expect(dialog.getByRole('button', { name: 'Registra il pagamento' })).toBeDisabled();
  });

  it('sendLink_ServerRefuses_ShowsTheServerReasonAndReloads', async () => {
    get.mockResolvedValue({ data: ledger() });
    post.mockRejectedValue(httpError(409, { code: 'rent_installment_in_flight' }));

    renderPanel();

    fireEvent.click(await screen.findByRole('button', { name: 'Invia link di pagamento' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Un pagamento online della rata è in corso: attendi l'esito da Stripe."),
    );
    expect(post).toHaveBeenCalledWith(`${RENT_URL}/installments/inst-1/payment-request`, undefined, undefined);
    await waitFor(() => expect(get.mock.calls.filter(([url]) => url === RENT_URL).length).toBeGreaterThan(1));
  });
  it('render_LeaseGetsSigned_ReadsTheLedgerAgainAndOffersTheSchedule', async () => {
    // A7-29 (found by the e2e): the panel was rendered while the lease was a draft and kept "not signed yet" after the
    // landlord uploaded the signed contract, until a reload.
    get.mockResolvedValueOnce({ data: ledger({ canConfigure: false, schedule: null, installments: [] }) });
    get.mockResolvedValue({ data: ledger({ canConfigure: true, schedule: null, installments: [] }) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const tree = (status: string) => (
      <QueryClientProvider client={client}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <RentSchedulePanel leaseId="lease-1" leaseStatus={status} />
          </MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>
    );
    const view = render(tree('Draft'));
    expect(await screen.findByTestId('rent-not-signed')).toBeInTheDocument();

    view.rerender(tree('Signed'));

    expect(await screen.findByRole('button', { name: /Genera lo scadenziario/ })).toBeInTheDocument();
    expect(screen.queryByTestId('rent-not-signed')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
