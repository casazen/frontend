import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import * as api from '@/api/billing-setup.api';
import { formatCurrency } from '@/lib/utils';
import { BILLING_SETUP_PATH } from '../billing-wizard-ids';
import { currencyOfCountry, exampleDocument } from '../billing-wizard-model';
import { BillingWizardPage } from '../billing-wizard-page';
import { ITALIAN_RULE, SWISS_RULE, emptySetup, italianSetup, previewOf, section, swissSetup } from './billing-fixtures';

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

function renderSummary() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`${BILLING_SETUP_PATH}?step=summary`] },
        createElement(Routes, null, createElement(Route, { path: BILLING_SETUP_PATH, element: createElement(BillingWizardPage) })),
      ),
    ),
  );
}

const plain = (value: string | null | undefined) => (value ?? '').replace(/[\u00a0\u202f]/g, ' ');

async function exampleTable() {
  return within(await screen.findByTestId('billing-example', undefined, WAIT)).findByTestId('billing-example-table', undefined, WAIT);
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  workspace.contexts = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];
  workspace.hasPermission = () => true;
  vi.mocked(api.canChangeBillingSetup).mockResolvedValue(true);
  vi.mocked(api.saveBillingSetupSection).mockImplementation(async (name) => section(name, {}));
});

afterEach(() => {
  cleanup();
});

describe('the example document of the summary is in the currency of the issuer (E11/F02/US01/T01)', () => {
  it('BillingWizard_SwissIssuer_SeesFrancsInTheSummaryExample', async () => {
    vi.mocked(api.getBillingSetup).mockResolvedValue(swissSetup());
    vi.mocked(api.getBillingPreview).mockResolvedValue(previewOf(SWISS_RULE));
    renderSummary();

    const table = await exampleTable();
    // A test stay of two nights at 100 and a cleaning of 50, with the VAT of the Swiss rule: 3.8% on both, so 7.60 and 1.90.
    const total = within(table).getByTestId('billing-example-total');
    expect(plain(total.textContent)).toContain(plain(formatCurrency(259.5, 'CHF', 'it-IT')));
    const text = plain(table.textContent);
    for (const amount of [200, 207.6, 50, 51.9, 250, 9.5, 259.5]) expect(text).toContain(plain(formatCurrency(amount, 'CHF', 'it-IT')));
    expect(text).toContain('CHF');
    expect(text).not.toContain('€');
    expect(screen.queryByTestId('billing-example-no-currency')).not.toBeInTheDocument();
    expect(screen.getByTestId('billing-rule')).toHaveTextContent('CH-2024-01-01');
    expect(screen.getByTestId('billing-rates')).toHaveTextContent('3,8%');
  });

  it('BillingWizard_ItalianIssuer_SeesEurosAndTheStampDutyOfTheRuleInTheSummaryExample', async () => {
    vi.mocked(api.getBillingSetup).mockResolvedValue(italianSetup());
    vi.mocked(api.getBillingPreview).mockResolvedValue(previewOf(ITALIAN_RULE));
    renderSummary();

    const table = await exampleTable();
    const text = plain(table.textContent);
    // 250 with no VAT is above the threshold of the stamp duty, which the rule charges to the guest.
    expect(plain(within(table).getByTestId('billing-example-total').textContent)).toContain(plain(formatCurrency(252, 'EUR', 'it-IT')));
    expect(text).toContain(plain(formatCurrency(2, 'EUR', 'it-IT')));
    expect(text).toContain('€');
    expect(text).not.toContain('CHF');
  });

  it('BillingWizard_IssuerWithNoCountryYet_SeesNoSymbolAndASentenceThatSaysWhy', async () => {
    vi.mocked(api.getBillingSetup).mockResolvedValue(emptySetup());
    vi.mocked(api.getBillingPreview).mockResolvedValue(previewOf(SWISS_RULE));
    renderSummary();

    const table = await exampleTable();
    const text = plain(table.textContent);
    expect(text).not.toContain('CHF');
    expect(text).not.toContain('€');
    expect(text).toContain('259,50');
    expect(screen.getByTestId('billing-example-no-currency')).toHaveTextContent(i18n.t('billingWizard.summary.example.noCurrency'));
  });

  it('BillingWizard_SummaryWithNoRuleInForce_ShowsNoExampleInsteadOfARateNobodyApproved', async () => {
    vi.mocked(api.getBillingSetup).mockResolvedValue(swissSetup());
    vi.mocked(api.getBillingPreview).mockResolvedValue(previewOf(undefined));
    renderSummary();

    await waitFor(() => expect(screen.getByTestId('billing-example-none')).toHaveTextContent(i18n.t('billingWizard.summary.example.noRule')), WAIT);
    expect(screen.queryByTestId('billing-example-table')).not.toBeInTheDocument();
  });
});

describe('the currency and the example of the issuer, without the page', () => {
  it('CurrencyOfCountry_SwitzerlandIsFrancsItalyIsEurosAndAnUnknownCountryIsNone', () => {
    expect(currencyOfCountry('CH')).toBe('CHF');
    expect(currencyOfCountry(' ch ')).toBe('CHF');
    expect(currencyOfCountry('IT')).toBe('EUR');
    for (const country of ['', '  ', undefined, null, 'FR']) expect(currencyOfCountry(country)).toBeNull();
  });

  it('ExampleDocument_VatIsRoundedToTheCentAndTheStampIsAddedOnlyAboveItsThresholdWhenTheGuestPaysIt', () => {
    const swiss = exampleDocument(SWISS_RULE);
    expect(swiss?.lines.map((line) => [line.lineType, line.net, line.vat, line.gross])).toEqual([
      ['Accommodation', 200, 7.6, 207.6],
      ['Cleaning', 50, 1.9, 51.9],
    ]);
    expect(swiss).toMatchObject({ net: 250, vat: 9.5, stamp: 0, total: 259.5 });

    expect(exampleDocument(ITALIAN_RULE)).toMatchObject({ net: 250, vat: 0, stamp: 2, total: 252 });
    expect(exampleDocument({ ...ITALIAN_RULE, stampDuty: { threshold: 77.47, amount: 2, chargedToRecipient: false } })?.stamp).toBe(0);
    expect(exampleDocument({ ...ITALIAN_RULE, stampDuty: { threshold: 500, amount: 2, chargedToRecipient: true } })?.stamp).toBe(0);
    expect(exampleDocument(undefined)).toBeNull();
    expect(exampleDocument({ ...SWISS_RULE, rates: [{ lineType: 'Cleaning', percent: 3.8 }] })).toBeNull();
  });
});
