import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n/config';
import { bookingsApi } from '@/api/bookings.api';
import { checkinLinkApi } from '@/api/checkin-link.api';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { copyTextToClipboard } from '@/lib/utils';
import type { CheckInLinkDelivery } from '@/types/checkin-link.types';
import type { CheckInSessionStatusDto } from '@/types/public-checkin.types';
import { CheckInLinkPanel } from '../components/checkin-link-panel';

vi.mock('@/api/bookings.api', () => ({
  bookingsApi: { getCheckInSession: vi.fn(), resendCheckInLink: vi.fn(), createCheckInLink: vi.fn() },
}));
vi.mock('@/api/checkin-link.api', () => ({ checkinLinkApi: { getDelivery: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils')>()),
  copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
/** The link to the page of the guest: a secret, so the test looks for it in everything the panel draws. */
const LINK = 'https://casazen.test/checkin/secret-token-123';

/** A portal guest with no e-mail address: the daily job found no recipient. */
const NO_RECIPIENT: CheckInSessionStatusDto = {
  sessionId: 's1',
  status: 'Inviato',
  issuedAt: '2026-11-14T08:00:00Z',
  expiresAt: '2099-11-21T08:00:00Z',
  sentAt: null,
  completedAt: null,
  emailStatus: 'Failed',
  emailError: 'no_recipient',
  canIssueLink: true,
};

function delivery(overrides: Partial<CheckInLinkDelivery> = {}): CheckInLinkDelivery {
  return { channel: 'PortalChat', state: 'WaitingChatPermission', attempts: 1, lastErrorCode: 'chat_not_licensed', ended: false, checkInLink: LINK, ...overrides };
}

function renderPanel({ canWrite = true, flags = {} as Partial<FeatureFlags> } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const value = { flags: { ...DEFAULT_FEATURE_FLAGS, portalChatCheckInLink: true, ...flags }, isLoading: false };
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(FeatureFlagsContext.Provider, { value }, createElement(CheckInLinkPanel, { bookingId: BOOKING_ID, canWrite })),
    ),
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

/** What a person reads in the panel: its text and the values of its fields, where a link would show. */
function everythingShown(container: HTMLElement): string {
  const fields = [...container.querySelectorAll('input')].map((input) => input.value).join(' ');
  return `${container.textContent ?? ''} ${fields}`;
}

/**
 * The read of the delivery has been answered and the page has drawn the answer: what is not on the page now is not coming. Waits for the answer itself, never for a window of time,
 * so that a line that must be absent is absent because of the rule, and not because the answer had not come yet.
 */
async function deliveryDrawn() {
  await waitFor(() => expect(checkinLinkApi.getDelivery).toHaveBeenCalled());
  await act(async () => {
    await vi.mocked(checkinLinkApi.getDelivery).mock.results[0]?.value;
  });
  await act(async () => {});
}

describe('CheckInLinkPanel: where the check-in link of a portal booking stands (E23/F01/US02, NF-122)', () => {
  // PERMISSION: the link is a secret that opens the page of the guest. The server gives it only to who can already copy a link (`booking.write`); the panel never draws it
  // for anyone else, whatever the answer holds.
  it('panel_WithoutTheCopyPermission_ShowsWhyTheLinkWaitsAndNeverTheLinkNorTheButton', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery());
    const { container } = renderPanel({ canWrite: false });

    expect(await screen.findByTestId('checkin-delivery-state')).toHaveTextContent('In attesa: la chat del portale non è ancora attiva');
    expect(screen.queryByTestId('checkin-delivery-copy')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copia link/i })).not.toBeInTheDocument();
    expect(everythingShown(container)).not.toContain('secret-token-123');
    expect(copyTextToClipboard).not.toHaveBeenCalled();
  });

  it('panel_WithTheCopyPermission_CopiesTheLinkOfTheDeliveryAndNeverPrintsIt', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery());
    const { container } = renderPanel({ canWrite: true });

    const copy = await screen.findByTestId('checkin-delivery-copy');
    expect(copy).toHaveTextContent('Copia link');
    await waitFor(() => expect(copy).toBeEnabled());
    fireEvent.click(copy);

    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(LINK));
    expect(everythingShown(container)).not.toContain('secret-token-123');
    // Copying makes no new link: the one the guest may already hold keeps working.
    expect(bookingsApi.createCheckInLink).not.toHaveBeenCalled();
    expect(bookingsApi.resendCheckInLink).not.toHaveBeenCalled();
  });

  it('panel_ServerGivesNoLink_OffersNothingToCopyEvenToWhoMayCopy', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ checkInLink: null }));
    renderPanel({ canWrite: true });

    expect(await screen.findByTestId('checkin-delivery-state')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-delivery-copy')).not.toBeInTheDocument();
  });

  it.each([
    ['PortalChat', 'Sent', null, 'Inviato nella chat del portale'],
    ['PortalChat', 'Sending', null, 'Invio in corso nella chat del portale'],
    ['PortalChat', 'WaitingChatPermission', 'chat_not_licensed', 'In attesa: la chat del portale non è ancora attiva'],
    ['PortalChat', 'WaitingThread', 'no_conversation', 'In attesa che il portale apra la conversazione'],
    ['Email', 'WaitingStaticIps', 'octorate_sensitive_data_not_allowed', 'In attesa degli indirizzi IP'],
    ['Manual', 'WaitingContact', null, "In attesa: non c'è un modo automatico per raggiungere l'ospite"],
    ['PortalChat', 'Failed', 'octorate_message_error', "Il link non è arrivato all'ospite"],
  ] as const)('panel_%s_%s_SaysWhereTheLinkStands', async (channel, state, lastErrorCode, expected) => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ channel, state, lastErrorCode, checkInLink: state === 'Sent' || state === 'Sending' ? null : LINK }));
    renderPanel();

    expect(await screen.findByTestId('checkin-delivery-state')).toHaveTextContent(expected);
    // The line of the e-mail that was never sent says nothing for a link that goes another way.
    expect(screen.queryByTestId('checkin-link-email')).not.toBeInTheDocument();
  });

  it('panel_EmailSent_SaysSentByEmailAndKeepsTheLineOfTheEmail', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue({ ...NO_RECIPIENT, emailStatus: 'Sent', emailError: null, sentAt: '2026-11-14T08:00:00Z' });
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ channel: 'Email', state: 'Sent', lastErrorCode: null, checkInLink: null }));
    renderPanel();

    expect(await screen.findByTestId('checkin-delivery-state')).toHaveTextContent('Inviato per email');
    expect(screen.getByTestId('checkin-link-email')).toBeInTheDocument();
  });

  // The delivery only handed the e-mail to the queue: what the session says of the e-mail is the truth, and nothing contradicts it with «Inviato per email».
  it.each([
    ['Failed', 'Email non inviata'],
    ['Queued', 'Email con il link in coda di invio'],
    ['NotRequested', 'nessuna email inviata'],
  ] as const)('panel_EmailThatTheSessionSays%s_IsNeverToldAsSentByEmail', async (emailStatus, expected) => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue({ ...NO_RECIPIENT, emailStatus, emailError: emailStatus === 'Failed' ? 'rejected' : null });
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ channel: 'Email', state: 'Sent', lastErrorCode: null, checkInLink: null }));
    renderPanel();

    await deliveryDrawn();
    expect(await screen.findByTestId('checkin-link-email')).toHaveTextContent(expected);
    expect(screen.queryByTestId('checkin-delivery-state')).not.toBeInTheDocument();
  });

  it('panel_MessageWithTheChannelThatHasNotLeft_IsNotToldAsSentAndOffersNoLink', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ state: 'Sending', lastErrorCode: null, checkInLink: null }));
    renderPanel();

    const line = await screen.findByTestId('checkin-delivery-state');
    expect(line).toHaveTextContent('Invio in corso');
    expect(line).not.toHaveTextContent(/inviato nella chat/i);
    expect(screen.getByTestId('checkin-delivery-hint')).toHaveTextContent('Non devi fare nulla');
    expect(screen.queryByTestId('checkin-delivery-copy')).not.toBeInTheDocument();
  });

  it('panel_FailedForANameOfTheChannelManager_SaysOnlyThatTheChatOfThePortalDidNotAcceptIt', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ state: 'Failed', lastErrorCode: 'octorate_message_error' }));
    const { container } = renderPanel();

    expect(await screen.findByTestId('checkin-delivery-hint')).toHaveTextContent('La chat del portale non ha accettato il messaggio.');
    expect(screen.getByTestId('checkin-delivery')).toHaveAttribute('role', 'alert');
    expect(everythingShown(container)).not.toMatch(/octorate/i);
  });

  it('panel_FailedForACodeNobodyKnowsYet_SaysItWithTheGenericSentenceNeverTheCode', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ state: 'Failed', lastErrorCode: 'a_code_of_a_later_server' }));
    const { container } = renderPanel();

    expect(await screen.findByTestId('checkin-delivery-hint')).toHaveTextContent('Il link non è stato inviato in automatico.');
    expect(everythingShown(container)).not.toContain('a_code_of_a_later_server');
  });

  it('panel_DeliveryThatEnded_SaysNothingAboutWhatItWaitedFor', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ ended: true, endedReason: 'host_link', checkInLink: null }));
    renderPanel();

    // The host carries the link from here (the server ended the delivery): the line of the session says what there is.
    expect(await screen.findByTestId('checkin-link-email')).toBeInTheDocument();
    await deliveryDrawn();
    expect(screen.queryByTestId('checkin-delivery-state')).not.toBeInTheDocument();
  });

  it('panel_ExpiredLink_DoesNotShowAWaitingStateForALinkNobodyCanOpen', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue({ ...NO_RECIPIENT, status: 'Scaduto' });
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ checkInLink: null }));
    renderPanel();

    expect(await screen.findByText(/Il link è scaduto/)).toBeInTheDocument();
    await deliveryDrawn();
    expect(screen.queryByTestId('checkin-delivery-state')).not.toBeInTheDocument();
  });

  it('panel_DeliveryThatCannotBeRead_SaysSoAndOffersToTryAgainNeverNothing', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockRejectedValue(new Error('boom'));
    renderPanel();

    expect(await screen.findByTestId('checkin-delivery-error')).toHaveTextContent("Non riesco a leggere come sta andando l'invio del link.");
    expect(screen.queryByTestId('checkin-delivery-state')).not.toBeInTheDocument();
  });

  // With both flags off nothing changes: nothing is asked and the panel is what it was.
  it('panel_FlagsOff_AsksNothingAndShowsNothingOfTheDelivery', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery());
    renderPanel({ flags: { portalChatCheckInLink: false, guestContactInfo: false } });

    expect(await screen.findByTestId('checkin-link-email')).toHaveTextContent('Email non inviata');
    expect(checkinLinkApi.getDelivery).not.toHaveBeenCalled();
    expect(screen.queryByTestId('checkin-delivery')).not.toBeInTheDocument();
  });

  it('panel_OnlyTheFlagOfTheContactOfTheGuest_StillReadsTheDelivery', async () => {
    vi.mocked(bookingsApi.getCheckInSession).mockResolvedValue(NO_RECIPIENT);
    vi.mocked(checkinLinkApi.getDelivery).mockResolvedValue(delivery({ channel: 'Email', state: 'WaitingStaticIps', lastErrorCode: 'octorate_sensitive_data_not_allowed' }));
    renderPanel({ flags: { portalChatCheckInLink: false, guestContactInfo: true } });

    expect(await screen.findByTestId('checkin-delivery-state')).toHaveTextContent('In attesa degli indirizzi IP');
  });

  it('panel_EveryTextOfTheDelivery_ExistsInBothLanguagesWithoutTheNameOfTheChannelManager', async () => {
    const keys = [
      'sent', 'sentEmail', 'sentOn', 'sentPortalChat', 'sending', 'sendingHint', 'failed', 'carryIt', 'loadError',
      'waitingChatPermission', 'waitingChatPermissionHint', 'waitingThread', 'waitingThreadHint', 'waitingContact', 'waitingContactHint', 'waitingStaticIps', 'waitingStaticIpsHint',
      'reason.chatNotLicensed', 'reason.manualVerify', 'reason.mappingNotConfirmed', 'reason.messageRefused', 'reason.noConversation', 'reason.notConnected',
      'reason.rateLimited', 'reason.threadClosed', 'reason.unavailable', 'reason.unknown',
    ].map((key) => `checkin.link.delivery.${key}`);
    for (const language of ['it', 'en']) {
      const t = i18n.getFixedT(language);
      for (const key of keys) {
        const text = t(key, { date: '12/11/2026' });
        expect(text, `${language} ${key}`).not.toBe(key);
        expect(text, `${language} ${key}`).not.toMatch(/octorate/i);
      }
    }
  });
});
