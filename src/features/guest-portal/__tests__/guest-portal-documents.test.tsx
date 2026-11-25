import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { GuestPortalDocuments } from '../guest-portal-documents';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const path = '/public/guest-portal/stay-token';
const labels = { loading: 'Loading', failed: 'Failed', empty: 'No documents yet', download: 'Download', correction: 'Request correction', requested: 'Request sent' };
const invoice = { id: 'invoice-1', number: '1-2026', kind: 'Invoice', total: 100, currency: 'EUR' };

function show(issued: boolean) {
  vi.mocked(ApiClient.get).mockImplementation(async url => url.endsWith('/invoice-data')
    ? { issued, invoiceRequested: false, hasInvoiceData: false, hostManaged: false }
    : issued ? [invoice] : []);
  render(<QueryClientProvider client={new QueryClient()}>
    <GuestPortalDocuments path={path} language="en" labels={labels} />
  </QueryClientProvider>);
}

describe('stay invoice recipient', () => {
  it('saves the pre-issue answer through the scoped stay endpoint', async () => {
    show(false);
    fireEvent.click(await screen.findByTestId('checkin-invoice-yes'));
    fireEvent.click(screen.getByRole('button', { name: /save answer/i }));
    await waitFor(() => expect(ApiClient.put).toHaveBeenCalledWith(
      path + '/documents/invoice-data', { needInvoice: true }, { public: true },
    ));
  });

  it('offers a correction for an issued invoice', async () => {
    show(true);
    fireEvent.click(await screen.findByRole('button', { name: labels.correction }));
    await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith(
      path + '/documents/invoice-1/correction-request', undefined, { public: true },
    ));
    expect(screen.queryByTestId('checkin-invoice-step')).not.toBeInTheDocument();
  });
});
