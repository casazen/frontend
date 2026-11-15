import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import type { CompanyTenantCase } from '@/types';
import { CompanyTenantCasesSection } from '../components/company-tenant-decision';

const api = vi.hoisted(() => ({ listCompanyTenantCases: vi.fn(), decide: vi.fn() }));

vi.mock('@/api/owner-tax-checks.api', () => ({ ownerTaxChecksApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

/**
 * The stay of a company tenant in the property of a private owner (E18/F01/US03/T01, NF-117, ⚖ I7): CasaZen never changes the regime of a stay by itself, a person decides, and the decision is recorded with its
 * regime and its reason. The dialog starts with no regime chosen, asks the reason, tells the two readings of the rule in plain words and shows nothing of the tenant.
 */

const FIRST = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const SECOND = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

const kase = (overrides: Partial<CompanyTenantCase> = {}): CompanyTenantCase => ({
  bookingId: FIRST,
  bookingCode: 'BK-1001',
  propertyId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  propertyName: 'Casa Lago',
  checkIn: '2026-10-10',
  checkOut: '2026-10-14',
  decision: null,
  decidedAt: null,
  decidedByUserId: null,
  ...overrides,
});

function Probe() {
  const location = useLocation();
  return createElement('output', { 'data-testid': 'address' }, location.search);
}

function renderSection(path = '/app/account/withholding', taxReportingExports = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(
      FeatureFlagsContext.Provider,
      { value: { flags: { ...DEFAULT_FEATURE_FLAGS, taxReportingExports }, isLoading: false } },
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(Routes, null, createElement(Route, { path: '/app/account/withholding', element: createElement('div', null, createElement(CompanyTenantCasesSection), createElement(Probe)) })),
        ),
      ),
    ),
  );
}

const problem = (status: number, code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code, ...extra } } });

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  api.listCompanyTenantCases.mockResolvedValue([
    kase({ bookingId: SECOND, bookingCode: 'BK-0900', decision: 'ShortLet', decidedAt: '2026-11-03T09:00:00Z', decidedByUserId: 'auth0|someone' }),
    kase(),
  ]);
});

afterEach(() => cleanup());

describe('the list of the stays of a company tenant', () => {
  it('CompanyTenant_WithTheFlagOff_NothingIsDrawnAndNothingIsAsked', () => {
    const { container } = renderSection('/app/account/withholding?decision=' + FIRST, false);

    expect(container.querySelector('[data-testid="tenant-cases"]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.listCompanyTenantCases).not.toHaveBeenCalled();
  });

  it('CompanyTenant_TheStaysWaitingForADecisionComeFirst_AndNeverTheTenant', async () => {
    renderSection();

    const rows = await screen.findAllByTestId('tenant-case');
    expect(rows.map((row) => row.getAttribute('data-decision'))).toEqual(['Pending', 'ShortLet']);
    expect(rows[0]).toHaveTextContent('BK-1001');
    expect(rows[0]).toHaveTextContent('Casa Lago');
    expect(rows[1]).toHaveTextContent(i18n.t('ownerAccounting.tenantDecision.regime.ShortLet.title'));
    // The id of the account that decided is an internal one, never shown.
    expect(screen.getByTestId('tenant-cases').textContent).not.toContain('auth0|someone');
  });

  it('CompanyTenant_WhenThereIsNoStayThatNeedsADecision_TheSectionIsNotThere', async () => {
    api.listCompanyTenantCases.mockResolvedValue([]);
    renderSection();

    await waitFor(() => expect(api.listCompanyTenantCases).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('tenant-cases')).toBeNull());
  });

  it('CompanyTenant_ARoleThatMayNotReadThem_IsToldSo_AndSeesNoList', async () => {
    api.listCompanyTenantCases.mockResolvedValue(null);
    renderSection();

    expect(await screen.findByTestId('tenant-cases-no-access')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-case')).toBeNull();
  });
});

describe('the decision is the person\'s: a regime nobody chose for them and a reason', () => {
  it('CompanyTenant_TheDialogTellsTheTwoReadings_AndStartsWithNoRegimeChosen', async () => {
    renderSection();

    fireEvent.click(await screen.findByTestId(`tenant-case-decide-${FIRST}`));

    const dialog = await screen.findByRole('dialog');
    expect(screen.getByTestId('address')).toHaveTextContent(`?decision=${FIRST}`);
    const readings = within(dialog).getByTestId('tenant-decision-readings');
    expect(readings).toHaveTextContent('24/E');
    expect(readings).toHaveTextContent('12395/2024');
    // No rate is written in it (the rate is the configuration's), and nothing is chosen for the person.
    expect(readings.textContent).not.toMatch(/%/);
    expect(within(dialog).getByTestId('tenant-decision-regime-ShortLet')).not.toBeChecked();
    expect(within(dialog).getByTestId('tenant-decision-regime-NotShortLet')).not.toBeChecked();
    expect(within(dialog).getByTestId('tenant-decision-confirm')).toBeDisabled();
  });

  it('CompanyTenant_TheRegimeAndTheReasonAreBothNeeded_AndTheReasonIsSentWithoutItsSpaces', async () => {
    api.decide.mockResolvedValue({ id: 'd-1', bookingId: FIRST, regime: 'NotShortLet', reason: 'x', decidedAt: '2026-11-15T09:00:00Z', decidedByUserId: 'u' });
    renderSection();
    fireEvent.click(await screen.findByTestId(`tenant-case-decide-${FIRST}`));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByTestId('tenant-decision-confirm');

    // A reason alone, or a regime alone, or a reason of spaces: nothing is sent.
    fireEvent.change(within(dialog).getByTestId('tenant-decision-reason'), { target: { value: '   ' } });
    fireEvent.click(within(dialog).getByTestId('tenant-decision-regime-NotShortLet'));
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('tenant-decision-reason'), { target: { value: '  Sentito il commercialista il 12/11  ' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(api.decide).toHaveBeenCalledTimes(1));
    expect(api.decide).toHaveBeenCalledWith({ bookingId: FIRST, regime: 'NotShortLet', reason: 'Sentito il commercialista il 12/11' });
    // Decided: the dialog is gone and the address is the page's again.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('address')).toHaveTextContent('');
    expect(screen.getByTestId('address').textContent).not.toContain('decision');
  });

  it('CompanyTenant_TheDialogOpensFromTheAddressOfTheTodo_OnTheStayItNames', async () => {
    renderSection(`/app/account/withholding?decision=${SECOND}`);

    const dialog = await screen.findByRole('dialog');
    // A stay already decided shows the decision in force: a new one replaces it and the first stays in the history.
    expect(await within(dialog).findByTestId('tenant-decision-current')).toHaveTextContent(i18n.t('ownerAccounting.tenantDecision.regime.ShortLet.title'));
    expect(within(dialog).getByTestId('tenant-decision-case')).toHaveTextContent('BK-0900');
  });

  it('CompanyTenant_AStayThatIsNotInTheList_IsToldGone_NeverAFormForAStayThatNeedsNone', async () => {
    renderSection('/app/account/withholding?decision=cccccccc-3333-4333-8333-cccccccccccc');

    expect(await screen.findByTestId('tenant-decision-gone')).toBeInTheDocument();
    expect(screen.queryByTestId('tenant-decision-form')).toBeNull();
    fireEvent.click(within(screen.getByTestId('tenant-decision-gone')).getByRole('button', { name: i18n.t('shared.close') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('CompanyTenant_ARefusalOfTheServer_IsToldInTheDialog_AndTheListIsReadAgain', async () => {
    api.decide.mockRejectedValue(problem(422, 'owner_tax_decision_not_applicable'));
    renderSection(`/app/account/withholding?decision=${FIRST}`);
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByTestId('tenant-decision-form');
    fireEvent.click(within(dialog).getByTestId('tenant-decision-regime-ShortLet'));
    fireEvent.change(within(dialog).getByTestId('tenant-decision-reason'), { target: { value: 'Resta una locazione breve' } });
    const reads = api.listCompanyTenantCases.mock.calls.length;

    fireEvent.click(within(dialog).getByTestId('tenant-decision-confirm'));

    expect(await within(dialog).findByTestId('tenant-decision-error')).toHaveTextContent(i18n.t('apiErrors.codes.ownerTaxDecisionNotApplicable'));
    await waitFor(() => expect(api.listCompanyTenantCases.mock.calls.length).toBeGreaterThan(reads));
  });
});
