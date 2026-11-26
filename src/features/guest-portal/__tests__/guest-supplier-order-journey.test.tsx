import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { GuestSupplierOperations } from '../guest-supplier-operations';
import { GuestSupplierOrders } from '../guest-supplier-orders';
import type { GuestSupplierOrder } from '../guest-supplier-order-model';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('carries a guest request through the supplier quote and completion using the simulated payment', async () => {
  const guest = '/guest/test/supplier-orders';
  const supplier = '/supplier/guest-orders';
  let orders: GuestSupplierOrder[] = [];
  const offer = { id: 'offer', serviceName: 'Giro in barca', category: 'Lago', supplierName: 'Battelli', summary: null, priceCents: null, commissionBasisPoints: 0 };
  const otherOffer = { ...offer, id: 'kayak', serviceName: 'Kayak' };
  vi.spyOn(ApiClient, 'get').mockImplementation(async (path) => {
    if (path === guest) return { offers: [offer, otherOffer], orders: [...orders], environment: 'Test' };
    if (path === supplier) return { offers: [], orders: [...orders] };
    throw Error('Unexpected fixture URL: ' + path);
  });
  const post = vi.spyOn(ApiClient, 'post').mockImplementation(async (path, body) => {
    if (path === guest) {
      orders = [{ id: 'order', serviceName: offer.serviceName, supplierName: offer.supplierName, requestedFor: '2027-07-01T10:00:00Z',
        state: 'PendingQuote', completedAt: null, totalCents: 0, supplierPriceCents: 0, commissionCents: 0, refundCents: 0,
        hostOrigin: false, requestNote: null, complaint: null, supplierReply: null, decision: null }];
    } else if (path === guest + '/order/authorize') {
      orders = [{ ...orders[0], state: 'Authorized' }];
    } else if (path === supplier + '/order/transition') {
      const action = (body as { action: string }).action;
      const nextState: Record<string, string> = { quote: 'Quoted', accept: 'Accepted', complete: 'Completed' };
      const state = nextState[action];
      if (!state) throw Error('Unknown transition');
      orders = [{ ...orders[0], state, totalCents: 5000, supplierPriceCents: 5000 }];
    } else throw Error('Unexpected fixture URL: ' + path);
    return orders[0];
  });
  function showGuest() {
    return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><GuestSupplierOrders path="/guest/test" language="en" /></MemoryRouter></QueryClientProvider>);
  }
  function showSupplier() {
    return render(<QueryClientProvider client={new QueryClient()}><GuestSupplierOperations scope={{ role: 'supplier' }} /></QueryClientProvider>);
  }
  let view = showGuest();
  const offerSummary = await screen.findByText(/Giro in barca/);
  const kayak = screen.getByText(/Kayak/);
  fireEvent.click(kayak);
  const otherNote = within(kayak.parentElement!).getByLabelText('Notes for the supplier');
  fireEvent.change(otherNote, { target: { value: 'Two paddles' } });
  fireEvent.click(offerSummary);
  const boat = within(offerSummary.parentElement!);
  fireEvent.change(boat.getByLabelText('Date'), { target: { value: '2027-07-01' } });
  fireEvent.change(boat.getByLabelText('Time in Italy'), { target: { value: '12:00' } });
  fireEvent.click(boat.getByRole('button', { name: 'Request a quote' }));
  await screen.findByText(/Request sent/);
  expect(otherNote).toBeInTheDocument();
  expect(otherNote).toHaveValue('Two paddles');
  expect(post).toHaveBeenCalledWith(guest, expect.objectContaining({ offerId: 'offer', requestedFor: '2027-07-01T10:00:00.000Z' }), { public: true });
  view.unmount();

  view = showSupplier();
  fireEvent.change(await screen.findByLabelText('Prezzo in euro'), { target: { value: '50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Invia preventivo' }));
  await screen.findByText(/Da confermare/);
  view.unmount();

  view = showGuest();
  fireEvent.click(await screen.findByRole('button', { name: 'Authorize simulated payment' }));
  await screen.findByText(/Amount authorized/);
  view.unmount();

  view = showSupplier();
  fireEvent.click(await screen.findByRole('button', { name: 'Accetta ordine' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Completa servizio' }));
  await screen.findByText(/Servizio completato/);
  view.unmount();

  showGuest();
  const finalOrder = await screen.findByRole('article');
  expect(within(finalOrder).getByText(/Service completed/)).toBeVisible();
});
