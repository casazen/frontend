import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { ApiClient } from '@/api/client';
import { httpError } from '@/features/leases/__tests__/lease-test-utils';
import { expectNoAxeViolations } from '@/test/axe';
import { UnsubscribePage } from '../unsubscribe-page';

vi.mock('@/api/client');

// CRM-08 (NF-95): the unsubscribe link of a marketing e-mail opens this page. Its signed values are in the fragment of the address, which no
// server receives; they must go back unchanged to the API and nowhere else.
const ORG_ID = '0b6f7a3e-5a2d-4c58-9e0a-6c8b0f2e1d11';
const EMAIL_HASH = 'f3a9c2d4e5b6a7981c0d2e3f4a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7';
const SIGNATURE = '9c1e7b5a3d2f4e6a8b0c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a';
const EXPIRES_AT = '2026-12-05T10:00:00Z';
const CAMPAIGN_ID = '7d1c2b3a-9e8f-4a5b-8c6d-1e2f3a4b5c6d';
const SECRETS = [ORG_ID, EMAIL_HASH, SIGNATURE, CAMPAIGN_ID];

const FRAGMENT = `#orgId=${ORG_ID}&emailHash=${EMAIL_HASH}&expiresAt=${encodeURIComponent(EXPIRES_AT)}&signature=${SIGNATURE}&campaignId=${CAMPAIGN_ID}`;

const post = vi.mocked(ApiClient.post);

function openLink(fragment: string) {
  window.history.replaceState(null, '', `/unsubscribe${fragment}`);
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UnsubscribePage />
    </QueryClientProvider>,
  );
}

/** What a console call printed, whatever it was given. */
function asText(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '';
  }
}

const title = () => screen.getByRole('heading', { level: 1 });
const unsubscribeButton = () => screen.getByRole('button', { name: 'Annulla iscrizione' });

describe('UnsubscribePage (CRM-08)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    post.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('UnsubscribePage_LinkOfAnEmail_CleansTheAddressPostsTheValuesOnceOnTheClickAndPutsThemInNoLink', async () => {
    post.mockResolvedValue({ unsubscribed: true });
    const consoleSpies = (['log', 'info', 'debug', 'warn', 'error'] as const).map((method) => vi.spyOn(console, method));
    // A value the page does not know (here a stray parameter) is never carried along.
    openLink(`${FRAGMENT}&utm_source=newsletter`);

    const { container } = renderPage();

    // The address bar is cleaned as soon as the page has read the link: no signed value stays in a bookmark, a shared address or the history.
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(window.location.pathname).toBe('/unsubscribe');
    // A mail scanner that only loads the page unsubscribes nobody: nothing is posted before the person asks.
    expect(title()).toHaveTextContent("Vuoi annullare l'iscrizione?");
    expect(post).not.toHaveBeenCalled();
    // Not indexed.
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');

    fireEvent.click(unsubscribeButton());

    expect(await screen.findByRole('heading', { level: 1, name: 'Iscrizione annullata' })).toBeInTheDocument();
    expect(screen.getByText(/Non riceverai più e-mail promozionali da questa struttura/)).toBeInTheDocument();
    expect(screen.getByText(/potranno comunque arrivare/)).toBeInTheDocument();

    // Once, anonymous, with the values exactly as the link carried them and nothing in the body.
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, options] = post.mock.calls[0];
    expect(url.startsWith('/public/marketing/unsubscribe?')).toBe(true);
    expect(Object.fromEntries(new URLSearchParams(url.slice(url.indexOf('?') + 1)))).toEqual({
      orgId: ORG_ID,
      emailHash: EMAIL_HASH,
      expiresAt: EXPIRES_AT,
      signature: SIGNATURE,
      campaignId: CAMPAIGN_ID,
    });
    expect(body).toBeUndefined();
    expect(options).toEqual({ public: true });

    // In no link and no text of the page, in no storage and in no log.
    expect(container.querySelectorAll('a')).toHaveLength(0);
    const logged = consoleSpies.flatMap((spy) => spy.mock.calls.map((args) => args.map(asText).join(' ')));
    const kept = JSON.stringify([Object.entries(window.localStorage), Object.entries(window.sessionStorage), logged]);
    for (const secret of SECRETS) {
      expect(document.body.innerHTML).not.toContain(secret);
      expect(window.location.href).not.toContain(secret);
      expect(kept).not.toContain(secret);
    }
  });

  it.each([
    ['link_expired', 422, 'Il link è scaduto'],
    ['invalid_signature', 422, 'Il link non è valido'],
    ['signature_missing', 400, 'Il link non è valido'],
    ['invalid_timestamp', 422, 'Il link non è valido'],
  ])('UnsubscribePage_ServerSaysTheLinkDoesNotWork_%s_ExplainsInPlainWordsWithNoWayOn', async (code, status, expectedTitle) => {
    post.mockRejectedValue(httpError(status, { code }));
    openLink(FRAGMENT);

    renderPage();
    fireEvent.click(unsubscribeButton());

    expect(await screen.findByRole('heading', { level: 1, name: expectedTitle })).toBeInTheDocument();
    // No code, no technical detail, and nothing to press: that link cannot work again.
    expect(document.body).not.toHaveTextContent(code);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no fragment', ''],
    ['a fragment without the signature', `#orgId=${ORG_ID}&emailHash=${EMAIL_HASH}&expiresAt=${encodeURIComponent(EXPIRES_AT)}`],
  ])('UnsubscribePage_%s_SaysTheLinkIsNotValidAndAsksNothing', (_name, fragment) => {
    openLink(fragment);

    renderPage();

    expect(title()).toHaveTextContent('Il link non è valido');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('UnsubscribePage_ServerError_SaysToTryAgainKeepsTheButtonAndTheSecondTryWorks', async () => {
    post.mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce({ unsubscribed: true });
    openLink(FRAGMENT);

    renderPage();
    fireEvent.click(unsubscribeButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Riprova tra qualche istante');
    expect(title()).toHaveTextContent("Vuoi annullare l'iscrizione?");

    fireEvent.click(unsubscribeButton());

    expect(await screen.findByRole('heading', { level: 1, name: 'Iscrizione annullata' })).toBeInTheDocument();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('UnsubscribePage_AnswerArrives_TheNewTitleTakesTheFocus', async () => {
    post.mockResolvedValue({ unsubscribed: true });
    openLink(FRAGMENT);

    renderPage();
    fireEvent.click(unsubscribeButton());

    const done = await screen.findByRole('heading', { level: 1, name: 'Iscrizione annullata' });
    await waitFor(() => expect(done).toHaveFocus());
  });

  it('UnsubscribePage_TheQuestionAndTheAnswer_HaveNoAccessibilityViolations', async () => {
    post.mockResolvedValue({ unsubscribed: true });
    openLink(FRAGMENT);

    const { container } = renderPage();
    await expectNoAxeViolations(container);

    fireEvent.click(unsubscribeButton());
    await screen.findByRole('heading', { level: 1, name: 'Iscrizione annullata' });
    await expectNoAxeViolations(container);
  });
});
