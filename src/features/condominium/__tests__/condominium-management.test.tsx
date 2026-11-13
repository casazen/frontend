import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { CondominiumManagement } from '../condominium-management';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
const base = '/long-rent/condominiums';
const report = { condominiumName: 'Via Roma', periodLabel: '2027', periodStart: '2027-01-01', periodEnd: '2027-12-31', ordinary: 1800, extraordinary: 0, prior: 0, finalAmount: null, paid: 0, stillToPay: 1800, settlement: null, installments: [], payments: [] };
function show() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><CondominiumManagement propertyId="property-1" /></QueryClientProvider>);
}
describe('property condominium book', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.mocked(axios.get).mockReset();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.get).mockImplementation(async url => ({ data: String(url).endsWith('/properties') ? [{ propertyId: 'property-1', propertyName: 'Appartamento sfitto', books: [{ id: 'book-1', name: 'Via Roma', fiscalStartMonth: 1, periods: [{ id: 'year-1', label: '2027', startDate: '2027-01-01', endDate: '2027-12-31', status: 'Draft' }] }] }] : report }));
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
  });
  it('sends a custom calendar with separate ordinary and extraordinary quotas', async () => {
    show();
    fireEvent.change(await screen.findByLabelText('Quota ordinaria annuale (€)'), { target: { value: '1800' } });
    fireEvent.change(screen.getByLabelText('Quota straordinaria annuale (€)'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Frequenza delle rate al condominio'), { target: { value: 'Custom' } });
    fireEvent.change(screen.getByLabelText('Scadenze personalizzate'), { target: { value: '2027-02-01\n2027-06-01\n2027-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferma preventivo' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(`${base}/book-1/periods/year-1/budget`, { ordinaryAmount: 1800, extraordinary: [{ amount: 300 }], cadence: 'Custom', customDueDates: ['2027-02-01', '2027-06-01', '2027-10-01'] }, undefined));
  });
  it('uploads multipart data and waits for the user to review the PDF', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { id: 'proposal-1', label: '2027', kind: 'Budget', ordinary: 1800, extraordinary: 0, finalAmount: null, excerpt: 'Preventivo 2027', notExtracted: [] } });
    show();
    const file = new File(['pdf'], 'preventivo.pdf', { type: 'application/pdf' });
    fireEvent.change(await screen.findByLabelText('Documento PDF'), { target: { files: [file] } });
    expect(await screen.findByRole('button', { name: 'Conferma dati del documento' })).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [, payload, options] = vi.mocked(axios.post).mock.calls[0];
    expect((payload as FormData).get('file')).toBe(file);
    expect(options).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferma dati del documento' }));
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(`${base}/book-1/statements/proposals/proposal-1/confirm`, {}, undefined));
  });
});
