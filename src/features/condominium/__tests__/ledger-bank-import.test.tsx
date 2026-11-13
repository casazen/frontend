import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from '@/lib/axios';
import i18n from '@/i18n/config';
import { LedgerBankImport } from '../ledger-bank-import';
import { readBankFile } from '../ledger-bank-reader';
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../ledger-bank-reader', () => ({ readBankFile: vi.fn() }));
const report = { condominiumName: 'Navigli', periodLabel: '2027', periodStart: '2027-01-01', periodEnd: '2027-12-31', ordinary: 1800, extraordinary: 0, prior: 0, finalAmount: null, paid: 0, stillToPay: 1800, settlement: null, installments: [], payments: [] };
function show() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><LedgerBankImport bookId="book-1" periodId="year-1" report={report} /></QueryClientProvider>); }
async function upload() { fireEvent.change(screen.getByLabelText('Estratto conto (Excel o CSV)'), { target: { files: [new File(['test'], 'movimenti.xlsx')] } }); await screen.findAllByRole('checkbox'); }
describe('reviewed bank import', () => {
  beforeEach(async () => { await i18n.changeLanguage('it'); vi.mocked(axios.post).mockReset(); vi.mocked(axios.post).mockResolvedValue({ data: {} }); vi.mocked(readBankFile).mockResolvedValue([{ id: 'stable-1', date: '2028-01-10', amount: 150, details: 'Saldo condominio 2027' }]); });
  it('records no movement until selection and confirmation, including a payment after the fiscal year', async () => {
    show(); await upload();
    expect(axios.post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Conferma i versamenti selezionati' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma i versamenti selezionati' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/long-rent/condominiums/book-1/periods/year-1/payments', { installmentId: null, coversPriorBalance: false, amount: 150, paidOn: '2028-01-10', method: 'Estratto conto', note: 'Saldo condominio 2027', externalSourceHash: 'bank-import:book-1:stable-1' }, undefined));
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Conferma i versamenti selezionati' })).toBeDisabled();
  });
  it('retries only failed movements after a partially completed import', async () => {
    vi.mocked(readBankFile).mockResolvedValue([{ id: 'first', date: '2027-01-10', amount: 150, details: 'Prima rata' }, { id: 'second', date: '2027-02-10', amount: 180, details: 'Seconda rata' }]);
    vi.mocked(axios.post).mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error('connection lost')).mockResolvedValue({ data: {} });
    show(); await upload();
    screen.getAllByRole('checkbox').forEach(c => fireEvent.click(c));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma i versamenti selezionati' }));
    await screen.findByRole('alert');
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma i versamenti selezionati' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(3));
    expect(vi.mocked(axios.post).mock.calls.map(call => (call[1] as { externalSourceHash: string }).externalSourceHash)).toEqual(['bank-import:book-1:first', 'bank-import:book-1:second', 'bank-import:book-1:second']);
  });
});
