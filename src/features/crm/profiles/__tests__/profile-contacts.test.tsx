import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AxiosError, type AxiosResponse } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { CrmApi } from '@/api/crm.api';
import type { CrmContact } from '@/types/crm.types';
import { ProfileContacts } from '../profile-contacts';

vi.mock('@/api/crm.api', () => ({
  CrmApi: { sendConfirmation: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const PROFILE = '0b8f5d6e-1111-4a22-8333-aaaaaaaaaaa1';
const GUEST = '3c1d7e9a-5555-4666-8777-bbbbbbbbbbb1';

function contact(overrides: Partial<CrmContact> = {}): CrmContact {
  return {
    id: 'c-email',
    channel: 'Email',
    origin: 'CheckIn',
    confirmation: 'Unconfirmed',
    legalBasis: 'Consent',
    basisVersion: '2026-10',
    basisRecordedAt: '2026-10-12T09:30:00Z',
    isSuppressed: false,
    isOtaForward: false,
    value: 'mario.rossi@example.it',
    marketable: false,
    reachabilityReason: 'not_confirmed',
    ...overrides,
  };
}

function problem(status: number, code: string): AxiosError {
  const response = { status, statusText: String(status), data: { code }, headers: {}, config: {} } as unknown as AxiosResponse;
  return new AxiosError(code, String(status), undefined, undefined, response);
}

function renderContacts(contacts: CrmContact[], options: { canWrite?: boolean; primaryGuestId?: string | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProfileContacts
            profileId={PROFILE}
            contacts={contacts}
            primaryGuestId={options.primaryGuestId === undefined ? GUEST : options.primaryGuestId}
            canWrite={options.canWrite ?? true}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const sendButton = () => screen.queryByTestId('crm-contact-send-confirmation');

describe('ProfileContacts: the contacts of a profile (E07/F01/US04/T02, NF-89)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(CrmApi.sendConfirmation).mockResolvedValue({ sent: true });
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('ProfileContacts_AContact_ShowsChannelValueOriginBasisWithVersionAndDateAndConfirmation', () => {
    renderContacts([contact({ confirmation: 'Pending' })]);

    const item = within(screen.getByTestId('crm-contact'));
    expect(item.getByText('mario.rossi@example.it')).toBeInTheDocument();
    expect(item.getByText('E-mail')).toBeInTheDocument();
    expect(item.getByText('Check-in online')).toBeInTheDocument();
    expect(item.getByText(/Consenso · testo versione 2026-10, registrato il 12 ott 2026/)).toBeInTheDocument();
    expect(item.getByText("In attesa della risposta dell'ospite")).toBeInTheDocument();
    expect(item.getByTestId('crm-contact-reachability')).toHaveTextContent(i18n.t('crm.contacts.reachability.notConfirmed'));
  });

  it('ProfileContacts_AConsentNotConfirmed_OffersTheConfirmationRequestAndSendsItForThatContact', async () => {
    renderContacts([contact()]);

    fireEvent.click(sendButton()!);

    await waitFor(() => expect(CrmApi.sendConfirmation).toHaveBeenCalledWith('c-email'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(i18n.t('crm.contacts.confirmationSent')));
  });

  it('ProfileContacts_ARequestSentFewMinutesAgo_SaysSoAndSendsNothingMore', async () => {
    vi.mocked(CrmApi.sendConfirmation).mockResolvedValue({ sent: false });
    renderContacts([contact({ confirmation: 'Pending' })]);

    fireEvent.click(sendButton()!);

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(i18n.t('crm.contacts.confirmationTooSoon')));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([
    ['a confirmed consent', contact({ confirmation: 'Confirmed', marketable: true, reachabilityReason: null })],
    ['a soft opt-in', contact({ legalBasis: 'SoftOptIn', origin: 'DirectBooking', marketable: true, reachabilityReason: null })],
    ['a service-only address', contact({ legalBasis: 'ServiceOnly', origin: 'Manual', reachabilityReason: 'no_basis' })],
    ['a phone number with a consent', contact({ id: 'c-phone', channel: 'Phone', value: '+39 333 1234567', reachabilityReason: 'channel_not_available' })],
    ['a WhatsApp number with a consent', contact({ id: 'c-wa', channel: 'WhatsApp', value: '+39 333 1234567', reachabilityReason: 'channel_not_available' })],
  ])('ProfileContacts_%s_HasNothingToConfirm', (_name, item) => {
    renderContacts([item]);

    expect(sendButton()).not.toBeInTheDocument();
  });

  it('ProfileContacts_AForwardAddressOfAChannel_IsServiceOnlyAndHasNoConfirmationButton', () => {
    renderContacts([
      contact({ origin: 'OtaForward', legalBasis: 'ServiceOnly', isOtaForward: true, value: 'abc123@guest.airbnb.com', reachabilityReason: 'ota_forward' }),
    ]);

    expect(screen.getByTestId('crm-contact-ota-note')).toHaveTextContent('solo messaggi di servizio');
    expect(screen.getByTestId('crm-contact-reachability')).toHaveTextContent(i18n.t('crm.contacts.reachability.otaForward'));
    expect(screen.getByTestId('contact-state-badge')).toHaveAttribute('data-state', 'serviceOnly');
    expect(sendButton()).not.toBeInTheDocument();
  });

  it('ProfileContacts_AGuestWhoOptedOut_CannotBeAskedAndSaysWhy', () => {
    renderContacts([contact({ isSuppressed: true, reachabilityReason: 'suppressed' })]);

    expect(sendButton()).toBeDisabled();
    expect(screen.getByTestId('crm-contact-confirmation-blocked')).toHaveTextContent(i18n.t('crm.contacts.confirmationSuppressed'));
    expect(screen.getByTestId('contact-state-badge')).toHaveAttribute('data-state', 'unsubscribed');
    fireEvent.click(sendButton()!);
    expect(CrmApi.sendConfirmation).not.toHaveBeenCalled();
  });

  it('ProfileContacts_TheServerSaysTheLimitIsReached_TheButtonWaitsAndSaysWhy', async () => {
    vi.mocked(CrmApi.sendConfirmation).mockRejectedValue(problem(409, 'crm_confirmation_limit_reached'));
    renderContacts([contact({ confirmation: 'Pending' })]);

    fireEvent.click(sendButton()!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.crmConfirmationLimitReached')));
    await waitFor(() => expect(sendButton()).toBeDisabled());
    expect(screen.getByTestId('crm-contact-confirmation-blocked')).toHaveTextContent(i18n.t('crm.contacts.confirmationLimit'));
  });

  it.each([
    ['crm_contact_suppressed', 'apiErrors.codes.crmContactSuppressed'],
    ['crm_confirmation_not_required', 'apiErrors.codes.crmConfirmationNotRequired'],
  ])('ProfileContacts_TheServerRefusesWith_%s_ItIsToldInPlainWords', async (code, key) => {
    vi.mocked(CrmApi.sendConfirmation).mockRejectedValue(problem(code === 'crm_contact_suppressed' ? 409 : 422, code));
    renderContacts([contact()]);

    fireEvent.click(sendButton()!);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t(key)));
  });

  it('ProfileContacts_ACallerWhoCannotWrite_SeesTheContactsButNoButton', () => {
    renderContacts([contact()], { canWrite: false });

    expect(screen.getByTestId('crm-contact')).toBeInTheDocument();
    expect(sendButton()).not.toBeInTheDocument();
  });

  it.each([
    ['suppressed', 'crm.contacts.reachability.suppressed'],
    ['ota_forward', 'crm.contacts.reachability.otaForward'],
    ['not_confirmed', 'crm.contacts.reachability.notConfirmed'],
    ['no_basis', 'crm.contacts.reachability.noBasis'],
    ['channel_not_available', 'crm.contacts.reachability.channelNotAvailable'],
  ] as const)('ProfileContacts_ReasonOf_%s_IsOneSentence', (reason, key) => {
    renderContacts([contact({ reachabilityReason: reason, legalBasis: 'ServiceOnly' })]);

    expect(screen.getByTestId('crm-contact-reachability')).toHaveTextContent(i18n.t(key));
  });

  it('ProfileContacts_AMarketableContact_SaysYouCanWriteToIt', () => {
    renderContacts([contact({ confirmation: 'Confirmed', marketable: true, reachabilityReason: null })]);

    expect(screen.getByTestId('crm-contact-reachability')).toHaveTextContent(i18n.t('crm.contacts.reachability.marketable'));
    expect(screen.getByTestId('contact-state-badge')).toHaveAttribute('data-state', 'consent');
  });

  it('ProfileContacts_Withdrawals_StayInThePrivacyTabOfTheGuestAndAreNeverHere', () => {
    renderContacts([contact()]);

    const link = within(screen.getByTestId('crm-contacts-withdrawals')).getByRole('link', { name: i18n.t('crm.contacts.withdrawalsLink') });
    expect(link).toHaveAttribute('href', `/app/short-rent/guests/${GUEST}?tab=privacy`);
    // No control of this section withdraws a consent.
    expect(screen.queryByRole('button', { name: /revoca|ritira|withdraw|opt.?out/i })).not.toBeInTheDocument();
  });

  it('ProfileContacts_ALeadWithNoGuestRecord_HasTheNoteButNoLink', () => {
    renderContacts([contact()], { primaryGuestId: null });

    expect(screen.getByTestId('crm-contacts-withdrawals')).toHaveTextContent(i18n.t('crm.contacts.withdrawals'));
    expect(within(screen.getByTestId('crm-contacts-withdrawals')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('ProfileContacts_NoContact_SaysSo', () => {
    renderContacts([]);

    expect(screen.getByTestId('crm-contacts-empty')).toHaveTextContent(i18n.t('crm.contacts.empty'));
  });
});
