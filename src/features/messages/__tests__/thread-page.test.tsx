import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import { messageHubApi } from '@/api/message-hub.api';
import type { MessageBookingCard, MessageHubMessage, MessageHubThreadDetail } from '@/types';
import { ThreadPage } from '../thread-page';

const permissions = vi.hoisted(() => ({ canWrite: true }));

vi.mock('@/api/message-hub.api', () => ({
  messageHubApi: {
    getThread: vi.fn(),
    markRead: vi.fn(),
    reply: vi.fn(),
    list: vi.fn(),
    unread: vi.fn(),
    listTemplates: vi.fn(),
    listChannelTemplates: vi.fn(),
    renderTemplate: vi.fn(),
    translate: vi.fn(),
    openAttachment: vi.fn(),
  },
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permissions.canWrite || permission !== 'booking.write' }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

const KEY = 'ota:6f1c9a52-1111-4222-8333-944455556666';
const DIRECT_KEY = 'direct:0c9d2a10-aaaa-4bbb-8ccc-123456789abc';

const CARD: MessageBookingCard = {
  bookingId: 'b-1',
  bookingCode: 'ABCDE-12345',
  guestName: 'Sofia Marino',
  checkInDate: '2026-11-20',
  checkOutDate: '2026-11-23',
  guests: 3,
  adults: 2,
  children: 1,
  status: 'Confirmed',
  source: 'Airbnb',
  channelLabel: null,
  currency: 'EUR',
  amounts: { total: 450, commission: 67.5, net: 382.5, paid: 100, balance: 350 },
};

function msg(overrides: Partial<MessageHubMessage> & { id: string }): MessageHubMessage {
  return { direction: 'Inbound', origin: 'Guest', text: 'Che ore sono il check-in?', sentAt: '2026-11-10T08:00:00Z', ...overrides };
}

function thread(overrides: Partial<MessageHubThreadDetail> = {}): MessageHubThreadDetail {
  return {
    threadKey: KEY,
    source: 'Ota',
    channel: 'Airbnb',
    kind: 'Reservation',
    state: 'Open',
    propertyId: 'p-1',
    propertyName: 'Casa Mare',
    unassigned: false,
    guestName: 'Sofia Marino',
    unreadCount: 1,
    needsReply: true,
    anonymized: false,
    booking: CARD,
    customer: { guestId: 'g-1' },
    allowedActions: { canReply: true, contactDetailsAllowed: true, attachmentsAllowed: false, autoReplyAllowed: false, reason: null },
    messages: [msg({ id: 'm-1' })],
    hasEarlierMessages: false,
    ...overrides,
  };
}

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function renderThread(threadKey = KEY) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/app/short-rent/messages/${encodeURIComponent(threadKey)}`]}>
        <Routes>
          <Route path="/app/short-rent/messages/:threadKey" element={<ThreadPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const textbox = () => screen.getByRole('textbox', { name: "Messaggio per l'ospite" });
const typeMessage = (text: string) => fireEvent.change(textbox(), { target: { value: text } });

describe('ThreadPage (NF-61, NF-63, NF-64)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(async () => {
    vi.clearAllMocks();
    permissions.canWrite = true;
    // From a desktop the booking card is open beside the conversation (on a phone it is a line that opens).
    window.matchMedia = ((query: string) => ({
      matches: query === '(width >= 64rem)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    vi.mocked(messageHubApi.getThread).mockResolvedValue(thread());
    vi.mocked(messageHubApi.markRead).mockResolvedValue({ threadKey: KEY, unreadCount: 0 });
    vi.mocked(messageHubApi.reply).mockResolvedValue({ channel: 'Ota', threadKey: KEY, message: msg({ id: 'm-2', direction: 'Outbound', origin: 'Person', text: 'Dalle 15.', deliveryState: 'Sent' }), state: 'Sent', replayed: false });
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  it('ThreadPage_OpenConversation_ShowsTheMessagesAndTheBookingCardBesideThem', async () => {
    renderThread();

    expect(await screen.findByText('Che ore sono il check-in?')).toBeInTheDocument();
    // The key is the one of the address, back as the server gave it.
    expect(messageHubApi.getThread).toHaveBeenCalledWith(KEY);

    const card = screen.getByTestId('booking-card');
    expect(within(card).getByTestId('booking-card-code')).toHaveTextContent('ABCDE-12345');
    expect(within(card).getByTestId('booking-card-status')).toHaveTextContent('Confermata');
    expect(card).toHaveTextContent('Sofia Marino');
    expect(card).toHaveTextContent('3 notti');
    expect(card).toHaveTextContent('3 ospiti');
    // The amounts in simple words (a commission, a net, what was paid and what is left).
    const amounts = within(card).getByTestId('booking-card-amounts');
    expect(amounts).toHaveTextContent('Totale');
    expect(amounts).toHaveTextContent('Commissione del canale');
    expect(amounts).toHaveTextContent('Netto per te');
    expect(amounts).toHaveTextContent('Già pagato');
    expect(amounts).toHaveTextContent('Ancora da pagare');
    expect(amounts).toHaveTextContent(/67,50/);
    // Links to the booking and to the guest.
    expect(within(card).getByTestId('booking-card-open')).toHaveAttribute('href', '/app/short-rent/bookings/b-1');
    expect(within(card).getByTestId('booking-card-profile')).toHaveAttribute('href', '/app/short-rent/guests/g-1');
    expect(screen.getByTestId('channel-badge')).toHaveTextContent('Airbnb');
  });

  it('ThreadPage_FigureTheChannelHasNotGiven_IsLeftOutNeverShownAsZero', async () => {
    vi.mocked(messageHubApi.getThread).mockResolvedValue(thread({ booking: { ...CARD, amounts: { total: 450 } } }));
    renderThread();

    const amounts = await screen.findByTestId('booking-card-amounts');
    expect(amounts).toHaveTextContent('Totale');
    expect(amounts).not.toHaveTextContent('Commissione');
    expect(amounts).not.toHaveTextContent('Netto');
  });

  it('ThreadPage_ReaderWhoMayNotReadPayments_SeesNoAmountsAtAll', async () => {
    vi.mocked(messageHubApi.getThread).mockResolvedValue(thread({ booking: { ...CARD, amounts: null } }));
    renderThread();

    await screen.findByTestId('booking-card');
    expect(screen.queryByTestId('booking-card-amounts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-card-no-amounts')).not.toBeInTheDocument();
  });

  it('ThreadPage_RequestWithNoBooking_IsLabelledRichiestaAndSaysThereIsNoBookingYet', async () => {
    vi.mocked(messageHubApi.getThread).mockResolvedValue(
      thread({
        kind: 'Request',
        booking: null,
        customer: null,
        guestName: null,
        allowedActions: { canReply: true, contactDetailsAllowed: false, attachmentsAllowed: false, autoReplyAllowed: false, reason: null },
      }),
    );
    renderThread();

    expect(await screen.findByTestId('thread-request-label')).toHaveTextContent('Richiesta');
    expect(screen.getByTestId('booking-card-none')).toHaveTextContent('Non c\'è ancora una prenotazione');
    expect(screen.queryByTestId('booking-card')).not.toBeInTheDocument();
    // On an Airbnb request the composer says that links and contacts cannot be sent before the booking.
    expect(screen.getByTestId('reply-no-contacts')).toHaveTextContent('Prima della prenotazione il canale non permette di scrivere link');
  });

  it('ThreadPage_RuleOfTheChannelRefusesTheText_ShowsTheRefusalAsTheSameSentenceAndGivesTheTextBack', async () => {
    vi.mocked(messageHubApi.getThread).mockResolvedValue(
      thread({ kind: 'Request', booking: null, customer: null, allowedActions: { canReply: true, contactDetailsAllowed: false, attachmentsAllowed: false, autoReplyAllowed: false, reason: null } }),
    );
    vi.mocked(messageHubApi.reply).mockRejectedValue(httpError(422, { code: 'channel_rule_violation' }));
    renderThread();
    await screen.findByTestId('reply-composer');

    typeMessage('Chiamami al 333 1234567');
    fireEvent.click(screen.getByTestId('reply-send'));

    expect(await screen.findByTestId('pending-error')).toHaveTextContent('Prima della prenotazione il canale non permette di scrivere link');
    // Sending it again would be refused the same way: the host edits it, and the text is back in the box.
    fireEvent.click(screen.getByTestId('pending-edit'));
    expect(textbox()).toHaveValue('Chiamami al 333 1234567');
    expect(screen.queryByTestId('pending-error')).not.toBeInTheDocument();
  });

  it('ThreadPage_RefusedMessageTakenBackToTheBox_GoesInFrontOfWhatTheHostTypedMeanwhile', async () => {
    vi.mocked(messageHubApi.getThread).mockResolvedValue(
      thread({ kind: 'Request', booking: null, customer: null, allowedActions: { canReply: true, contactDetailsAllowed: false, attachmentsAllowed: false, autoReplyAllowed: false, reason: null } }),
    );
    vi.mocked(messageHubApi.reply).mockRejectedValue(httpError(422, { code: 'channel_rule_violation' }));
    renderThread();
    await screen.findByTestId('reply-composer');

    typeMessage('Chiamami al 333 1234567');
    fireEvent.click(screen.getByTestId('reply-send'));
    await screen.findByTestId('pending-error');
    // The box stays open while a message is refused: the host goes on with another one.
    typeMessage('Ci vediamo alle 15.');
    fireEvent.click(screen.getByTestId('pending-edit'));

    // Nothing the host typed is lost: the refused words come first, the new ones stay under them.
    expect(textbox()).toHaveValue('Chiamami al 333 1234567\n\nCi vediamo alle 15.');
    expect(screen.queryByTestId('pending-error')).not.toBeInTheDocument();
  });

  it('ThreadPage_ReplyToAConversationOfAChannel_IsSentOnceWithOneKeyAndShownAsSent', async () => {
    renderThread();
    await screen.findByTestId('reply-composer');

    typeMessage('Dalle 15.');
    const send = screen.getByTestId('reply-send');
    fireEvent.click(send);
    fireEvent.click(send);

    // The row of the message is the one of the page while it is sent and the stored one when the server answers: asked again each time.
    await waitFor(() => expect(screen.getByText('Dalle 15.')).toBeInTheDocument());
    // A second click on the button finds the box already empty: nothing goes twice.
    expect(messageHubApi.reply).toHaveBeenCalledTimes(1);
    expect(messageHubApi.reply).toHaveBeenCalledWith(KEY, 'Dalle 15.', expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/));
    await waitFor(() => expect(screen.getAllByTestId('delivery-sent')).toHaveLength(1));
    expect(textbox()).toHaveValue('');
  });

  it('ThreadPage_ReplyToADirectConversation_GoesThroughTheSameComposer', async () => {
    vi.mocked(messageHubApi.getThread).mockResolvedValue(thread({ threadKey: DIRECT_KEY, source: 'Direct', channel: 'Direct', unreadCount: 0 }));
    vi.mocked(messageHubApi.reply).mockResolvedValue({ channel: 'Direct', threadKey: DIRECT_KEY, message: msg({ id: 'd-2', direction: 'Outbound', origin: 'Person', text: 'Ti aspettiamo.' }), state: 'Sent', replayed: false });
    renderThread(DIRECT_KEY);
    await screen.findByTestId('reply-composer');

    typeMessage('Ti aspettiamo.');
    fireEvent.click(screen.getByTestId('reply-send'));

    await waitFor(() => expect(screen.getByText('Ti aspettiamo.')).toBeInTheDocument());
    expect(messageHubApi.reply).toHaveBeenCalledWith(DIRECT_KEY, 'Ti aspettiamo.', expect.any(String));
    expect(screen.getByTestId('channel-badge')).toHaveTextContent('Diretto');
  });

  it('ThreadPage_SendFailsOnTheNetwork_RetryUsesTheSameKeySoTheMessageIsWrittenOnce', async () => {
    vi.mocked(messageHubApi.reply).mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK));
    renderThread();
    await screen.findByTestId('reply-composer');

    typeMessage('Dalle 15.');
    fireEvent.click(screen.getByTestId('reply-send'));
    fireEvent.click(await screen.findByTestId('pending-retry'));

    await waitFor(() => expect(messageHubApi.reply).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(messageHubApi.reply).mock.calls;
    expect(second[2]).toBe(first[2]);
    expect(second[1]).toBe('Dalle 15.');
    await waitFor(() => expect(screen.queryByTestId('pending-error')).not.toBeInTheDocument());
  });

  it('ThreadPage_ChannelAnswersThatTheOutcomeIsNotKnown_ShowsDaVerificareAndNeverASecondSend', async () => {
    vi.mocked(messageHubApi.reply).mockResolvedValue({
      channel: 'Ota',
      threadKey: KEY,
      message: msg({ id: 'm-2', direction: 'Outbound', origin: 'Person', text: 'Dalle 15.', deliveryState: 'ManualVerify' }),
      state: 'ManualVerify',
      replayed: false,
    });
    renderThread();
    await screen.findByTestId('reply-composer');

    typeMessage('Dalle 15.');
    fireEvent.click(screen.getByTestId('reply-send'));

    expect(await screen.findByTestId('delivery-needs-verification')).toHaveTextContent('Da verificare');
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    expect(messageHubApi.reply).toHaveBeenCalledTimes(1);
  });

  it('ThreadPage_RefusedMessageSentAgain_UsesAKeyMadeFromThatMessageSoOpeningTheConversationAgainCannotWriteItTwice', async () => {
    const refused = msg({ id: 'm-7', direction: 'Outbound', origin: 'Person', text: 'Dalle 15.', deliveryState: 'Error' });
    vi.mocked(messageHubApi.getThread).mockResolvedValue(thread({ messages: [msg({ id: 'm-1' }), refused] }));
    const first = renderThread();

    fireEvent.click(await screen.findByTestId('delivery-retry'));
    await waitFor(() => expect(messageHubApi.reply).toHaveBeenCalledTimes(1));
    expect(messageHubApi.reply).toHaveBeenLastCalledWith(KEY, 'Dalle 15.', 'resend-m-7');
    // On this page the refused message has no second button.
    await waitFor(() => expect(screen.queryByTestId('delivery-retry')).not.toBeInTheDocument());

    // The conversation opened again before the list carried the new message: the same message gives the same key, and the server answers
    // «replayed» instead of writing it a second time.
    first.unmount();
    renderThread();
    fireEvent.click(await screen.findByTestId('delivery-retry'));
    await waitFor(() => expect(messageHubApi.reply).toHaveBeenCalledTimes(2));
    expect(messageHubApi.reply).toHaveBeenLastCalledWith(KEY, 'Dalle 15.', 'resend-m-7');
  });

  it('ThreadPage_ConversationOpenedAgainAfterTheMessageWasSentAgain_HasNoRiprovaOnTheRefusedOne', async () => {
    const hostMessage = (id: string, deliveryState: MessageHubMessage['deliveryState']) => msg({ id, direction: 'Outbound', origin: 'Person', text: 'Dalle 15.', deliveryState });
    vi.mocked(messageHubApi.getThread).mockResolvedValue(thread({ messages: [hostMessage('m-7', 'Error'), hostMessage('m-8', 'Sent')] }));
    renderThread();

    // The refusal stays on screen as it happened, and nothing offers to send the same words a second time.
    expect(await screen.findByTestId('delivery-error')).toHaveTextContent('Non inviato');
    expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
  });

  it('ThreadPage_SecondAttemptRefusedToo_OnlyTheNewestMessageOffersRiprovaWithItsOwnKey', async () => {
    const hostMessage = (id: string) => msg({ id, direction: 'Outbound', origin: 'Person', text: 'Dalle 15.', deliveryState: 'Error' });
    vi.mocked(messageHubApi.getThread).mockResolvedValue(thread({ messages: [hostMessage('m-7'), hostMessage('m-8')] }));
    renderThread();

    expect(await screen.findAllByTestId('delivery-error')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(messageHubApi.reply).toHaveBeenCalledTimes(1));
    expect(messageHubApi.reply).toHaveBeenCalledWith(KEY, 'Dalle 15.', 'resend-m-8');
  });

  it('ThreadPage_ConversationClosedMeanwhile_SaysSoInTheSentenceOfThatAnswer', async () => {
    vi.mocked(messageHubApi.reply).mockRejectedValue(httpError(409, { code: 'thread_closed' }));
    renderThread();
    await screen.findByTestId('reply-composer');

    typeMessage('Dalle 15.');
    fireEvent.click(screen.getByTestId('reply-send'));

    expect(await screen.findByTestId('pending-error')).toHaveTextContent('La conversazione è chiusa: non si possono più scrivere messaggi.');
  });

  it('ThreadPage_ListingNotLinkedToAProperty_CanBeReadAndHasNoBoxToAnswer', async () => {
    vi.mocked(messageHubApi.getThread).mockResolvedValue(
      thread({ unassigned: true, propertyId: null, propertyName: null, allowedActions: { canReply: false, contactDetailsAllowed: false, attachmentsAllowed: false, autoReplyAllowed: false, reason: 'mapping_not_confirmed' } }),
    );
    renderThread();

    expect(await screen.findByTestId('thread-cannot-reply')).toHaveTextContent("l'annuncio non è ancora collegato a un tuo immobile");
    expect(screen.queryByTestId('reply-composer')).not.toBeInTheDocument();
    expect(screen.getByText('Che ore sono il check-in?')).toBeInTheDocument();
  });

  it('ThreadPage_ReaderWithoutTheRightToWrite_ReadsAndIsNotAskedToMarkAsRead', async () => {
    permissions.canWrite = false;
    renderThread();

    expect(await screen.findByTestId('thread-cannot-reply')).toHaveTextContent('Puoi leggere i messaggi, ma non hai il permesso di rispondere.');
    expect(screen.queryByTestId('reply-composer')).not.toBeInTheDocument();
    expect(messageHubApi.markRead).not.toHaveBeenCalled();
  });

  it('ThreadPage_ConversationWithMessagesNotRead_MarksThemAsReadOnceWhenItOpens', async () => {
    renderThread();

    await waitFor(() => expect(messageHubApi.markRead).toHaveBeenCalledTimes(1));
    expect(messageHubApi.markRead).toHaveBeenCalledWith(KEY);
  });

  it('ThreadPage_ConversationAlreadyRead_AsksNothing', async () => {
    vi.mocked(messageHubApi.getThread).mockResolvedValue(thread({ unreadCount: 0 }));
    renderThread();

    await screen.findByText('Che ore sono il check-in?');
    expect(messageHubApi.markRead).not.toHaveBeenCalled();
  });

  it('ThreadPage_ConversationThatIsNotThere_SaysSoAndLeadsBackToTheMessages', async () => {
    vi.mocked(messageHubApi.getThread).mockRejectedValue(httpError(404, { code: 'thread_not_found' }));
    renderThread();

    expect(await screen.findByText('Conversazione non trovata')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Torna ai messaggi' })).toHaveAttribute('href', '/app/short-rent/messages');
  });

  it('ThreadPage_ServerFailure_IsAnErrorWithARetryNeverAnEmptyConversation', async () => {
    // A refusal is not retried by itself (a 5xx would be, once, after a second).
    vi.mocked(messageHubApi.getThread).mockRejectedValue(httpError(403));
    renderThread();

    expect(await screen.findByTestId('messages-thread-error')).toHaveTextContent('Non riesco a caricare la conversazione.');
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
  });

  it('ThreadPage_NeverNamesTheChannelManager', async () => {
    renderThread();
    await screen.findByTestId('booking-card');

    expect(document.body.textContent).not.toMatch(/octorate/i);
  });
});
