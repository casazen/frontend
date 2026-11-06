import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { ApiClient } from '@/api/client';
import { httpError } from '@/features/leases/__tests__/lease-test-utils';
import { ConfirmPage } from '../confirm-page';

vi.mock('@/api/client');

// CRM-03 (NF-90): the link of the double opt-in e-mail opens this page. It carries the contact, the expiry and the signature in the fragment,
// never the address.
const CONTACT_ID = '5e9c1a2b-3d4f-4a6b-8c7d-9e0f1a2b3c4d';
const SIGNATURE = '4b7d9f1a2c3e5a6b8d0f1a2c3e4b5d6f7a8c9e0b1d2f3a4c5e6b7d8f9a0c1e2b';
const EXPIRES_AT = '2026-11-09T18:30:00Z';
const FRAGMENT = `#contactId=${CONTACT_ID}&expiresAt=${encodeURIComponent(EXPIRES_AT)}&signature=${SIGNATURE}`;

const post = vi.mocked(ApiClient.post);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConfirmPage />
    </QueryClientProvider>,
  );
}

const confirmButton = () => screen.getByRole('button', { name: 'Conferma iscrizione' });

describe('ConfirmPage (CRM-03)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    post.mockReset();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it.each([false, true])(
    'ConfirmPage_LinkOfTheEmail_AlreadyConfirmed_%s_CleansTheAddressPostsTheValuesOnTheClickAndSaysConfirmed',
    async (alreadyConfirmed) => {
      post.mockResolvedValue({ confirmed: true, alreadyConfirmed });
      window.history.replaceState(null, '', `/marketing/confirm${FRAGMENT}`);

      const { container } = renderPage();

      await waitFor(() => expect(window.location.hash).toBe(''));
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Confermi la tua iscrizione?');
      expect(post).not.toHaveBeenCalled();

      fireEvent.click(confirmButton());

      // The same words whether it was the first time or not.
      expect(await screen.findByRole('heading', { level: 1, name: 'Iscrizione confermata' })).toBeInTheDocument();
      expect(post).toHaveBeenCalledTimes(1);
      const [url, body, options] = post.mock.calls[0];
      expect(url.startsWith('/public/marketing/confirm?')).toBe(true);
      expect(Object.fromEntries(new URLSearchParams(url.slice(url.indexOf('?') + 1)))).toEqual({
        contactId: CONTACT_ID,
        expiresAt: EXPIRES_AT,
        signature: SIGNATURE,
      });
      expect(body).toBeUndefined();
      expect(options).toEqual({ public: true });
      expect(container.querySelectorAll('a')).toHaveLength(0);
      expect(document.body.innerHTML).not.toContain(CONTACT_ID);
      expect(document.body.innerHTML).not.toContain(SIGNATURE);
    },
  );

  it.each([
    [422, 'link_expired', 'Il link è scaduto'],
    [422, 'invalid_signature', 'Il link non è valido'],
    [404, 'contact_not_found', 'Iscrizione non trovata'],
    // The person opted out after the e-mail was sent: nothing is confirmed and the opt-out stands (409 of the API), so there is nothing to retry.
    [409, 'contact_suppressed', 'Iscrizione non confermata'],
  ])('ConfirmPage_ServerAnswers_%s_%s_ExplainsInPlainWords', async (status, code, expectedTitle) => {
    post.mockRejectedValue(httpError(status, { code }));
    window.history.replaceState(null, '', `/marketing/confirm${FRAGMENT}`);

    renderPage();
    fireEvent.click(confirmButton());

    expect(await screen.findByRole('heading', { level: 1, name: expectedTitle })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(code);
    // No way on and no «try again»: that link cannot work, and it was sent once.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('ConfirmPage_OptedOut_SaysNothingWasConfirmedAndTheOptOutStands', async () => {
    post.mockRejectedValue(httpError(409, { code: 'contact_suppressed' }));
    window.history.replaceState(null, '', `/marketing/confirm${FRAGMENT}`);

    renderPage();
    fireEvent.click(confirmButton());

    expect(await screen.findByText(/non abbiamo confermato nulla/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Iscrizione confermata' })).not.toBeInTheDocument();
  });

  it('ConfirmPage_NoFragment_SaysTheLinkIsNotValidAndAsksNothing', () => {
    window.history.replaceState(null, '', '/marketing/confirm');

    renderPage();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Il link non è valido');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
