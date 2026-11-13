import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import i18n from '@/i18n/config';
import { calendarChangesApi } from '@/api/calendar-changes.api';
import { calendarDaysApi } from '@/api/calendar-days.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { useProperties } from '@/queries/use-properties';
import { freezeClock } from '@/test/clock';
import type { CalendarChange, CalendarChangePreview } from '@/types/calendar-changes.types';
import { CalendarBulkPage } from '../calendar-bulk-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }) }));
vi.mock('@/queries/use-properties', () => ({ useProperties: vi.fn() }));
vi.mock('@/api/calendar-changes.api', () => ({ calendarChangesApi: { apply: vi.fn(), get: vi.fn(), retry: vi.fn(), list: vi.fn(), preview: vi.fn() } }));
vi.mock('@/api/calendar-days.api', () => ({ calendarDaysApi: { getDays: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({ AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

const WAIT = { timeout: 5000 };

const PREVIEW: CalendarChangePreview = {
  days: 62,
  changedDays: 60,
  unchangedDays: 0,
  takenDays: 2,
  skippedPastDays: 0,
  estimatedQuotaUnits: 3,
  warnings: [{ code: 'property_not_mirrored', propertyId: 'p2', message: 'x' }],
  properties: [
    {
      propertyId: 'p1',
      name: 'Villa Mare',
      mirrored: true,
      days: 31,
      changedDays: 30,
      unchangedDays: 0,
      takenDays: 1,
      skippedPastDays: 0,
      estimatedQuotaUnits: 3,
      samples: [
        {
          date: '2026-09-12',
          before: { priceCents: 10000, minNights: 1, closedToArrival: false, closedToDeparture: false },
          after: { priceCents: 12050, minNights: 1, closedToArrival: false, closedToDeparture: false },
        },
      ],
    },
    { propertyId: 'p2', name: 'Casa Lago', mirrored: false, days: 31, changedDays: 30, unchangedDays: 0, takenDays: 1, skippedPastDays: 0, estimatedQuotaUnits: 0, samples: [] },
  ],
};

const CHANGE: CalendarChange = {
  id: 'c1',
  kind: 'Bulk',
  state: 'Queued',
  requestedAt: '2026-09-12T10:00:00Z',
  propertyCount: 2,
  dayCount: 62,
  quotaUnitsEstimated: 3,
  properties: [
    { propertyId: 'p1', state: 'Pending', chunkCount: 1 },
    { propertyId: 'p2', state: 'Skipped', chunkCount: 0 },
  ],
};

function problemError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data });
}

function renderPage(permissions: string[] = ['property.read', 'property.write'], connector = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const workspace = { hasPermission: (context: string, permission: string) => context === 'short-rent' && permissions.includes(permission) } as unknown as WorkspaceContextValue;
  render(
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, octorateConnector: connector }, isLoading: false }}>
        <WorkspaceContext.Provider value={workspace}>
          <MemoryRouter initialEntries={['/app/short-rent/bookings/calendar/bulk']}>
            <Routes>
              <Route path="/app/short-rent/bookings/calendar/bulk" element={<CalendarBulkPage />} />
              <Route path="/app/short-rent/bookings/calendar" element={<p>calendar-page</p>} />
            </Routes>
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

const next = () => fireEvent.click(screen.getByTestId('bulk-wizard-next'));
const label = (key: string) => screen.getByLabelText(i18n.t(key));

async function chooseProperties() {
  const boxes = await screen.findAllByTestId('bulk-property', undefined, WAIT);
  fireEvent.click(boxes[0]);
  fireEvent.click(boxes[1]);
}

async function toSummary() {
  await chooseProperties();
  next();
  await screen.findByTestId('bulk-period-step', undefined, WAIT);
  next();
  fireEvent.click(await screen.findByTestId('bulk-rule-price-Set', undefined, WAIT));
  fireEvent.change(await screen.findByTestId('bulk-rule-price-input'), { target: { value: '120,5' } });
  next();
  await screen.findByTestId('bulk-summary-preview', undefined, WAIT);
}

describe('CalendarBulkPage (E08/F05/US03/T03, NF-78, NF-05)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // The draft of the wizard is kept in the tab: a test does not start from the answers of the one before.
    window.sessionStorage.clear();
    await i18n.changeLanguage('it');
    freezeClock('2026-09-12T10:00:00Z');
    vi.mocked(useProperties).mockReturnValue({
      data: [
        { id: 'p1', name: 'Villa Mare', city: 'Rimini' },
        { id: 'p2', name: 'Casa Lago', city: 'Como' },
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useProperties>);
    vi.mocked(calendarDaysApi.getDays).mockResolvedValue({
      today: '2026-09-12',
      properties: [
        { propertyId: 'p1', timezone: 'Europe/Rome', currency: 'EUR', mirrored: true, days: [] },
        { propertyId: 'p2', timezone: 'Europe/Rome', currency: 'EUR', mirrored: false, days: [] },
      ],
    });
    vi.mocked(calendarChangesApi.preview).mockResolvedValue(PREVIEW);
    vi.mocked(calendarChangesApi.apply).mockResolvedValue(CHANGE);
    vi.mocked(calendarChangesApi.get).mockResolvedValue(CHANGE);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('CalendarBulkPage_PropertiesStep_OffersTheShortRentPropertiesWithTheirConnection', { timeout: 30_000 }, async () => {
    renderPage();

    const connections = await screen.findAllByTestId('bulk-property-connection', undefined, WAIT);
    expect(connections[0]).toHaveTextContent('Collegato al tuo gestionale');
    expect(connections[1]).toHaveTextContent('Non collegato al tuo gestionale: la modifica resta in CasaZen.');
    // At least one property is needed to go on.
    next();
    expect(await screen.findByTestId('bulk-properties-problem', undefined, WAIT)).toHaveTextContent('Scegli almeno un immobile.');
  });

  it('CalendarBulkPage_WithoutTheRightToReadProperties_SaysNothingOfTheConnection_AndAsksForNoDays', { timeout: 30_000 }, async () => {
    renderPage(['property.write']);

    await screen.findAllByTestId('bulk-property', undefined, WAIT);
    expect(screen.queryByTestId('bulk-property-connection')).not.toBeInTheDocument();
    expect(calendarDaysApi.getDays).not.toHaveBeenCalled();
  });

  it('CalendarBulkPage_ConnectorOff_SaysNothingOfTheChannelManagerInTheStepsAndTheSummary', { timeout: 30_000 }, async () => {
    renderPage(['property.read', 'property.write'], false);
    await toSummary();

    const words = screen.getByTestId('bulk-summary-words');
    expect(words).toHaveTextContent('Cambieremo il prezzo di 31 giorni su 2 immobili in CasaZen.');
    expect(words.textContent).not.toMatch(/gestionale/i);
    expect(screen.queryByTestId('bulk-summary-quota')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('bulk-wizard-back'));
    fireEvent.click(screen.getByTestId('bulk-wizard-back'));
    fireEvent.click(screen.getByTestId('bulk-wizard-back'));
    await screen.findAllByTestId('bulk-property', undefined, WAIT);
    expect(screen.queryByTestId('bulk-property-connection')).not.toBeInTheDocument();
  });

  it('CalendarBulkPage_PeriodEntirelyPast_IsRefusedWithAPlainSentence_AndNothingGoesOn', { timeout: 30_000 }, async () => {
    renderPage();
    await chooseProperties();
    next();
    await screen.findByTestId('bulk-period-step', undefined, WAIT);

    fireEvent.change(label('booking.calendar.bulk.period.from'), { target: { value: '2026-09-01' } });
    fireEvent.change(label('booking.calendar.bulk.period.to'), { target: { value: '2026-09-11' } });
    next();

    // The sentence is next to the field and in the list of the problems of the step.
    expect(await screen.findAllByText('Questi giorni sono già passati: scegli giorni da oggi in poi.', undefined, WAIT)).not.toHaveLength(0);
    expect(screen.getByTestId('bulk-period-step')).toBeInTheDocument();
  });

  it('CalendarBulkPage_ChangesStep_NeedsAtLeastOneValueToChange', { timeout: 30_000 }, async () => {
    renderPage();
    await chooseProperties();
    next();
    await screen.findByTestId('bulk-period-step', undefined, WAIT);
    next();
    await screen.findByTestId('bulk-changes-step', undefined, WAIT);
    next();

    expect(await screen.findByTestId('bulk-changes-problem', undefined, WAIT)).toHaveTextContent('Cambia almeno un valore');
    expect(calendarChangesApi.preview).not.toHaveBeenCalled();
  });

  it('CalendarBulkPage_PriceThatIsNotValid_IsRefusedNextToTheField', { timeout: 30_000 }, async () => {
    renderPage();
    await chooseProperties();
    next();
    await screen.findByTestId('bulk-period-step', undefined, WAIT);
    next();
    fireEvent.click(await screen.findByTestId('bulk-rule-price-Set', undefined, WAIT));
    fireEvent.change(await screen.findByTestId('bulk-rule-price-input'), { target: { value: '120.505' } });
    next();

    expect(await screen.findAllByText('Il prezzo può avere al massimo due decimali.', undefined, WAIT)).not.toHaveLength(0);
    expect(calendarChangesApi.preview).not.toHaveBeenCalled();
  });

  it('CalendarBulkPage_Summary_SaysInPlainWordsWhatWillHappen_AndSendsNothingBeforeApply', { timeout: 30_000 }, async () => {
    renderPage();
    await toSummary();

    expect(calendarChangesApi.preview).toHaveBeenCalledTimes(1);
    expect(vi.mocked(calendarChangesApi.preview).mock.calls[0][0]).toMatchObject({
      propertyIds: ['p1', 'p2'],
      from: '2026-09-12',
      to: '2026-10-11',
      price: { action: 'Set', value: 120.5 },
      minNights: { action: 'Keep' },
    });
    const words = screen.getByTestId('bulk-summary-words');
    expect(words).toHaveTextContent('Cambieremo il prezzo di 31 giorni su 2 immobili in CasaZen.');
    expect(words).toHaveTextContent('Per Villa Mare la modifica viene inviata anche al tuo gestionale (circa 3 chiamate al gestionale).');
    expect(words).toHaveTextContent('Casa Lago non è collegato al tuo gestionale: la sua modifica resta in CasaZen.');
    expect(screen.getByTestId('bulk-summary-quota')).toHaveTextContent('è solo una stima');
    // Per property the days that change and the days skipped, and the first changes before and after.
    const cards = screen.getAllByTestId('bulk-summary-property');
    expect(cards[0]).toHaveTextContent('30 giorni cambiano');
    expect(within(cards[0]).getByTestId('bulk-summary-taken')).toHaveTextContent('1 notte occupata');
    expect((within(cards[0]).getByTestId('bulk-summary-sample').textContent ?? '').replace(/\s/g, ' ')).toContain('Prezzo: 100 € → 120,50 €');
    // Nothing is sent before "Apply changes", and "Edit" is there to go back.
    expect(calendarChangesApi.apply).not.toHaveBeenCalled();
    expect(screen.getAllByRole('link', { name: /Modifica/ }).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('bulk-wizard-apply')).toBeEnabled();
  });

  it('CalendarBulkPage_PreviewThatFailed_SaysSo_AndTheLastButtonIsOff', { timeout: 30_000 }, async () => {
    vi.mocked(calendarChangesApi.preview).mockRejectedValue(problemError(422, { code: 'calendar_too_many_properties', detail: 'x y' }));
    renderPage();
    await chooseProperties();
    next();
    await screen.findByTestId('bulk-period-step', undefined, WAIT);
    next();
    fireEvent.click(await screen.findByTestId('bulk-rule-price-Set', undefined, WAIT));
    fireEvent.change(await screen.findByTestId('bulk-rule-price-input'), { target: { value: '99' } });
    next();

    const error = await screen.findByTestId('bulk-summary-error', undefined, WAIT);
    expect(error).toHaveTextContent('Una modifica può riguardare al massimo 50 immobili.');
    expect(screen.getByTestId('bulk-wizard-apply')).toBeDisabled();
    expect(calendarChangesApi.apply).not.toHaveBeenCalled();
  });

  it('CalendarBulkPage_Apply_SendsThePriceAsTypedAndSaysWhatHappenedToEachProperty', { timeout: 30_000 }, async () => {
    renderPage();
    await toSummary();
    fireEvent.click(screen.getByTestId('bulk-wizard-apply'));

    expect(await screen.findByText('Modifica salvata in CasaZen', undefined, WAIT)).toBeInTheDocument();
    expect(vi.mocked(calendarChangesApi.apply).mock.calls[0][0].price).toEqual({ action: 'Set', value: 120.5 });
    expect(screen.getByTestId('calendar-change-saved')).toHaveTextContent('Salvato in CasaZen');
    const lines = screen.getAllByTestId('calendar-change-property');
    expect(lines[0]).toHaveAttribute('data-state', 'waiting');
    expect(lines[1]).toHaveAttribute('data-state', 'notConnected');
    expect(lines[1]).toHaveTextContent('la modifica resta in CasaZen');
    // The only way out is "Save and exit"; the wording never says "published".
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByTestId('wizard-done-primary')).toHaveTextContent('Salva ed esci');
    expect(document.body.textContent).not.toMatch(/pubblicat/i);
  });

  it('CalendarBulkPage_ApplyThatTheApiRefuses_KeepsTheWizardOnTheSummaryWithTheReason', { timeout: 30_000 }, async () => {
    vi.mocked(calendarChangesApi.apply).mockRejectedValue(problemError(403, { code: 'forbidden' }));
    renderPage();
    await toSummary();
    fireEvent.click(screen.getByTestId('bulk-wizard-apply'));

    expect(await screen.findByTestId('bulk-wizard-error', undefined, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('bulk-summary-step')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('bulk-wizard-apply')).toBeEnabled());
  });

  it('CalendarBulkPage_SaveAndExit_ReturnsToTheCalendar', { timeout: 30_000 }, async () => {
    renderPage();
    await screen.findAllByTestId('bulk-property', undefined, WAIT);
    fireEvent.click(screen.getByTestId('bulk-save-and-exit'));

    expect(await screen.findByText('calendar-page', undefined, WAIT)).toBeInTheDocument();
  });
});
