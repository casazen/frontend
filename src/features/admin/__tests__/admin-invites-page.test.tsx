import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { AdminInvitesPage } from '../admin-invites-page';

const api = vi.hoisted(() => ({ createHostInvite: vi.fn(), fetchHostInvites: vi.fn() }));
vi.mock('@/api/host-invites.api', async (original) => ({ ...(await original<typeof import('@/api/host-invites.api')>()), ...api }));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,cXI=') } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderPage() {
  return render(<I18nextProvider i18n={i18n}>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><AdminInvitesPage /></MemoryRouter>
    </QueryClientProvider>
  </I18nextProvider>);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.fetchHostInvites.mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
  api.createHostInvite.mockResolvedValue({ inviteId: 'new', expiresAt: '2026-12-01T10:00:00Z', url: 'https://casazen.example/invito-host/personal-token' });
});

describe('super admin agency invitations', () => {
  it('offers only the founder of a new agency, without existing organization or supplier choices', async () => {
    renderPage();
    expect(await screen.findByTestId('host-invites-empty')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invita l’amministratore di una nuova agenzia' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invite-email-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('qr-agency')).not.toBeInTheDocument();
  });

  it('creates an email-bound invitation and renders the exact server link as a personal QR', async () => {
    renderPage();
    fireEvent.change(screen.getByTestId('host-invite-email'), { target: { value: 'titolare@example.com' } });
    fireEvent.click(screen.getByTestId('host-invite-submit'));
    await waitFor(() => expect(api.createHostInvite).toHaveBeenCalledWith('admin', {
      email: 'titolare@example.com', message: undefined, locale: undefined,
    }));
    expect(await screen.findByTestId('qr-agency-image')).toBeInTheDocument();
    expect(screen.getByTestId('qr-agency-url')).toHaveTextContent('https://casazen.example/invito-host/personal-token');
    expect(screen.getByTestId('qr-agency-download')).toHaveAttribute('download');
  });

  it('does not create an invitation with an invalid email', async () => {
    renderPage();
    fireEvent.change(screen.getByTestId('host-invite-email'), { target: { value: 'invalid' } });
    fireEvent.click(screen.getByTestId('host-invite-submit'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(api.createHostInvite).not.toHaveBeenCalled();
  });

  it('keeps the recipient and displays no QR when creation fails', async () => {
    api.createHostInvite.mockRejectedValue(new Error('offline'));
    renderPage();
    fireEvent.change(screen.getByTestId('host-invite-email'), { target: { value: 'titolare@example.com' } });
    fireEvent.click(screen.getByTestId('host-invite-submit'));
    await waitFor(() => expect(api.createHostInvite).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('host-invite-submit')).not.toBeDisabled());
    expect(screen.getByTestId('host-invite-email')).toHaveValue('titolare@example.com');
    expect(screen.queryByTestId('qr-agency')).not.toBeInTheDocument();
  });
});
