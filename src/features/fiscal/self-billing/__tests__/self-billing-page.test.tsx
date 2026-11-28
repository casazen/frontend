import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import * as fiscalApi from '@/api/fiscal-documents.api';
import * as api from '@/api/self-billing.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import type { FiscalDocumentSdiState, SelfBillingDetail, SelfBillingGeneration, SelfBillingListItem } from '@/types';
import { SelfBillingPage } from '../self-billing-page';

const env = vi.hoisted(() => ({ contexts: [] as { contextKey: string; roleKey: string; permissions?: string[] }[], flags: {} as Record<string, boolean> }));

vi.mock('@/api/self-billing.api', () => ({
  listSelfBilling: vi.fn(),
  getSelfBilling: vi.fn(),
  createSelfBillingDrafts: vi.fn(),
  issueSelfBilling: vi.fn(),
  discardSelfBilling: vi.fn(),
  startSelfBillingCorrection: vi.fn(),
}));
vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, getDocumentSdi: vi.fn() };
});
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    contexts: env.contexts,
    hasPermission: (contextKey: string, permission: string) => env.contexts.find((context) => context.contextKey === contextKey)?.permissions?.includes(permission) === true,
  }),
}));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true, ...env.flags }, isLoading: false }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const list = vi.mocked(api.listSelfBilling);
const read = vi.mocked(api.getSelfBilling);
const prepare = vi.mocked(api.createSelfBillingDrafts);
const issue = vi.mocked(api.issueSelfBilling);
const discard = vi.mocked(api.discardSelfBilling);
const sdi = vi.mocked(fiscalApi.getDocumentSdi);

function failure(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, {}, { status, data: {}, statusText: '', headers: {}, config });
}

const plain = (value: string) => value.replace(/\s/g, ' ');
const money = (amount: number, currency: string) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount));

const item = (overrides: Partial<SelfBillingListItem> = {}): SelfBillingListItem => ({
  id: 'd0000000-0000-4000-8000-000000000001',
  holderKind: 'Agency',
  holderOwnerId: null,
  holderName: 'Lago Immobiliare Srl',
  portalName: 'Portale Uno BV',
  portalCountry: 'NL',
  periodYear: 2026,
  periodMonth: 10,
  dueDate: '2026-11-15',
  number: null,
  issueDate: null,
  status: 'Draft',
  taxableBase: 100,
  vatAmount: 22,
  total: 122,
  currency: 'EUR',
  sdiStatus: 'not_applicable',
  canCorrect: false,
  replacesDocumentId: null,
  replacedByDocumentId: null,
  keptReason: null,
  closedReason: null,
  closedAt: null,
  closedBy: null,
  closedNote: null,
  ...overrides,
});

const detail = (overrides: Partial<SelfBillingDetail> = {}): SelfBillingDetail => ({
  invoice: item(),
  ruleVersion: null,
  vatRatePercent: 22,
  hasXml: false,
  estimatedAmount: 0,
  lines: [{ lineNumber: 1, description: 'Commissione di ottobre', totalPrice: 100, vatRatePercent: 22, vatAmount: 22 }],
  ...overrides,
});

/** The state towards the SDI the server answers for an issued TD17 that waits to be sent. */
const sdiState = (documentId: string): FiscalDocumentSdiState => ({
  documentId,
  status: 'to_send',
  errorCode: null,
  reason: null,
  statusUpdatedAt: null,
  providerConfigured: true,
  canSubmit: true,
  canDeclare: true,
  canCorrect: false,
});

const generation = (overrides: Partial<SelfBillingGeneration> = {}): SelfBillingGeneration => ({
  year: 2026,
  month: 10,
  created: 0,
  updated: 0,
  alreadyIssued: 0,
  discarded: 0,
  drafts: [],
  failed: [],
  notDue: [],
  kept: [],
  ledgerPosted: true,
  ...overrides,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(SelfBillingPage))));
}

beforeEach(async () => {
  vi.resetAllMocks();
  env.contexts = [{ contextKey: 'account', roleKey: 'org_admin' }];
  env.flags = {};
  await i18n.changeLanguage('it');
  list.mockResolvedValue([item()]);
});

afterEach(() => cleanup());

describe('the self-billed invoices (TD17) follow the role, the money and the confirmation (E17/F03/US01/T02, NF-116)', () => {
  it('SelfBillingPage_ForWhoIsNotAnAdministratorOfTheOrganization_AsksNothingAndShowsNoList', async () => {
    env.contexts = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];
    renderPage();

    expect(await screen.findByTestId('agency-admin-required')).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByTestId('self-billing-list')).toBeNull();
    expect(screen.queryByTestId('self-billing-prepare')).toBeNull();
  });

  it('SelfBillingPage_EveryAmountIsInItsOwnCurrency_AndOneWithNoneIsWrittenWithoutASymbolAndSaysSo', async () => {
    list.mockResolvedValue([
      item({ id: 'a', total: 122, currency: 'EUR' }),
      item({ id: 'b', total: 50, taxableBase: 50, vatAmount: 0, currency: 'CHF' }),
      item({ id: 'c', total: 10, taxableBase: 10, vatAmount: 0, currency: '' }),
    ]);
    renderPage();

    const rows = await screen.findAllByTestId('self-billing-row');
    const totalOf = (id: string) => plain(within(rows.find((row) => row.getAttribute('data-id') === id) as HTMLElement).getByTestId('self-billing-row-total').textContent ?? '');
    expect(totalOf('a')).toContain(money(122, 'EUR'));
    expect(totalOf('b')).toContain(money(50, 'CHF'));
    expect(totalOf('b')).not.toContain('€');
    expect(totalOf('c')).toBe(plain(i18n.t('selfBilling.row.total', { amount: '10' })));
    expect(totalOf('c')).not.toMatch(/€|EUR|CHF/);
    expect(screen.getByTestId('self-billing-currency-missing')).toHaveTextContent(i18n.t('selfBilling.currencyMissing'));
  });

  it('SelfBillingPage_WhenAllTheCurrenciesAreCodes_SaysNothingAboutAMissingOne', async () => {
    renderPage();

    await screen.findAllByTestId('self-billing-row');
    expect(screen.queryByTestId('self-billing-currency-missing')).toBeNull();
  });

  it('SelfBillingPage_ADraftWithAnEstimate_IsIssuedOnlyAfterThePersonAcceptsTheEstimate', async () => {
    const id = 'd0000000-0000-4000-8000-000000000001';
    read.mockResolvedValue(detail({ estimatedAmount: 42.5 }));
    issue.mockResolvedValue(detail({ invoice: item({ status: 'Issued', number: 'AF-2026/1', issueDate: '2026-11-10' }) }));
    renderPage();

    fireEvent.click(await screen.findByTestId('self-billing-row-open'));
    expect(await screen.findByTestId('self-billing-estimate')).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId('self-billing-issue'));

    const confirm = await screen.findByRole('button', { name: i18n.t('selfBilling.detail.issue.confirm') });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(screen.getByTestId('self-billing-accept-estimate')).getByRole('checkbox'));
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
    expect(issue).toHaveBeenCalledWith(id, { acceptEstimate: true });
  });

  it('SelfBillingPage_ADraftWithNoEstimate_IsIssuedWithoutAnyAcceptance', async () => {
    read.mockResolvedValue(detail());
    issue.mockResolvedValue(detail({ invoice: item({ status: 'Issued', number: 'AF-2026/1', issueDate: '2026-11-10' }) }));
    renderPage();

    fireEvent.click(await screen.findByTestId('self-billing-row-open'));
    fireEvent.click(await screen.findByTestId('self-billing-issue'));
    expect(screen.queryByTestId('self-billing-accept-estimate')).toBeNull();
    const confirm = await screen.findByRole('button', { name: i18n.t('selfBilling.detail.issue.confirm') });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => expect(issue).toHaveBeenCalledTimes(1));
    expect(issue).toHaveBeenCalledWith('d0000000-0000-4000-8000-000000000001', { acceptEstimate: false });
  });

  it('SelfBillingPage_TheDraftsOfAMonth_NeverSayAllIsDoneForAHolderThatCouldNotGetOne', async () => {
    prepare.mockResolvedValue(generation({ created: 1, ledgerPosted: false, failed: [{ holderKind: 'Owner', holderOwnerId: 'o1', portalName: 'Portale Due Ltd', code: 'issuer_profile_incomplete', fields: ['vatNumber'] }] }));
    renderPage();

    await screen.findAllByTestId('self-billing-row');
    const button = screen.getByTestId('self-billing-prepare');
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    const report = await screen.findByTestId('self-billing-report');
    expect(within(report).getByTestId('self-billing-ledger-not-posted')).toBeInTheDocument();
    expect(within(report).getByTestId('self-billing-report-failed')).toHaveTextContent('Portale Due Ltd');
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}$/);
  });

  it('SelfBillingPage_AnAdministratorOfTheAccountWithNoRentalMembership_CanIssueAndDiscardADraft', async () => {
    read.mockResolvedValue(detail());
    renderPage();

    fireEvent.click(await screen.findByTestId('self-billing-row-open'));

    expect(await screen.findByTestId('self-billing-issue')).toBeEnabled();
    expect(screen.getByTestId('self-billing-discard')).toBeEnabled();
  });

  it('SelfBillingPage_WhenTheDiscardOfADraftFails_SaysWhyInTheDialogAndNothingSaysItWasDiscarded', async () => {
    read.mockResolvedValue(detail());
    discard.mockRejectedValue(failure(500));
    renderPage();

    fireEvent.click(await screen.findByTestId('self-billing-row-open'));
    fireEvent.click(await screen.findByTestId('self-billing-discard'));
    const dialog = await screen.findByRole('dialog', { name: i18n.t('selfBilling.detail.discard.title') });
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('selfBilling.detail.discard.confirm') }));

    expect(await within(dialog).findByTestId('self-billing-discard-problem')).toHaveTextContent(i18n.t('selfBilling.detail.discard.failed'));
    expect(discard).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('self-billing-detail')).toHaveAttribute('data-status', 'Draft');
  });

  it('SelfBillingPage_TheSendingOfAnIssuedInvoiceToTheSdi_IsOfferedOnlyToWhoMayWritePayments', async () => {
    env.flags = { sdiSubmission: true };
    const issued = item({ status: 'Issued', number: 'AF-2026/1', issueDate: '2026-11-10', sdiStatus: 'to_send' });
    read.mockResolvedValue(detail({ invoice: issued, hasXml: true }));
    sdi.mockResolvedValue(sdiState(issued.id));

    renderPage();
    fireEvent.click(await screen.findByTestId('self-billing-row-open'));
    const panel = await screen.findByTestId('fiscal-document-sdi');
    expect(await within(panel).findByTestId('fiscal-document-sdi-state')).toHaveAttribute('data-state', 'toSend');
    expect(within(panel).queryByTestId('fiscal-document-sdi-submit')).toBeNull();
    expect(within(panel).queryByTestId('fiscal-document-sdi-declare')).toBeNull();
    cleanup();

    env.contexts = [
      { contextKey: 'account', roleKey: 'org_admin' },
      { contextKey: 'short-rent', roleKey: 'property_manager', permissions: ['payment.read', 'payment.write'] },
    ];
    renderPage();
    fireEvent.click(await screen.findByTestId('self-billing-row-open'));
    const writer = await screen.findByTestId('fiscal-document-sdi');
    expect(await within(writer).findByTestId('fiscal-document-sdi-submit')).toBeEnabled();
    expect(within(writer).getByTestId('fiscal-document-sdi-declare')).toBeEnabled();
  });
});
