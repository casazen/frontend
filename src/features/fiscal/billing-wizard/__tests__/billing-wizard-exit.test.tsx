import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import * as api from '@/api/billing-setup.api';
import { BILLING_SETUP_PATH, FISCAL_PATH } from '../billing-wizard-ids';
import { BillingWizardPage } from '../billing-wizard-page';
import { previewOf, section, swissSetup } from './billing-fixtures';

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

const workspace = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  getDefaultRoute: (contextKey: string) => `/app/${contextKey}`,
  hasPermission: (() => true) as (context: string, permission: string) => boolean,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };

function renderWizard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`${BILLING_SETUP_PATH}?step=issuer`] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: BILLING_SETUP_PATH, element: createElement(BillingWizardPage) }),
          createElement(Route, { path: FISCAL_PATH, element: createElement('div', { 'data-testid': 'fiscal-home' }) }),
        ),
      ),
    ),
  );
}

async function saveAndExit() {
  await waitFor(() => expect(screen.getByTestId('billing-save-exit')).toBeEnabled(), WAIT);
  fireEvent.click(screen.getByTestId('billing-save-exit'));
  await screen.findByTestId('fiscal-home', undefined, WAIT);
}

const write = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  workspace.contexts = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];
  workspace.hasPermission = () => true;
  vi.mocked(api.getBillingSetup).mockResolvedValue(swissSetup());
  vi.mocked(api.getBillingPreview).mockResolvedValue(previewOf(undefined));
  vi.mocked(api.canChangeBillingSetup).mockResolvedValue(true);
  vi.mocked(api.saveBillingSetupSection).mockImplementation(async (name) => section(name, {}));
});

afterEach(() => {
  cleanup();
});

// «Salva ed esci» keeps what is valid and changed, and nothing else: so the word «Salvato» is for what is true. Part of the input that was left out (not valid) is told as left out,
// and a draft that had nothing to send says there was nothing new, instead of the same «Salvato» for all of it.
describe('«Salva ed esci» says what it kept (E11/F02/US01/T01)', () => {
  it('SaveAndExit_AllThatWasWrittenIsValid_IsToldSavedAndOnlyTheChangedFieldIsSent', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByTestId('billing-legal-name')).toBeEnabled(), WAIT);

    write('billing-legal-name', 'Casa Lugano 2 SA');
    await saveAndExit();

    expect(api.saveBillingSetupSection).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.saveBillingSetupSection).mock.calls[0]).toEqual(['issuer', { legalName: 'Casa Lugano 2 SA' }]);
    expect(toast.success).toHaveBeenCalledWith(i18n.t('billingWizard.exit.saved'));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('SaveAndExit_PartOfWhatWasWrittenIsNotValid_KeepsTheValidPartAndSaysTheRestWasLeftOut', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByTestId('billing-legal-name')).toBeEnabled(), WAIT);

    write('billing-legal-name', 'Casa Lugano 2 SA');
    write('billing-postal-code', '69');
    await saveAndExit();

    expect(vi.mocked(api.saveBillingSetupSection).mock.calls[0]).toEqual(['issuer', { legalName: 'Casa Lugano 2 SA' }]);
    expect(toast.warning).toHaveBeenCalledWith(i18n.t('billingWizard.exit.savedPartly'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('SaveAndExit_WhatWasWrittenIsNotValidAtAll_IsNeverToldSavedAndNothingIsSent', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByTestId('billing-postal-code')).toBeEnabled(), WAIT);

    write('billing-postal-code', '69');
    await saveAndExit();

    expect(api.saveBillingSetupSection).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(i18n.t('billingWizard.exit.notSaved'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('SaveAndExit_NothingWasChanged_SaysThereWasNothingNewAndSendsNothing', async () => {
    renderWizard();
    await waitFor(() => expect(screen.getByTestId('billing-legal-name')).toBeEnabled(), WAIT);

    await saveAndExit();

    expect(api.saveBillingSetupSection).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(i18n.t('billingWizard.exit.nothingNew'));
    expect(toast.warning).not.toHaveBeenCalled();
  });
});
