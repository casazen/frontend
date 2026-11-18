import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardApi } from '@/api/dashboard.api';
import { messageHubApi } from '@/api/message-hub.api';
import { WorkspaceContext } from '@/contexts/workspace-context';
import i18n from '@/i18n/config';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { DashboardToday, DashboardTodayStay } from '@/types/dashboard.types';
import { AskProvider } from '../ask-provider';
import { AskArrivalsButton, AskBookingDraftButton, AskCasaZenButton } from '../ask-trigger';
import { asksForIncompleteArrivals, disambiguatingBookingReference, summarizeArrivals } from '../arrivals-capability';

vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock('@/config/demo.config', async (original) => ({ ...(await original<object>()), isDemoMode: false }));
vi.mock('@/api/dashboard.api', () => ({ dashboardApi: { getToday: vi.fn() } }));
vi.mock('@/api/message-hub.api', () => ({
  messageHubApi: {
    getContactOptions: vi.fn(),
    listTemplates: vi.fn(),
    renderTemplate: vi.fn(),
    reply: vi.fn(),
    startConversation: vi.fn(),
  },
}));

const day = todayInRome();
const stay: DashboardTodayStay = {
  bookingId: 'b1',
  propertyId: 'p1',
  propertyName: 'Casa Rosa',
  guestName: 'Private Name',
  numberOfGuests: 1,
  checkInDate: day,
  checkOutDate: addDays(day, 2),
  status: 'Confirmed',
  checkIn: { state: 'Sent', dataComplete: false },
  cleaning: null,
};
const empty = { items: [], count: 0 };
function today(items: DashboardTodayStay[], count = items.length): DashboardToday {
  return { today: day, arrivals: { items, count }, departures: empty, services: empty, approvals: empty, todo: empty };
}

function view(path = '/app/short-rent', org = 'A', permissions = ['booking.read', 'booking.write']) {
  const client = new QueryClient();
  const tree = (orgId: string, allowed: string[]) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <WorkspaceContext.Provider
          value={{
            activeContext: 'short-rent',
            contexts: [
              {
                contextKey: 'short-rent',
                displayName: 'Host',
                roleKey: 'host',
                defaultRoute: path,
                permissions: allowed,
              },
            ],
            isReady: true,
            hasPermission: (_area, grant) => allowed.includes(grant),
            setActiveContext: vi.fn(),
            getDefaultRoute: () => path,
          }}
        >
          <AskProvider area="short-rent" orgId={orgId} orgName={orgId} userId="user">
            <AskCasaZenButton />
            <AskArrivalsButton />
            <AskBookingDraftButton />
          </AskProvider>
        </WorkspaceContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(tree(org, permissions));
  return (orgId: string, allowed = permissions) => result.rerender(tree(orgId, allowed));
}

// The app loads the panel on demand. Load its module before measuring UI waits in the test runner.
beforeAll(async () => {
  await import('../ask-panel');
}, 60000);
beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
});
afterEach(cleanup);

describe('read arrivals in context', () => {
  it('recognizes the supported questions in both languages and requests clarification for other dates or properties', () => {
    expect(asksForIncompleteArrivals('Quali arrivi di oggi hanno il check-in incompleto?')).toBe(true);
    expect(asksForIncompleteArrivals('Which arrivals today have incomplete check-in?')).toBe(true);
    expect(asksForIncompleteArrivals('Quali arrivi di domani hanno il check-in incompleto?')).toBe(false);
    expect(asksForIncompleteArrivals('Arrivi da gestire a Casa Rosa')).toBe(false);
  });

  it('checks actual guest-data completeness, flags missing state and scope truncation, and only retains references', () => {
    const answer = summarizeArrivals(
      today(
        [
          stay,
          { ...stay, bookingId: 'b2', checkIn: { state: 'Completed', dataComplete: false } },
          { ...stay, bookingId: 'b3', checkIn: { state: 'NotSent', dataComplete: true } },
          { ...stay, bookingId: 'b4', checkIn: null },
          { ...stay, bookingId: 'b5', status: 'CheckedIn' },
          { ...stay, bookingId: 'b6', propertyId: 'p2' },
        ],
        12,
      ),
      'p1',
    );
    expect(answer.rows.map((row) => [row.bookingId, row.state])).toEqual([
      ['b1', 'Sent'],
      ['b2', 'Completed'],
      ['b4', 'unknown'],
    ]);
    expect(answer.partial).toBe(true);
    expect(JSON.stringify(answer)).not.toContain(stay.guestName);
    expect(() => summarizeArrivals({} as DashboardToday, null)).toThrow();
  });

  it('adds a reference only when the property and dates would identify two arrivals equally', () => {
    const { rows } = summarizeArrivals(
      today([
        { ...stay, bookingCode: 'AQ123-4402A' },
        { ...stay, bookingId: 'b2' },
        { ...stay, bookingId: 'b3', checkOutDate: addDays(day, 4) },
      ]),
      null,
    );
    expect(rows.map((row) => disambiguatingBookingReference(row, rows))).toEqual(['AQ123-4402A', 'b2', null]);
  });

  it('shows the authoritative empty state, then retries an unavailable service without replaying an old result', async () => {
    vi.mocked(dashboardApi.getToday).mockRejectedValueOnce(new Error()).mockResolvedValueOnce(today([]));
    view();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ask.arrivalsShortcut') }));
    await screen.findByText(i18n.t('ask.unavailable'), {}, { timeout: 6000 });
    expect(screen.getByRole('link', { name: i18n.t('ask.manual') })).toHaveAttribute(
      'href',
      '/app/short-rent?today=arrivals',
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ask.retry') }));
    expect(await screen.findByText(i18n.t('ask.noArrivals'))).toBeVisible();
  });

  it('aborts a pending read when the org changes; the next answer belongs to the new scope', async () => {
    let oldSignal: AbortSignal | undefined;
    vi.mocked(dashboardApi.getToday)
      .mockImplementationOnce((signal) => {
        oldSignal = signal;
        return new Promise(() => {});
      })
      .mockResolvedValueOnce(today([{ ...stay, propertyName: 'Casa Blu' }]));
    const change = view();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ask.arrivalsShortcut') }));
    await waitFor(() => expect(oldSignal).toBeDefined());
    change('B');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(oldSignal?.aborted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ask.arrivalsShortcut') }));
    expect(await screen.findByRole('link', { name: /Casa Blu/ })).toHaveAttribute(
      'href',
      '/app/short-rent/bookings/b1?tab=guest',
    );
    change('B', []);
    expect(screen.queryByText('Casa Blu')).toBeNull();
  });

  it('withholds the read from a role without booking.read including a typed request', async () => {
    view('/app/short-rent', 'A', []);
    expect(screen.queryByRole('button', { name: i18n.t('ask.arrivalsShortcut') })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ask.title') }));
    const panel = within(await screen.findByRole('dialog'));
    fireEvent.change(panel.getByLabelText(i18n.t('ask.field')), { target: { value: i18n.t('ask.question') } });
    fireEvent.click(panel.getByRole('button', { name: i18n.t('ask.submit') }));
    expect(await panel.findByText(i18n.t('ask.noPages'))).toBeVisible();
    expect(dashboardApi.getToday).not.toHaveBeenCalled();
  });

  it('identifies an old source day and suppresses the outdated links', async () => {
    const previous = addDays(day, -1);
    vi.mocked(dashboardApi.getToday).mockResolvedValue({
      ...today([{ ...stay, checkInDate: previous }]),
      today: previous,
    });
    view();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ask.arrivalsShortcut') }));
    expect(await screen.findByText(i18n.t('ask.stale'))).toBeVisible();
    expect(screen.queryByRole('link', { name: /Casa Rosa/ })).toBeNull();
  });

  it('prepares and edits a template for the server-resolved conversation, and closes without sending', async () => {
    const key = 'direct:booking1';
    vi.mocked(messageHubApi.getContactOptions).mockResolvedValue({
      threadKey: key,
      channel: 'Direct',
      emailAvailable: false,
      phoneAvailable: false,
    });
    vi.mocked(messageHubApi.listTemplates).mockResolvedValue([
      { id: 'template1', name: 'Arrivo', language: 'it', body: 'Ciao', variables: [], isActive: true, updatedAt: '' },
    ]);
    vi.mocked(messageHubApi.renderTemplate).mockResolvedValue({ text: 'Arrivo alle 15' });
    view('/app/short-rent/bookings/booking1');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ask.draftShortcut') }));
    fireEvent.change(await screen.findByLabelText(i18n.t('ask.chooseTemplate')), { target: { value: 'template1' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ask.render') }));
    const draft = await screen.findByLabelText(i18n.t('ask.draftLabel'));
    expect(draft).toHaveValue('Arrivo alle 15');
    fireEvent.change(draft, { target: { value: 'Arrivo alle 16' } });
    expect(draft).toHaveValue('Arrivo alle 16');
    expect(messageHubApi.renderTemplate).toHaveBeenCalledWith('template1', key, expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('shared.close') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(messageHubApi.reply).not.toHaveBeenCalled();
    expect(messageHubApi.startConversation).not.toHaveBeenCalled();
  });
});
