import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import { OwnerPortalShell } from '@/features/owner-portal/owner-portal-shell';
import { OWNER_PORTAL_KEY } from '@/queries/ownerPortal';
import { OwnerCalendar } from '../OwnerCalendar';
import { OwnerContacts } from '../OwnerContacts';
import { OwnerConversation } from '../OwnerConversation';
import { OwnerDocuments } from '../OwnerDocuments';
import { OwnerInbox } from '../OwnerInbox';
import { OwnerProperties } from '../OwnerProperties';
import { OwnerStatements } from '../OwnerStatements';

vi.mock('@/api/ownerPortal.api', () => ({
  ownerPortalApi: {
    getProperties: vi.fn(),
    getCalendar: vi.fn(),
    listStays: vi.fn(),
    getStayRule: vi.fn(),
    listDocuments: vi.fn(),
    listExternalDocuments: vi.fn(),
    listContacts: vi.fn(),
    listConversations: vi.fn(),
    listMessages: vi.fn(),
    getInboxPreferences: vi.fn(),
  },
}));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

import { ownerPortalApi } from '@/api/ownerPortal.api';

const api = vi.mocked(ownerPortalApi);

function refusal(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('refused', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, code } });
}

const PROPERTY = {
  propertyId: 'p1',
  propertyName: 'Casa Mare',
  address: 'Via del Mare 1, Rimini',
  totalBookings: 4,
  totalRevenue: 4200,
  occupancyRate: 61.5,
  recentBookings: [
    {
      bookingId: 'b1',
      checkInDate: '2026-10-01T00:00:00Z',
      checkOutDate: '2026-10-05T00:00:00Z',
      channel: 'Booking.com',
      totalAmount: 480,
      status: 'Confirmed',
      // What a leaking answer would carry: none of it may reach the page.
      guestName: 'Luigi Bianchi',
      guestEmail: 'luigi.bianchi@example.com',
      guestPhone: '+39 333 7654321',
    },
  ],
};

function statement(status: string, month: number, versionNumber = 1) {
  return {
    statementVersionId: `sv-${status}-${month}-${versionNumber}`,
    orgId: 'o1',
    propertyOwnerId: 'po1',
    periodYear: 2026,
    periodMonth: month,
    versionNumber,
    status,
    publishedAt: '2026-11-02T09:00:00Z',
  };
}

function renderPortal(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/portale-proprietari" element={<OwnerPortalShell />}>
            <Route path="immobili/:propertyId" element={<OwnerProperties />} />
            <Route path="calendario/:propertyId?" element={<OwnerCalendar />} />
            <Route path="contabilita" element={<OwnerStatements />} />
            <Route path="documenti" element={<OwnerDocuments />} />
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

/** The name of every control of the page: its text, its `aria-label` and the text of its label. */
function controlNames(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('input, button, select, textarea, [role="switch"], [role="checkbox"]')).map((control) => {
    const labels = control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement ? Array.from(control.labels ?? []).map((label) => label.textContent) : [];
    return [control.textContent, control.getAttribute('aria-label'), ...labels].filter(Boolean).join(' ');
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  api.getProperties.mockResolvedValue([PROPERTY]);
  api.listStays.mockResolvedValue([]);
  api.getCalendar.mockResolvedValue({ propertyId: 'p1', from: '2026-11-13', to: '2027-02-11', ranges: [] });
  api.getStayRule.mockResolvedValue({
    rule: { propertyId: 'p1', minAdvanceDays: 14, minNights: 2, approvalRequired: true, blackouts: [] },
    year: 2026,
    nightsUsed: 0,
  });
  api.listDocuments.mockResolvedValue({ documents: [], statements: [] });
  api.listExternalDocuments.mockResolvedValue([]);
  api.listContacts.mockResolvedValue([]);
  api.listConversations.mockResolvedValue([]);
  api.listMessages.mockResolvedValue([]);
  api.getInboxPreferences.mockResolvedValue({ emailNotifications: true });
});

afterEach(() => {
  cleanup();
});

describe('the owner portal never shows a guest (ADR-011-R3, AC-NF111-1)', () => {
  it('OwnerPortal_NoGuestPiiToggleOrField_Test', async () => {
    // The calendar: an answer polluted with everything a guest has. The page draws dates and one neutral word.
    api.getCalendar.mockResolvedValue({
      propertyId: 'p1',
      from: '2026-11-13',
      to: '2027-02-11',
      ranges: [
        {
          start: '2026-12-01',
          end: '2026-12-05',
          kind: 'occupied',
          guestName: 'Mario Rossi',
          guestEmail: 'mario.rossi@example.com',
          guestPhone: '+39 333 1234567',
          guestDocument: 'AB1234567',
          channel: 'Airbnb',
          note: 'ospite con cane',
        },
        { start: '2026-12-10', end: '2026-12-12', kind: 'ownerStay', stayId: 's1', stayState: 'requested' },
        { start: '2026-12-20', end: '2026-12-27', kind: 'available' },
      ],
    } as never);

    renderPortal('/portale-proprietari/calendario/p1');
    await screen.findByTestId('owner-calendar-runs');
    const calendarText = document.body.textContent ?? '';
    expect(calendarText).not.toMatch(/Mario|Rossi|mario\.rossi|333 1234567|AB1234567|Airbnb|con cane/);
    // Occupied is one word, and an owner stay says where it stands.
    expect(within(screen.getByTestId('owner-calendar-runs')).getAllByText('Occupato')).toHaveLength(1);
    expect(calendarText).toContain('Richiesta inviata');
    cleanup();

    // The property page: the channel, the dates and the amount of a booking, and never a guest.
    renderPortal('/portale-proprietari/immobili/p1');
    await screen.findByTestId('owner-recent-bookings');
    const propertyText = document.body.textContent ?? '';
    expect(propertyText).toContain('Booking.com');
    expect(propertyText).not.toMatch(/Luigi|Bianchi|luigi\.bianchi|333 7654321/);
    cleanup();

    // No control of any page offers to show, hide or configure a guest (there is no such toggle, and no field).
    const pages = ['calendario/p1', 'contabilita', 'documenti', 'messaggi', 'contatti', 'immobili/p1'];
    for (const page of pages) {
      renderPortal(`/portale-proprietari/${page}`);
      await waitFor(() => expect(document.querySelector('main')?.textContent).toBeTruthy());
      await waitFor(() => expect(screen.queryByRole('status', { name: /caricamento|loading/i })).toBeNull());
      const names = controlNames(document.body);
      expect(names.length).toBeGreaterThan(0);
      expect(names.filter((name) => /(mostra|nascondi|visualizza|abilita|attiva|configura|show|hide|enable|configure)[^.]*(ospit|guest)|(ospit|guest)[^.]*(mostra|nascondi|visualizza|abilita|attiva|configura|show|hide|enable|configure)/i.test(name))).toEqual([]);
      cleanup();
    }
  });

  it('OwnerPortal_NoGuestMemberInTheContractOfTheCalendarTheStaysTheDocumentsOrTheInbox', async () => {
    const sources = import.meta.glob<string>(
      ['/src/types/owner-portal-operations.types.ts', '/src/features/owner-portal/owner-portal-model.ts', '/src/api/ownerPortal.api.ts'],
      { query: '?raw', import: 'default', eager: true },
    );
    const code = Object.values(sources)
      .join('\n')
      // Comments say what is NOT there (the types say «no guest»): only the code counts.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(Object.keys(sources)).toHaveLength(3);
    expect(code).not.toMatch(/guest|ospite|booking(Id)?\b|channel|phone/i);
  });
});

describe('the accounting of the owner (E06): published versions only, and no word of a payment that nobody confirmed', () => {
  it('OwnerPortal_OnlyPublishedAccountingVersionsVisible_Test', async () => {
    api.listDocuments.mockResolvedValue({
      documents: [],
      statements: [
        statement('Draft', 9),
        statement('Flagged', 8),
        statement('Approved', 7),
        statement('Superseded', 6, 1),
        statement('Published', 6, 2),
        statement('Published', 5),
      ] as never,
    });

    renderPortal('/portale-proprietari/contabilita');
    await screen.findByTestId('owner-statements');

    const shown = screen.getAllByTestId('owner-statement');
    expect(shown.map((item) => item.getAttribute('data-status'))).toEqual(['Published', 'Superseded', 'Published']);
    // Newest period first; September, August and July (draft, flagged, only approved) never appear.
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/settembre 2026|agosto 2026|luglio 2026/i);
    expect(shown[0].textContent).toContain('giugno 2026');
    expect(shown[1].textContent).toContain('Sostituito');

    // The portal has no payout state and no evidence of a submission for the owner: nothing here is called paid, sent or accepted.
    expect(text).not.toMatch(/\b(pagat[oaie]|inviat[oaie]|accettat[oaie]|incassat[oaie]|saldat[oaie])\b/i);
    expect(screen.getByTestId('owner-accounting-note').textContent).toContain('non sono ancora mostrati');
  });

  it('OwnerPortal_Accounting_AReadThatFails_IsNeverSaidToBeInOrder_AndARefusalIsItsOwnHonestState', async () => {
    api.listDocuments.mockRejectedValue(new Error('Network Error'));
    renderPortal('/portale-proprietari/contabilita');
    expect(await screen.findByTestId('owner-accounting-error')).toBeInTheDocument();
    // Not «no statements published yet»: a failed read is a failed read.
    expect(screen.queryByTestId('owner-statements-empty')).toBeNull();
    cleanup();

    api.listDocuments.mockRejectedValue(refusal(403, 'owner_portal_permission_missing'));
    renderPortal('/portale-proprietari/contabilita');
    const notice = await screen.findByTestId('owner-accounting-error');
    expect(notice.getAttribute('data-state')).toBe('permission');
    expect(screen.queryByTestId('owner-statements-empty')).toBeNull();
    // The rest of the portal is still there: the menu is.
    expect(screen.getByTestId('owner-nav')).toBeInTheDocument();
  });
  it('OwnerPortal_Accounting_AReadThatWasGoodAndIsRefusedTheNextTime_LeavesNoDocumentNorStatementUnderTheNotice', async () => {
    api.listDocuments.mockResolvedValueOnce({
      documents: [
        {
          id: 'd9',
          orgId: 'o1',
          propertyOwnerId: 'po1',
          type: 'Invoice',
          title: 'Fattura di novembre',
          expiryState: 'none',
          updatedAt: '2026-11-01T10:00:00Z',
          versions: [{ id: 'v9', versionNumber: 1, fileName: 'fattura.pdf', contentType: 'application/pdf', sizeBytes: 100, sha256: 'a', state: 'current', uploadedAt: '2026-11-01T10:00:00Z' }],
        },
      ],
      statements: [statement('Published', 10)],
    } as never);
    const { client } = renderPortal('/portale-proprietari/contabilita');
    expect(await screen.findByTestId('owner-accounting-documents')).toBeInTheDocument();
    expect(screen.getByTestId('owner-statements')).toBeInTheDocument();

    // The access is withdrawn: the next read is refused, and what the read before it left (TanStack Query keeps it) is not drawn under the notice.
    api.listDocuments.mockRejectedValue(refusal(403, 'owner_portal_permission_missing'));
    await act(async () => {
      await client.refetchQueries({ queryKey: [OWNER_PORTAL_KEY, 'documents'] });
    });

    const notice = await screen.findByTestId('owner-accounting-error');
    expect(notice.getAttribute('data-state')).toBe('permission');
    expect(screen.queryByTestId('owner-accounting-documents')).toBeNull();
    expect(screen.queryByTestId('owner-accounting-documents-empty')).toBeNull();
    expect(screen.queryByTestId('owner-statements')).toBeNull();
    expect(document.body.textContent).not.toContain('Fattura di novembre');
  });
});

describe('the portal works from a phone and from the keyboard (NF-111, AC-NF111-6)', () => {
  it('OwnerPortal_AllCoreFlowsResponsiveAndKeyboardReachable_Test', async () => {
    api.listContacts.mockResolvedValue([]);
    renderPortal('/portale-proprietari/documenti');

    // Every flow of NF-111 is one link of the menu, and the menu is part of the page (nothing fixed that could cover a button).
    const nav = await screen.findByTestId('owner-nav');
    await waitFor(() => expect(within(nav).getAllByRole('link')).toHaveLength(6));
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Panoramica', 'Immobili e calendario', 'Contabilità', 'Documenti', 'Messaggi', 'Contatti']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/portale-proprietari',
      '/portale-proprietari/calendario',
      '/portale-proprietari/contabilita',
      '/portale-proprietari/documenti',
      '/portale-proprietari/messaggi',
      '/portale-proprietari/contatti',
    ]);
    // A touch target of at least 44 px whatever the pointer (a class, not a media query), reached by the keyboard (no negative tabindex).
    for (const link of links) {
      expect(link.className).toContain('min-h-11');
      expect(link.getAttribute('tabindex')).not.toBe('-1');
    }
    expect(links[3].getAttribute('aria-current')).toBe('page');
    expect(document.querySelectorAll('header .fixed, header .sticky, nav .fixed, nav .sticky')).toHaveLength(0);
    // The one thing fixed to the screen is the link that skips the menu, off screen until the keyboard reaches it.
    expect(screen.getByTestId('skip-link').getAttribute('href')).toBe('#owner-portal-main');
    expect(document.getElementById('owner-portal-main')).not.toBeNull();
    await expectNoAxeViolations(document.body);
    cleanup();

    // Every page has no violation axe can find without a browser, in the states a phone meets too.
    api.getProperties.mockResolvedValue([PROPERTY]);
    api.listStays.mockResolvedValue([
      {
        id: 's1',
        orgId: 'o1',
        propertyId: 'p1',
        propertyName: 'Casa Mare',
        propertyOwnerId: 'po1',
        startDate: '2027-01-10',
        endDate: '2027-01-14',
        nights: 4,
        status: 'Approved',
        state: 'approved_syncing',
        syncState: 'Pending',
        releaseSyncState: 'None',
        requestedAt: '2026-11-10T10:00:00Z',
        requestedByContact: false,
      },
    ]);
    api.listDocuments.mockResolvedValue({
      documents: [
        {
          id: 'd1',
          orgId: 'o1',
          propertyOwnerId: 'po1',
          type: 'Mandate',
          title: 'Mandato di gestione',
          expiryState: 'expiring',
          expiresOn: '2026-12-01',
          updatedAt: '2026-11-01T10:00:00Z',
          versions: [
            { id: 'v2', versionNumber: 2, fileName: 'mandato.pdf', contentType: 'application/pdf', sizeBytes: 20480, sha256: 'a', state: 'current', uploadedAt: '2026-11-01T10:00:00Z' },
            { id: 'v1', versionNumber: 1, fileName: 'mandato-1.pdf', contentType: 'application/pdf', sizeBytes: 10240, sha256: 'b', state: 'superseded', uploadedAt: '2026-01-01T10:00:00Z' },
          ],
        },
      ],
      statements: [statement('Published', 10) as never],
    });
    api.listContacts.mockResolvedValue([
      {
        id: 'c1',
        orgId: 'o1',
        propertyOwnerId: 'po1',
        email: 'anna.verdi@example.com',
        firstName: 'Anna',
        lastName: 'Verdi',
        permissions: ['calendar.read'],
        status: 'active',
        createdAt: '2026-11-01T10:00:00Z',
        invitationExpiresAt: '2026-11-08T10:00:00Z',
      },
    ]);
    api.listConversations.mockResolvedValue([
      { id: 'cv1', orgId: 'o1', propertyOwnerId: 'po1', topic: 'Document', documentId: 'd1', subject: 'Scadenza del mandato', createdAt: '2026-11-05T10:00:00Z', lastMessageAt: '2026-11-06T10:00:00Z' },
    ]);
    const pages: Array<[string, string]> = [
      ['calendario/p1', 'owner-stays'],
      ['contabilita', 'owner-statements'],
      ['documenti', 'owner-documents'],
      ['messaggi', 'owner-conversations'],
      ['contatti', 'owner-contacts'],
    ];
    for (const [page, marker] of pages) {
      renderPortal(`/portale-proprietari/${page}`);
      await screen.findByTestId(marker);
      // No table to scroll sideways: the lists are lists of cards.
      expect(document.querySelectorAll('main table')).toHaveLength(0);
      // Every button and link of the page is a 44 px target and has a name.
      const targets = Array.from(document.querySelectorAll<HTMLElement>('main a[href], main button')).filter((element) => !element.closest('[hidden]'));
      expect(targets.length).toBeGreaterThan(0);
      for (const target of targets) {
        expect(target.className, target.outerHTML.slice(0, 160)).toContain('min-h-11');
      }
      await expectNoAxeViolations(document.body);
      cleanup();
    }
  });

  it('OwnerPortal_AContactTheOwnerLetIn_HasNoContactsEntry_AndTheContactsPageSaysItIsTheOwnersAlone', async () => {
    api.listContacts.mockRejectedValue(refusal(403, 'owner_contact_owner_only'));
    renderPortal('/portale-proprietari/documenti');
    const nav = await screen.findByTestId('owner-nav');
    await screen.findByTestId('owner-documents-empty');
    await waitFor(() => expect(api.listContacts).toHaveBeenCalled());
    expect(within(nav).queryByRole('link', { name: 'Contatti' })).toBeNull();
    cleanup();

    renderPortal('/portale-proprietari/contatti');
    const notice = await screen.findByTestId('owner-contacts-error');
    expect(notice.getAttribute('data-state')).toBe('ownerOnly');
    expect(screen.queryByTestId('owner-invite-form')).toBeNull();
  });
});
