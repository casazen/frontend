import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import * as api from '@/api/billing-setup.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { useAgencyPlan } from '@/hooks/use-agency-plan';
import type { BillingSetup, ChannelCommissionRuleSet } from '@/types';
import { BILLING_SETUP_PATH } from '../billing-wizard-ids';
import { BillingWizardPage } from '../billing-wizard-page';
import { item, previewOf, section, setupOf, swissSetup } from './billing-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/billing-setup.api', () => ({
  getBillingSetup: vi.fn(),
  saveBillingSetupSection: vi.fn(),
  canChangeBillingSetup: vi.fn(),
  savePortalAccountSettings: vi.fn(),
  getChannelAccountHolders: vi.fn(),
  saveChannelAccountHolders: vi.fn(),
  getChannelCommissionRules: vi.fn(),
  saveChannelCommissionRules: vi.fn(),
  applyMandateTemplate: vi.fn(),
  getBillingPreview: vi.fn(),
}));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1', name: 'Casa Lugano SA' } }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const env = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  flags: {} as Record<string, boolean>,
  properties: [] as Array<{ id: string; name: string; city: string }>,
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ contexts: env.contexts, getDefaultRoute: (contextKey: string) => `/app/${contextKey}`, hasPermission: () => true }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true, ...env.flags }, isLoading: false }),
}));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: vi.fn() }));
vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({ data: env.properties, isPending: false, isError: false, error: null, refetch: vi.fn() }),
}));

vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };

const ADMIN = [{ contextKey: 'account', roleKey: 'org_owner' }];
const COLLABORATOR = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];

const RULES: ChannelCommissionRuleSet = {
  rules: [],
  channels: [
    { channel: 'Airbnb', percent: 15, base: 'GrossExclTouristTax', isDefault: true },
    { channel: 'BookingCom', percent: 16, base: 'GrossExclTouristTax', isDefault: true },
  ],
};

function agencySetup(): BillingSetup {
  return setupOf(
    swissSetup().sections.map((entry) => {
      if (entry.section === 'channels') return section('channels', {}, [item('channel_commissions_unconfirmed', 'channels', 'unconfirmed')]);
      if (entry.section === 'mandates') return section('mandates', {}, [item('owners_without_mandate', 'mandates', 'required', 3)]);
      return entry;
    }),
  );
}

function renderWizard(step: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`${BILLING_SETUP_PATH}?step=${step}`] },
        createElement(Routes, null, createElement(Route, { path: BILLING_SETUP_PATH, element: createElement(BillingWizardPage) })),
      ),
    ),
  );
}

const wizard = () => screen.getByTestId('fiscal-billing-wizard');

async function onStep(step: string) {
  await waitFor(() => expect(wizard()).toHaveAttribute('data-step', step), WAIT);
}

async function next() {
  await waitFor(() => expect(screen.getByTestId('fiscal-billing-next')).toBeEnabled(), WAIT);
  fireEvent.click(screen.getByTestId('fiscal-billing-next'));
}

async function expectNoAgencyAtAll(step: string) {
  await onStep(step);
  expect(wizard()).not.toHaveAttribute('data-step', 'channels');
  expect(screen.queryByText(i18n.t('billingWizard.steps.channels.label'))).not.toBeInTheDocument();
  expect(screen.queryByText(i18n.t('billingWizard.steps.mandate.label'))).not.toBeInTheDocument();
  expect(api.getChannelCommissionRules).not.toHaveBeenCalled();
  expect(api.getChannelAccountHolders).not.toHaveBeenCalled();
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  env.contexts = ADMIN;
  env.flags = { agencyTier: true };
  env.properties = [
    { id: 'p1', name: 'Casa 1', city: 'Milano' },
    { id: 'p2', name: 'Casa 2', city: 'Roma' },
  ];
  vi.mocked(useAgencyPlan).mockReturnValue({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() });
  vi.mocked(api.getBillingSetup).mockResolvedValue(agencySetup());
  vi.mocked(api.getBillingPreview).mockResolvedValue(previewOf(undefined));
  vi.mocked(api.canChangeBillingSetup).mockResolvedValue(true);
  vi.mocked(api.saveBillingSetupSection).mockImplementation(async (name) => section(name, {}));
  vi.mocked(api.getChannelCommissionRules).mockResolvedValue(RULES);
  vi.mocked(api.getChannelAccountHolders).mockResolvedValue([]);
  vi.mocked(api.saveChannelAccountHolders).mockResolvedValue([]);
  vi.mocked(api.savePortalAccountSettings).mockResolvedValue(section('channels', {}));
  vi.mocked(api.saveChannelCommissionRules).mockResolvedValue(RULES);
  vi.mocked(api.applyMandateTemplate).mockResolvedValue({ created: 3, skipped: 0, createdOwnerIds: [], skippedOwnerIds: [] });
});

afterEach(() => {
  cleanup();
});

describe('the steps of the agency are only for the administrator of an organization on the agency plan (E11/F02/US01/T01)', () => {
  it('BillingWizard_ACollaboratorOfAnAgency_HasNoStepOfThePortalsOrOfTheMandateAndAsksNothingOfTheAgency', async () => {
    env.contexts = COLLABORATOR;
    renderWizard('channels');

    await expectNoAgencyAtAll('tourist-tax');
    expect(useAgencyPlan).not.toHaveBeenCalled();
  });

  it('BillingWizard_AnAdministratorWithTheAgencyTierOff_HasNoStepOfTheAgencyAndDoesNotEvenAskThePlan', async () => {
    env.flags = { agencyTier: false };
    renderWizard('mandate');

    await expectNoAgencyAtAll('tourist-tax');
    expect(useAgencyPlan).not.toHaveBeenCalled();
  });

  it('BillingWizard_AnAdministratorOfAnOrganizationThatIsNotOnTheAgencyPlan_HasNoStepOfTheAgencyAndAsksNothingOfIt', async () => {
    vi.mocked(useAgencyPlan).mockReturnValue({ isAgency: false, isLoading: false, failed: false, retry: vi.fn() });
    renderWizard('channels');

    await expectNoAgencyAtAll('tourist-tax');
    expect(useAgencyPlan).toHaveBeenCalled();
  });

  it('BillingWizard_AnAdministratorOfAnAgency_HasTheStepsOfThePortalsAndOfTheMandateInTheirPlace', async () => {
    renderWizard('channels');
    await onStep('channels');

    expect(screen.getAllByText(i18n.t('billingWizard.steps.mandate.label')).length).toBeGreaterThan(0);
    await waitFor(() => expect(api.getChannelCommissionRules).toHaveBeenCalled(), WAIT);
  });
});

describe('the account holders of the portals follow the flag ownerInvoicing (E14/F01/US01/T01)', () => {
  it('BillingWizard_ChannelsStepWithOwnerInvoicingOff_AsksNoHolderAndSavesOnlyTheCommissionsOnContinua', async () => {
    renderWizard('channels');
    await onStep('channels');

    expect(await screen.findByTestId('billing-holders-unavailable')).toHaveTextContent(i18n.t('billingWizard.channels.holder.unavailable'));
    expect(screen.queryByTestId('billing-holders')).not.toBeInTheDocument();
    expect(await screen.findByTestId('billing-commissions')).toBeInTheDocument();

    await next();
    await onStep('mandate');

    expect(api.saveChannelCommissionRules).toHaveBeenCalledTimes(1);
    const rules = vi.mocked(api.saveChannelCommissionRules).mock.calls[0][0];
    expect(rules.map((rule) => [rule.channel, rule.percent])).toEqual([
      ['Airbnb', 15],
      ['BookingCom', 16],
    ]);
    expect(api.getChannelAccountHolders).not.toHaveBeenCalled();
    expect(api.savePortalAccountSettings).not.toHaveBeenCalled();
    expect(api.saveChannelAccountHolders).not.toHaveBeenCalled();
  });

  it('BillingWizard_ChannelsStepWithOwnerInvoicingOn_AsksTheHoldersAndSavesThemWithTheCommissionsOnContinua', async () => {
    env.flags = { agencyTier: true, ownerInvoicing: true };
    renderWizard('channels');
    await onStep('channels');

    expect(await screen.findByTestId('billing-holders-table')).toBeInTheDocument();
    expect(api.getChannelAccountHolders).toHaveBeenCalled();
    expect(screen.queryByTestId('billing-holders-unavailable')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('billing-holder-p1-Airbnb'), { target: { value: 'Agency' } });
    await next();
    await onStep('mandate');

    expect(api.savePortalAccountSettings).toHaveBeenCalledTimes(1);
    expect(api.savePortalAccountSettings).toHaveBeenCalledWith({ portalAccountHolder: 'Owner', rechargePortalCommissions: true });
    expect(api.saveChannelAccountHolders).toHaveBeenCalledTimes(1);
    expect(api.saveChannelAccountHolders).toHaveBeenCalledWith([{ propertyId: 'p1', channel: 'Airbnb', holder: 'Agency' }]);
    expect(api.saveChannelCommissionRules).toHaveBeenCalledTimes(1);
  });
});

describe('the standard mandate is applied by its own action and never by «Continua» (E13/F01/US01/T01)', () => {
  it('BillingWizard_MandateStep_ApplyingNeedsTheConfirmationAndContinuaNeverApplies', async () => {
    renderWizard('mandate');
    await onStep('mandate');

    expect(await screen.findByTestId('billing-mandate-count')).toHaveTextContent(i18n.t('billingWizard.mandate.apply.withoutMandate', { count: 3 }));
    fireEvent.change(screen.getByTestId('billing-mandate-percent'), { target: { value: '20' } });

    await waitFor(() => expect(screen.getByTestId('billing-mandate-apply-button')).toBeEnabled(), WAIT);
    fireEvent.click(screen.getByTestId('billing-mandate-apply-button'));
    expect(await screen.findByTestId('billing-mandate-confirm')).toBeInTheDocument();
    expect(api.applyMandateTemplate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('billing-mandate-confirm-yes'));
    await waitFor(() => expect(api.applyMandateTemplate).toHaveBeenCalledTimes(1), WAIT);
    expect(vi.mocked(api.applyMandateTemplate).mock.calls[0][0]).toMatchObject({ commissionPercent: 20, commissionBase: 'GrossExclTouristTax', commissionIncludesVat: false });
    expect(await screen.findByTestId('billing-mandate-result')).toHaveTextContent(i18n.t('billingWizard.mandate.apply.result', { count: 3, skipped: 0 }));

    await next();
    await onStep('issuing');
    expect(api.applyMandateTemplate).toHaveBeenCalledTimes(1);
  });

  it('BillingWizard_MandateStep_ContinuaWithAFilledFormButNoActionAppliesNothing', async () => {
    renderWizard('mandate');
    await onStep('mandate');
    fireEvent.change(await screen.findByTestId('billing-mandate-percent'), { target: { value: '20' } });

    await next();
    await onStep('issuing');

    expect(api.applyMandateTemplate).not.toHaveBeenCalled();
  });
});

async function saveAndExit() {
  await waitFor(() => expect(screen.getByTestId('billing-save-exit')).toBeEnabled(), WAIT);
  fireEvent.click(screen.getByTestId('billing-save-exit'));
}

describe('«Salva ed esci» on the steps of the agency says what it kept (E11/F02/US01/T01)', () => {
  it('SaveAndExit_MandateStepWithTheTermsWritten_SaysTheyAreNotSavedFromHereAndAppliesNothing', async () => {
    renderWizard('mandate');
    await onStep('mandate');
    fireEvent.change(await screen.findByTestId('billing-mandate-percent'), { target: { value: '20' } });

    await saveAndExit();

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(i18n.t('billingWizard.exit.mandateNotSaved')), WAIT);
    expect(toast.success).not.toHaveBeenCalled();
    expect(api.applyMandateTemplate).not.toHaveBeenCalled();
    expect(api.saveBillingSetupSection).not.toHaveBeenCalled();
  });

  it('SaveAndExit_ChannelsStepWithAPercentThatIsNotOne_IsNeverToldSavedAndNothingIsSent', async () => {
    renderWizard('channels');
    await onStep('channels');
    await screen.findByTestId('billing-commissions');
    fireEvent.change(screen.getByTestId('billing-commission-Airbnb'), { target: { value: 'abc' } });

    await saveAndExit();

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(i18n.t('billingWizard.exit.notSaved')), WAIT);
    expect(toast.success).not.toHaveBeenCalled();
    expect(api.saveChannelCommissionRules).not.toHaveBeenCalled();
  });

  it('SaveAndExit_ChannelsStepWithAValidPercentAndOneThatIsNot_KeepsTheValidOneOnlyAndSaysTheRestWasLeftOut', async () => {
    renderWizard('channels');
    await onStep('channels');
    await screen.findByTestId('billing-commissions');
    fireEvent.change(screen.getByTestId('billing-commission-Airbnb'), { target: { value: '16' } });
    fireEvent.change(screen.getByTestId('billing-commission-BookingCom'), { target: { value: 'abc' } });

    await saveAndExit();

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(i18n.t('billingWizard.exit.savedPartly')), WAIT);
    expect(api.saveChannelCommissionRules).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.saveChannelCommissionRules).mock.calls[0][0].map((rule) => [rule.channel, rule.percent])).toEqual([['Airbnb', 16]]);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
