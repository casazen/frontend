import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@/api/client';
import { GuestPortalReview } from '../guest-portal-review';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn(), post: vi.fn() } }));

const path = '/public/guest-portal/stay-token';
const labels = {
  rating: 'Valutazione', ratingValue: '{value} su 5', comment: 'Commento facoltativo', showName: 'Mostra il mio nome', send: 'Invia',
  loading: 'Caricamento…', failed: 'Errore', unavailable: 'Non disponibile', submitted: 'Recensione inviata.',
};

describe('the review of a stay (UX round 2026-11)', () => {
  it('rates with five stars, one radio each, and sends the chosen one', async () => {
    vi.mocked(ApiClient.get).mockResolvedValue({ submitted: false });
    vi.mocked(ApiClient.post).mockResolvedValue(undefined);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <GuestPortalReview path={path} labels={labels} onSubmitted={vi.fn()} />
      </QueryClientProvider>,
    );

    const stars = await screen.findByRole('radiogroup', { name: 'Valutazione' });
    expect(within(stars).getAllByRole('radio').map((star) => star.getAttribute('aria-label'))).toEqual(['1 su 5', '2 su 5', '3 su 5', '4 su 5', '5 su 5']);
    expect(screen.getByRole('button', { name: 'Invia' })).toBeDisabled();

    fireEvent.click(within(stars).getByRole('radio', { name: '4 su 5' }));
    // The stars up to the chosen one are filled, the others are not.
    expect(stars.querySelectorAll('[data-on]')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Invia' }));

    await waitFor(() => expect(ApiClient.post).toHaveBeenCalledWith(`${path}/review`, { rating: 4, text: '', showName: false }, { public: true }));
  });
});
