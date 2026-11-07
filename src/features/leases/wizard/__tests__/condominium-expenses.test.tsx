import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { CondominiumExpenses } from '../condominium-expenses';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

function renderExpenses() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <CondominiumExpenses propertyId="prop-1" leaseId="lease-1" />
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe('Condominium expenses on the contract wizard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    get.mockReset();
    post.mockReset();
  });

  it('proposes the fiscal-year amount and saves it on the proposal endpoint', async () => {
    get.mockResolvedValue({
      data: { state: 'ready', fiscalYearLabel: '2025/2026', amount: 120, currency: 'EUR' },
    });
    post.mockResolvedValue({
      data: { state: 'ready', fiscalYearLabel: '2025/2026', amount: 120, currency: 'EUR' },
    });

    renderExpenses();

    expect(await screen.findByTestId('lease-condominium-proposed')).toHaveTextContent('2025/2026');
    expect(screen.getByTestId('lease-condominium-proposed')).toHaveTextContent(/120,00/);
    expect(screen.queryByTestId('lease-condominium-empty')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/long-rent/properties/prop-1/condominium-proposal', expect.anything());

    fireEvent.click(screen.getByTestId('lease-condominium-accept'));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/long-rent/properties/prop-1/condominium-proposal',
        { mode: 'proposed', leaseId: 'lease-1', amount: 120 },
        undefined,
      ),
    );
    expect(await screen.findByTestId('lease-condominium-saved')).toHaveTextContent(/120,00/);
  });

  it('calculates the amount from the previous-year consuntivo and the new-year preventivo', async () => {
    get.mockResolvedValue({ data: { state: 'empty', fiscalYearLabel: null, amount: null, currency: 'EUR' } });
    post.mockResolvedValue({ data: { state: 'ready', fiscalYearLabel: '2026/2027', amount: 95.5, currency: 'EUR' } });

    renderExpenses();

    expect(await screen.findByTestId('lease-condominium-empty')).toHaveTextContent('consuntivo');
    expect(screen.getByLabelText("Consuntivo dell'anno precedente")).toBeInTheDocument();
    expect(screen.getByLabelText('Preventivo del nuovo anno')).toBeInTheDocument();
    expect(screen.getByTestId('lease-condominium-calculate')).toBeDisabled();

    const consuntivo = new File(['final'], 'consuntivo.txt', { type: 'text/plain' });
    const preventivo = new File(['budget'], 'preventivo.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText("Consuntivo dell'anno precedente"), { target: { files: [consuntivo] } });
    fireEvent.change(screen.getByLabelText('Preventivo del nuovo anno'), { target: { files: [preventivo] } });
    fireEvent.click(screen.getByTestId('lease-condominium-calculate'));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const body = post.mock.calls[0][1] as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('leaseId')).toBe('lease-1');
    expect(body.get('consuntivo')).toBe(consuntivo);
    expect(body.get('preventivo')).toBe(preventivo);
    expect(post.mock.calls[0][0]).toBe('/long-rent/properties/prop-1/condominium-proposal');
    expect(await screen.findByTestId('lease-condominium-proposed')).toHaveTextContent('2026/2027');
  });

  it('saves a hand-typed amount to be settled at consuntivo', async () => {
    get.mockResolvedValue({ data: { state: 'empty', fiscalYearLabel: null, amount: null, currency: 'EUR' } });
    post.mockResolvedValue({ data: { state: 'ready', fiscalYearLabel: null, amount: 80, currency: 'EUR' } });

    renderExpenses();

    expect(await screen.findByText('Si conguaglia al consuntivo.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Importo a mano (€ al mese)'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('lease-condominium-manual'));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/long-rent/properties/prop-1/condominium-proposal',
        { mode: 'manual', leaseId: 'lease-1', amount: 80, settleAtConsuntivo: true },
        undefined,
      ),
    );
  });

  it('treats a missing proposal as nothing loaded', async () => {
    get.mockRejectedValue(new AxiosError('missing', '404', undefined, undefined, { status: 404 } as never));

    renderExpenses();

    expect(await screen.findByTestId('lease-condominium-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('lease-condominium-error')).not.toBeInTheDocument();
  });
});
