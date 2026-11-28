import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { addDays, formatStayDate, todayInRome } from '@/lib/stay-dates';
import type { ChannelCommissionRuleSet } from '@/types';
import { ChannelCommissionRulesPage } from '../channel-commission-rules-page';
import { defaultPeriod, startOfPeriod } from '../owner-accounting-model';

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/api/billing-setup.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/billing-setup.api')>()),
  getChannelCommissionRules: api.get,
  saveChannelCommissionRules: api.save,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

const SET: ChannelCommissionRuleSet = {
  rules: [{ id: 'r-booking', channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: null, createdAt: '2026-01-01T00:00:00Z' }],
  channels: [
    { channel: 'Airbnb', percent: 15, base: 'GrossExclTouristTax', isDefault: true },
    { channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', isDefault: false, ruleId: 'r-booking', validFrom: '2026-01-01', validTo: null },
    { channel: 'Vrbo', percent: null, isDefault: false },
  ],
};

const SAVED: ChannelCommissionRuleSet = {
  rules: [
    { ...SET.rules[0], validTo: addDays(todayInRome(), -1) },
    { id: 'r-booking-2', channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', validFrom: todayInRome(), validTo: null, createdAt: '2026-11-15T09:00:00Z' },
  ],
  channels: [
    { channel: 'Airbnb', percent: 15, base: 'GrossExclTouristTax', isDefault: true },
    { channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', isDefault: false, ruleId: 'r-booking-2', validFrom: todayInRome(), validTo: null },
    { channel: 'Vrbo', percent: null, isDefault: false },
  ],
};

const problem = (status: number, code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code, ...extra } } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(ChannelCommissionRulesPage))));
}

const box = (channel: string) => screen.getByTestId(`billing-commission-${channel}`);
const type = (channel: string, value: string) => fireEvent.change(box(channel), { target: { value } });
const chooseFrom = (day: string) => fireEvent.change(screen.getByTestId('channel-rules-from'), { target: { value: day } });

async function save() {
  const button = screen.getByTestId('channel-rules-save');
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

beforeEach(async () => {
  vi.resetAllMocks();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  await i18n.changeLanguage('it');
  api.get.mockResolvedValue(SET);
});

afterEach(() => cleanup());

describe('the channel commissions of the agency, after the setup (E13/F02/US03/T01, NF-115, ⚖ R2)', () => {
  it('ChannelCommissionRules_ForAnyoneButTheOwnerAndTheAdministrators_ReadsNothing_Test', async () => {
    workspace.contexts = [{ contextKey: 'account', roleKey: 'accountant' }];
    renderPage();

    expect(await screen.findByTestId('agency-admin-required')).toBeInTheDocument();
    expect(screen.queryByTestId('channel-rules-form')).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('ChannelCommissionRules_ANewPercentIsSavedAsTheWholeList_WithOnlyWhatWasTyped_Test', async () => {
    api.save.mockResolvedValue(SAVED);
    renderPage();

    await screen.findByTestId('channel-rules-form');
    expect(box('BookingCom')).toHaveValue('15.5');
    expect(screen.getByTestId('channel-rules-save')).toBeDisabled();
    expect(screen.getByText(text('ownerAccounting.channelRules.noChange'))).toBeInTheDocument();

    type('BookingCom', '16');
    chooseFrom('2026-10-01');
    await save();

    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    expect(api.save).toHaveBeenCalledWith([
      { channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: '2026-09-30' },
      { channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', validFrom: '2026-10-01' },
    ]);
    await waitFor(() => expect(box('BookingCom')).toHaveValue('16'));
    expect(toast.success).toHaveBeenCalledWith(text('ownerAccounting.channelRules.saved', { date: formatStayDate('2026-10-01', 'it-IT') }));
    expect(screen.getByTestId('channel-rules-save')).toBeDisabled();
    expect(screen.queryByTestId('channel-rules-error')).toBeNull();
  });

  it('ChannelCommissionRules_TheDayTheyStartFromIsTheFirstDayOfTheMonthToClose_AndTheOneChosenIsTheOneSaved_Test', async () => {
    api.save.mockResolvedValue(SAVED);
    renderPage();

    await screen.findByTestId('channel-rules-form');
    expect(screen.getByTestId('channel-rules-from')).toHaveValue(startOfPeriod(defaultPeriod(todayInRome())));

    chooseFrom('2026-10-01');
    type('Vrbo', '8');
    await save();

    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    expect(api.save).toHaveBeenCalledWith([
      { channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: null },
      { channel: 'Vrbo', percent: 8, validFrom: '2026-10-01' },
    ]);
  });

  it('ChannelCommissionRules_ARuleInForceThatStartsAfterTheChosenDay_RefusesTheDay_AndSendsNothing_Test', async () => {
    const LATE: ChannelCommissionRuleSet = {
      rules: [{ ...SET.rules[0], validFrom: '2026-11-05' }],
      channels: [SET.channels[0], { ...SET.channels[1], validFrom: '2026-11-05' }, SET.channels[2]],
    };
    api.get.mockResolvedValue(LATE);
    api.save.mockResolvedValue(SAVED);
    renderPage();

    await screen.findByTestId('channel-rules-form');
    type('BookingCom', '16');
    chooseFrom('2026-11-01');

    expect(await screen.findByText(text('ownerAccounting.channelRules.fromTooEarly', { date: formatStayDate('2026-11-05', 'it-IT') }))).toBeInTheDocument();
    expect(screen.getByTestId('channel-rules-save')).toBeDisabled();
    expect(api.save).not.toHaveBeenCalled();

    chooseFrom('2026-11-05');
    await save();
    await waitFor(() => expect(api.save).toHaveBeenCalledWith([{ channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', validFrom: '2026-11-05', validTo: null }]));
  });

  it('ChannelCommissionRules_NoDayToStartFrom_IsRefusedOnTheFieldAndNothingIsSent', async () => {
    renderPage();

    await screen.findByTestId('channel-rules-form');
    type('Vrbo', '8');
    chooseFrom('');

    expect(await screen.findByText(text('ownerAccounting.channelRules.fromInvalid'))).toBeInTheDocument();
    expect(screen.getByTestId('channel-rules-save')).toBeDisabled();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('ChannelCommissionRules_ADayThatFallsOnAnotherRuleOfThePortal_IsSaidAsTheDay_NeverAsSaved_Test', async () => {
    api.save.mockRejectedValue(problem(422, 'channel_commission_rules_invalid', { field: 'validFrom', index: 1 }));
    renderPage();

    await screen.findByTestId('channel-rules-form');
    chooseFrom('2026-10-01');
    type('Vrbo', '8');
    await save();

    expect(await screen.findByTestId('channel-rules-error')).toHaveTextContent(text('ownerAccounting.channelRules.fromOverlap'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('ChannelCommissionRules_ARuleTheStatementsAlreadyNameIsRefused_IsNeverToldAsSaved_Test', async () => {
    api.save.mockRejectedValue(problem(409, 'channel_commission_rule_in_use'));
    renderPage();

    await screen.findByTestId('channel-rules-form');
    type('BookingCom', '16');
    chooseFrom('2026-10-01');
    await save();

    expect(await screen.findByTestId('channel-rules-error')).toHaveTextContent(text('apiErrors.codes.channelCommissionRuleInUse'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(box('BookingCom')).toHaveValue('16');
    await waitFor(() => expect(screen.getByTestId('channel-rules-save')).toBeEnabled());
  });

  it('ChannelCommissionRules_APercentThatIsNotOne_IsRefusedOnTheFieldAndNothingIsSent', async () => {
    renderPage();

    await screen.findByTestId('channel-rules-form');
    type('Vrbo', '150');

    expect(await screen.findByText(text('billingWizard.errors.percent'))).toBeInTheDocument();
    expect(screen.getByTestId('channel-rules-save')).toBeDisabled();
    type('Vrbo', '8');
    await waitFor(() => expect(screen.getByTestId('channel-rules-save')).toBeEnabled());
    expect(api.save).not.toHaveBeenCalled();
  });

  it('ChannelCommissionRules_ALoadThatFails_IsAFailureWithAWayToTryAgain_NeverAnEmptyEditor', async () => {
    api.get.mockRejectedValueOnce(problem(500, 'server_error')).mockResolvedValue(SET);
    renderPage();

    expect(await screen.findByTestId('owner-accounting-error')).toHaveTextContent(text('ownerAccounting.channelRules.loadError'));
    expect(screen.queryByTestId('channel-rules-form')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: text('shared.errorState.retry') }));

    expect(await screen.findByTestId('channel-rules-form')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-accounting-error')).toBeNull();
  });
});
