import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import { messageHubApi } from '@/api/message-hub.api';
import type { PendingThreadMessage } from '@/queries/use-thread-send';
import type { MessageHubMessage } from '@/types';
import { MessageBubble, type BubbleActions } from '../components/message-bubble';
import type { HubThreadItem } from '../lib/thread-items';

vi.mock('@/api/message-hub.api', () => ({
  messageHubApi: { translate: vi.fn(), openAttachment: vi.fn() },
}));

const THREAD = 'ota:6f1c9a52-1111-4222-8333-944455556666';

function message(overrides: Partial<MessageHubMessage> = {}): MessageHubMessage {
  return { id: 'm-1', direction: 'Outbound', origin: 'Person', text: 'Il check-in è dalle 15.', sentAt: '2026-11-10T08:00:00Z', deliveryState: 'Sent', ...overrides };
}

function itemOf(msg: MessageHubMessage, author = 'Tu'): HubThreadItem {
  return { id: msg.id, mine: msg.direction === 'Outbound', author, text: msg.text, at: msg.sentAt, message: msg };
}

function failedItem(error: unknown): HubThreadItem {
  const pending: PendingThreadMessage = { key: 'key-1', text: 'Scrivimi su +39 333 1234567', status: 'failed', error };
  return { id: pending.key, mine: true, author: 'Tu', text: pending.text, at: null, status: 'failed', pending };
}

function actionsMock(): BubbleActions {
  return { onResend: vi.fn(), onCheck: vi.fn(), checking: false, onRetryPending: vi.fn(), onEditPending: vi.fn() };
}

function renderBubble(item: HubThreadItem, actions = actionsMock(), props: { canWrite?: boolean; resent?: ReadonlySet<string> } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MessageBubble item={item} threadKey={THREAD} hostLanguage="it" canWrite={props.canWrite ?? true} resent={props.resent ?? new Set()} actions={actions} />
    </QueryClientProvider>,
  );
  return actions;
}

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

describe('MessageBubble: the state of a message and what can be done about it (NF-63)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('MessageBubble_SentMessage_SaysInviatoAndOffersNothing', () => {
    renderBubble(itemOf(message()));

    expect(screen.getByTestId('delivery-sent')).toHaveTextContent('Inviato');
    expect(screen.queryByTestId('delivery-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delivery-needs-verification')).not.toBeInTheDocument();
  });

  it('MessageBubble_MessageStillOnItsWay_SaysInInvio', () => {
    renderBubble(itemOf(message({ deliveryState: 'WaitingAuthorization' })));

    expect(screen.getByTestId('delivery-sending')).toHaveTextContent('In invio');
  });

  it('MessageBubble_MessageTheChannelRefused_SaysNonInviatoAndSendsItAgainAsANewMessage', () => {
    const msg = message({ deliveryState: 'Error' });
    const actions = renderBubble(itemOf(msg));

    expect(screen.getByTestId('delivery-error')).toHaveTextContent('Non inviato');
    expect(screen.getByTestId('delivery-error')).toHaveTextContent('Il canale non ha accettato il messaggio.');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(actions.onResend).toHaveBeenCalledWith(msg);
  });

  it('MessageBubble_MessageAlreadySentAgain_HasNoSecondButtonToSendItAThirdTime', () => {
    renderBubble(itemOf(message({ deliveryState: 'Error' })), actionsMock(), { resent: new Set(['m-1']) });

    expect(screen.getByTestId('delivery-error')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
  });

  it('MessageBubble_ReaderWhoMayNotWrite_HasNothingToSendAgain', () => {
    renderBubble(itemOf(message({ deliveryState: 'Error' })), actionsMock(), { canWrite: false });

    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
  });

  it('MessageBubble_OutcomeNotKnown_SaysDaVerificareAndOnlyChecksNeverSendsAgain', () => {
    const actions = renderBubble(itemOf(message({ deliveryState: 'ManualVerify' })));

    expect(screen.getByTestId('delivery-needs-verification')).toHaveTextContent('Da verificare');
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Controlla' }));
    expect(actions.onCheck).toHaveBeenCalledTimes(1);
    expect(actions.onResend).not.toHaveBeenCalled();
  });

  it('MessageBubble_NeverNamesTheChannelManager', () => {
    renderBubble(itemOf(message({ deliveryState: 'ManualVerify' })));

    expect(screen.getByTestId('message-bubble').textContent).not.toMatch(/octorate/i);
  });

  it('MessageBubble_PendingMessageNetworkFailure_OffersRiprovaWithTheSameKey', () => {
    const actions = renderBubble(failedItem(new AxiosError('Network Error', AxiosError.ERR_NETWORK)));

    fireEvent.click(screen.getByTestId('pending-retry'));
    expect(actions.onRetryPending).toHaveBeenCalledWith('key-1');
  });

  it('MessageBubble_PendingMessageRefusedByTheChannelRule_SaysSoInTheSentenceAndOffersToEditIt', () => {
    const error = httpError(422, { code: 'channel_rule_violation' });
    const item = failedItem(error);
    const actions = renderBubble(item);

    expect(screen.getByTestId('pending-error')).toHaveTextContent('Prima della prenotazione il canale non permette di scrivere link, indirizzi e-mail o numeri di telefono');
    expect(screen.queryByTestId('pending-retry')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pending-edit'));
    expect(actions.onEditPending).toHaveBeenCalledWith(item.pending);
  });

  it.each([
    [409, 'thread_closed', 'La conversazione è chiusa: non si possono più scrivere messaggi.'],
    [409, 'mapping_not_confirmed', "L'annuncio non è ancora collegato a un tuo immobile: il messaggio non è stato inviato."],
    [422, 'message_text_invalid', 'Scrivi un messaggio non vuoto e di al massimo 2000 caratteri.'],
  ])('MessageBubble_PendingMessageRefused_%s_%s_HasItsOwnSentence', (status, code, sentence) => {
    renderBubble(failedItem(httpError(status, { code })));

    expect(screen.getByTestId('pending-error')).toHaveTextContent(sentence);
  });

  it('MessageBubble_PendingMessageRateLimited_SaysHowLongToWaitAndOffersToTryAgain', () => {
    renderBubble(failedItem(httpError(429, { retryAfterSeconds: 90 })));

    expect(screen.getByTestId('pending-error')).toHaveTextContent('Troppi messaggi: riprova tra 2 minuti.');
    expect(screen.getByTestId('pending-retry')).toBeInTheDocument();
  });
});

describe('MessageBubble: files and translation of a message', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('MessageBubble_FileThatIsGone_SaysAllegatoNonPiuDisponibileAndNeverABrokenPicture', async () => {
    vi.mocked(messageHubApi.openAttachment).mockRejectedValue(httpError(404, { code: 'attachment_unavailable' }));
    renderBubble(itemOf(message({ direction: 'Inbound', origin: 'Guest', text: '', deliveryState: null, attachment: { contentType: 'image/jpeg' } }), 'Sofia'));

    expect(await screen.findByTestId('message-attachment-unavailable')).toHaveTextContent('Allegato non più disponibile');
    expect(screen.queryByTestId('message-attachment-image')).not.toBeInTheDocument();
    // It was asked through the API, by the id of the message: no address of the channel is in the page.
    expect(messageHubApi.openAttachment).toHaveBeenCalledWith('m-1');
  });

  it('MessageBubble_FileThatIsNotAPicture_IsADownloadAskedOnlyWhenTheHostClicks', async () => {
    vi.mocked(messageHubApi.openAttachment).mockRejectedValue(httpError(404));
    renderBubble(itemOf(message({ direction: 'Inbound', origin: 'Guest', text: 'Ecco il documento', deliveryState: null, attachment: { contentType: 'application/octet-stream' } }), 'Sofia'));

    expect(messageHubApi.openAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('message-attachment-download'));
    expect(await screen.findByTestId('message-attachment-unavailable')).toBeInTheDocument();
  });

  it('MessageBubble_MessageOfTheGuest_IsTranslatedIntoTheLanguageOfTheHostAndLabelledMachineTranslated', async () => {
    vi.mocked(messageHubApi.translate).mockResolvedValue({ text: 'Che ore sono il check-in?', targetLanguage: 'it', machineTranslated: true });
    renderBubble(itemOf(message({ direction: 'Inbound', origin: 'Guest', text: 'What time is check-in?', deliveryState: null }), 'Sofia'));

    fireEvent.click(screen.getByTestId('translate-button'));

    expect(await screen.findByTestId('message-translation')).toHaveTextContent('Che ore sono il check-in?');
    expect(screen.getByTestId('message-translation')).toHaveTextContent('Traduzione automatica');
    expect(messageHubApi.translate).toHaveBeenCalledWith({ threadKey: THREAD, messageId: 'm-1', targetLanguage: 'it' });
    // The original stays; the button now hides the translation, and asks nothing again.
    expect(screen.getByText('What time is check-in?')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('translate-button'));
    await waitFor(() => expect(screen.queryByTestId('message-translation')).not.toBeInTheDocument());
    expect(messageHubApi.translate).toHaveBeenCalledTimes(1);
  });

  it('MessageBubble_TranslationNotAvailable_SaysSoInOneSentence', async () => {
    vi.mocked(messageHubApi.translate).mockRejectedValue(httpError(422, { code: 'translation_unavailable' }));
    renderBubble(itemOf(message({ direction: 'Inbound', origin: 'Guest', text: 'Hello', deliveryState: null }), 'Sofia'));

    fireEvent.click(screen.getByTestId('translate-button'));

    expect(await screen.findByRole('alert')).toHaveTextContent('La traduzione non è disponibile in questo momento.');
  });

  it('MessageBubble_MessageOfTheHost_HasNoTranslateButton', () => {
    renderBubble(itemOf(message()));

    expect(screen.queryByTestId('translate-button')).not.toBeInTheDocument();
  });
});
