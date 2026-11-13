import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { calendarChangesApi } from '@/api/calendar-changes.api';
import { manualBlocksApi } from '@/api/manual-blocks.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import type { CalendarChange } from '@/types/calendar-changes.types';
import type { CalendarDayInfo } from '@/types/calendar-days.types';
import { toDayLayer } from '../../lib/day-layer';
import { extendSelection, startSelection } from '../../lib/day-selection';
import { DayPanel } from '../day-panel';

vi.mock('@/api/calendar-changes.api', () => ({ calendarChangesApi: { apply: vi.fn(), get: vi.fn(), retry: vi.fn(), list: vi.fn(), preview: vi.fn() } }));
vi.mock('@/api/manual-blocks.api', () => ({ manualBlocksApi: { create: vi.fn(), remove: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TODAY = '2026-09-12';
const SELECTION = extendSelection(startSelection('p1', '2026-09-12'), 'p1', '2026-09-15')!;

const day = (date: string, changes: Partial<CalendarDayInfo> = {}): CalendarDayInfo => ({
  date,
  priceCents: 12000,
  priceSource: 'Base',
  minNights: 1,
  closedToArrival: false,
  closedToDeparture: false,
  hasRule: false,
  taken: false,
  ...changes,
});

const LAYER = toDayLayer({
  today: TODAY,
  properties: [
    {
      propertyId: 'p1',
      timezone: 'Europe/Rome',
      currency: 'EUR',
      mirrored: true,
      days: [day('2026-09-12'), day('2026-09-13', { taken: true }), day('2026-09-14'), day('2026-09-15', { taken: true })],
    },
  ],
})?.get('p1');

const change = (changes: Partial<CalendarChange> = {}): CalendarChange => ({
  id: 'c1',
  kind: 'DayRules',
  state: 'Sent',
  requestedAt: '2026-09-12T10:00:00Z',
  propertyCount: 1,
  dayCount: 4,
  quotaUnitsEstimated: 1,
  properties: [{ propertyId: 'p1', state: 'Accepted', chunkCount: 1 }],
  ...changes,
});

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data });
}

function renderPanel(props: Partial<Parameters<typeof DayPanel>[0]> = {}, permissions: string[] = ['property.read', 'property.write'], connector = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const workspace = { hasPermission: (context: string, permission: string) => context === 'short-rent' && permissions.includes(permission) } as unknown as WorkspaceContextValue;
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false }}>
        <WorkspaceContext.Provider value={workspace}>
          <DayPanel selection={SELECTION} propertyName="Casa Roma" layer={LAYER} today={TODAY} onClose={onClose} {...props} />
        </WorkspaceContext.Provider>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
  return onClose;
}

describe('DayPanel (E08/F05/US03/T02)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
  });
  afterEach(() => cleanup());

  it('DayPanel_Header_SaysTheDatesThePropertyAndTheNights', () => {
    renderPanel();
    expect(screen.getByTestId('day-panel-title')).toHaveTextContent('12-15 settembre · Casa Roma · 4 notti');
  });

  it('DayPanel_BlockTab_SaysBeforeSendingThatANightOfTheSelectionIsTaken', () => {
    renderPanel();

    expect(screen.getByTestId('day-panel-taken')).toHaveTextContent('2 notti della selezione sono già occupate');
    expect(screen.getByTestId('manual-block-form')).toBeInTheDocument();
  });

  it('DayPanel_BlockTab_ThePanelDoesNotBlockWhenTheCallerCannotReadTheLayer_ButStillOffersTheForm', () => {
    renderPanel({ layer: undefined });

    expect(screen.queryByTestId('day-panel-taken')).not.toBeInTheDocument();
    expect(screen.getByTestId('manual-block-form')).toBeInTheDocument();
  });

  it('DayPanel_BlockThatMeetsABooking_ShowsTheErrorNextToItsFieldsAndKeepsThePanel', async () => {
    vi.mocked(manualBlocksApi.create).mockRejectedValue(problemError(409, { code: 'calendar_block_overlaps_booking', detail: 'server text' }));
    renderPanel();

    fireEvent.change(within(screen.getByTestId('manual-block-form')).getByLabelText('Motivo'), { target: { value: 'Owner' } });
    fireEvent.click(within(screen.getByTestId('manual-block-form')).getByRole('button', { name: 'Blocca date' }));

    expect(await screen.findByTestId('manual-block-error')).toHaveTextContent('Una prenotazione occupa già una di queste notti');
    expect(screen.getByTestId('day-panel')).toBeInTheDocument();
  });

  it('DayPanel_PastDays_DisableEveryActionAndSayWhy', () => {
    const past = extendSelection(startSelection('p1', '2026-09-01'), 'p1', '2026-09-03')!;
    renderPanel({ selection: past });

    expect(screen.getByTestId('day-panel-past')).toHaveTextContent('Questi giorni sono già passati');
    for (const id of ['day-panel-block', 'day-panel-price', 'day-panel-restrictions']) expect(screen.getByTestId(id)).toBeDisabled();
    expect(screen.queryByTestId('manual-block-form')).not.toBeInTheDocument();
  });

  it('DayPanel_SomePastDays_AreLeftAsTheyWereAndSaidSo', () => {
    const mixed = extendSelection(startSelection('p1', '2026-09-10'), 'p1', '2026-09-13')!;
    renderPanel({ selection: mixed });

    expect(screen.getByTestId('day-panel-some-past')).toHaveTextContent('2 giorni sono già passati: restano com\'erano.');
    expect(screen.getByTestId('day-panel-price')).toBeEnabled();
  });

  it('DayPanel_PriceForAMirroredProperty_SaysSavedInCasaZenAndAcceptedNeverPublished', async () => {
    vi.mocked(calendarChangesApi.apply).mockResolvedValue(change());
    vi.mocked(calendarChangesApi.get).mockResolvedValue(change());
    renderPanel();

    fireEvent.click(screen.getByTestId('day-panel-price'));
    expect(screen.getByTestId('day-price-now')).toHaveTextContent('Prezzo attuale');
    fireEvent.change(screen.getByTestId('day-price-input'), { target: { value: '150,5' } });
    fireEvent.click(screen.getByTestId('day-rules-submit'));

    await screen.findByTestId('day-panel-result');
    expect(calendarChangesApi.apply).toHaveBeenCalledTimes(1);
    expect(vi.mocked(calendarChangesApi.apply).mock.calls[0][0]).toMatchObject({
      propertyIds: ['p1'],
      from: '2026-09-12',
      to: '2026-09-15',
      price: { action: 'Set', value: 150.5 },
    });
    expect(screen.getByTestId('calendar-change-saved')).toHaveTextContent('Salvato in CasaZen');
    const line = screen.getByTestId('calendar-change-property');
    expect(line).toHaveAttribute('data-state', 'accepted');
    expect(line).toHaveTextContent('Accettata dal tuo channel manager.');
    expect(screen.getByTestId('day-panel-result').textContent).not.toMatch(/pubblicat/i);
  });

  it('DayPanel_PriceForAPropertyThatIsNotConnected_SaysTheChangeStaysInCasaZen', async () => {
    const stays = change({ state: 'Applied', properties: [{ propertyId: 'p1', state: 'Skipped', chunkCount: 0 }] });
    vi.mocked(calendarChangesApi.apply).mockResolvedValue(stays);
    vi.mocked(calendarChangesApi.get).mockResolvedValue(stays);
    renderPanel();

    fireEvent.click(screen.getByTestId('day-panel-price'));
    fireEvent.change(screen.getByTestId('day-price-input'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('day-rules-submit'));

    const line = await screen.findByTestId('calendar-change-property');
    expect(line).toHaveAttribute('data-state', 'notConnected');
    expect(line).toHaveTextContent('la modifica resta in CasaZen');
  });

  it('DayPanel_ConnectorOff_SaysOnlySavedInCasaZen_NothingOfTheChannelManager', async () => {
    const stays = change({ state: 'Applied', properties: [{ propertyId: 'p1', state: 'Skipped', chunkCount: 0 }] });
    vi.mocked(calendarChangesApi.apply).mockResolvedValue(stays);
    vi.mocked(calendarChangesApi.get).mockResolvedValue(stays);
    renderPanel({}, ['property.read', 'property.write'], false);

    fireEvent.click(screen.getByTestId('day-panel-price'));
    fireEvent.change(screen.getByTestId('day-price-input'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('day-rules-submit'));

    expect(await screen.findByTestId('calendar-change-saved')).toHaveTextContent('Salvato in CasaZen');
    expect(screen.queryByTestId('calendar-change-property')).not.toBeInTheDocument();
    expect(screen.getByTestId('day-panel-result').textContent).not.toMatch(/channel manager/i);
    // Nothing is sent there, so the state of the change is not asked either.
    expect(calendarChangesApi.get).not.toHaveBeenCalled();
  });

  it('DayPanel_AChangeThatFailed_SaysWhyAndOffersRetryNow_WhichSendsItAgain', async () => {
    const failed = change({ state: 'Failed', properties: [{ propertyId: 'p1', state: 'Failed', errorCode: 'octorate_unavailable', chunkCount: 1 }] });
    vi.mocked(calendarChangesApi.apply).mockResolvedValue(failed);
    vi.mocked(calendarChangesApi.get).mockResolvedValue(failed);
    vi.mocked(calendarChangesApi.retry).mockResolvedValue(change({ state: 'Queued', properties: [{ propertyId: 'p1', state: 'Pending', chunkCount: 1 }] }));
    renderPanel();

    fireEvent.click(screen.getByTestId('day-panel-price'));
    fireEvent.change(screen.getByTestId('day-price-input'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('day-rules-submit'));

    expect(await screen.findByTestId('calendar-change-reason')).toHaveTextContent('Il channel manager non ha risposto');
    expect(screen.getByTestId('calendar-change-property')).toHaveAttribute('data-state', 'failed');
    fireEvent.click(screen.getByTestId('calendar-change-retry'));
    await waitFor(() => expect(calendarChangesApi.retry).toHaveBeenCalledWith('c1'));
  });

  it('DayPanel_WhileTheRetryIsOnItsWay_TheButtonsOfTheCardAreOff', async () => {
    const failed = change({ state: 'Failed', properties: [{ propertyId: 'p1', state: 'Failed', errorCode: 'octorate_channel_error', chunkCount: 1 }] });
    vi.mocked(calendarChangesApi.apply).mockResolvedValue(failed);
    vi.mocked(calendarChangesApi.get).mockResolvedValue(failed);
    vi.mocked(calendarChangesApi.retry).mockReturnValue(new Promise(() => undefined));
    renderPanel();

    fireEvent.click(screen.getByTestId('day-panel-price'));
    fireEvent.change(screen.getByTestId('day-price-input'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('day-rules-submit'));
    fireEvent.click(await screen.findByTestId('calendar-change-retry'));

    await waitFor(() => expect(screen.getByTestId('calendar-change-retry')).toBeDisabled());
  });

  it('DayPanel_AChangeTheApiRefuses_ShowsTheReasonInTheFormAndKeepsIt', async () => {
    vi.mocked(calendarChangesApi.apply).mockRejectedValue(problemError(422, { code: 'calendar_day_rule_in_past', detail: 'I giorni sono già passati.' }));
    renderPanel();

    fireEvent.click(screen.getByTestId('day-panel-price'));
    fireEvent.change(screen.getByTestId('day-price-input'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('day-rules-submit'));

    // The sentence of the code, in the words of the app (the text of the server is the fallback for a code with none).
    expect(await screen.findByTestId('day-rules-error')).toHaveTextContent('Questi giorni sono già passati: scegli giorni da oggi in poi.');
    expect(screen.queryByTestId('day-panel-result')).not.toBeInTheDocument();
  });

  it('DayPanel_AWriterWithoutTheRightToReadChanges_DoesNotAskForThem', async () => {
    vi.mocked(calendarChangesApi.apply).mockResolvedValue(change({ state: 'Queued', properties: [{ propertyId: 'p1', state: 'Pending', chunkCount: 1 }] }));
    renderPanel({}, ['property.write']);

    fireEvent.click(screen.getByTestId('day-panel-price'));
    fireEvent.change(screen.getByTestId('day-price-input'), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('day-rules-submit'));

    // The change cannot be followed without the right to read it: what it was when the API answered is said as that, never as a progress that is not known.
    const line = await screen.findByTestId('calendar-change-property');
    expect(line).toHaveAttribute('data-state', 'noAnswer');
    expect(calendarChangesApi.get).not.toHaveBeenCalled();
  });
});
