import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { ApiClient } from '@/api/client';
import { Ross1000Panel } from '../ross1000-panel';

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/api/client', () => ({ ApiClient: { post: vi.fn() } }));

function mount() {
  return render(<I18nextProvider i18n={i18n}><QueryClientProvider client={new QueryClient()}>
    <Ross1000Panel propertyId="p1" canWrite />
  </QueryClientProvider></I18nextProvider>);
}
beforeEach(async () => {
  await i18n.changeLanguage('it');
  vi.mocked(ApiClient.post).mockReset();
});
afterEach(cleanup);

describe('ROSS1000 daily submission', () => {
  it('requires review and posts the hash with the same confirmed capacity', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ state: 'ready', hash: 'v1', arrivals: 0, departures: 0 })
      .mockResolvedValueOnce({ state: 'accepted', arrivals: 0, departures: 0, accepted: 0, rejected: 0 });
    mount();
    fireEvent.change(screen.getByLabelText('Giorno di attività'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByText('Struttura aperta'));
    fireEvent.click(screen.getByText('Prepara anteprima'));
    const capacity = { open: false, occupiedRooms: 0, availableRooms: 0, availableBeds: 0 };
    await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith('/properties/p1/ross1000/2026-01-01/preview', capacity));
    fireEvent.click(await screen.findByRole('button', { name: 'Invia il movimento alla Lombardia' }));
    await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith('/properties/p1/ross1000/2026-01-01/send', { capacity, hash: 'v1' }));
    await screen.findByText('Movimento accettato.', { exact: false });
    expect(screen.queryByRole('button', { name: 'Invia il movimento alla Lombardia' })).toBeNull();
  });

  it.each(['preview_only', 'unknown', 'partial'])('blocks sending for %s', async state => {
    vi.mocked(ApiClient.post).mockResolvedValue({ state, hash: 'v1', arrivals: 0, departures: 0, accepted: 0, rejected: 0 });
    mount();
    fireEvent.click(screen.getByText('Struttura aperta'));
    fireEvent.click(screen.getByText('Prepara anteprima'));
    await screen.findByRole('status');
    expect(screen.queryByRole('button', { name: 'Invia il movimento alla Lombardia' })).toBeNull();
    expect(ApiClient.post).toHaveBeenCalledTimes(1);
  });
});
