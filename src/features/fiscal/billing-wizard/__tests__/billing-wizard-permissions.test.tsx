import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import * as api from '@/api/billing-setup.api';
import { BILLING_SETUP_PATH } from '../billing-wizard-ids';
import { BillingWizardPage } from '../billing-wizard-page';
import { previewOf, section, setupOf, swissSetup } from './billing-fixtures';

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

function renderWizard(url: string = `${BILLING_SETUP_PATH}?step=issuer`) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [url] },
        createElement(Routes, null, createElement(Route, { path: BILLING_SETUP_PATH, element: createElement(BillingWizardPage) })),
      ),
    ),
  );
}

const wizard = () => screen.getByTestId('fiscal-billing-wizard');
const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

async function onStep(step: string) {
  await waitFor(() => expect(wizard()).toHaveAttribute('data-step', step), WAIT);
}

async function next() {
  await waitFor(() => expect(screen.getByTestId('fiscal-billing-next')).toBeEnabled(), WAIT);
  fireEvent.click(screen.getByTestId('fiscal-billing-next'));
}

function fieldsOfTheStep(step: string): HTMLElement[] {
  return Array.from(screen.getByTestId(`billing-step-${step}`).querySelectorAll<HTMLElement>('input, select, textarea, button'));
}

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

describe('the wizard «Fatturazione» is read-only for who may not change the setup (E11/F02/US01/T01)', () => {
  it('BillingWizard_PartialScopeUser_HasNoEditableFieldInAnyStepAndSendsNothing', async () => {
    vi.mocked(api.canChangeBillingSetup).mockResolvedValue(false);
    renderWizard();
    await onStep('issuer');

    expect(screen.getByTestId('billing-read-only')).toHaveTextContent(text('billingWizard.readOnly.partialScope'));
    const fields = fieldsOfTheStep('issuer');
    expect(fields.filter((field) => field.tagName === 'INPUT').length).toBeGreaterThan(5);
    for (const field of fields) expect(field, field.getAttribute('data-testid') ?? field.tagName).toBeDisabled();

    await next();
    await onStep('vat');
    expect(fieldsOfTheStep('vat').length).toBeGreaterThan(0);
    for (const field of fieldsOfTheStep('vat')) expect(field, field.getAttribute('data-testid') ?? field.tagName).toBeDisabled();
    expect(api.saveBillingSetupSection).not.toHaveBeenCalled();
    expect(api.savePortalAccountSettings).not.toHaveBeenCalled();
  });

  it('BillingWizard_UserWithoutWritePermission_IsReadOnlyWithItsReasonAndTheReachIsNotEvenAsked', async () => {
    workspace.hasPermission = (_context, permission) => permission !== 'property.write';
    renderWizard();
    await onStep('issuer');

    expect(screen.getByTestId('billing-read-only')).toHaveTextContent(text('billingWizard.readOnly.noPermission'));
    for (const field of fieldsOfTheStep('issuer')) expect(field, field.getAttribute('data-testid') ?? field.tagName).toBeDisabled();
    expect(api.canChangeBillingSetup).not.toHaveBeenCalled();
    await next();
    await onStep('vat');
    expect(api.saveBillingSetupSection).not.toHaveBeenCalled();
  });

  it('BillingWizard_WholeOrganizationWriter_HasEditableFieldsAndSavesTheStepOnContinue', async () => {
    renderWizard();
    await onStep('issuer');

    expect(screen.queryByTestId('billing-read-only')).not.toBeInTheDocument();
    expect(screen.getByTestId('billing-legal-name')).toBeEnabled();
    expect(screen.getByTestId('billing-street')).toBeEnabled();

    await next();
    await onStep('vat');
    expect(api.saveBillingSetupSection).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.saveBillingSetupSection).mock.calls[0][0]).toBe('issuer');
    expect(vi.mocked(api.saveBillingSetupSection).mock.calls[0][1]).toMatchObject({ countryCode: 'CH', legalName: 'Casa Lugano SA', postalCode: '6900', city: 'Lugano' });
  });

  it('BillingWizard_ASaveRefusedForTheReachOfThePerson_TurnsTheWizardReadOnlyWithoutLosingWhatWasTyped', async () => {
    const refusal = Object.assign(new Error('Forbidden'), {
      isAxiosError: true,
      response: { status: 403, data: { code: 'fiscal_settings_need_whole_org' } },
    });
    vi.mocked(api.saveBillingSetupSection).mockRejectedValue(refusal);
    renderWizard();
    await onStep('issuer');

    fireEvent.change(screen.getByTestId('billing-legal-name'), { target: { value: 'Casa Lugano 2 SA' } });
    await next();

    await waitFor(() => expect(screen.getByTestId('billing-read-only')).toHaveTextContent(text('billingWizard.readOnly.partialScope')), WAIT);
    for (const field of fieldsOfTheStep('issuer')) expect(field, field.getAttribute('data-testid') ?? field.tagName).toBeDisabled();
    expect(screen.getByTestId('billing-legal-name')).toHaveValue('Casa Lugano 2 SA');
    expect(wizard()).toHaveAttribute('data-step', 'issuer');
  });

  it('BillingWizard_ASetupThatIsNotThere_LeadsToTheHomeOfTheAreaEvenWhenTheQueryStillHoldsAnOldAnswer', async () => {
    const notFound = Object.assign(new Error('Not found'), { isAxiosError: true, response: { status: 404, data: {} } });
    vi.mocked(api.getBillingSetup).mockResolvedValueOnce(setupOf([section('issuer', {})])).mockRejectedValue(notFound);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
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
            createElement(Route, { path: '/app/short-rent', element: createElement('div', { 'data-testid': 'home' }) }),
          ),
        ),
      ),
    );
    await onStep('issuer');

    await client.refetchQueries({ queryKey: ['billing-setup'] });
    await waitFor(() => expect(screen.getByTestId('home')).toBeInTheDocument(), WAIT);
  });
});
