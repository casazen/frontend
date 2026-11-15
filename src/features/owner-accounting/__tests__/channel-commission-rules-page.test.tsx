import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { ChannelCommissionRuleSet } from '@/types';
import { ChannelCommissionRulesPage } from '../channel-commission-rules-page';

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

/** Booking.com has a rule in force (15,5%), Airbnb only the default of the configuration, Vrbo nothing. */
const SET: ChannelCommissionRuleSet = {
  rules: [{ id: 'r-booking', channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: null, createdAt: '2026-01-01T00:00:00Z' }],
  channels: [
    { channel: 'Airbnb', percent: 15, base: 'GrossExclTouristTax', isDefault: true },
    { channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', isDefault: false, ruleId: 'r-booking', validFrom: '2026-01-01', validTo: null },
    { channel: 'Vrbo', percent: null, isDefault: false },
  ],
};

/** What the server answers once Booking.com has its new percent: the rule of before closed, the new one in force. */
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

/** What the server says to a refusal: the status and the problem with its code. */
const problem = (status: number, code: string) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code } } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(ChannelCommissionRulesPage))));
}

const box = (channel: string) => screen.getByTestId(`billing-commission-${channel}`);
const type = (channel: string, value: string) => fireEvent.change(box(channel), { target: { value } });

/** Presses «Salva»: the button is waited for until it can be pressed, never a fixed time. */
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
  // Permission: the rules are the whole organization's money. Nothing is read for anyone but the owner and the administrators, as the backend asks.
  it('ChannelCommissionRules_ForAnyoneButTheOwnerAndTheAdministrators_ReadsNothing_Test', async () => {
    workspace.contexts = [{ contextKey: 'account', roleKey: 'accountant' }];
    renderPage();

    expect(await screen.findByTestId('agency-admin-required')).toBeInTheDocument();
    expect(screen.queryByTestId('channel-rules-form')).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.save).not.toHaveBeenCalled();
  });

  // Money: a new percent closes the rule in force the day before and starts from today; what is only shown (the default of the configuration) is not made the agency's rule by saving another.
  it('ChannelCommissionRules_ANewPercentIsSavedAsTheWholeList_WithOnlyWhatWasTyped_Test', async () => {
    api.save.mockResolvedValue(SAVED);
    renderPage();

    await screen.findByTestId('channel-rules-form');
    expect(box('BookingCom')).toHaveValue('15.5');
    // Nothing changed yet: nothing to save, and the page says so.
    expect(screen.getByTestId('channel-rules-save')).toBeDisabled();
    expect(screen.getByText(text('ownerAccounting.channelRules.noChange'))).toBeInTheDocument();

    type('BookingCom', '16');
    await save();

    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
    const today = todayInRome();
    expect(api.save).toHaveBeenCalledWith([
      { channel: 'BookingCom', percent: 15.5, base: 'GrossExclTouristTax', validFrom: '2026-01-01', validTo: addDays(today, -1) },
      { channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', validFrom: today },
    ]);
    // The answer of the server is what the page shows now, and the editor is clean again.
    await waitFor(() => expect(box('BookingCom')).toHaveValue('16'));
    expect(toast.success).toHaveBeenCalledWith(text('ownerAccounting.channelRules.saved'));
    expect(screen.getByTestId('channel-rules-save')).toBeDisabled();
    expect(screen.queryByTestId('channel-rules-error')).toBeNull();
  });

  // Money / data: a rule that the statements already name cannot be changed. The refusal is said in words and nothing is told as saved.
  it('ChannelCommissionRules_ARuleTheStatementsAlreadyNameIsRefused_IsNeverToldAsSaved_Test', async () => {
    api.save.mockRejectedValue(problem(409, 'channel_commission_rule_in_use'));
    renderPage();

    await screen.findByTestId('channel-rules-form');
    type('BookingCom', '16');
    await save();

    expect(await screen.findByTestId('channel-rules-error')).toHaveTextContent(text('apiErrors.codes.channelCommissionRuleInUse'));
    expect(toast.success).not.toHaveBeenCalled();
    // What was typed is still there, to be changed or undone: the percent in force on the server is the one before.
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
