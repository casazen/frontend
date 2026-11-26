import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import { GuestSupplierOperations } from '../guest-supplier-operations';

it('keeps private offers visible and shows the fixed CasaZen commission before adding a marketplace service', async () => {
  await i18n.changeLanguage('it');
  const endpoint = '/properties/casa-1/guest-supplier-orders';
  const get = vi.spyOn(ApiClient, 'get').mockImplementation(async (url) => {
    if (url.endsWith('/catalog')) {
      return [{ id: 'tour', name: 'Tour in barca', supplier: 'Lago', hostOrigin: false, commissionBasisPoints: 1250 }];
    }
    return {
      offers: [{ id: 'offer', serviceId: 'transfer', serviceName: 'Transfer', supplierName: 'Mario',
        hostOrigin: true, accepted: true, enabled: true, commissionBasisPoints: 400, version: 1 }],
      orders: [],
    };
  });
  const put = vi.spyOn(ApiClient, 'put').mockResolvedValue({});
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(<QueryClientProvider client={client}><GuestSupplierOperations scope={{ role: 'host', propertyId: 'casa-1' }} /></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Transfer · Mario' });
    expect(screen.getByRole('spinbutton', { name: 'Commissione host (%)' })).toHaveValue(4);
    fireEvent.click(screen.getByRole('button', { name: 'Marketplace CasaZen' }));
    expect(screen.queryByText('Transfer · Mario')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cerca altri servizi o fornitori'), { target: { value: 'tour' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerca' }));
    await screen.findByText('Commissione CasaZen: 12.5%');
    expect(get).toHaveBeenCalledWith(endpoint + '/catalog', { origin: 'marketplace', search: 'tour' }, expect.anything());
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salva servizio' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(endpoint + '/offers/tour', { commissionBasisPoints: 1250, enabled: true }));
  } finally {
    get.mockRestore();
    put.mockRestore();
    client.clear();
  }
});

it('lets staff request a partial refund on a marketplace order and keeps the pending decision read-only', async () => {
  await i18n.changeLanguage('it');
  const order = {
    id: 'ord-1', serviceName: 'Transfer', supplierName: 'Lago', stripeSandbox: true, requestedFor: '2026-11-25',
    state: 'Disputed', totalCents: 1100, refundCents: 0, hostOrigin: false, refundStatus: null as string | null,
    documentPlan: { sellerOrgId: 'supplier', guestGrossCents: 1100, guestRefundCents: 0,
      commission: { issuerRole: 'platform', issuerOrgId: null, debtorOrgId: 'supplier', grossCents: 100, refundedCents: 0 } },
  };
  const get = vi.spyOn(ApiClient, 'get').mockImplementation(async () => [{ ...order }]);
  const post = vi.spyOn(ApiClient, 'post').mockImplementation(async () => {
    order.refundStatus = 'processing';
    return {};
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  try {
    render(<QueryClientProvider client={client}><GuestSupplierOperations scope={{ role: 'admin' }} /></QueryClientProvider>);
    fireEvent.click(await screen.findByText('Prospetto documenti di test'));
    expect(screen.getByText('Vendita di Lago all’ospite, prezzo complessivo')).toBeVisible();
    expect(screen.getByText('Commissione di CasaZen a carico di Lago, inclusa nel prezzo')).toBeVisible();
    fireEvent.change(await screen.findByRole('spinbutton'), { target: { value: '5.50' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Servizio parziale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Risolvi controversia' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/guest-supplier-orders/ord-1/resolve', {
      refundCents: 550, text: 'Servizio parziale',
    }));
    expect(await screen.findByText(/Rimborso in elaborazione/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Risolvi controversia' })).not.toBeInTheDocument();
  } finally {
    get.mockRestore();
    post.mockRestore();
    client.clear();
  }
});
