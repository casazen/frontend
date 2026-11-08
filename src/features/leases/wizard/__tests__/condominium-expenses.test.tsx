import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { CondominiumExpenses } from '../condominium-expenses';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const post = vi.mocked(axios.post);
const PATH = '/leases/lease-1/draft/condominium-expense';

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    source: 'ConfirmedBudget',
    installmentAmount: 120,
    lastInstallmentAmount: 120,
    installments: 12,
    annualAmount: 1440,
    previousConsuntivo: null,
    preventivo: 1440,
    settledAtConsuntivo: false,
    periodId: 'period-1',
    periodLabel: '2025/2026',
    ...overrides,
  };
}

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function expenses(queryClient = client()) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <CondominiumExpenses propertyId="prop-1" leaseId="lease-1" />
      </I18nextProvider>
    </QueryClientProvider>
  );
}

function renderExpenses() {
  return render(expenses());
}

function nothingLoaded(): AxiosError {
  return new AxiosError('invalid', '422', undefined, undefined, {
    status: 422,
    data: { code: 'tenant_expense_proposal_invalid' },
  } as never);
}

describe('Condominium expenses on the contract wizard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    post.mockReset();
  });

  it('does not post an empty body when the step opens', async () => {
    renderExpenses();

    expect(await screen.findByTestId('lease-condominium-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-condominium-error')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('calculates the amount from the previous consuntivo and the new preventivo', async () => {
    post.mockResolvedValue({
      data: proposal({
        source: 'Statements',
        installmentAmount: 95.5,
        lastInstallmentAmount: 95.5,
        annualAmount: 1146,
        previousConsuntivo: 1000,
        preventivo: 1146,
        settledAtConsuntivo: true,
        periodId: null,
        periodLabel: null,
      }),
    });

    renderExpenses();

    expect(await screen.findByTestId('lease-condominium-empty')).toHaveTextContent('consuntivo');
    expect(screen.getByTestId('lease-condominium-limits')).toHaveTextContent('millesimi');
    expect(screen.getByLabelText("Consuntivo dell'anno precedente (€)")).toBeInTheDocument();
    expect(screen.getByLabelText('Preventivo del nuovo anno (€)')).toBeInTheDocument();
    expect(screen.getByTestId('lease-condominium-calculate')).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Consuntivo dell'anno precedente (€)"), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Preventivo del nuovo anno (€)'), { target: { value: '1146' } });
    fireEvent.click(screen.getByTestId('lease-condominium-calculate'));

    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(
        PATH,
        { cadence: 'Monthly', previousConsuntivo: 1000, preventivo: 1146 },
        undefined,
      ),
    );
    expect(await screen.findByTestId('lease-condominium-saved')).toHaveTextContent(/95,50/);
    expect(screen.getByText('Si conguaglia al consuntivo.')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-condominium-accept')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-condominium-manual')).not.toBeInTheDocument();
    expect(post.mock.calls.filter((call) => (call[1] as { advanceMode?: string } | undefined)?.advanceMode)).toHaveLength(0);
  });

  it('saves a hand-typed amount to be settled at consuntivo and does not drop that on a second click', async () => {
    post.mockResolvedValue({
      data: proposal({
        source: 'Manual',
        installmentAmount: 80,
        lastInstallmentAmount: 80,
        annualAmount: 960,
        previousConsuntivo: null,
        preventivo: null,
        settledAtConsuntivo: true,
        periodId: null,
        periodLabel: null,
      }),
    });

    renderExpenses();

    expect(await screen.findByText('Si conguaglia al consuntivo. Le rate già emesse non cambiano.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Importo a mano (€ al mese)'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('lease-condominium-manual'));

    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(PATH, { cadence: 'Monthly', manualAmount: 80 }, undefined),
    );
    expect(await screen.findByTestId('lease-condominium-saved')).toHaveTextContent(/80,00/);
    expect(screen.queryByTestId('lease-condominium-accept')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-condominium-manual')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls.some((call) => Object.keys((call[1] as object) ?? {}).length === 0)).toBe(false);
    expect(post.mock.calls.some((call) => (call[1] as { manualAmount?: number }).manualAmount === undefined && Object.keys((call[1] as object) ?? {}).length > 0)).toBe(false);
  });

  it('accepts an Italian comma amount, including thousands grouping', async () => {
    post.mockResolvedValue({
      data: proposal({
        source: 'Manual',
        installmentAmount: 95.5,
        lastInstallmentAmount: 95.5,
        annualAmount: 1146,
        previousConsuntivo: null,
        preventivo: null,
        settledAtConsuntivo: true,
        periodId: null,
        periodLabel: null,
      }),
    });

    renderExpenses();

    const manual = await screen.findByLabelText('Importo a mano (€ al mese)');
    expect(screen.getByTestId('lease-condominium-manual')).toBeDisabled();
    fireEvent.change(manual, { target: { value: '95,50' } });
    expect(screen.getByTestId('lease-condominium-manual')).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Consuntivo dell'anno precedente (€)"), { target: { value: '1.234,50' } });
    fireEvent.change(screen.getByLabelText('Preventivo del nuovo anno (€)'), { target: { value: '95,50' } });
    expect(screen.getByTestId('lease-condominium-calculate')).toBeEnabled();

    fireEvent.click(screen.getByTestId('lease-condominium-manual'));

    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith(PATH, { cadence: 'Monthly', manualAmount: 95.5 }, undefined),
    );
  });

  it('keeps a settle-at-consuntivo choice when the step is opened again', async () => {
    post.mockResolvedValue({
      data: proposal({
        source: 'Manual',
        installmentAmount: 80,
        lastInstallmentAmount: 80,
        annualAmount: 960,
        previousConsuntivo: null,
        preventivo: null,
        settledAtConsuntivo: true,
        periodId: null,
        periodLabel: null,
      }),
    });
    const queryClient = client();
    const view = render(expenses(queryClient));

    fireEvent.change(await screen.findByLabelText('Importo a mano (€ al mese)'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('lease-condominium-manual'));
    expect(await screen.findByTestId('lease-condominium-saved')).toHaveTextContent(/80,00/);
    const calls = post.mock.calls.length;

    view.unmount();
    render(expenses(queryClient));

    expect(await screen.findByTestId('lease-condominium-saved')).toHaveTextContent(/80,00/);
    expect(screen.getByText('Si conguaglia al consuntivo.')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-condominium-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lease-condominium-accept')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(calls);
  });

  it('treats a missing year as nothing loaded and does not ask the server', async () => {
    post.mockRejectedValue(nothingLoaded());

    renderExpenses();

    expect(await screen.findByTestId('lease-condominium-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-condominium-error')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
