import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { GuestPortalDocuments } from '../guest-portal-documents';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const path = '/public/guest-portal/stay-token';
const labels = { loading: 'Loading', failed: 'Failed', empty: 'No documents yet', download: 'Download', correction: 'Request correction', requested: 'Request sent' };
const invoice = { id: 'invoice-1', number: '1-2026', kind: 'Invoice', total: 100, currency: 'EUR' };

function show(issued: boolean, serviceFiles: object[] = []) {
  vi.mocked(ApiClient.get).mockImplementation(async url => url.endsWith('/invoice-data')
    ? { issued, invoiceRequested: false, hasInvoiceData: false, hostManaged: false }
    : url.endsWith('/supplier-services') ? serviceFiles : issued ? [invoice] : []);
  render(<QueryClientProvider client={new QueryClient()}>
    <GuestPortalDocuments path={path} language="en" labels={labels} />
  </QueryClientProvider>);
}

describe('stay invoice recipient', () => {
  it('saves validated pre-issue recipient details through the scoped stay endpoint', async () => {
    show(false);
    fireEvent.click(await screen.findByTestId('checkin-invoice-yes'));
    fireEvent.change(screen.getByTestId('checkin-invoice-name'), { target: { value: 'Mario Rossi' } });
    fireEvent.change(screen.getByTestId('checkin-invoice-fiscalCode'), { target: { value: 'RSSMRA80A01H501U' } });
    fireEvent.click(screen.getByRole('button', { name: /save answer/i }));
    await waitFor(() => expect(ApiClient.put).toHaveBeenCalledWith(
      path + '/documents/invoice-data', { needInvoice: true, recipientKind: 'Guest', countryCode: 'IT', name: 'Mario Rossi', fiscalCode: 'RSSMRA80A01H501U' }, { public: true },
    ));
  });

  it('refreshes the correction action when the host issues while the form is open', async () => {
    show(false);
    vi.mocked(ApiClient.put).mockImplementationOnce(async () => {
      vi.mocked(ApiClient.get).mockImplementation(async url => url.endsWith('/invoice-data')
        ? { issued: true, invoiceRequested: true, hasInvoiceData: true, hostManaged: false } : [invoice]);
      throw { isAxiosError: true, response: { status: 409 } };
    });
    fireEvent.click(await screen.findByTestId('checkin-invoice-yes'));
    fireEvent.click(screen.getByRole('button', { name: /save answer/i }));
    expect(await screen.findByRole('button', { name: labels.correction })).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-invoice-step')).not.toBeInTheDocument();
  });

  it('offers a correction for an issued invoice', async () => {
    show(true);
    fireEvent.click(await screen.findByRole('button', { name: labels.correction }));
    await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith(
      path + '/documents/invoice-1/correction-request', undefined, { public: true },
    ));
    expect(screen.queryByTestId('checkin-invoice-step')).not.toBeInTheDocument();
  });


  it('shows the seller PDF and receipt when the stay has no host invoice', async () => {
    show(false, [{ id: 'order-1', serviceName: 'Transfer', supplierName: 'Example supplier',
      documents: [{ id: 'doc-1', fileName: 'invoice.pdf', uploadedAt: '2026-11-26T12:00:00Z' }] }]);
    expect(await screen.findByText('Transfer · Example supplier')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'invoice.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Payment receipt' })).toBeInTheDocument();
    expect(screen.queryByText(labels.empty)).not.toBeInTheDocument();
  });
});
