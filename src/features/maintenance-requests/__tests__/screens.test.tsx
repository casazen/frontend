import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { LandlordMaintenancePage } from '../landlord-page';
import { TenantMaintenanceRequestPage } from '../tenant-wizard';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const get = vi.mocked(axios.get);
const post = vi.mocked(axios.post);

const pending = {
  id: 'mr-1',
  leaseId: 'lease-1',
  what: 'Rubinetto del bagno',
  urgency: 'normale',
  note: 'Gocciola da ieri',
  photoName: null,
  status: 'pending',
  reason: null,
  createdAt: '2026-11-08T10:00:00Z',
};

function renderAt(path: string, element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/portale-conduttore/contratti/:leaseId/richiesta-manutenzione" element={element} />
            <Route path="/app/long-rent/leases/:id/manutenzione" element={element} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

async function fillWizard(what = 'Rubinetto del bagno') {
  fireEvent.change(await screen.findByTestId('maintenance-what'), { target: { value: what } });
  fireEvent.click(screen.getByTestId('maintenance-next'));
  fireEvent.click(screen.getByRole('radio', { name: /Normale/ }));
  fireEvent.click(screen.getByTestId('maintenance-next'));
  fireEvent.change(screen.getByTestId('maintenance-note'), { target: { value: 'Gocciola da ieri' } });
  fireEvent.click(screen.getByTestId('maintenance-next'));
  fireEvent.click(screen.getByTestId('maintenance-next'));
  expect(screen.getByTestId('maintenance-confirm-what')).toHaveTextContent(what);
  expect(screen.getByTestId('maintenance-confirm-urgency')).toHaveTextContent('Normale');
  fireEvent.click(screen.getByTestId('maintenance-submit'));
}

describe('tenant maintenance wizard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    get.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('walks the phone steps and lands on In attesa, without approve or pay', async () => {
    post.mockResolvedValue({ data: pending });
    renderAt('/portale-conduttore/contratti/lease-1/richiesta-manutenzione', <TenantMaintenanceRequestPage />);

    await fillWizard();

    expect(await screen.findByTestId('maintenance-waiting')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In attesa' })).toBeInTheDocument();
    expect(screen.getByTestId('maintenance-tenant-status')).toHaveTextContent('In attesa');
    expect(screen.queryByTestId('maintenance-pay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('maintenance-approve')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Paga' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approva' })).not.toBeInTheDocument();

    const [url, body] = post.mock.calls[0];
    expect(url).toBe('/leases/lease-1/maintenance-requests');
    expect(body).toEqual({ what: 'Rubinetto del bagno', urgency: 'High', note: 'Gocciola da ieri' });
  });

  it('does not offer a second send when the list cache is still empty', async () => {
    get.mockResolvedValue({ data: [] });
    post.mockResolvedValue({ data: pending });
    renderAt('/portale-conduttore/contratti/lease-1/richiesta-manutenzione', <TenantMaintenanceRequestPage />);

    await fillWizard();
    expect(await screen.findByTestId('maintenance-waiting')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('maintenance-see-requests'));

    expect(screen.queryByTestId('maintenance-submit')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Controlla e invia' })).not.toBeInTheDocument();
    expect(screen.getByTestId('maintenance-tenant-status')).toHaveTextContent('In attesa');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('keeps pay hidden when a request is already approved', async () => {
    get.mockResolvedValue({ data: [{ ...pending, status: 'approved' }] });
    renderAt('/portale-conduttore/contratti/lease-1/richiesta-manutenzione', <TenantMaintenanceRequestPage />);
    expect(await screen.findByTestId('maintenance-tenant-status')).toHaveTextContent('Approvata');
    expect(screen.queryByTestId('maintenance-pay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('maintenance-approve')).not.toBeInTheDocument();
  });

  it('shows the rejection reason and still no pay', async () => {
    get.mockResolvedValue({
      data: [{ ...pending, status: 'rejected', reason: 'Non è un guasto a carico del proprietario.' }],
    });
    renderAt('/portale-conduttore/contratti/lease-1/richiesta-manutenzione', <TenantMaintenanceRequestPage />);
    expect(await screen.findByTestId('maintenance-reason')).toHaveTextContent('Non è un guasto a carico del proprietario.');
    expect(screen.queryByTestId('maintenance-pay')).not.toBeInTheDocument();
  });
});

describe('landlord maintenance approval', () => {
  let rows = [{ ...pending }];

  beforeEach(async () => {
    await i18n.changeLanguage('it');
    rows = [{ ...pending }];
    get.mockImplementation(() => Promise.resolve({ data: rows }));
    post.mockImplementation((url: string, body: { decision?: string; reason?: string }) => {
      const current = rows[0];
      if (String(url).endsWith('/decision')) {
        rows = [
          {
            ...current,
            status: body.decision === 'Rejected' ? 'rejected' : 'approved',
            reason: body.reason ?? null,
          },
        ];
      }
      if (String(url).endsWith('/payment')) {
        rows = [{ ...current, status: 'paid' }];
      }
      return Promise.resolve({ data: rows[0] });
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('hides pay until approval, then shows it', async () => {
    renderAt('/app/long-rent/leases/lease-1/manutenzione', <LandlordMaintenancePage />);
    expect(await screen.findByTestId('maintenance-status')).toHaveTextContent('In attesa');
    expect(screen.queryByTestId('maintenance-pay')).not.toBeInTheDocument();
    expect(screen.getByText(/Il pagamento non è ancora disponibile/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('maintenance-approve'));

    expect(await screen.findByTestId('maintenance-pay')).toBeInTheDocument();
    expect(screen.queryByTestId('maintenance-approve')).not.toBeInTheDocument();
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/leases/lease-1/maintenance-requests/mr-1/decision');
    expect(post.mock.calls[0][1]).toEqual({ decision: 'Approved' });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('rejects with a reason and keeps pay hidden', async () => {
    renderAt('/app/long-rent/leases/lease-1/manutenzione', <LandlordMaintenancePage />);
    fireEvent.click(await screen.findByTestId('maintenance-reject'));
    expect(screen.queryByTestId('maintenance-pay')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('maintenance-reject-reason'), {
      target: { value: 'Non è un guasto a carico del proprietario.' },
    });
    fireEvent.click(screen.getByTestId('maintenance-reject-confirm'));

    expect(await screen.findByTestId('maintenance-reason')).toHaveTextContent('Non è un guasto a carico del proprietario.');
    expect(screen.getByTestId('maintenance-status')).toHaveTextContent('Rifiutata');
    expect(screen.queryByTestId('maintenance-pay')).not.toBeInTheDocument();
    expect(post.mock.calls[0][1]).toEqual({
      decision: 'Rejected',
      reason: 'Non è un guasto a carico del proprietario.',
    });
  });
});
