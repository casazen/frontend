import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { addDays, todayInRome } from '@/lib/stay-dates';
import { OwnerPortalShell } from '@/features/owner-portal/owner-portal-shell';
import { OwnerCalendar } from '@/pages/owner-portal/OwnerCalendar';
import { OwnerContacts } from '@/pages/owner-portal/OwnerContacts';
import { OwnerConversation } from '@/pages/owner-portal/OwnerConversation';
import { OwnerInbox } from '@/pages/owner-portal/OwnerInbox';

vi.mock('@/api/ownerPortal.api', () => ({
  ownerPortalApi: {
    getProperties: vi.fn(),
    getCalendar: vi.fn(),
    listStays: vi.fn(),
    getStayRule: vi.fn(),
    requestStay: vi.fn(),
    cancelStay: vi.fn(),
    listDocuments: vi.fn(),
    listContacts: vi.fn(),
    inviteContact: vi.fn(),
    setContactPermissions: vi.fn(),
    revokeContact: vi.fn(),
    listConversations: vi.fn(),
    listMessages: vi.fn(),
    postMessage: vi.fn(),
    startConversation: vi.fn(),
    getInboxPreferences: vi.fn(),
    setInboxPreferences: vi.fn(),
  },
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import { ownerPortalApi } from '@/api/ownerPortal.api';

const api = vi.mocked(ownerPortalApi);

/** A refusal as the API client raises it: the status and a ProblemDetails body, and the request that was sent (as axios keeps it). */
function refusal(status: number, code: string, sent?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), data: sent === undefined ? undefined : JSON.stringify(sent) };
  return new AxiosError('refused', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

const RULE = {
  rule: { propertyId: 'p1', minAdvanceDays: 14, maxAdvanceDays: 365, minNights: 2, maxNights: 21, yearlyNightAllowance: 30, approvalRequired: true, blackouts: [] },
  year: 2026,
  nightsUsed: 4,
  nightsRemaining: 26,
};

function stay(state: string, id = `s-${state}`) {
  return {
    id,
    orgId: 'o1',
    propertyId: 'p1',
    propertyName: 'Casa Mare',
    propertyOwnerId: 'po1',
    startDate: addDays(todayInRome(), 40),
    endDate: addDays(todayInRome(), 44),
    nights: 4,
    status: state === 'requested' ? 'Requested' : state === 'rejected' ? 'Rejected' : state === 'cancelled' ? 'Cancelled' : 'Approved',
    state,
    syncState: state === 'confirmed' ? 'Acknowledged' : state === 'sync_failed' ? 'Failed' : 'Pending',
    releaseSyncState: 'None',
    requestedAt: '2026-11-10T10:00:00Z',
    requestedByContact: false,
  };
}

function contact(permissions: string[], status = 'active') {
  return {
    id: 'c1',
    orgId: 'o1',
    propertyOwnerId: 'po1',
    email: 'anna.verdi@example.com',
    firstName: 'Anna',
    lastName: 'Verdi',
    permissions,
    status,
    createdAt: '2026-11-01T10:00:00Z',
    invitationExpiresAt: '2026-11-08T10:00:00Z',
  };
}

function renderPortal(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portale-proprietari" element={<OwnerPortalShell />}>
            <Route path="calendario/:propertyId?" element={<OwnerCalendar />} />
            <Route path="messaggi" element={<OwnerInbox />} />
            <Route path="messaggi/:conversationId" element={<OwnerConversation />} />
            <Route path="contatti" element={<OwnerContacts />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.getProperties.mockResolvedValue([{ propertyId: 'p1', propertyName: 'Casa Mare', address: 'Via del Mare 1', totalBookings: 0, totalRevenue: 0, occupancyRate: 0, recentBookings: [] }]);
  api.listStays.mockResolvedValue([]);
  api.getCalendar.mockResolvedValue({ propertyId: 'p1', from: todayInRome(), to: addDays(todayInRome(), 90), ranges: [] });
  api.getStayRule.mockResolvedValue(RULE as never);
  api.listDocuments.mockResolvedValue({ documents: [], statements: [] });
  api.listContacts.mockResolvedValue([]);
  api.listConversations.mockResolvedValue([]);
  api.listMessages.mockResolvedValue([]);
  api.getInboxPreferences.mockResolvedValue({ emailNotifications: true });
});

afterEach(() => {
  cleanup();
});

describe('the owner stays: a request is never a confirmed stay (NF-111, AC-NF111-2)', () => {
  async function fillAndSend() {
    const form = await screen.findByTestId('owner-stay-form');
    fireEvent.change(within(form).getByTestId('owner-stay-start'), { target: { value: addDays(todayInRome(), 40) } });
    fireEvent.change(within(form).getByTestId('owner-stay-end'), { target: { value: addDays(todayInRome(), 44) } });
    fireEvent.click(within(form).getByTestId('owner-stay-submit'));
  }

  it('OwnerStay_ARequestThatWasSent_SaysItBlocksNothingYet_AndNeverCallsItConfirmed', async () => {
    api.requestStay.mockResolvedValue(stay('requested') as never);
    renderPortal('/portale-proprietari/calendario/p1');
    await fillAndSend();

    const sent = await screen.findByTestId('owner-stay-sent');
    expect(sent.textContent).toContain('Richiesta inviata');
    expect(sent.textContent).toContain('Non è ancora un soggiorno confermato');
    expect(sent.textContent).not.toMatch(/Confermato/);
    expect(api.requestStay).toHaveBeenCalledTimes(1);
    expect(api.requestStay).toHaveBeenCalledWith({ propertyId: 'p1', startDate: addDays(todayInRome(), 40), endDate: addDays(todayInRome(), 44) });
  });

  it('OwnerStay_ARefusalOfTheRules_SaysWhichRuleWithTheNumbersOfTheRuleTheOwnerReadAbove', async () => {
    api.requestStay.mockRejectedValue(refusal(422, 'owner_stay_notice_too_short'));
    renderPortal('/portale-proprietari/calendario/p1');
    await fillAndSend();
    expect((await screen.findByTestId('owner-stay-refused')).textContent).toContain('almeno 14 giorni di preavviso');
    cleanup();

    api.requestStay.mockRejectedValue(refusal(409, 'owner_stay_dates_unavailable'));
    renderPortal('/portale-proprietari/calendario/p1');
    await fillAndSend();
    expect((await screen.findByTestId('owner-stay-refused')).textContent).toContain('non sono più libere');
    // The rule is shown before the form, in words.
    expect(screen.getByTestId('owner-stay-rule').textContent).toContain('Almeno 14 giorni di preavviso');
    expect(screen.getByTestId('owner-stay-rule').textContent).toContain('ne restano 26');
  });

  it('OwnerStay_EveryStateIsToldInItsOwnWords_AndOnlyAConfirmedStayReadsConfirmed', async () => {
    api.listStays.mockResolvedValue([stay('requested'), stay('approved_syncing'), stay('confirmed'), stay('sync_failed'), stay('rejected'), stay('cancelled')] as never);
    renderPortal('/portale-proprietari/calendario/p1');
    const list = await screen.findByTestId('owner-stays');
    const byState = (state: string) => within(list).getAllByTestId('owner-stay').find((item) => item.getAttribute('data-state') === state) as HTMLElement;

    expect(byState('approved_syncing').textContent).toContain('non è ancora confermato');
    expect(byState('approved_syncing').textContent).not.toMatch(/Confermato\b/);
    expect(byState('sync_failed').textContent).toContain('Non è confermato');
    expect(byState('sync_failed').textContent).not.toMatch(/Confermato\b/);
    expect(byState('requested').textContent).toContain('Le date non sono ancora bloccate');
    expect(byState('confirmed').textContent).toContain('Confermato');
    // A refused or withdrawn stay has no button to withdraw it again.
    expect(within(byState('rejected')).queryByTestId('owner-stay-cancel')).toBeNull();
    expect(within(byState('cancelled')).queryByTestId('owner-stay-cancel')).toBeNull();
    expect(within(byState('confirmed')).getByTestId('owner-stay-cancel')).toBeInTheDocument();
  });

  it('OwnerStay_Withdrawing_AsksFirst_AndSendsOneCallOnlyWhenTheOwnerConfirms', async () => {
    api.listStays.mockResolvedValue([stay('confirmed', 's9')] as never);
    api.cancelStay.mockResolvedValue(stay('cancelled', 's9') as never);
    renderPortal('/portale-proprietari/calendario/p1');
    fireEvent.click(await screen.findByTestId('owner-stay-cancel'));

    const dialog = await screen.findByRole('dialog');
    expect(api.cancelStay).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla il soggiorno' }));
    await waitFor(() => expect(api.cancelStay).toHaveBeenCalledTimes(1));
    expect(api.cancelStay).toHaveBeenCalledWith('s9');
  });
});

describe('the delegated contacts (NF-111, AC-NF111-4)', () => {
  it('OwnerContact_EachPermissionIsIndependent_TheSaveSendsExactlyTheChosenOnes_AndNoneLeftCannotBeSaved', async () => {
    api.listContacts.mockResolvedValue([contact(['calendar.read', 'documents.read', 'inbox.use'])] as never);
    api.setContactPermissions.mockResolvedValue(contact(['calendar.read', 'inbox.use']) as never);
    renderPortal('/portale-proprietari/contatti');
    const card = await screen.findByTestId('owner-contact');

    const save = within(card).getByTestId('owner-contact-save');
    expect(save).toBeDisabled();
    // Taking one permission away changes that one only.
    fireEvent.click(within(card).getByTestId('owner-contact-c1-documents.read'));
    expect(within(card).getByTestId('owner-contact-c1-calendar.read')).toBeChecked();
    expect(within(card).getByTestId('owner-contact-c1-inbox.use')).toBeChecked();
    expect(within(card).getByTestId('owner-contact-c1-accounting.read')).not.toBeChecked();
    fireEvent.click(save);
    await waitFor(() => expect(api.setContactPermissions).toHaveBeenCalledTimes(1));
    expect(api.setContactPermissions).toHaveBeenCalledWith('c1', ['calendar.read', 'inbox.use']);
  });

  it('OwnerContact_WithNoPermissionLeft_TheSaveIsOff_AnEmptyListIsNeverSentAndNeverMeansAll', async () => {
    api.listContacts.mockResolvedValue([contact(['inbox.use'])] as never);
    renderPortal('/portale-proprietari/contatti');
    const card = await screen.findByTestId('owner-contact');
    fireEvent.click(within(card).getByTestId('owner-contact-c1-inbox.use'));
    expect(within(card).getByTestId('owner-contact-save')).toBeDisabled();
    expect(card.textContent).toContain('Lascia almeno un permesso');
    fireEvent.click(within(card).getByTestId('owner-contact-save'));
    expect(api.setContactPermissions).not.toHaveBeenCalled();
  });

  it('OwnerContact_AnInvitationNeedsAPermission_AndSendsOnlyTheOnesChosen', async () => {
    api.inviteContact.mockResolvedValue(contact(['accounting.read'], 'invited') as never);
    renderPortal('/portale-proprietari/contatti');
    const form = await screen.findByTestId('owner-invite-form');
    fireEvent.change(within(form).getByTestId('owner-invite-first-name'), { target: { value: 'Anna' } });
    fireEvent.change(within(form).getByTestId('owner-invite-last-name'), { target: { value: 'Verdi' } });
    fireEvent.change(within(form).getByTestId('owner-invite-email'), { target: { value: 'anna.verdi@example.com' } });

    // No permission chosen: nothing is sent, and the form says why (no permission is not «all»).
    fireEvent.click(within(form).getByTestId('owner-invite-submit'));
    expect((await within(form).findByTestId('owner-invite-problem')).textContent).toContain('nessun permesso non significa');
    expect(api.inviteContact).not.toHaveBeenCalled();

    fireEvent.click(within(form).getByTestId('owner-invite-accounting.read'));
    fireEvent.click(within(form).getByTestId('owner-invite-submit'));
    await waitFor(() => expect(api.inviteContact).toHaveBeenCalledTimes(1));
    expect(api.inviteContact).toHaveBeenCalledWith({ email: 'anna.verdi@example.com', firstName: 'Anna', lastName: 'Verdi', permissions: ['accounting.read'] });
    // The contact has no access until it accepts, and the page says so.
    expect((await screen.findByTestId('owner-invite-sent')).textContent).toContain('Non ha ancora nessun accesso');
  });

  it('OwnerContact_Withdrawing_AsksFirst_AndSaysItAppliesFromTheNextRequest', async () => {
    api.listContacts.mockResolvedValue([contact(['calendar.read'])] as never);
    api.revokeContact.mockResolvedValue(contact(['calendar.read'], 'revoked') as never);
    renderPortal('/portale-proprietari/contatti');
    fireEvent.click(await screen.findByTestId('owner-contact-revoke'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Vale dalla sua prossima richiesta');
    expect(api.revokeContact).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoca l’accesso' }));
    await waitFor(() => expect(api.revokeContact).toHaveBeenCalledTimes(1));
    expect(api.revokeContact).toHaveBeenCalledWith('c1');
  });

  it('OwnerContact_AFailedInvitation_KeepsNothingOfTheRequestInTheCacheOfTheMutations', async () => {
    api.inviteContact.mockRejectedValue(refusal(409, 'owner_contact_exists', { email: 'secret.person@example.com', firstName: 'Secret' }));
    const { client } = renderPortal('/portale-proprietari/contatti');
    const form = await screen.findByTestId('owner-invite-form');
    fireEvent.change(within(form).getByTestId('owner-invite-first-name'), { target: { value: 'Secret' } });
    fireEvent.change(within(form).getByTestId('owner-invite-last-name'), { target: { value: 'Person' } });
    fireEvent.change(within(form).getByTestId('owner-invite-email'), { target: { value: 'secret.person@example.com' } });
    fireEvent.click(within(form).getByTestId('owner-invite-calendar.read'));
    fireEvent.click(within(form).getByTestId('owner-invite-submit'));

    expect((await within(form).findByTestId('owner-invite-refused')).textContent).toContain('già tra i tuoi contatti');
    // What the cache of the mutations keeps of the failure is the status and the answer, not the body that was sent.
    const kept = client.getMutationCache().getAll().map((mutation) => mutation.state.error as AxiosError | null);
    expect(kept.length).toBeGreaterThan(0);
    for (const error of kept) {
      expect(error?.config?.data).toBeUndefined();
      expect(JSON.stringify(error?.response?.data ?? null)).not.toContain('secret.person');
    }
  });
});

describe('the inbox (NF-111, AC-NF111-5)', () => {
  it('OwnerInbox_ALinkCanOpenTheFormPointedAtItsItem_AndTheWordsTypedAreSentOnlyToTheServer', async () => {
    api.listDocuments.mockResolvedValue({
      documents: [{ id: 'd1', orgId: 'o1', propertyOwnerId: 'po1', type: 'Mandate', title: 'Mandato di gestione', expiryState: 'none', versions: [], updatedAt: '2026-11-01T10:00:00Z' }],
      statements: [],
    });
    api.startConversation.mockResolvedValue({ id: 'cv9', orgId: 'o1', propertyOwnerId: 'po1', topic: 'Document', documentId: 'd1', subject: 'Scadenza', createdAt: '2026-11-13T10:00:00Z', lastMessageAt: '2026-11-13T10:00:00Z' });
    renderPortal('/portale-proprietari/messaggi?topic=document&documentId=d1');

    const form = await screen.findByTestId('owner-new-conversation');
    // The item of the link is already chosen once it is known to be the person's own.
    await waitFor(() => expect((within(form).getByTestId('owner-new-reference') as HTMLSelectElement).value).toBe('d1'));
    fireEvent.change(within(form).getByTestId('owner-new-subject'), { target: { value: 'Scadenza' } });
    fireEvent.change(within(form).getByTestId('owner-new-body'), { target: { value: 'Quando scade il mandato?' } });
    fireEvent.click(within(form).getByTestId('owner-new-submit'));

    await waitFor(() => expect(api.startConversation).toHaveBeenCalledTimes(1));
    expect(api.startConversation).toHaveBeenCalledWith({ topic: 'document', documentId: 'd1', subject: 'Scadenza', body: 'Quando scade il mandato?' });
  });

  it('OwnerInbox_AnItemThatIsNotThePersonsOwn_IsNotOnOffer_AndTheConversationIsNotStarted', async () => {
    renderPortal('/portale-proprietari/messaggi?topic=document&documentId=somebody-elses');
    const form = await screen.findByTestId('owner-new-conversation');
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalled());
    expect((within(form).getByTestId('owner-new-reference') as HTMLSelectElement).value).toBe('');
    fireEvent.change(within(form).getByTestId('owner-new-subject'), { target: { value: 'X' } });
    fireEvent.change(within(form).getByTestId('owner-new-body'), { target: { value: 'Y' } });
    fireEvent.click(within(form).getByTestId('owner-new-submit'));
    expect((await within(form).findByTestId('owner-new-problem')).textContent).toContain('Scegli a cosa si riferisce');
    expect(api.startConversation).not.toHaveBeenCalled();
  });

  it('OwnerInbox_AFileThatIsNotAPdfOrAnImage_IsNotUploaded_AndTheServersRefusalKeepsTheWordsTyped', async () => {
    api.listConversations.mockResolvedValue([{ id: 'cv1', orgId: 'o1', propertyOwnerId: 'po1', topic: 'General', subject: 'Domanda', createdAt: '2026-11-05T10:00:00Z', lastMessageAt: '2026-11-06T10:00:00Z' }]);
    api.postMessage.mockRejectedValue(refusal(422, 'owner_file_active_content'));
    renderPortal('/portale-proprietari/messaggi/cv1');
    const reply = await screen.findByTestId('owner-reply');

    fireEvent.change(within(reply).getByTestId('owner-reply-body'), { target: { value: 'Ecco il documento' } });
    const zip = new File(['x'], 'archivio.zip', { type: 'application/zip' });
    fireEvent.change(within(reply).getByTestId('owner-reply-file'), { target: { files: [zip] } });
    expect((await within(reply).findByTestId('owner-reply-problem')).textContent).toContain('non è accettato');
    expect(within(reply).queryByTestId('owner-reply-file-name')).toBeNull();

    const pdf = new File(['%PDF-1.4'], 'fattura.pdf', { type: 'application/pdf' });
    fireEvent.change(within(reply).getByTestId('owner-reply-file'), { target: { files: [pdf] } });
    expect(within(reply).getByTestId('owner-reply-file-name').textContent).toContain('fattura.pdf');
    fireEvent.click(within(reply).getByTestId('owner-reply-send'));
    await waitFor(() => expect(api.postMessage).toHaveBeenCalledTimes(1));
    expect(api.postMessage).toHaveBeenCalledWith('cv1', 'Ecco il documento', pdf);

    // The server scans the file and refuses it: said in words, and nothing the person typed is lost.
    expect((await within(reply).findByTestId('owner-reply-refused')).textContent).toContain('password');
    expect((within(reply).getByTestId('owner-reply-body') as HTMLTextAreaElement).value).toBe('Ecco il documento');
  });

  it('OwnerInbox_AConversationThatIsNotThePersonsOwn_IsNotFound_NeverSomebodyElsesThread', async () => {
    api.listMessages.mockRejectedValue(refusal(404, 'owner_conversation_not_found'));
    renderPortal('/portale-proprietari/messaggi/not-mine');
    const notice = await screen.findByTestId('owner-messages-error');
    expect(notice.getAttribute('data-state')).toBe('unavailable');
    expect(screen.queryByTestId('owner-reply')).toBeNull();
    expect(screen.queryByTestId('owner-messages-empty')).toBeNull();
  });
});

describe('what the portal keeps (ADR-011, NF-111)', () => {
  it('OwnerPortal_LeavingThePortal_LeavesNothingOfTheOwnerInTheCacheOfTheQueries', async () => {
    api.listContacts.mockResolvedValue([contact(['calendar.read'])] as never);
    api.listStays.mockResolvedValue([stay('requested')] as never);
    const { client, unmount } = renderPortal('/portale-proprietari/contatti');
    await screen.findByTestId('owner-contact');
    expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);

    act(() => unmount());
    // Every query of the portal is dropped as soon as nothing shows it (`gcTime: 0`) and the shell clears what is left when it goes.
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(0));
  });

  it('OwnerPortal_NothingOfTheOwnerReachesTheAddressTheStorageOrTheLog', async () => {
    const logged = [vi.spyOn(console, 'log'), vi.spyOn(console, 'info'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    sessionStorage.clear();
    localStorage.clear();
    api.listContacts.mockResolvedValue([contact(['calendar.read'])] as never);
    renderPortal('/portale-proprietari/contatti');
    await screen.findByTestId('owner-contact');
    fireEvent.change(screen.getByTestId('owner-invite-email'), { target: { value: 'another.person@example.com' } });

    expect(Object.keys(localStorage)).toHaveLength(0);
    expect(Object.keys(sessionStorage)).toHaveLength(0);
    expect(window.location.href).not.toMatch(/anna|verdi|another\.person/i);
    for (const spy of logged) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/anna\.verdi|another\.person/);
  });
});
