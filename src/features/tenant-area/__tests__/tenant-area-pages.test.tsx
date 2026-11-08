import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { loadStripe } from '@stripe/stripe-js';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { resetStripeTransferAttempts } from '@/features/bank-transfer/transfer-attempt';
import { freezeClock } from '@/test/clock';
import { TenantContractPage } from '../tenant-contract-page';
import { TenantDocumentsPage } from '../tenant-documents-page';
import { TenantDuesPage } from '../tenant-dues-page';
import { TenantMaintenanceDetailPage, TenantMaintenanceFormPage } from '../tenant-maintenance-pages';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn() }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

const area = {
  contract: { id: 'lease-1', label: 'Contratto Via Roma', status: 'Active', startDate: '2026-01-01', endDate: '2027-12-31', role: 'TenantPrimary' },
  property: { id: 'prop-1', name: 'Via Roma 12', address: 'Via Roma 12, Roma' },
  dues: [
    {
      id: 'due-1',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      dueDate: '2026-11-05',
      currency: 'EUR',
      amount: 1050,
      status: 'Scheduled',
      isOverdue: false,
      components: [
        { kind: 'Rent', amount: 900 },
        { kind: 'CondominiumAdvance', amount: 150 },
      ],
      bank: {
        accountHolder: 'Maria Bianchi',
        iban: 'IT60X0542811101000000123456',
        amount: 1050,
        dueDate: '2026-11-05',
        reference: 'CZ-2026-11-ABC',
      },
      declaration: null,
    },
  ],
  documents: [],
  emergency: { instructions: 'Chiama il numero di reperibilità.', contacts: [{ name: 'Gestore', phone: '+39 333 0000000' }] },
  maintenanceCategories: ['plumbing'],
};

function renderAt(path: string, element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/portale-conduttore/contratti/:leaseId" element={element} />
            <Route path="/portale-conduttore/contratti/:leaseId/scadenze/:dueId?" element={element} />
            <Route path="/portale-conduttore/contratti/:leaseId/documenti" element={element} />
            <Route path="/portale-conduttore/contratti/:leaseId/manutenzione/nuova" element={element} />
            <Route path="/portale-conduttore/contratti/:leaseId/manutenzione/:requestId" element={element} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('tenant area', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    cleanup();
    resetStripeTransferAttempts();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('shows the breakdown and the bank details, and a transfer declaration does not mark the installment paid', async () => {
    // 23:30 UTC is already the next calendar day in Zurich. The default must not be the UTC date.
    freezeClock('2026-01-15T23:30:00Z');
    get.mockResolvedValue({ data: area });
    post.mockResolvedValue({
      data: {
        id: 'decl-1',
        status: 'Submitted',
        amount: 1050,
        transferDate: '2026-11-04',
        submittedAt: '2026-11-04T10:00:00Z',
        bankReference: null,
      },
    });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-bank-reference')).toHaveTextContent('CZ-2026-11-ABC');
    expect(screen.getByTestId('rent-composition-rent')).toHaveTextContent(/900,00/);
    expect(screen.getByTestId('rent-composition-condominiumAdvance')).toHaveTextContent(/150,00/);
    expect(screen.getByTestId('rent-composition-total')).toHaveTextContent(/1\.?050,00/);
    expect(screen.getByTestId('tenant-due-status')).toHaveTextContent('Da pagare');

    fireEvent.click(screen.getByTestId('tenant-copy-reference'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('CZ-2026-11-ABC'));
    expect(screen.getByLabelText('Data del bonifico')).toHaveValue('2026-01-16');

    fireEvent.click(screen.getByTestId('tenant-declare-transfer'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/tenant-area/contracts/lease-1/dues/due-1/declarations');
    expect(url).not.toContain('mark-paid');
    expect(body).toMatchObject({ amount: 1050, transferDate: '2026-01-16' });
    expect(await screen.findByTestId('tenant-declaration-status')).toHaveTextContent('Inviata');
    expect(screen.getByTestId('tenant-due-status')).toHaveTextContent('Da pagare');
    expect(screen.queryByText('Pagata')).not.toBeInTheDocument();
  });

  it('sends a maintenance request to the manager and shows a simplified status without supplier terms', async () => {
    get.mockImplementation((url: string) => {
      if (String(url).endsWith('/maintenance/req-1')) {
        return Promise.resolve({
          data: {
            id: 'req-1',
            category: 'plumbing',
            urgency: 'Normal',
            description: 'Perde acqua dal lavello',
            submittedAt: '2026-11-07',
            status: 'PresoInCarico',
            supplierName: 'Idraulica Rossi',
            priceCents: 18000,
            messages: [{ id: 'm2', from: 'Supplier', body: 'Preventivo 180 euro' }],
          },
        });
      }
      return Promise.resolve({ data: area });
    });

    renderAt('/portale-conduttore/contratti/lease-1/manutenzione/req-1', <TenantMaintenanceDetailPage />);

    expect(await screen.findByTestId('tenant-request-status')).toHaveTextContent('Presa in carico dal gestore');
    expect(screen.getByText('Perde acqua dal lavello')).toBeInTheDocument();
    expect(screen.queryByText(/Rossi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/180/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Preventivo/)).not.toBeInTheDocument();
  });

  it('asks for category, urgency, description and attachments, and posts them to the manager', async () => {
    get.mockResolvedValue({ data: area });
    post.mockResolvedValue({
      data: {
        id: 'req-2',
        category: 'plumbing',
        urgency: 'Emergency',
        description: 'Perdita importante',
        status: 'Sent',
        updates: [],
        attachments: [],
      },
    });

    renderAt('/portale-conduttore/contratti/lease-1/manutenzione/nuova', <TenantMaintenanceFormPage />);

    expect(await screen.findByLabelText('Categoria')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Urgenza'), { target: { value: 'Emergency' } });
    expect(screen.getByTestId('tenant-emergency')).toHaveTextContent('non significa che qualcuno stia già intervenendo');
    expect(screen.getByTestId('tenant-emergency')).toHaveTextContent('+39 333 0000000');
    fireEvent.change(screen.getByLabelText('Descrizione'), { target: { value: 'Perdita importante' } });
    fireEvent.click(screen.getByTestId('tenant-maintenance-submit'));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/tenant-area/contracts/lease-1/maintenance');
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect(form.get('category')).toBe('plumbing');
    expect(form.get('urgency')).toBe('Emergency');
    expect(form.get('description')).toBe('Perdita importante');
    expect(toast.success).toHaveBeenCalled();
  });

  it('resets the declaration when another due is opened', async () => {
    const second = {
      ...area.dues[0],
      id: 'due-2',
      amount: 200,
      bank: { ...area.dues[0].bank, amount: 200, reference: 'CZ-DUE-2' },
    };
    get.mockResolvedValue({ data: { ...area, dues: [area.dues[0], second] } });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    const amount = await screen.findByLabelText('Importo del bonifico');
    fireEvent.change(amount, { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('tenant-due-due-2'));

    expect(await screen.findByLabelText('Importo del bonifico')).toHaveValue('200');
    expect(screen.getByTestId('tenant-bank-reference')).toHaveTextContent('CZ-DUE-2');
  });

  it('keeps the manual transfer on an euro due until a bank account is linked', async () => {
    get.mockResolvedValue({ data: area });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-bank')).toHaveTextContent('IT60X0542811101000000123456');
    expect(screen.getByTestId('tenant-bank-reference')).toHaveTextContent('CZ-2026-11-ABC');
    expect(screen.getByTestId('tenant-declare-transfer')).toHaveTextContent('Ho effettuato il bonifico');
    expect(screen.getByTestId('stripe-link-account')).toHaveTextContent('Collega il conto');
    expect(screen.getByText(/banche italiane/)).toBeInTheDocument();
    expect(screen.queryByText('Accetta e continua')).not.toBeInTheDocument();
    expect(screen.getByTestId('tenant-due-status')).toHaveTextContent('Da pagare');
  });

  it.each(['Paid', 'Cancelled'])('does not offer a transfer declaration when the installment is %s', async (status) => {
    get.mockResolvedValue({ data: { ...area, dues: [{ ...area.dues[0], status }] } });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-due-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-declaration-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stripe-bank-transfer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tenant-declaration-note')).not.toBeInTheDocument();
  });

  it('explains a condominium advance and a settlement credit, and keeps the due unpaid', async () => {
    get.mockResolvedValue({
      data: {
        ...area,
        dues: [
          {
            ...area.dues[0],
            amount: 970,
            residual: 970,
            components: [
              { kind: 'Rent', amount: 900 },
              { kind: 'CondominiumAdvance', amount: 150 },
              { kind: 'CondominiumSettlement', amount: -80 },
            ],
          },
        ],
      },
    });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-advance-note')).toHaveTextContent('già dentro questa scadenza');
    expect(screen.getByTestId('tenant-settlement-note')).toHaveTextContent('è un credito');
    expect(screen.getByTestId('tenant-due-amount')).toHaveTextContent(/970,00/);
    expect(screen.getByTestId('tenant-due-status')).toHaveTextContent('Da pagare');
    expect(screen.getByTestId('tenant-sepa')).toHaveTextContent('banche italiane');
    expect(screen.getByTestId('tenant-manual')).toBeInTheDocument();
  });

  it('does not ask for a payment when the residual is settled', async () => {
    get.mockResolvedValue({
      data: {
        ...area,
        dues: [
          {
            ...area.dues[0],
            amount: 0,
            residual: 0,
            components: [
              { kind: 'Rent', amount: 100 },
              { kind: 'CondominiumSettlement', amount: -100 },
            ],
          },
        ],
      },
    });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-due-settled')).toHaveTextContent('Sei in pari');
    expect(screen.queryByTestId('tenant-sepa')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tenant-declaration-form')).not.toBeInTheDocument();
  });

  it('shows the failed debit and keeps SEPA and the manual transfer', async () => {
    get.mockResolvedValue({ data: { ...area, dues: [{ ...area.dues[0], status: 'Failed' }] } });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-due-failed')).toHaveTextContent('bonifico manuale');
    expect(screen.getByTestId('tenant-due-status')).toHaveTextContent('Addebito non riuscito');
    expect(screen.getByTestId('stripe-link-account')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-declare-transfer')).toBeInTheDocument();
  });

  it('keeps SEPA off a due that is not in euro and shows the manual transfer', async () => {
    get.mockResolvedValue({ data: { ...area, dues: [{ ...area.dues[0], currency: 'CHF' }] } });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-sepa-unavailable')).toHaveTextContent('solo in euro');
    expect(screen.queryByTestId('stripe-bank-transfer')).not.toBeInTheDocument();
    expect(screen.getByTestId('tenant-manual')).toBeInTheDocument();
  });

  it('shows the declaration error and leaves the due unpaid', async () => {
    get.mockResolvedValue({ data: area });
    post.mockRejectedValue(new Error('down'));

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    fireEvent.click(await screen.findByTestId('tenant-declare-transfer'));

    expect(await screen.findByTestId('tenant-declaration-error')).toHaveTextContent('Non riesco a registrare la dichiarazione');
    expect(screen.getByTestId('tenant-due-status')).toHaveTextContent('Da pagare');
  });

  it('uses an empty state when there is no due', async () => {
    get.mockResolvedValue({ data: { ...area, dues: [] } });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-dues-empty')).toHaveTextContent('Nessuna scadenza');
    expect(screen.queryByTestId('tenant-sepa')).not.toBeInTheDocument();
  });

  it('names the next amount on the contract and does not show the bank details', async () => {
    get.mockResolvedValue({ data: area });

    renderAt('/portale-conduttore/contratti/lease-1', <TenantContractPage />);

    expect(await screen.findByTestId('tenant-contract-next')).toHaveTextContent('05/11/2026');
    expect(screen.getByRole('link', { name: 'Paga la scadenza' })).toHaveAttribute(
      'href',
      '/portale-conduttore/contratti/lease-1/scadenze/due-1',
    );
    expect(screen.queryByTestId('tenant-bank')).not.toBeInTheDocument();
    expect(screen.queryByText('IT60X0542811101000000123456')).not.toBeInTheDocument();
  });

  it('retries a failed euro SEPA debit with a new key and a manual declaration does not mark the due paid', async () => {
    const collect = vi.fn().mockResolvedValue({
      financialConnectionsSession: { id: 'fcsess_1', accounts: [{ id: 'fca_1' }] },
    });
    vi.mocked(loadStripe).mockResolvedValue({ collectFinancialConnectionsAccounts: collect } as never);

    const failed = { ...area, dues: [{ ...area.dues[0], status: 'Failed' }] };
    let debitAccepted = false;
    get.mockImplementation(() => Promise.resolve({ data: debitAccepted ? failed : area }));
    post.mockImplementation((url: string) => {
      const path = String(url);
      if (path.endsWith('/session')) {
        return Promise.resolve({ data: { sessionId: 'fcsess_1', clientSecret: 'fcsess_secret', publishableKey: 'pk_test' } });
      }
      if (path.endsWith('/payment')) {
        debitAccepted = true;
        return Promise.resolve({
          data: {
            paymentId: 'pay-1',
            paymentIntentId: 'pi_1',
            clientSecret: null,
            stripeStatus: 'processing',
            paymentMethodType: 'sepa_debit',
            dueSettled: false,
          },
        });
      }
      if (path.endsWith('/declarations')) {
        return Promise.resolve({
          data: {
            id: 'decl-1',
            status: 'Submitted',
            amount: 1050,
            transferDate: '2026-11-04',
            submittedAt: '2026-11-04T10:00:00Z',
            bankReference: null,
          },
        });
      }
      return Promise.resolve({
        data: { linked: true, accountId: 'fca_1', institutionName: 'Banca Test', last4: '6789', displayName: null },
      });
    });

    renderAt('/portale-conduttore/contratti/lease-1/scadenze/due-1', <TenantDuesPage />);

    fireEvent.click(await screen.findByTestId('tenant-declare-transfer'));
    expect(await screen.findByTestId('tenant-declaration-status')).toHaveTextContent('Inviata');
    expect(screen.getByTestId('tenant-due-status')).toHaveTextContent('Da pagare');
    const declaration = post.mock.calls.find((call) => String(call[0]).endsWith('/declarations'));
    expect(String(declaration?.[0])).toBe('/tenant-area/contracts/lease-1/dues/due-1/declarations');
    expect(String(declaration?.[0])).not.toContain('mark-paid');
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThanOrEqual(2));

    fireEvent.click(await screen.findByTestId('stripe-link-account'));
    fireEvent.click(await screen.findByTestId('stripe-start-transfer'));
    await waitFor(() => expect(post.mock.calls.filter((call) => String(call[0]).endsWith('/payment'))).toHaveLength(1));

    expect(await screen.findByTestId('tenant-due-status')).toHaveTextContent('Addebito non riuscito');
    const retry = await screen.findByTestId('stripe-start-transfer');
    fireEvent.click(retry);

    await waitFor(() => {
      const payments = post.mock.calls.filter((call) => String(call[0]).endsWith('/payment'));
      expect(payments).toHaveLength(2);
    });
    const payments = post.mock.calls.filter((call) => String(call[0]).endsWith('/payment'));
    const keys = payments.map((call) => (call[2] as { headers: { 'Idempotency-Key': string } }).headers['Idempotency-Key']);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBeTruthy();
    expect(keys[0]).not.toBe(keys[1]);
    expect(payments.every((call) => !String(call[0]).includes('mark-paid'))).toBe(true);
    expect(screen.getByTestId('tenant-due-status')).toHaveTextContent('Addebito non riuscito');
    expect(screen.queryByText('Pagata')).not.toBeInTheDocument();
  });

  it('points the contract at the later due that still has a residual and does not call a balanced due late', async () => {
    const settled = {
      ...area.dues[0],
      id: 'due-settled',
      dueDate: '2026-10-05',
      amount: 0,
      residual: 0,
      isOverdue: true,
      components: [
        { kind: 'Rent', amount: 100 },
        { kind: 'CondominiumSettlement', amount: -100 },
      ],
    };
    const later = {
      ...area.dues[0],
      id: 'due-later',
      dueDate: '2026-12-05',
      amount: 400,
      residual: 400,
      isOverdue: true,
    };
    get.mockResolvedValue({ data: { ...area, dues: [settled, later] } });

    renderAt('/portale-conduttore/contratti/lease-1', <TenantContractPage />);

    expect(await screen.findByRole('link', { name: 'Paga la scadenza' })).toHaveAttribute(
      'href',
      '/portale-conduttore/contratti/lease-1/scadenze/due-later',
    );
    expect(screen.queryByRole('link', { name: 'Vedi la scadenza' })).not.toBeInTheDocument();

    cleanup();
    renderAt('/portale-conduttore/contratti/lease-1/scadenze', <TenantDuesPage />);

    expect(await screen.findByTestId('tenant-due-due-settled')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-due-late-due-settled')).not.toBeInTheDocument();
    expect(screen.getByTestId('tenant-due-late-due-later')).toHaveTextContent('In ritardo');
  });

  it('sends a tenant with no shared documents to the dues', async () => {
    get.mockResolvedValue({ data: area });

    renderAt('/portale-conduttore/contratti/lease-1/documenti', <TenantDocumentsPage />);

    expect(await screen.findByTestId('tenant-documents-empty')).toHaveTextContent('conguaglio');
    expect(screen.getByRole('link', { name: 'Vai ai canoni' })).toHaveAttribute(
      'href',
      '/portale-conduttore/contratti/lease-1/scadenze',
    );
  });
});
