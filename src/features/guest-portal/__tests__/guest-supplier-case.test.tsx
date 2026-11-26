import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { GuestSupplierCasePanel } from '../guest-supplier-case-panel';
import type { GuestSupplierOrder } from '../guest-supplier-order-model';

it('routes an appeal through the private stay context and shows the human response', async () => {
  const order: GuestSupplierOrder = { id: 'ord', requestedFor: '', completedAt: null, state: 'Resolved', serviceName: 'Tour',
    supplierName: 'A', supplierPriceCents: 100, commissionCents: 10, totalCents: 110, refundCents: 0, hostOrigin: false,
    requestNote: null, complaint: 'Incomplete', supplierReply: null, decision: 'No refund' };
  const url = '/g/stay/supplier-orders';
  const get = vi.spyOn(ApiClient, 'get').mockResolvedValue({ assigned: false, photos: [], reviews: [] });
  const post = vi.spyOn(ApiClient, 'post').mockResolvedValue({ assigned: true, photos: [], reviews: [{
    id: 'r', side: 'guest', request: 'Review the route', finding: null,
  }] });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    render(<QueryClientProvider client={cache}><GuestSupplierCasePanel endpoint={url} role="guest" language="en" order={order} /></QueryClientProvider>);
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Photos and review' }));
    fireEvent.change(await screen.findByRole('textbox', { name: 'Why are you requesting a review?' }), { target: { value: 'Review the route' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request human review' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(url + '/ord/case/reviews', { text: 'Review the route' }, { public: true }));
    expect(await screen.findByText('Awaiting staff review')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Request human review' })).not.toBeInTheDocument();
  } finally {
    post.mockRestore();
    get.mockRestore();
    cache.clear();
  }
});
