import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { propertyModeApi } from '@/api/property-mode.api';
import { propertiesApi } from '@/api/properties.api';
import { expectNoAxeViolations } from '@/test/axe';
import { NOON_UTC, freezeClock } from '@/test/clock';
import { readWizardDraft } from '@/lib/wizard-draft';
import type { Property } from '@/types';
import type {
  PropertyModeBlocker,
  PropertyModeChange,
  PropertyModePreview,
  PropertyModeState,
} from '@/types/property-mode.types';
import { LongRentPropertyModePage, ShortRentPropertyModePage } from '../property-mode-wizard-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/property-mode.api', () => ({
  propertyModeApi: { getState: vi.fn(), preview: vi.fn(), schedule: vi.fn(), cancel: vi.fn() },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getById: vi.fn() } }));

const WAIT = { timeout: 5000 };
const PROPERTY_ID = 'c0c1d2e3-0000-4000-8000-0000000000aa';
const MODE_URL = (area: 'short-rent' | 'long-rent', search = '') => `/app/${area}/properties/${PROPERTY_ID}/mode${search}`;

// The clock is fixed at noon of 24/09/2026 in UTC: 14:00 of the same day in Rome. Tomorrow is the 25th.
const TOMORROW = '2026-09-25';

const property = (overrides: Partial<Property> = {}): Property =>
  ({ id: PROPERTY_ID, name: 'Villa Aurora', city: 'Roma', rentalMode: 'Short', ...overrides }) as Property;

const state = (overrides: Partial<PropertyModeState> = {}): PropertyModeState => ({
  propertyId: PROPERTY_ID,
  rentalMode: 'Short',
  scheduledChange: null,
  lastChange: null,
  ...overrides,
});

const change = (overrides: Partial<PropertyModeChange> = {}): PropertyModeChange => ({
  id: 'c1',
  propertyId: PROPERTY_ID,
  fromMode: 'Short',
  toMode: 'Long',
  effectiveDate: '2026-12-01',
  status: 'Scheduled',
  createdAt: '2026-09-24T10:00:00Z',
  appliedAt: null,
  cancelledAt: null,
  failedAt: null,
  failureReason: null,
  ...overrides,
});

const blocker = (overrides: Partial<PropertyModeBlocker> = {}): PropertyModeBlocker => ({
  id: 'b1',
  kind: 'Stay',
  start: '2026-09-28',
  end: '2026-10-03',
  freeFrom: '2026-10-04',
  status: 'Confirmed',
  source: 'Direct',
  ...overrides,
});

const preview = (overrides: Partial<PropertyModePreview> = {}): PropertyModePreview => ({
  propertyId: PROPERTY_ID,
  currentMode: 'Short',
  targetMode: 'Long',
  today: '2026-09-24',
  earliestDate: TOMORROW,
  date: TOMORROW,
  canSchedule: true,
  issues: [],
  blockers: [],
  calendarClosedUntil: null,
  scheduledChange: null,
  ...overrides,
});

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <LocationProbe />
          <Routes>
            <Route path="/app/short-rent/properties/:id/mode" element={<ShortRentPropertyModePage />} />
            <Route path="/app/long-rent/properties/:id/mode" element={<LongRentPropertyModePage />} />
            <Route path="/app/short-rent/properties/:id" element={<div data-testid="short-detail" />} />
            <Route path="/app/long-rent/properties/:id" element={<div data-testid="long-detail" />} />
            <Route path="/app/account/properties" element={<div data-testid="account-list" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const next = () => fireEvent.click(screen.getByTestId('property-mode-next'));
const finish = () => fireEvent.click(screen.getByTestId('property-mode-finish'));

async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('property-mode-wizard')).toHaveAttribute('data-step', step), WAIT);
}

const setDate = (value: string) =>
  fireEvent.change(screen.getByTestId('property-mode-date'), { target: { value } });

/** Opens the wizard of a short-stay property that can go long-term at once, up to the "Date" step. */
async function openAtTheDateStep(url = MODE_URL('short-rent')) {
  renderPage(url);
  await onStep('choice');
  next();
  await onStep('date');
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  freezeClock(NOON_UTC);
  await i18n.changeLanguage('it');
  vi.mocked(propertiesApi.getById).mockResolvedValue(property());
  vi.mocked(propertyModeApi.getState).mockResolvedValue(state());
  vi.mocked(propertyModeApi.preview).mockImplementation(async (_id, to, date) =>
    preview({ targetMode: to, currentMode: to === 'Long' ? 'Short' : 'Long', date: date || TOMORROW }),
  );
  vi.mocked(propertyModeApi.schedule).mockImplementation(async (_id, dto) =>
    change({ toMode: dto.to, fromMode: dto.to === 'Long' ? 'Short' : 'Long', effectiveDate: dto.effectiveDate }),
  );
  vi.mocked(propertyModeApi.cancel).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PropertyModeWizard: from short stays to long-term (PM-03)', { timeout: 30000 }, () => {
  it('PropertyModeWizard_ShortToLong_WalksTheFourStepsAndProgramsTheChange', async () => {
    // The server keeps what it was told: after the change is programmed the state has it, as a refresh would show.
    let programmed: PropertyModeChange | null = null;
    vi.mocked(propertyModeApi.getState).mockImplementation(async () => state({ scheduledChange: programmed }));
    vi.mocked(propertyModeApi.schedule).mockImplementation(async (_id, dto) => {
      programmed = change({ effectiveDate: dto.effectiveDate });
      return programmed;
    });

    renderPage(MODE_URL('short-rent'));

    // 1. Choice: the one thing a property can do, already chosen, with a line on what changes.
    await onStep('choice');
    expect(screen.getByRole('heading', { level: 2, name: i18n.t('propertyMode.steps.choice.title') })).toBeInTheDocument();
    expect(screen.getByTestId('property-mode-choice')).toBeChecked();
    expect(screen.getByText(i18n.t('propertyMode.choice.toLong.title'))).toBeInTheDocument();
    expect(screen.getByTestId('property-mode-next')).toHaveTextContent(i18n.t('propertyMode.steps.choice.next'));
    // The server was asked what stands in the way of tomorrow, once, for the other mode.
    expect(propertyModeApi.preview).toHaveBeenCalledWith(PROPERTY_ID, 'Long', TOMORROW);
    next();

    // 2. Date: from the first possible day (tomorrow, nothing in the way), which says why.
    await onStep('date');
    const date = screen.getByTestId('property-mode-date');
    expect(date).toHaveValue(TOMORROW);
    expect(date).toHaveAttribute('min', TOMORROW);
    expect(date).toHaveAttribute('max', '2036-09-24');
    expect(screen.getByTestId('property-mode-date-reason')).toHaveTextContent(i18n.t('propertyMode.date.reason.freeToLong'));
    setDate('2026-10-01');
    next();

    // 3. Checks: the server looks at the chosen day and says yes.
    await onStep('checks');
    expect(await screen.findByTestId('property-mode-checks-result', undefined, WAIT)).toHaveTextContent('Tutto a posto per il 1 ottobre 2026');
    expect(propertyModeApi.preview).toHaveBeenCalledWith(PROPERTY_ID, 'Long', '2026-10-01');
    expect(screen.getByTestId('property-mode-check-passed')).toHaveTextContent('Nessun soggiorno o data occupata finisce il 1 ottobre 2026 o dopo.');
    await waitFor(() => expect(screen.getByTestId('property-mode-next')).toBeEnabled());
    next();

    // 4. Confirm: the answers (the day can be edited from here) and what the passage does, only true things.
    await onStep('confirm');
    const confirm = screen.getByTestId('property-mode-confirm');
    expect(within(confirm).getByText('Villa Aurora')).toBeInTheDocument();
    expect(within(confirm).getByText('Affitti brevi')).toBeInTheDocument();
    expect(within(confirm).getByText('Affitti lunghi')).toBeInTheDocument();
    expect(within(confirm).getByText('1 ottobre 2026')).toBeInTheDocument();
    expect(within(confirm).getAllByRole('link', { name: /^Modifica / })).toHaveLength(1);
    expect(confirm).toHaveTextContent('Da subito il sito e i portali non accettano più prenotazioni con partenza dal 1 ottobre 2026 in poi.');
    expect(confirm).toHaveTextContent("Dal 1 ottobre 2026 il sito di prenotazione non mostra più l'immobile.");
    expect(confirm).toHaveTextContent('Puoi annullare il passaggio fino al giorno prima.');
    expect(screen.getByTestId('property-mode-finish')).toHaveTextContent(i18n.t('propertyMode.finish.toLong'));
    expect(propertyModeApi.schedule).not.toHaveBeenCalled();
    finish();

    await waitFor(() => expect(propertyModeApi.schedule).toHaveBeenCalledWith(PROPERTY_ID, { to: 'Long', effectiveDate: '2026-10-01' }), WAIT);

    // What happens now: two ways on, the main one to the property (still in its section), the other to the list.
    expect(await screen.findByRole('heading', { level: 2, name: 'Passaggio programmato' }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: i18n.t('wizard.done.whatNext') })).toBeInTheDocument();
    expect(screen.getByText("«Villa Aurora» passerà all'affitto lungo il 1 ottobre 2026.")).toBeInTheDocument();
    expect(screen.getByText("Dal 1 ottobre 2026 l'immobile compare in Affitti lunghi e non è più in Affitti brevi.")).toBeInTheDocument();
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/short-rent/properties/${PROPERTY_ID}`);
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/short-rent/properties');
    expect(screen.getByTestId('property-mode-wizard')).toHaveAttribute('data-step', 'fatto');
    // The refreshed state now has the change, and the confirmation stays: it is not replaced by "already programmed".
    await waitFor(() => expect(vi.mocked(propertyModeApi.getState).mock.calls.length).toBeGreaterThan(1), WAIT);
    expect(screen.queryByTestId('property-mode-scheduled')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Passaggio programmato' })).toBeInTheDocument();
    // Nothing is left in the draft.
    expect(sessionStorage.length).toBe(0);
  });

  it('PropertyModeWizard_AStayInTheWay_SaysWhyTheFirstDayIsLaterAndHoldsTheDayToIt', async () => {
    vi.mocked(propertyModeApi.preview).mockImplementation(async (_id, to, date) =>
      preview({
        targetMode: to,
        date: date || TOMORROW,
        earliestDate: '2026-11-15',
        blockers: [blocker({ id: 's1', end: '2026-11-14', freeFrom: '2026-11-15' })],
        canSchedule: false,
        issues: ['property_mode_blocked_by_bookings'],
      }),
    );

    await openAtTheDateStep();

    // The field starts from the first day possible and does not go below it; the reason is the stay that frees the property last.
    const date = screen.getByTestId('property-mode-date');
    expect(date).toHaveValue('2026-11-15');
    expect(date).toHaveAttribute('min', '2026-11-15');
    expect(screen.getByTestId('property-mode-date-reason')).toHaveTextContent(
      "L'ultimo soggiorno finisce il 14 novembre 2026: il passaggio può partire dal giorno dopo, il 15 novembre 2026.",
    );
    expect(screen.queryByTestId('property-mode-use-earliest')).not.toBeInTheDocument();

    // A day before it does not pass: the wizard stays and says so.
    setDate('2026-10-01');
    expect(screen.getByTestId('property-mode-use-earliest')).toHaveTextContent('Usa il 15 novembre 2026');
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('propertyMode.errors.dateTooEarly'));
    await onStep('date');
    expect(propertyModeApi.preview).not.toHaveBeenCalledWith(PROPERTY_ID, 'Long', '2026-10-01');

    // Ten years ahead is the limit, too.
    setDate('2036-09-25');
    next();
    await waitFor(
      () => expect(screen.getByTestId('wizard-error-summary')).toHaveTextContent(i18n.t('propertyMode.errors.dateTooFar')),
      WAIT,
    );

    // The button puts the first day possible in the field.
    fireEvent.click(screen.getByTestId('property-mode-use-earliest'));
    expect(screen.getByTestId('property-mode-date')).toHaveValue('2026-11-15');
  });

  it('PropertyModeWizard_Obstacles_AreListedWithTheirActionAndHoldTheChecksStep', async () => {
    vi.mocked(propertyModeApi.preview).mockImplementation(async (_id, to, date) => {
      const day = date || TOMORROW;
      // Tomorrow is free for the date step; October 1st meets a stay and a portal block; the 4th is free.
      if (day === TOMORROW || day >= '2026-10-04') return preview({ targetMode: to, date: day });
      return preview({
        targetMode: to,
        date: day,
        earliestDate: '2026-10-04',
        canSchedule: false,
        issues: ['property_mode_blocked_by_bookings'],
        blockers: [
          blocker({ id: 'stay-1', kind: 'Stay', start: '2026-09-28', end: '2026-10-03', freeFrom: '2026-10-04', status: 'Confirmed' }),
          blocker({ id: 'block-1', kind: 'ImportedBlock', start: '2026-10-01', end: '2026-10-03', freeFrom: '2026-10-04', status: null, source: 'Airbnb' }),
        ],
      });
    });

    await openAtTheDateStep();
    setDate('2026-10-01');
    next();
    await onStep('checks');

    const result = await screen.findByTestId('property-mode-checks-result', undefined, WAIT);
    expect(result).toHaveTextContent('Il 1 ottobre 2026 non è possibile');
    // Each obstacle says what it is and where it is dealt with.
    const stay = screen.getByTestId('property-mode-blocker-Stay');
    expect(stay).toHaveTextContent('Soggiorno');
    expect(stay).toHaveTextContent('dal 28 settembre al 3 ottobre');
    expect(stay).toHaveTextContent('Confermata');
    expect(within(stay).getByTestId('property-mode-blocker-open-Stay')).toHaveAttribute('href', '/app/short-rent/bookings/stay-1');
    const portal = screen.getByTestId('property-mode-blocker-ImportedBlock');
    expect(within(portal).getByTestId('property-mode-blocker-open-ImportedBlock')).toHaveAttribute(
      'href',
      `/app/short-rent/properties/${PROPERTY_ID}?tab=ical`,
    );
    expect(result).toHaveTextContent(i18n.t('propertyMode.checks.bookings.portalHint'));

    // The wizard does not move on, and says why.
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('propertyMode.errors.checksFailed'));
    await onStep('checks');

    // One click puts the first free day in the field and the server checks it again.
    fireEvent.click(screen.getByTestId('property-mode-pick-earliest'));
    await waitFor(() => expect(propertyModeApi.preview).toHaveBeenCalledWith(PROPERTY_ID, 'Long', '2026-10-04'), WAIT);
    expect(await screen.findByText('Tutto a posto per il 4 ottobre 2026', undefined, WAIT)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('property-mode-checks-result')).toHaveTextContent('Tutto a posto per il 4 ottobre 2026'));
    next();
    await onStep('confirm');
    finish();
    await waitFor(() => expect(propertyModeApi.schedule).toHaveBeenCalledWith(PROPERTY_ID, { to: 'Long', effectiveDate: '2026-10-04' }), WAIT);
  });

  it('PropertyModeWizard_TheServerRefusesAtTheEnd_ShowsTheReasonOnTheLastStepAndProgramsNothing', async () => {
    vi.mocked(propertyModeApi.schedule).mockRejectedValue(
      axiosError(409, { code: 'property_mode_blocked_by_bookings', detail: 'Il testo del server' }),
    );

    await openAtTheDateStep();
    next();
    await onStep('checks');
    await waitFor(() => expect(screen.getByTestId('property-mode-checks-result')).toBeInTheDocument(), WAIT);
    await waitFor(() => expect(screen.getByTestId('property-mode-next')).toBeEnabled());
    next();
    await onStep('confirm');
    finish();

    // A booking came in while the person was reading: the translated reason is next to the button, the wizard stays.
    expect(await screen.findByTestId('property-mode-finish-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.propertyModeBlockedByBookings'),
    );
    await onStep('confirm');
    expect(screen.queryByRole('heading', { level: 2, name: 'Passaggio programmato' })).not.toBeInTheDocument();
  });

  it('PropertyModeWizard_TheChecksCannotBeRead_OffersToTryAgainAndNeverLetsGo', async () => {
    let failing = true;
    vi.mocked(propertyModeApi.preview).mockImplementation(async (_id, to, date) => {
      if (failing && date !== TOMORROW) throw axiosError(500, { title: 'Internal Server Error' });
      return preview({ targetMode: to, date: date || TOMORROW });
    });

    await openAtTheDateStep();
    setDate('2026-10-01');
    next();
    await onStep('checks');

    const error = await screen.findByTestId('property-mode-checks-error', undefined, WAIT);
    expect(error).toHaveTextContent(i18n.t('propertyMode.checks.loadFailed'));
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('propertyMode.errors.checksFailed'));

    failing = false;
    fireEvent.click(within(error).getByRole('button', { name: i18n.t('propertyMode.retry') }));
    expect(await screen.findByTestId('property-mode-checks-result', undefined, WAIT)).toHaveTextContent('Tutto a posto per il 1 ottobre 2026');
  });

  it('PropertyModeWizard_TheServerRefusesForAReasonItDoesNotKnow_SaysSoAndDoesNotLetGo', async () => {
    vi.mocked(propertyModeApi.preview).mockImplementation(async (_id, to, date) =>
      date === TOMORROW || !date
        ? preview({ targetMode: to })
        : preview({ targetMode: to, date, canSchedule: false, issues: ['property_mode_something_new'], blockers: [] }),
    );

    await openAtTheDateStep();
    setDate('2026-10-01');
    next();
    await onStep('checks');

    expect(await screen.findByTestId('property-mode-check-unexplained', undefined, WAIT)).toHaveTextContent(
      i18n.t('propertyMode.checks.unexplained'),
    );
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('propertyMode.errors.checksFailed'));
    await onStep('checks');
  });

  it('PropertyModeWizard_EveryScreen_HasNoAccessibilityViolationThatAxeCanFindWithoutABrowser', async () => {
    vi.mocked(propertyModeApi.preview).mockImplementation(async (_id, to, date) => {
      const day = date || TOMORROW;
      if (day === TOMORROW || day >= '2026-10-04') return preview({ targetMode: to, date: day });
      return preview({
        targetMode: to,
        date: day,
        earliestDate: '2026-10-04',
        canSchedule: false,
        issues: ['property_mode_blocked_by_bookings'],
        blockers: [blocker({ id: 'stay-1' }), blocker({ id: 'block-1', kind: 'ImportedBlock', status: null, source: 'Airbnb' })],
      });
    });
    const { container } = renderPage(MODE_URL('short-rent'));

    await onStep('choice');
    await expectNoAxeViolations(container);
    next();
    await onStep('date');
    await expectNoAxeViolations(container);
    // An error on the field, and the obstacles of the checks with their links.
    setDate('2026-09-20');
    fireEvent.blur(screen.getByTestId('property-mode-date'));
    await screen.findByText(i18n.t('propertyMode.errors.dateTooEarly'), undefined, WAIT);
    await expectNoAxeViolations(container);
    setDate('2026-10-01');
    next();
    await onStep('checks');
    await screen.findByTestId('property-mode-blockers', undefined, WAIT);
    await expectNoAxeViolations(container);
    fireEvent.click(screen.getByTestId('property-mode-pick-earliest'));
    await waitFor(() => expect(screen.getByTestId('property-mode-checks-result')).toHaveTextContent('Tutto a posto per il 4 ottobre 2026'), WAIT);
    next();
    await onStep('confirm');
    await expectNoAxeViolations(container);
    finish();
    await screen.findByRole('heading', { level: 2, name: 'Passaggio programmato' }, WAIT);
    await expectNoAxeViolations(container);
  });

  it('PropertyModeWizard_TheDraft_KeepsTheDayButNeverTheResultOfTheChecks', async () => {
    await openAtTheDateStep();
    setDate('2026-10-01');
    next();
    await onStep('checks');
    await waitFor(() => expect(screen.getByTestId('property-mode-checks-result')).toBeInTheDocument(), WAIT);

    await waitFor(() => {
      const draft = readWizardDraft(`property-mode-${PROPERTY_ID}`, { userId: 'user-1', orgId: 'org-1' });
      expect(draft?.step).toBe('checks');
      expect(draft?.values).toMatchObject({ target: 'Long', date: '2026-10-01' });
      expect(draft?.values).not.toHaveProperty('checksOk');
    }, WAIT);
  });
});

describe('PropertyModeWizard: from long-term leases to short stays (PM-03)', { timeout: 30000 }, () => {
  beforeEach(() => {
    vi.mocked(propertiesApi.getById).mockResolvedValue(property({ rentalMode: 'Long' }));
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state({ rentalMode: 'Long' }));
  });

  it('PropertyModeWizard_LongToShort_ALeaseAndADraft_AreExplainedWithTheirActions', async () => {
    vi.mocked(propertyModeApi.preview).mockImplementation(async (_id, to, date) => {
      const day = date || TOMORROW;
      const lease = blocker({ id: 'lease-1', kind: 'Lease', start: '2025-12-01', end: '2026-12-01', freeFrom: '2026-12-02', status: 'Registered' });
      const draft = blocker({ id: 'draft-1', kind: 'DraftLease', start: '2027-01-01', end: '2027-12-31', freeFrom: null, status: 'Draft' });
      if (day === TOMORROW) {
        return preview({ targetMode: to, currentMode: 'Long', date: day, earliestDate: '2026-12-02', canSchedule: false, issues: ['property_mode_blocked_by_lease', 'property_mode_blocked_by_draft_lease'], blockers: [lease, draft] });
      }
      return preview({ targetMode: to, currentMode: 'Long', date: day, earliestDate: '2026-12-02', canSchedule: false, issues: ['property_mode_blocked_by_draft_lease'], blockers: [draft] });
    });

    renderPage(MODE_URL('long-rent'));
    await onStep('choice');
    expect(screen.getByText(i18n.t('propertyMode.choice.toShort.title'))).toBeInTheDocument();
    expect(propertyModeApi.preview).toHaveBeenCalledWith(PROPERTY_ID, 'Short', TOMORROW);
    next();

    // The first day is the one after the lease ends, and the draft is named: no day frees it.
    await onStep('date');
    expect(screen.getByTestId('property-mode-date')).toHaveValue('2026-12-02');
    const reason = screen.getByTestId('property-mode-date-reason');
    expect(reason).toHaveTextContent('Il contratto finisce il 1 dicembre 2026: il passaggio può partire dal giorno dopo, il 2 dicembre 2026.');
    expect(reason).toHaveTextContent(i18n.t('propertyMode.date.reason.draft'));
    next();

    await onStep('checks');
    const drafts = await screen.findByTestId('property-mode-drafts', undefined, WAIT);
    expect(drafts).toHaveTextContent(i18n.t('propertyMode.checks.drafts.help'));
    expect(within(drafts).getByTestId('property-mode-blocker-open-DraftLease')).toHaveAttribute('href', '/app/long-rent/leases/draft-1');
    // The lease ends before the day: that check passes, the draft is the only thing left.
    expect(screen.getByTestId('property-mode-check-passed')).toHaveTextContent('Nessun contratto finisce il 2 dicembre 2026 o dopo.');
    next();
    expect(await screen.findByTestId('wizard-error-summary', undefined, WAIT)).toHaveTextContent(i18n.t('propertyMode.errors.checksFailed'));
    await onStep('checks');
  });

  it('PropertyModeWizard_LongToShort_ProgramsTheChangeBackToShortStays', async () => {
    renderPage(MODE_URL('long-rent'));
    await onStep('choice');
    next();
    await onStep('date');
    next();
    await onStep('checks');
    await waitFor(() => expect(screen.getByTestId('property-mode-checks-result')).toBeInTheDocument(), WAIT);
    await waitFor(() => expect(screen.getByTestId('property-mode-next')).toBeEnabled());
    next();
    await onStep('confirm');
    expect(screen.getByTestId('property-mode-confirm')).toHaveTextContent("Dal 25 settembre 2026 l'immobile esce da Affitti lunghi e compare in Affitti brevi.");
    expect(screen.getByTestId('property-mode-finish')).toHaveTextContent(i18n.t('propertyMode.finish.toShort'));
    finish();

    await waitFor(() => expect(propertyModeApi.schedule).toHaveBeenCalledWith(PROPERTY_ID, { to: 'Short', effectiveDate: TOMORROW }), WAIT);
    expect(await screen.findByRole('heading', { level: 2, name: 'Passaggio programmato' }, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/long-rent/properties/${PROPERTY_ID}`);
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/long-rent/properties');
  });
});

describe('PropertyModeWizard: a change already programmed (PM-03)', { timeout: 30000 }, () => {
  it('PropertyModeWizard_AChangeWaits_SaysSoAndWithdrawsItAfterAskingWhatItLeadsTo', async () => {
    let waiting: PropertyModeChange | null = change();
    vi.mocked(propertyModeApi.getState).mockImplementation(async () => state({ scheduledChange: waiting }));
    vi.mocked(propertyModeApi.cancel).mockImplementation(async () => {
      waiting = null;
    });

    const { container } = renderPage(MODE_URL('short-rent'));

    const panel = await screen.findByTestId('property-mode-scheduled', undefined, WAIT);
    await expectNoAxeViolations(container);
    expect(panel).toHaveTextContent("C'è già un passaggio in programma");
    expect(panel).toHaveTextContent("«Villa Aurora» passerà all'affitto lungo il 1 dicembre 2026.");
    // A property has one change at a time: no wizard to program a second one, and no request for a preview.
    expect(screen.queryByTestId('property-mode-wizard')).not.toBeInTheDocument();
    expect(propertyModeApi.preview).not.toHaveBeenCalled();
    expect(screen.getByTestId('property-mode-scheduled-back')).toHaveAttribute('href', `/app/short-rent/properties/${PROPERTY_ID}`);

    fireEvent.click(screen.getByTestId('property-mode-scheduled-cancel'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Annullare il passaggio all\'affitto lungo?')).toBeInTheDocument();
    const consequences = within(dialog).getByTestId('confirmation-consequences');
    expect(consequences).toHaveTextContent("L'immobile resta in Affitti brevi.");
    expect(consequences).toHaveTextContent('Il calendario si riapre');
    expect(propertyModeApi.cancel).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('propertyMode.cancel.action') }));
    await waitFor(() => expect(propertyModeApi.cancel).toHaveBeenCalledWith(PROPERTY_ID, 'c1'), WAIT);
    // It is withdrawn: the person goes back to the property.
    await waitFor(() => expect(screen.getByTestId('short-detail')).toBeInTheDocument(), WAIT);
  });

  it('PropertyModeWizard_TheLastScreenOpenedAgain_ShowsTheChangeThatWaitsOrLeavesForTheProperty', async () => {
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state({ scheduledChange: change() }));
    renderPage(MODE_URL('short-rent', '?step=fatto'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Passaggio programmato' }, WAIT)).toBeInTheDocument();
    expect(screen.getByText("«Villa Aurora» passerà all'affitto lungo il 1 dicembre 2026.")).toBeInTheDocument();
    // It does not wait for a second request: the screen is the state the server has.
    expect(propertyModeApi.preview).not.toHaveBeenCalled();
    cleanup();

    // With nothing programmed there is nothing to confirm: the page leads to the property.
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state());
    renderPage(MODE_URL('short-rent', '?step=fatto'));
    await waitFor(() => expect(screen.getByTestId('short-detail')).toBeInTheDocument(), WAIT);
  });
});

describe('PropertyModeWizard: where the person is and where they came from (PM-03)', { timeout: 30000 }, () => {
  it('PropertyModeWizard_ThePropertyIsInTheOtherSection_OpensTheWizardThereKeepingTheQuery', async () => {
    vi.mocked(propertiesApi.getById).mockResolvedValue(property({ rentalMode: 'Long' }));
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state({ rentalMode: 'Long' }));

    renderPage(MODE_URL('short-rent', '?from=account'));

    await onStep('choice');
    expect(screen.getByTestId('location')).toHaveTextContent(`/app/long-rent/properties/${PROPERTY_ID}/mode?from=account`);
    expect(screen.getByText(i18n.t('propertyMode.choice.toShort.title'))).toBeInTheDocument();
  });

  it('PropertyModeWizard_FromTheAccount_TheWayOutAndTheWayBackLeadToTheListOfTheAccount', async () => {
    renderPage(MODE_URL('short-rent', '?from=account'));
    await onStep('choice');

    // "Annulla" on the first step goes back to where the person began, and the draft is gone.
    fireEvent.click(screen.getByTestId('property-mode-exit'));
    await waitFor(() => expect(screen.getByTestId('account-list')).toBeInTheDocument(), WAIT);
    cleanup();

    renderPage(MODE_URL('short-rent', '?from=account'));
    await onStep('choice');
    next();
    await onStep('date');
    next();
    await onStep('checks');
    await waitFor(() => expect(screen.getByTestId('property-mode-checks-result')).toBeInTheDocument(), WAIT);
    await waitFor(() => expect(screen.getByTestId('property-mode-next')).toBeEnabled());
    next();
    await onStep('confirm');
    finish();

    expect(await screen.findByRole('heading', { level: 2, name: 'Passaggio programmato' }, WAIT)).toBeInTheDocument();
    // "Torna all'elenco" is the list of the account, not the one of the section; the step in the address keeps `from`.
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/account/properties');
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/short-rent/properties/${PROPERTY_ID}`);
    expect(screen.getByTestId('location')).toHaveTextContent('from=account');
  });

  it('PropertyModeWizard_ThePropertyCannotBeRead_SaysWhyAndOffersToTryAgain', async () => {
    vi.mocked(propertyModeApi.getState).mockRejectedValue(axiosError(500, { title: 'Internal Server Error' }));
    renderPage(MODE_URL('short-rent'));

    const error = await screen.findByTestId('property-mode-load-error', undefined, WAIT);
    expect(error).toHaveTextContent(i18n.t('propertyMode.loadFailed'));

    vi.mocked(propertyModeApi.getState).mockResolvedValue(state());
    fireEvent.click(within(error).getByRole('button', { name: i18n.t('propertyMode.retry') }));
    await onStep('choice');
  });

  it('PropertyModeWizard_AnUnknownProperty_IsNotFoundWithNoRetry', async () => {
    vi.mocked(propertiesApi.getById).mockRejectedValue(axiosError(404, { code: 'property_not_found' }));
    vi.mocked(propertyModeApi.getState).mockRejectedValue(axiosError(404, { code: 'property_not_found' }));
    renderPage(MODE_URL('short-rent'));

    const error = await screen.findByTestId('property-mode-load-error', undefined, WAIT);
    expect(error).toHaveTextContent(i18n.t('propertyMode.notFound'));
    expect(within(error).queryByRole('button')).not.toBeInTheDocument();
  });

  it('PropertyModeWizard_English_UsesTheEnglishTexts', async () => {
    await i18n.changeLanguage('en');
    renderPage(MODE_URL('short-rent'));

    await onStep('choice');
    expect(screen.getByRole('heading', { level: 2, name: 'What do you want to do?' })).toBeInTheDocument();
    expect(screen.getByText('Switch to long-term rental')).toBeInTheDocument();
    expect(screen.getByTestId('property-mode-next')).toHaveTextContent('Choose the date');
  });
});
