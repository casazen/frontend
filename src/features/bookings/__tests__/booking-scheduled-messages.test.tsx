import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { scheduledMessagesApi } from '@/api/scheduled-messages.api';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { SCHEDULED_MESSAGES_KEY } from '@/queries/use-scheduled-messages';
import type { Booking, ScheduledMessage } from '@/types';
import { BookingScheduledMessages } from '../components/booking-scheduled-messages';
import { BookingStayTab } from '../components/booking-stay-tab';

// E05/F07/US02 (NF-71): the section «Messaggi programmati» of a booking. The server enforces the state machine and the permissions; what these tests prove is what the screen does with the answers:
// flag and permission (nothing is drawn or asked without them), a read that fails is an unknown state, a message that did not go out is never told as sent, what the host reads and saves is
// never the stand-ins of the preview, and nothing of the host's words stays in the cache of the mutations.

const state = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock('@/api/scheduled-messages.api', () => ({ scheduledMessagesApi: { list: vi.fn(), edit: vi.fn(), skip: vi.fn(), sendNow: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => state.granted.has(permission) }),
}));
// The other sections of the tab Soggiorno have their own tests: here they draw nothing and ask nothing.
vi.mock('@/features/reviews/components/review-invite-panel', () => ({ ReviewInvitePanel: () => null }));
vi.mock('@/features/service-requests/components/service-requests-card', () => ({ ServiceRequestsCard: () => null }));
vi.mock('@/features/service-requests/components/service-request-form', () => ({ ServiceRequestForm: () => null }));
vi.mock('@/queries/use-service-requests', () => ({ useServiceRequests: () => ({ data: undefined }) }));

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROPERTY_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

const BOOKING: Booking = {
  id: BOOKING_ID,
  propertyId: PROPERTY_ID,
  userId: 'auth0|host',
  checkInDate: '2026-12-01T00:00:00Z',
  checkOutDate: '2026-12-05T00:00:00Z',
  numberOfGuests: 2,
  totalPrice: 400,
  currency: 'EUR',
  status: 'Confirmed',
  source: 'Manual',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '+393331234567', country: 'IT' },
  createdAt: '2026-11-01T08:00:00Z',
  updatedAt: '2026-11-01T08:00:00Z',
};

/** A message as the server answers it: planned for 08:00 in Rome on 24 November, open, with all three actions. */
function msg(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    id: 'm-1',
    bookingId: BOOKING_ID,
    routineId: 'r-1',
    routineName: 'Messaggio di arrivo',
    actionIndex: 0,
    plannedAtUtc: '2026-11-24T07:00:00Z',
    timeZone: 'Europe/Rome',
    status: 'Scheduled',
    blockedReason: null,
    skipReason: null,
    edited: false,
    outsideHours: false,
    sentAt: null,
    sentThreadKey: null,
    channel: 'Ota',
    channelReason: null,
    text: 'Ciao Mario, benvenuto! Il tuo link: [check_in_link]',
    missingVariables: [],
    canEdit: true,
    canSkip: true,
    canSendNow: true,
    ...overrides,
  };
}

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

interface RenderOptions {
  flags?: Partial<FeatureFlags>;
  canWrite?: boolean;
  /** The whole tab Soggiorno (where the flag and the permission decide), or the section alone. */
  tab?: boolean;
}

function renderSection({ flags = {}, canWrite = true, tab = false }: RenderOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value = { flags: { ...DEFAULT_FEATURE_FLAGS, scheduledMessages: true, ...flags }, isLoading: false };
  const content = tab ? createElement(BookingStayTab, { booking: BOOKING }) : createElement(BookingScheduledMessages, { booking: BOOKING, canWrite });
  const view = render(
    createElement(QueryClientProvider, { client }, createElement(FeatureFlagsContext.Provider, { value }, createElement(MemoryRouter, null, content))),
  );
  return { ...view, client };
}

const list = vi.mocked(scheduledMessagesApi.list);
const edit = vi.mocked(scheduledMessagesApi.edit);
const skip = vi.mocked(scheduledMessagesApi.skip);
const sendNow = vi.mocked(scheduledMessagesApi.sendNow);

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  vi.clearAllMocks();
  state.granted = new Set();
  cleanup();
});

/** The card of one message. */
async function cardOf(id: string) {
  const cards = await screen.findAllByTestId('scheduled-message');
  const card = cards.find((item) => item.getAttribute('data-message-id') === id);
  if (!card) throw new Error(`no card for ${id}`);
  return within(card);
}

describe('the section in the tab Soggiorno (E05/F07/US02, NF-71)', () => {
  // PERMISSION: nothing is drawn and nothing is asked while the flag is off or the person cannot read the booking.
  it('stayTab_FlagOff_DrawsNoSectionAndAsksTheServerNothing', async () => {
    state.granted = new Set(['booking.read', 'booking.write', 'property.write']);
    renderSection({ tab: true, flags: { scheduledMessages: false } });

    expect(await screen.findByText('Mario Rossi')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-scheduled-messages')).not.toBeInTheDocument();
    expect(screen.queryByText('Messaggi programmati')).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it('stayTab_WithoutThePermissionToReadTheBooking_DrawsNoSectionAndAsksTheServerNothing', async () => {
    state.granted = new Set(['property.write']);
    renderSection({ tab: true });

    expect(await screen.findByText('Mario Rossi')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-scheduled-messages')).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it('stayTab_FlagOnAndPermissionToRead_DrawsTheSectionAndReadsTheMessagesOfThisBooking', async () => {
    state.granted = new Set(['booking.read']);
    list.mockResolvedValue([msg()]);
    renderSection({ tab: true });

    const section = await screen.findByTestId('booking-scheduled-messages');
    expect(within(section).getByRole('heading', { name: 'Messaggi programmati' })).toBeInTheDocument();
    await screen.findByTestId('scheduled-message');
    expect(list).toHaveBeenCalledWith(BOOKING_ID);
    // Read-only without the permission to write the booking: the messages, never the buttons.
    expect(screen.queryByTestId('scheduled-message-actions')).not.toBeInTheDocument();
  });
});

describe('the timeline', () => {
  it('section_Messages_AreInTimeOrderWithTheTimeOnTheClockOfThePropertyTheRoutineTheChannelAndTheState', async () => {
    list.mockResolvedValue([
      msg({ id: 'm-later', plannedAtUtc: '2026-11-30T09:00:00Z', routineName: 'Promemoria partenza', channel: 'Email' }),
      msg({ id: 'm-sooner', plannedAtUtc: '2026-11-24T07:00:00Z' }),
    ]);
    renderSection();

    const cards = await screen.findAllByTestId('scheduled-message');
    expect(cards.map((card) => card.getAttribute('data-message-id'))).toEqual(['m-sooner', 'm-later']);
    const first = within(cards[0]);
    // 07:00 UTC on 24 November is 08:00 in Rome (UTC+1).
    expect(first.getByTestId('scheduled-message-time')).toHaveTextContent('08:00');
    expect(first.getByTestId('scheduled-message-time')).toHaveTextContent('24');
    expect(first.getByTestId('scheduled-message-status')).toHaveTextContent('Programmato');
    expect(first.getByTestId('scheduled-message-routine')).toHaveTextContent('Routine: Messaggio di arrivo');
    expect(first.getByTestId('scheduled-message-channel')).toHaveTextContent('Canale: chat del portale');
    const second = within(cards[1]);
    expect(second.getByTestId('scheduled-message-time')).toHaveTextContent('10:00');
    expect(second.getByTestId('scheduled-message-channel')).toHaveTextContent('Canale: e-mail');
  });

  it('section_OpenMessageWithNoWayToTheGuest_SaysWhy', async () => {
    list.mockResolvedValue([msg({ channel: 'None', channelReason: 'thread_closed' })]);
    renderSection();

    expect(await screen.findByTestId('scheduled-message-channel')).toHaveTextContent("Nessun modo per scrivere all'ospite: la conversazione è chiusa");
  });

  it('section_EditedMessageAndOneSentOutsideTheHours_SayItInWords', async () => {
    list.mockResolvedValue([
      msg({ id: 'm-edited', edited: true }),
      msg({ id: 'm-late', status: 'Sent', outsideHours: true, sentAt: '2026-11-24T22:30:00Z', sentThreadKey: 'ota:t-1', text: null, canEdit: false, canSkip: false, canSendNow: false, channel: 'None' }),
    ]);
    renderSection();

    expect(await (await cardOf('m-edited')).findByTestId('scheduled-message-edited')).toHaveTextContent('Modificato');
    const late = await cardOf('m-late');
    expect(late.getByTestId('scheduled-message-outside-hours')).toHaveTextContent('Inviato fuori orario');
    expect(late.queryByTestId('scheduled-message-edited')).not.toBeInTheDocument();
  });

  it('section_SentMessage_LinksToItsConversationAndOffersNoActionNorText', async () => {
    state.granted = new Set(['booking.read', 'booking.write']);
    list.mockResolvedValue([
      msg({ status: 'Sent', sentAt: '2026-11-24T07:01:00Z', sentThreadKey: 'ota:thread-9', text: null, canEdit: false, canSkip: false, canSendNow: false, channel: 'None' }),
    ]);
    renderSection();

    const card = await cardOf('m-1');
    expect(card.getByTestId('scheduled-message-status')).toHaveTextContent('Inviato');
    expect(card.getByTestId('scheduled-message-sent')).toHaveTextContent('Inviato il');
    expect(card.getByTestId('scheduled-message-sent')).toHaveTextContent('08:01');
    // The key of a conversation goes in the address escaped, as every link to a conversation does.
    expect(card.getByTestId('scheduled-message-conversation')).toHaveAttribute('href', '/app/short-rent/messages/ota%3Athread-9');
    expect(card.queryByTestId('scheduled-message-actions')).not.toBeInTheDocument();
    expect(card.queryByTestId('scheduled-message-text-block')).not.toBeInTheDocument();
    // A message that is over has no channel: that is not «no way to the guest».
    expect(card.queryByTestId('scheduled-message-channel')).not.toBeInTheDocument();
  });

  it.each([
    ['person', 'Saltato da una persona del team.', null],
    ['check_in_completed', "L'ospite ha già completato il check-in online", 'Saltato da CasaZen.'],
    ['campaign_needs_consent', "L'ospite non ha dato il consenso", 'Saltato da CasaZen.'],
    ['a-code-of-a-later-server', "CasaZen non l'ha inviato.", 'Saltato da CasaZen.'],
  ])('section_SkippedMessage_%s_SaysWhoSkippedItAndWhy', async (skipReason, sentence, bySystem) => {
    list.mockResolvedValue([msg({ status: 'Skipped', skipReason, text: null, canEdit: false, canSkip: false, canSendNow: false, channel: 'None' })]);
    renderSection();

    const ended = (await cardOf('m-1')).getByTestId('scheduled-message-ended');
    expect(ended).toHaveTextContent(sentence);
    if (bySystem) expect(ended).toHaveTextContent(bySystem);
    else expect(ended).not.toHaveTextContent('CasaZen');
  });

  it.each([
    ['Cancelled', 'booking_cancelled', 'La prenotazione è stata annullata', 'Annullato'],
    ['Expired', 'missed', "L'orario previsto è passato da troppo tempo", 'Scaduto'],
  ] as const)('section_%sMessage_SaysItWillNeverGoOutAndWhy', async (status, skipReason, sentence, word) => {
    list.mockResolvedValue([msg({ status, skipReason, text: null, canEdit: false, canSkip: false, canSendNow: false, channel: 'None' })]);
    renderSection();

    const card = await cardOf('m-1');
    expect(card.getByTestId('scheduled-message-status')).toHaveTextContent(word);
    expect(card.getByTestId('scheduled-message-ended')).toHaveTextContent(sentence);
  });

  // The message did go out: a skip that landed while the send was under way leaves the time of the send beside the state, and the screen never says that the guest will not get it.
  it('section_SkippedMessageThatHadAlreadyGoneOut_SaysTheGuestGotIt', async () => {
    list.mockResolvedValue([msg({ status: 'Skipped', skipReason: 'person', sentAt: '2026-11-24T07:00:30Z', text: null, canEdit: false, canSkip: false, canSendNow: false, channel: 'None' })]);
    renderSection();

    expect((await cardOf('m-1')).getByTestId('scheduled-message-ended')).toHaveTextContent("l'ospite l'ha ricevuto lo stesso");
  });

  // UX-09: a message that did not go out is never told as sent.
  it.each([
    ['manual_verify', 'Non sappiamo se il messaggio è arrivato'],
    ['message_unconfirmed', 'non lo consideriamo inviato'],
    ['chat_not_licensed', 'la chat del portale non è ancora attiva'],
    ['octorate_unavailable', 'il canale non risponde'],
    ['a-code-of-a-later-server', 'Non è partito'],
  ])('section_FailedMessage_%s_IsToldAsNotSentWithItsReason', async (code, sentence) => {
    list.mockResolvedValue([msg({ status: 'Failed', blockedReason: code })]);
    renderSection();

    const card = await cardOf('m-1');
    expect(card.getByTestId('scheduled-message-status')).toHaveTextContent('Invio non riuscito');
    expect(card.getByTestId('scheduled-message-failure')).toHaveTextContent(sentence);
    expect(card.getByTestId('scheduled-message-failure').textContent).not.toMatch(/octorate/i);
    expect(card.queryByTestId('scheduled-message-sent')).not.toBeInTheDocument();
  });

  it('section_BlockedMessage_SaysWhatIsMissingInPlainWordsAndWhereToCompleteIt', async () => {
    state.granted = new Set(['booking.read', 'booking.write', 'property.read']);
    list.mockResolvedValue([msg({ status: 'Blocked', blockedReason: 'id_not_verified', missingVariables: ['access_code', 'check_in_time'], text: 'Codice: [access_code]' })]);
    renderSection();

    const card = await cardOf('m-1');
    expect(card.getByTestId('scheduled-message-status')).toHaveTextContent('Bloccato');
    const missing = card.getByTestId('scheduled-message-missing');
    expect(missing).toHaveTextContent('Manca:');
    expect(missing).toHaveTextContent("il codice d'accesso dell'immobile");
    expect(missing).toHaveTextContent("l'orario di arrivo dell'immobile");
    expect(missing).toHaveTextContent("la verifica dell'identità dell'ospite");
    // The data of the property are completed on the page of the property; the identity of the guest in Documenti, the tab of the booking where the check-in is followed.
    const property = card.getAllByTestId('scheduled-message-fix-property');
    expect(property).toHaveLength(2);
    for (const link of property) expect(link).toHaveAttribute('href', `/app/short-rent/properties/${PROPERTY_ID}`);
    expect(card.getByTestId('scheduled-message-fix-guest')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING_ID}?tab=guest`);
  });

  // PERMISSION: a link never leads to a page that answers «nessun accesso»: without the permission of the page there is the sentence and no link.
  it('section_BlockedMessage_WithoutThePermissionOfThePropertyPage_HasTheSentenceAndNoLinkToIt', async () => {
    state.granted = new Set(['booking.read']);
    list.mockResolvedValue([msg({ status: 'Blocked', blockedReason: 'variable_missing:property_address', missingVariables: ['property_address'] })]);
    renderSection();

    const card = await cardOf('m-1');
    expect(card.getByTestId('scheduled-message-missing')).toHaveTextContent("l'indirizzo dell'immobile");
    expect(card.queryByTestId('scheduled-message-fix-property')).not.toBeInTheDocument();
  });

  // PRIVACY: a preview issues no link and releases no code, so the text never carries either; what the host reads names them in words.
  it('section_Text_ShowsTheLinkAndTheCodeAsSentencesNeverAsCodesOrBrackets', async () => {
    list.mockResolvedValue([msg({ text: 'Ciao Mario!\nLink: [check_in_link]\nCodice: [access_code]\nRecensione: [review_link]' })]);
    renderSection();

    const block = await screen.findByTestId('scheduled-message-text-block');
    expect(block).toHaveTextContent('Ciao Mario!');
    expect(block).toHaveTextContent('il link del check-in verrà creato quando il messaggio parte');
    expect(block).toHaveTextContent("il codice d'accesso verrà aggiunto quando il messaggio parte");
    expect(block).toHaveTextContent('il link per la recensione verrà aggiunto quando il messaggio parte');
    expect(block.textContent).not.toMatch(/check_in_link|access_code|review_link/);
    expect(block.querySelectorAll('[data-placeholder]')).toHaveLength(3);
  });

  it('section_OpenMessageWhoseTemplateIsGone_SaysTheTextIsNotAvailable', async () => {
    list.mockResolvedValue([msg({ status: 'Blocked', blockedReason: 'template_missing', text: null })]);
    renderSection();

    expect(await screen.findByTestId('scheduled-message-no-text')).toHaveTextContent('il modello del messaggio non c\'è più');
  });
});

describe('nothing scheduled', () => {
  it('empty_SaysNothingIsSentUntilARoutineIsActivated_WithTheLinkToTheRoutinesForWhoMayOpenThem', async () => {
    state.granted = new Set(['booking.read', 'property.write']);
    list.mockResolvedValue([]);
    renderSection({ flags: { routines: true } });

    const empty = await screen.findByTestId('scheduled-messages-empty');
    expect(empty).toHaveTextContent("Non c'è niente di programmato per questa prenotazione. I messaggi partono da soli solo dopo che attivi una routine che li contiene.");
    expect(within(empty).getByTestId('scheduled-messages-routines-link')).toHaveAttribute('href', '/app/short-rent/automations');
    expect(screen.queryByTestId('scheduled-messages-list')).not.toBeInTheDocument();
  });

  it.each([
    ['the routines are closed (flag off)', ['booking.read', 'property.write'], false],
    ['the person cannot change the properties', ['booking.read'], true],
  ])('empty_WhenOnly_%s_TheSentenceStandsAloneWithNoLink', async (_why, permissions, routines) => {
    state.granted = new Set(permissions);
    list.mockResolvedValue([]);
    renderSection({ flags: { routines } });

    const empty = await screen.findByTestId('scheduled-messages-empty');
    expect(empty).toHaveTextContent('I messaggi partono da soli solo dopo che attivi una routine che li contiene.');
    expect(screen.queryByTestId('scheduled-messages-routines-link')).not.toBeInTheDocument();
  });
});

describe('a read that fails', () => {
  // DATA: the query keeps the old data when a read fails. A failed read is an unknown state: the old list is never shown as the present one.
  it('section_ARefreshThatFails_IsAnUnknownStateAndNeverTheListThatWasThere', async () => {
    list.mockResolvedValueOnce([msg()]);
    list.mockRejectedValueOnce(new Error('boom'));
    const { client } = renderSection();
    await screen.findByTestId('scheduled-message');

    await act(async () => {
      await client.invalidateQueries({ queryKey: [SCHEDULED_MESSAGES_KEY, BOOKING_ID] });
    });

    const problem = await screen.findByTestId('scheduled-messages-error');
    expect(problem).toHaveTextContent('Non riusciamo a leggere i messaggi programmati');
    expect(screen.queryByTestId('scheduled-message')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scheduled-message-actions')).not.toBeInTheDocument();

    // The retry reads again, and the list comes back only when the read has worked.
    list.mockResolvedValueOnce([msg({ id: 'm-after' })]);
    fireEvent.click(screen.getByTestId('scheduled-messages-retry'));
    await cardOf('m-after');
    expect(screen.queryByTestId('scheduled-messages-error')).not.toBeInTheDocument();
  });

  it('section_A404_IsSaidAsNotFound_NotAsAnEmptyListNorAsAFailureToTryAgain', async () => {
    list.mockRejectedValue(axiosError(404, { code: 'booking_not_found' }));
    renderSection();

    const problem = await screen.findByTestId('scheduled-messages-error');
    expect(problem).toHaveTextContent("Questa prenotazione non c'è più o non puoi vederla");
    expect(screen.queryByTestId('scheduled-messages-retry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scheduled-messages-empty')).not.toBeInTheDocument();
  });
});

describe('what the host may do', () => {
  // PERMISSION: only a person who may write the booking, and only what the server says the message still allows.
  it('actions_WithoutThePermissionToWrite_AreNeverOffered_WhateverTheServerSays', async () => {
    list.mockResolvedValue([msg()]);
    renderSection({ canWrite: false });

    await screen.findByTestId('scheduled-message');
    expect(screen.queryByTestId('scheduled-message-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scheduled-message-skip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scheduled-message-send-now')).not.toBeInTheDocument();
  });

  it('actions_WithThePermissionToWrite_AreOnlyTheOnesTheServerAllowsForEachMessage', async () => {
    list.mockResolvedValue([
      msg({ id: 'm-all' }),
      msg({ id: 'm-edit-and-send', plannedAtUtc: '2026-11-25T07:00:00Z', canSkip: false }),
      msg({ id: 'm-none', plannedAtUtc: '2026-11-26T07:00:00Z', canEdit: false, canSkip: false, canSendNow: false }),
    ]);
    renderSection();

    const all = await cardOf('m-all');
    expect([all.queryByTestId('scheduled-message-edit'), all.queryByTestId('scheduled-message-skip'), all.queryByTestId('scheduled-message-send-now')].every(Boolean)).toBe(true);
    const some = await cardOf('m-edit-and-send');
    expect(some.getByTestId('scheduled-message-edit')).toBeInTheDocument();
    expect(some.queryByTestId('scheduled-message-skip')).not.toBeInTheDocument();
    expect(some.getByTestId('scheduled-message-send-now')).toBeInTheDocument();
    expect((await cardOf('m-none')).queryByTestId('scheduled-message-actions')).not.toBeInTheDocument();
    // Each button says which message it is about, starting with its own words (the way the date is written belongs to the locale data of the machine, so only the time is read).
    expect(all.getByTestId('scheduled-message-edit')).toHaveAccessibleName(/^Modifica il messaggio «Messaggio di arrivo» di .*08:00/);
    expect(all.getByTestId('scheduled-message-skip')).toHaveAccessibleName(/^Salta il messaggio «Messaggio di arrivo» di .*08:00/);
    expect(all.getByTestId('scheduled-message-send-now')).toHaveAccessibleName(/^Invia ora il messaggio «Messaggio di arrivo» di .*08:00/);
  });

  it('skip_Confirmation_SaysTheGuestWillNotReceiveItAndSkipsOnlyWhenConfirmed', async () => {
    list.mockResolvedValueOnce([msg()]);
    skip.mockResolvedValue(msg({ status: 'Skipped', skipReason: 'person', text: null, canEdit: false, canSkip: false, canSendNow: false, channel: 'None' }));
    list.mockResolvedValue([msg({ status: 'Skipped', skipReason: 'person', text: null, canEdit: false, canSkip: false, canSendNow: false, channel: 'None' })]);
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-skip'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Saltare questo messaggio?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirmation-consequences')).toHaveTextContent("L'ospite non riceverà questo messaggio.");
    expect(within(dialog).getByTestId('confirmation-consequences')).toHaveTextContent('Non si può tornare indietro');
    // Nothing has happened yet.
    expect(skip).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Salta il messaggio' }));

    await waitFor(() => expect(skip).toHaveBeenCalledWith('m-1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Messaggio saltato: l'ospite non lo riceverà."));
    // The list is read again, so the card shows what the server says now.
    expect((await cardOf('m-1')).getByTestId('scheduled-message-status')).toHaveTextContent('Saltato');
  });

  it('skip_Cancelled_SkipsNothing', async () => {
    list.mockResolvedValue([msg()]);
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-skip'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(skip).not.toHaveBeenCalled();
  });

  it('sendNow_Confirmation_SaysItGoesOutAtOnceAndTheGuestReceivesItNow', async () => {
    list.mockResolvedValue([msg()]);
    sendNow.mockResolvedValue(msg({ status: 'Sent', sentAt: '2026-11-24T06:10:00Z', sentThreadKey: 'ota:t-1', text: null, canEdit: false, canSkip: false, canSendNow: false, channel: 'None' }));
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-send-now'));
    const dialog = await screen.findByRole('dialog');
    const consequences = within(dialog).getByTestId('confirmation-consequences');
    expect(consequences).toHaveTextContent('Il messaggio parte subito, senza aspettare');
    expect(consequences).toHaveTextContent("L'ospite lo riceve adesso.");
    expect(sendNow).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Invia ora' }));

    await waitFor(() => expect(sendNow).toHaveBeenCalledWith('m-1'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Messaggio inviato.'));
  });

  // UX-09: an answer of the server is not a message that went out. Only «Sent» is said as sent; a message the channel did not take, or that the guest cannot be written to, is not.
  it.each([
    ['Failed', 'error'],
    ['Skipped', 'warning'],
    ['Cancelled', 'warning'],
  ] as const)('sendNow_TheAnswerIs_%s_IsNeverToldAsSent', async (status, tone) => {
    list.mockResolvedValue([msg()]);
    sendNow.mockResolvedValue(msg({ status, blockedReason: status === 'Failed' ? 'octorate_unavailable' : null, skipReason: status === 'Failed' ? null : 'contact_unavailable' }));
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-send-now'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Invia ora' }));

    await waitFor(() => expect(toast[tone]).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
    expect(String(vi.mocked(toast[tone]).mock.calls[0]?.[0])).toMatch(/non è (partito|stato inviato)/i);
  });

  it('sendNow_ABlockedMessage_ShowsWhatIsMissingBeforeAndTheRefusalWithTheItemsThatStillAreAfter', async () => {
    list.mockResolvedValue([msg({ status: 'Blocked', blockedReason: 'id_not_verified', missingVariables: [] })]);
    sendNow.mockRejectedValue(axiosError(422, { code: 'scheduled_message_blocked', missing: ['id_not_verified'] }));
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-send-now'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('scheduled-message-send-now-missing')).toHaveTextContent("la verifica dell'identità dell'ospite");

    fireEvent.click(within(dialog).getByRole('button', { name: 'Invia ora' }));

    // The dialog stays open and says what the message still waits for; nothing is told as sent.
    const problem = await within(dialog).findByTestId('scheduled-message-dialog-problem');
    expect(problem).toHaveTextContent("Non è partito: manca ancora la verifica dell'identità dell'ospite");
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([
    ['sendNow', 409, 'scheduled_message_in_progress', 'sta partendo proprio ora: riprova tra poco'],
    ['sendNow', 409, 'scheduled_message_not_sendable', 'non si può inviare'],
    ['skip', 409, 'scheduled_message_in_progress', 'sta partendo proprio ora: riprova tra poco'],
    ['skip', 409, 'scheduled_message_not_editable', 'non si può più cambiare'],
    ['skip', 404, 'scheduled_message_not_found', "non c'è più o non puoi vederlo"],
  ] as const)('%s_Answer%s_%s_IsSaidInTheDialogInWords', async (action, status, code, sentence) => {
    list.mockResolvedValue([msg()]);
    vi.mocked(action === 'skip' ? skip : sendNow).mockRejectedValue(axiosError(status, { code }));
    renderSection();

    fireEvent.click(await screen.findByTestId(action === 'skip' ? 'scheduled-message-skip' : 'scheduled-message-send-now'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: action === 'skip' ? 'Salta il messaggio' : 'Invia ora' }));

    expect(await within(dialog).findByTestId('scheduled-message-dialog-problem')).toHaveTextContent(sentence);
    expect(toast.success).not.toHaveBeenCalled();
  });

  // The buttons of a card wait for ANY write of that card: a skip on its way must not be crossed by an edit or a send. Another card is not held.
  it('card_WhileAWriteIsOnItsWay_EveryButtonOfThatCardWaitsAndTheOtherCardsDoNot', async () => {
    list.mockResolvedValue([msg({ id: 'm-a' }), msg({ id: 'm-b', plannedAtUtc: '2026-11-25T07:00:00Z' })]);
    let finish: (message: ScheduledMessage) => void = () => undefined;
    skip.mockReturnValue(new Promise<ScheduledMessage>((resolve) => (finish = resolve)));
    renderSection();

    const first = await cardOf('m-a');
    fireEvent.click(first.getByTestId('scheduled-message-skip'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salta il messaggio' }));

    await waitFor(() => expect(skip).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(first.getByTestId('scheduled-message-edit')).toBeDisabled());
    expect(first.getByTestId('scheduled-message-skip')).toBeDisabled();
    expect(first.getByTestId('scheduled-message-send-now')).toBeDisabled();
    const other = await cardOf('m-b');
    expect(other.getByTestId('scheduled-message-edit')).toBeEnabled();
    expect(other.getByTestId('scheduled-message-skip')).toBeEnabled();
    expect(other.getByTestId('scheduled-message-send-now')).toBeEnabled();

    await act(async () => finish(msg({ id: 'm-a', status: 'Skipped', skipReason: 'person', canEdit: false, canSkip: false, canSendNow: false })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('the edit of a message', () => {
  it('edit_Dialog_SaysTheChangeIsForThisBookingOnlyAndStartsFromTheTextAsItWillRead', async () => {
    list.mockResolvedValue([msg()]);
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('La modifica vale solo per questa prenotazione: la routine e le altre prenotazioni non cambiano.')).toBeInTheDocument();
    // The stand-in of the preview is the variable it stands for, so that what is saved makes the link when the message goes out.
    expect(within(dialog).getByTestId('scheduled-message-edit-text')).toHaveValue('Ciao Mario, benvenuto! Il tuo link: {{check_in_link}}');
    // The text of the routine is one click away while the message is not changed.
    expect(within(dialog).getByTestId('scheduled-message-original')).toBeInTheDocument();
    // «Usa il testo della routine» is for a message that was changed.
    expect(within(dialog).queryByTestId('scheduled-message-edit-use-routine-text')).not.toBeInTheDocument();
    // Nothing is saved until the host presses «Salva», and only a changed text can be.
    expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeDisabled();
  });

  // DATA and PRIVACY: what is saved is the text with the variables, never the brackets of the preview; the host's words are not kept in the cache of the mutations afterwards.
  it('edit_Save_SendsTheTextForThisMessageWithTheVariablesAndKeepsNothingInTheCacheOfTheMutations', async () => {
    list.mockResolvedValueOnce([msg()]);
    const saved = msg({ edited: true, text: 'Ciao Mario! Parole riservate dell\'host. Il tuo link: [check_in_link]' });
    edit.mockResolvedValue(saved);
    list.mockResolvedValue([saved]);
    const { client } = renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByTestId('scheduled-message-edit-text') as HTMLTextAreaElement;
    // The host writes with the stand-in of the preview as well as with the variable: both reach the server as the variable.
    fireEvent.change(field, { target: { value: "Ciao Mario! Parole riservate dell'host. Il tuo link: [check_in_link] {{guest_name}}" } });
    await waitFor(() => expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeEnabled());
    fireEvent.click(within(dialog).getByTestId('scheduled-message-edit-save'));

    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    expect(edit).toHaveBeenCalledWith('m-1', "Ciao Mario! Parole riservate dell'host. Il tuo link: {{check_in_link}} {{guest_name}}");
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Messaggio modificato: la modifica vale solo per questa prenotazione.');
    // The card shows the answer of the server.
    expect((await cardOf('m-1')).getByTestId('scheduled-message-edited')).toHaveTextContent('Modificato');
    // PRIVACY: no mutation that holds the host's words is left once it is over.
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('edit_AVariableButton_PutsTheVariableWhereTheCursorIs', async () => {
    list.mockResolvedValue([msg({ text: 'Ciao , benvenuto!' })]);
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByTestId('scheduled-message-edit-text') as HTMLTextAreaElement;
    field.focus();
    field.setSelectionRange(5, 5);
    fireEvent.click(within(dialog).getByTestId('scheduled-message-variable-guest_name'));

    await waitFor(() => expect(field).toHaveValue('Ciao {{guest_name}}, benvenuto!'));
    // Thirteen buttons, one for each variable of a template.
    expect(within(dialog).getByRole('group', { name: 'Inserisci un dato' }).querySelectorAll('button')).toHaveLength(13);
  });

  it('edit_ATextTheServerRefuses_IsSaidOnTheFieldTheDialogStaysOpenAndNothingIsKept', async () => {
    list.mockResolvedValue([msg()]);
    edit.mockRejectedValue(axiosError(422, { code: 'template_variable_unknown' }));
    const { client } = renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByTestId('scheduled-message-edit-text'), { target: { value: 'Ciao {{nome}}' } });
    await waitFor(() => expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeEnabled());
    fireEvent.click(within(dialog).getByTestId('scheduled-message-edit-save'));

    expect(await within(dialog).findByText(/parte tra doppie parentesi graffe che non è un dato che conosciamo/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('edit_ATextThatIsEmptyOrTooLong_CannotBeSaved', async () => {
    list.mockResolvedValue([msg()]);
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByTestId('scheduled-message-edit-text');
    fireEvent.change(field, { target: { value: '   ' } });
    expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeDisabled();
    fireEvent.change(field, { target: { value: 'a'.repeat(2001) } });
    expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeDisabled();
    expect(within(dialog).getByText('Il testo non può essere vuoto né più lungo di 2000 caratteri.')).toBeInTheDocument();
    expect(edit).not.toHaveBeenCalled();
  });

  it('edit_AMessageThatWasChanged_CanGoBackToTheTextOfTheRoutine_WithTheEditCleared', async () => {
    list.mockResolvedValueOnce([msg({ edited: true })]);
    edit.mockResolvedValue(msg());
    list.mockResolvedValue([msg()]);
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    // The text of the routine is not in the answer of the server for a message that was changed: the button that clears the change is the way to it.
    expect(within(dialog).queryByTestId('scheduled-message-original')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByTestId('scheduled-message-edit-use-routine-text'));

    await waitFor(() => expect(edit).toHaveBeenCalledWith('m-1', null));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Il messaggio torna al testo della routine.'));
    await waitFor(() => expect(screen.queryByTestId('scheduled-message-edited')).not.toBeInTheDocument());
  });
});

// DATA: the server takes OUT of the text every variable the booking has no value for (`missingVariables`: «Il check-in è dalle {{check_in_time}}.» arrives as «Il check-in è dalle.»). A text saved from it would go
// without the datum, and the message, no longer held back for it, would go out with a gap in its sentence. The dialog says which data the text lacks, highlights the button that puts each one back, and does
// not save without them until the host has said that the message may go without.
describe('the edit of a message whose booking lacks data', () => {
  const blocked = () => msg({ status: 'Blocked', blockedReason: 'variable_missing:check_in_time', missingVariables: ['check_in_time'], text: 'Il check-in è dalle.' });

  it('edit_ATextThatLacksData_SaysWhichAndIsNotSavedWithoutThemUntilTheHostAgrees', async () => {
    list.mockResolvedValue([blocked()]);
    edit.mockResolvedValue(msg({ edited: true, text: 'Il check-in è dalle. A presto!' }));
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    const notice = within(dialog).getByTestId('scheduled-message-edit-missing');
    expect(notice).toHaveTextContent("l'orario di arrivo dell'immobile");
    expect(notice).toHaveTextContent('Se salvi così, il messaggio parte senza questi dati.');
    // The datum is not in the text the server gave, and the button that puts it back is the one that stands out.
    expect(within(dialog).getByTestId('scheduled-message-edit-text')).toHaveValue('Il check-in è dalle.');
    expect(within(dialog).getByTestId('scheduled-message-variable-check_in_time')).toHaveAttribute('data-missing', 'true');
    expect(within(dialog).getByTestId('scheduled-message-variable-guest_name')).not.toHaveAttribute('data-missing');
    // The data already filled in are told to become fixed text.
    expect(within(dialog).getByTestId('scheduled-message-edit-fixed-note')).toHaveTextContent('diventano testo fisso e non seguono più la prenotazione');

    fireEvent.change(within(dialog).getByTestId('scheduled-message-edit-text'), { target: { value: 'Il check-in è dalle. A presto!' } });
    // The text is changed, and still there is no silent save: the host has to say that the message may go without the datum.
    expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeDisabled();

    fireEvent.click(within(dialog).getByTestId('scheduled-message-edit-missing-accept'));
    await waitFor(() => expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeEnabled());
    fireEvent.click(within(dialog).getByTestId('scheduled-message-edit-save'));

    await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
    expect(edit).toHaveBeenCalledWith('m-1', 'Il check-in è dalle. A presto!');
  });

  it('edit_TheHostPutsTheMissingVariableBack_NeedsNoAgreement_AndSavesTheVariable', async () => {
    list.mockResolvedValue([blocked()]);
    edit.mockResolvedValue(msg({ edited: true }));
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByTestId('scheduled-message-edit-text') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'Il check-in è dalle .' } });
    field.focus();
    field.setSelectionRange(20, 20);
    fireEvent.click(within(dialog).getByTestId('scheduled-message-variable-check_in_time'));

    await waitFor(() => expect(field).toHaveValue('Il check-in è dalle {{check_in_time}}.'));
    // The datum is back in the text: nothing is left to agree to, the notice goes and the text can be saved.
    expect(within(dialog).queryByTestId('scheduled-message-edit-missing')).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('scheduled-message-variable-check_in_time')).not.toHaveAttribute('data-missing');
    await waitFor(() => expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeEnabled());
    fireEvent.click(within(dialog).getByTestId('scheduled-message-edit-save'));

    await waitFor(() => expect(edit).toHaveBeenCalledWith('m-1', 'Il check-in è dalle {{check_in_time}}.'));
  });

  it('edit_AVariableTypedByHand_CountsAsPutBack_WhateverTheSpacesAndTheCapitals', async () => {
    list.mockResolvedValue([blocked()]);
    renderSection();

    fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('scheduled-message-edit-missing')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByTestId('scheduled-message-edit-text'), { target: { value: 'Il check-in è dalle {{ Check_In_Time }}.' } });

    await waitFor(() => expect(within(dialog).queryByTestId('scheduled-message-edit-missing')).not.toBeInTheDocument());
    await waitFor(() => expect(within(dialog).getByTestId('scheduled-message-edit-save')).toBeEnabled());
  });

  it('edit_AMessageThatLacksNothingOrOnlyACodeThatIsNotAVariable_ShowsNoNoticeButTellsTheDataBecomeFixedText', async () => {
    list.mockResolvedValue([
      msg({ id: 'm-complete' }),
      msg({ id: 'm-no-template', plannedAtUtc: '2026-11-25T07:00:00Z', status: 'Blocked', blockedReason: 'template_missing', missingVariables: ['template_missing'], text: null }),
    ]);
    renderSection();

    for (const id of ['m-complete', 'm-no-template']) {
      fireEvent.click((await cardOf(id)).getByTestId('scheduled-message-edit'));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).queryByTestId('scheduled-message-edit-missing')).not.toBeInTheDocument();
      expect(within(dialog).getByTestId('scheduled-message-edit-fixed-note')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
  });

  it('edit_TheNoticeAndTheNoteAboutFixedText_AreWrittenInEnglishToo', async () => {
    await i18n.changeLanguage('en');
    try {
      list.mockResolvedValue([blocked()]);
      renderSection();

      fireEvent.click(await screen.findByTestId('scheduled-message-edit'));
      const dialog = await screen.findByRole('dialog');
      const notice = within(dialog).getByTestId('scheduled-message-edit-missing');
      expect(notice).toHaveTextContent('The text below lacks these details');
      expect(notice).toHaveTextContent('the check-in time of the property');
      expect(notice).toHaveTextContent('If you save it like this, the message goes out without these details.');
      expect(within(dialog).getByTestId('scheduled-message-edit-fixed-note')).toHaveTextContent('become fixed text and no longer follow the booking');
    } finally {
      await i18n.changeLanguage('it');
    }
  });
});
