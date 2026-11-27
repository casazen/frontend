import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import { messageHubApi } from '@/api/message-hub.api';
import type { MessageContactOptions } from '@/types';
import { ContactOptionsPanel } from '../components/contact-options-panel';

vi.mock('@/api/message-hub.api', () => ({
  messageHubApi: { getContactOptions: vi.fn(), startConversation: vi.fn() },
}));

const BOOKING = '0c9d2a10-aaaa-4bbb-8ccc-123456789abc';

function options(overrides: Partial<MessageContactOptions>): MessageContactOptions {
  return { channel: 'None', threadKey: null, reason: null, emailAvailable: false, phoneAvailable: false, ...overrides };
}

function renderPanel(canWrite = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ContactOptionsPanel bookingId={BOOKING} canWrite={canWrite} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

describe('ContactOptionsPanel (NF-63: a booking that has no conversation yet)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('ContactOptionsPanel_BookingWithAChannelConversation_OpensIt', async () => {
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue(options({ channel: 'Ota', threadKey: 'ota:6f1c9a52-1111-4222-8333-944455556666' }));
    renderPanel();

    const link = await screen.findByTestId('contact-open-thread');
    expect(link).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent('ota:6f1c9a52-1111-4222-8333-944455556666')}`);
    expect(messageHubApi.getContactOptions).toHaveBeenCalledWith(BOOKING);
  });

  it('ContactOptionsPanel_DirectBookingWithNoMessageYet_SaysTheHostMayWriteFirst', async () => {
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue(options({ channel: 'Direct', threadKey: 'direct:0c9d2a10-aaaa-4bbb-8ccc-123456789abc' }));
    renderPanel();

    expect(await screen.findByTestId('contact-existing-thread')).toHaveTextContent('Puoi scrivere tu per primo');
  });

  it('ContactOptionsPanel_ChannelWithoutChat_OffersToWriteByEmailThroughCasaZenAndNeverShowsAnAddress', async () => {
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue(options({ channel: 'Email', emailAvailable: true, phoneAvailable: true }));
    renderPanel();

    const form = await screen.findByTestId('contact-email-form');
    expect(form).toHaveTextContent("il suo indirizzo non lo vedi e non lo conserviamo");
    expect(screen.getByTestId('contact-email-send')).toHaveTextContent('Scrivi per e-mail');
    // «emailAvailable» and «phoneAvailable» say that they exist: neither the address nor the number is anywhere.
    expect(document.body.textContent).not.toMatch(/@|\+39/);
  });

  it('ContactOptionsPanel_EmailMessage_IsSentOnceWhateverTheNumberOfClicks_WithOneKey', async () => {
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue(options({ channel: 'Email', emailAvailable: true }));
    vi.mocked(messageHubApi.startConversation).mockResolvedValue({ channel: 'Email', state: 'Sent', replayed: false });
    renderPanel();
    await screen.findByTestId('contact-email-form');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Buongiorno, il check-in è dalle 15.' } });
    const send = screen.getByTestId('contact-email-send');
    fireEvent.click(send);
    fireEvent.click(send);

    expect(await screen.findByTestId('contact-email-sent')).toHaveTextContent('Messaggio inviato per e-mail.');
    expect(messageHubApi.startConversation).toHaveBeenCalledTimes(1);
    expect(messageHubApi.startConversation).toHaveBeenCalledWith(BOOKING, 'Buongiorno, il check-in è dalle 15.', expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/));
  });

  it('ContactOptionsPanel_EmailRetryAfterAFailure_KeepsTheKeyOfThatText', async () => {
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue(options({ channel: 'Email', emailAvailable: true }));
    vi.mocked(messageHubApi.startConversation)
      .mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK))
      .mockResolvedValueOnce({ channel: 'Email', state: 'Sent', replayed: false });
    renderPanel();
    await screen.findByTestId('contact-email-form');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ciao' } });
    fireEvent.click(screen.getByTestId('contact-email-send'));
    await screen.findByTestId('contact-email-problem');
    fireEvent.click(screen.getByTestId('contact-email-send'));

    await waitFor(() => expect(messageHubApi.startConversation).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(messageHubApi.startConversation).mock.calls;
    expect(second[2]).toBe(first[2]);
  });

  it('ContactOptionsPanel_ChannelThatDoesNotReleaseTheContact_IsExplainedInOneSentence', async () => {
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue(options({ channel: 'Email', emailAvailable: true }));
    vi.mocked(messageHubApi.startConversation).mockRejectedValue(httpError(409, { code: 'contact_info_unavailable' }));
    renderPanel();
    await screen.findByTestId('contact-email-form');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ciao' } });
    fireEvent.click(screen.getByTestId('contact-email-send'));

    expect(await screen.findByTestId('contact-email-problem')).toHaveTextContent("Il canale non ci dà l'e-mail di questo ospite: scrivigli dal canale.");
    expect(document.body.textContent).not.toMatch(/octorate/i);
  });

  it('ContactOptionsPanel_ReaderWhoMayNotWrite_DoesNotGetTheForm', async () => {
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue(options({ channel: 'Email', emailAvailable: true }));
    renderPanel(false);

    expect(await screen.findByText('Puoi leggere i messaggi, ma non hai il permesso di rispondere.')).toBeInTheDocument();
    expect(screen.queryByTestId('contact-email-form')).not.toBeInTheDocument();
  });

  it.each([
    ['mapping_not_confirmed', "L'annuncio non è ancora collegato a un tuo immobile: per ora non puoi scrivere all'ospite da qui."],
    ['thread_closed', 'La conversazione è chiusa: non si possono più scrivere messaggi.'],
    ['no_conversation', "Questa prenotazione non ha ancora una conversazione e non c'è un altro modo per scrivere all'ospite."],
    ['contact_info_unavailable', "Il canale non ci dà l'e-mail di questo ospite: scrivigli dal canale."],
    ['octorate_not_connected', 'Il collegamento ai canali non è attivo: non puoi scrivere all\'ospite da qui.'],
    ['something_new', "Per ora non puoi scrivere all'ospite da CasaZen."],
  ])('ContactOptionsPanel_NoWay_%s_SaysWhyInSimpleWords', async (reason, sentence) => {
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue(options({ channel: 'None', reason }));
    renderPanel();

    expect(await screen.findByTestId('contact-none')).toHaveTextContent(sentence);
  });

  it('ContactOptionsPanel_FailedToAsk_IsAnErrorWithARetry', async () => {
    // A refusal is not retried by itself (a 5xx would be, once, after a second).
    vi.mocked(messageHubApi.getContactOptions).mockRejectedValue(httpError(403));
    renderPanel();

    expect(await screen.findByTestId('contact-options-error')).toHaveTextContent("Non riesco a controllare come raggiungere l'ospite.");
  });
});
