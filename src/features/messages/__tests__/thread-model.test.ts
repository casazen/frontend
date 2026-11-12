import { describe, expect, it } from 'vitest';
import { AxiosError } from 'axios';
import i18n from '@/i18n/config';
import type { MessageHubMessage, MessageHubThreadDetail } from '@/types';
import { guestProfilePath } from '../lib/guest-profile';
import { canRetryReply, replyProblemMessage } from '../lib/reply-problems';
import { buildThreadItems, senderOf } from '../lib/thread-items';

const LABELS = { guest: 'Ospite', you: 'Tu', assistant: 'Assistente CasaZen' };

function msg(overrides: Partial<MessageHubMessage> & { id: string }): MessageHubMessage {
  return { direction: 'Inbound', origin: 'Guest', text: 'Ciao', sentAt: '2026-11-10T08:00:00Z', ...overrides };
}

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

describe('who wrote a message (NF-61)', () => {
  it('senderOf_Guest_IsTheNameOfTheGuestOrTheWordOspite', () => {
    expect(senderOf(msg({ id: '1' }), 'Sofia Marino', LABELS)).toBe('Sofia Marino');
    expect(senderOf(msg({ id: '1' }), null, LABELS)).toBe('Ospite');
    expect(senderOf(msg({ id: '1' }), '  ', LABELS)).toBe('Ospite');
  });

  it('senderOf_HostSide_IsAColleagueOrTheHostOfTheChannelByNameAndTuWhenWrittenInCasaZen', () => {
    expect(senderOf(msg({ id: '1', direction: 'Outbound', origin: 'Person', senderName: 'Marco Bianchi' }), 'Sofia', LABELS)).toBe('Marco Bianchi');
    expect(senderOf(msg({ id: '1', direction: 'Outbound', origin: 'Person' }), 'Sofia', LABELS)).toBe('Tu');
    expect(senderOf(msg({ id: '1', direction: 'Outbound', origin: 'Person', senderName: '   ' }), 'Sofia', LABELS)).toBe('Tu');
  });

  it('senderOf_Assistant_IsTheAssistantOfCasaZenWhateverTheName', () => {
    expect(senderOf(msg({ id: '1', direction: 'Outbound', origin: 'Assistant', senderName: 'Marco' }), 'Sofia', LABELS)).toBe('Assistente CasaZen');
  });

  it('buildThreadItems_MessagesOldestFirstThenWhatIsStillBeingSent', () => {
    const thread = {
      guestName: 'Sofia Marino',
      messages: [msg({ id: 'a' }), msg({ id: 'b', direction: 'Outbound', origin: 'Person', text: 'Dalle 15.' })],
    } as MessageHubThreadDetail;
    const items = buildThreadItems(thread, [{ key: 'k-1', text: 'Grazie', status: 'sending' }], LABELS);

    expect(items.map((item) => [item.id, item.mine, item.author, item.text, item.at !== null])).toEqual([
      ['a', false, 'Sofia Marino', 'Ciao', true],
      ['b', true, 'Tu', 'Dalle 15.', true],
      ['k-1', true, 'Tu', 'Grazie', false],
    ]);
    expect(items[2].status).toBe('sending');
    expect(items[0].message?.id).toBe('a');
    expect(items[2].pending?.key).toBe('k-1');
  });

  it('buildThreadItems_ThreadWithNoNameOfItsOwn_UsesTheGuestOfTheBooking', () => {
    const thread = { guestName: null, booking: { guestName: 'Luca Verdi' }, messages: [msg({ id: 'a' })] } as unknown as MessageHubThreadDetail;

    expect(buildThreadItems(thread, [], LABELS)[0].author).toBe('Luca Verdi');
  });
});

describe('the sentence for a send that did not go (NF-63)', () => {
  const t = i18n.getFixedT('it');

  it.each([
    [httpError(409, { code: 'thread_closed' }), 'La conversazione è chiusa: non si possono più scrivere messaggi.'],
    [httpError(409, { code: 'mapping_not_confirmed' }), "L'annuncio non è ancora collegato a un tuo immobile: il messaggio non è stato inviato."],
    [httpError(422, { code: 'channel_rule_violation' }), 'Prima della prenotazione il canale non permette di scrivere link, indirizzi e-mail o numeri di telefono: toglili dal messaggio.'],
    [httpError(422, { code: 'message_text_invalid' }), 'Scrivi un messaggio non vuoto e di al massimo 2000 caratteri.'],
    [httpError(429, { retryAfterSeconds: 30 }), 'Troppi messaggi: riprova tra 1 minuto.'],
    [httpError(429), 'Troppi messaggi in poco tempo: riprova tra poco.'],
    [httpError(500), 'Non è andato a buon fine. Riprova.'],
    [new Error('boom'), 'Non è andato a buon fine. Riprova.'],
  ])('replyProblemMessage_%#_HasItsOwnSentence', (error, sentence) => {
    expect(replyProblemMessage(error, t)).toBe(sentence);
  });

  it('canRetryReply_NetworkServerOrWaitYes_RefusalNo', () => {
    expect(canRetryReply(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toBe(true);
    expect(canRetryReply(httpError(503))).toBe(true);
    expect(canRetryReply(httpError(429, { retryAfterSeconds: 60 }))).toBe(true);
    expect(canRetryReply(httpError(409, { code: 'thread_closed' }))).toBe(false);
    expect(canRetryReply(httpError(422, { code: 'channel_rule_violation' }))).toBe(false);
  });
});

describe('the link to the guest (NF-64)', () => {
  const allow = () => true;

  it('guestProfilePath_GuestOfTheBooking_IsBuiltFromItsId', () => {
    expect(guestProfilePath('6f1c9a52-1111-4222-8333-944455556666', allow)).toBe('/app/short-rent/guests/6f1c9a52-1111-4222-8333-944455556666');
  });

  it('guestProfilePath_RequestWithNoGuest_HasNoLink', () => {
    expect(guestProfilePath(null, allow)).toBeNull();
    expect(guestProfilePath(undefined, allow)).toBeNull();
  });

  it('guestProfilePath_UserWhoMayNotOpenThePage_HasNoLinkInsteadOfALinkToNoAccess', () => {
    expect(guestProfilePath('g-1', (_context, permission) => permission !== 'booking.read')).toBeNull();
  });
});
