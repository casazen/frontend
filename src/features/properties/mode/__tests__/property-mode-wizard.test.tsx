import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { propertyModeApi } from '@/api/property-mode.api';
import { propertiesApi } from '@/api/properties.api';
import { expectNoAxeViolations } from '@/test/axe';
import { NOON_UTC, freezeClock } from '@/test/clock';
import { writeWizardDraft } from '@/lib/wizard-draft';
import type { Property } from '@/types';
import type { PropertyModeChange } from '@/types/property-mode.types';
import { LongRentPropertyModePage, ShortRentPropertyModePage } from '../property-mode-wizard-page';
import { PROPERTY_ID, TOMORROW, axiosError, blocker, change, preview, state } from './mode-fixtures';

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
const MODE_URL = (area: 'short-rent' | 'long-rent', search = '', id = PROPERTY_ID) => `/app/${area}/properties/${id}/mode${search}`;
const SCOPE = { userId: 'user-1', orgId: 'org-1' };

const property = (overrides: Partial<Property> = {}): Property =>
  ({ id: PROPERTY_ID, name: 'Villa Aurora', city: 'Roma', rentalMode: 'Short', ...overrides }) as Property;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

function renderPage(url: string, client = newClient()) {
  const view = render(
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
  return { ...view, client };
}

const next = () => fireEvent.click(screen.getByTestId('property-mode-next'));
const finish = () => fireEvent.click(screen.getByTestId('property-mode-finish'));

async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('property-mode-wizard')).toHaveAttribute('data-step', step), WAIT);
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
    vi.mocked(propertiesApi.getById).mockResolvedValue(property({ rentalMode: 'Long' }));
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state({ rentalMode: 'Long' }));
    renderPage(MODE_URL('long-rent', '?from=account'));
    await onStep('choice');

    // "Annulla" on the first step goes back to where the person began, and the draft is gone.
    fireEvent.click(screen.getByTestId('property-mode-exit'));
    await waitFor(() => expect(screen.getByTestId('account-list')).toBeInTheDocument(), WAIT);
    cleanup();

    renderPage(MODE_URL('long-rent', '?from=account'));
    await onStep('choice');
    next();
    await onStep('date');
    next();
    await onStep('checks');
    await waitFor(() => expect(screen.getByTestId('property-mode-checks-result')).toBeInTheDocument(), WAIT);
    next();
    await onStep('confirm');
    finish();

    expect(await screen.findByRole('heading', { level: 2, name: 'Passaggio programmato' }, WAIT)).toBeInTheDocument();
    // "Torna all'elenco" is the list of the account, not the one of the section; the step in the address keeps `from`.
    expect(screen.getByTestId('wizard-done-secondary')).toHaveAttribute('href', '/app/account/properties');
    expect(screen.getByTestId('wizard-done-primary')).toHaveAttribute('href', `/app/long-rent/properties/${PROPERTY_ID}`);
    expect(screen.getByTestId('location')).toHaveTextContent('from=account');
  });

  it('PropertyModeWizard_ThePropertyCannotBeRead_SaysWhyAndOffersToTryAgain', async () => {
    vi.mocked(propertyModeApi.getState).mockRejectedValue(axiosError(500, { title: 'Internal Server Error' }));
    renderPage(MODE_URL('short-rent'));

    const error = await screen.findByTestId('property-mode-load-error', undefined, WAIT);
    expect(error).toHaveTextContent(i18n.t('propertyMode.loadFailed'));
    expect(within(error).getByTestId('property-mode-load-error-back')).toHaveAttribute('href', '/app/short-rent/properties');

    vi.mocked(propertyModeApi.getState).mockResolvedValue(state());
    fireEvent.click(within(error).getByRole('button', { name: i18n.t('propertyMode.retry') }));
    await waitFor(() => expect(screen.getByTestId('short-detail')).toBeInTheDocument(), WAIT);
    expect(propertyModeApi.preview).not.toHaveBeenCalled();
  });

  it('PropertyModeWizard_AnUnknownProperty_IsNotFoundWithNoRetryButAWayBack', async () => {
    vi.mocked(propertiesApi.getById).mockRejectedValue(axiosError(404, { code: 'property_not_found' }));
    vi.mocked(propertyModeApi.getState).mockRejectedValue(axiosError(404, { code: 'property_not_found' }));
    renderPage(MODE_URL('short-rent', '?from=account'));

    const error = await screen.findByTestId('property-mode-load-error', undefined, WAIT);
    expect(error).toHaveTextContent(i18n.t('propertyMode.notFound'));
    expect(within(error).queryByRole('button')).not.toBeInTheDocument();
    // Every state has a way on: back to the list the person came from.
    expect(within(error).getByTestId('property-mode-load-error-back')).toHaveAttribute('href', '/app/account/properties');
  });

  it('PropertyModeWizard_English_UsesTheEnglishTexts', async () => {
    await i18n.changeLanguage('en');
    vi.mocked(propertiesApi.getById).mockResolvedValue(property({ rentalMode: 'Long' }));
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state({ rentalMode: 'Long' }));
    renderPage(MODE_URL('long-rent'));

    await onStep('choice');
    expect(screen.getByRole('heading', { level: 2, name: 'What do you want to do?' })).toBeInTheDocument();
    expect(screen.getByText('Switch to short-term rental')).toBeInTheDocument();
    expect(screen.getByTestId('property-mode-next')).toHaveTextContent('Choose the date');
  });
});

describe('Short-to-long conversion removed (#915)', () => {
  it.each(['', '?step=confirm', '?step=fatto', '?from=account&step=date'])('does not open a new conversion via direct URL %s', async (search) => {
    writeWizardDraft(`property-mode-${PROPERTY_ID}`, SCOPE, { step: 'confirm', values: { effectiveDate: TOMORROW, choice: true } });
    renderPage(MODE_URL('short-rent', search));
    await waitFor(() => expect(screen.getByTestId(search.includes('from=account') ? 'account-list' : 'short-detail')).toBeInTheDocument(), WAIT);
    expect(screen.queryByTestId('property-mode-wizard')).not.toBeInTheDocument();
    expect(propertyModeApi.preview).not.toHaveBeenCalled();
    expect(propertyModeApi.schedule).not.toHaveBeenCalled();
  });

  it('cannot start a short-to-long conversion through the long-rent URL', async () => {
    renderPage(MODE_URL('long-rent'));
    await waitFor(() => expect(screen.getByTestId('short-detail')).toBeInTheDocument(), WAIT);
    expect(propertyModeApi.preview).not.toHaveBeenCalled();
    expect(propertyModeApi.schedule).not.toHaveBeenCalled();
  });
});
