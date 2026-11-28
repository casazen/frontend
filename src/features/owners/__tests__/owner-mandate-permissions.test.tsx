import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { todayInRome } from '@/lib/stay-dates';
import { OWNER_ID, policy, profile } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import type { OwnerAddress, OwnerMandate } from '@/types';
import { OwnerFinancialProfilePage } from '../owner-financial-profile-page';

const api = vi.hoisted(() => ({
  listOwners: vi.fn(),
  getOnboardingReadiness: vi.fn(),
  listFiscalProfiles: vi.fn(),
  listPolicies: vi.fn(),
  listMandates: vi.fn(),
  createMandate: vi.fn(),
  createMandateWithDocument: vi.fn(),
  readMandateDocument: vi.fn(),
  getAddress: vi.fn(),
  saveAddress: vi.fn(),
}));

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_admin' }] }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
/** Intl writes a no-break space between a figure and its currency: the page text is compared with plain spaces. */
const plain = (value: string) => value.replace(/\s/g, ' ');
const money = (amount: number, currency: string) => plain(new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount));

function renderPage(tab = 'mandate') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`/app/account/owners/${OWNER_ID}/financial?tab=${tab}`] },
        createElement(Routes, null, createElement(Route, { path: '/app/account/owners/:ownerId/financial', element: createElement(OwnerFinancialProfilePage) })),
      ),
    ),
  );
}

const mandate = (overrides: Partial<OwnerMandate> = {}): OwnerMandate => ({
  id: 'c1000000-0000-4000-8000-000000000001',
  ownerId: OWNER_ID,
  ownershipId: null,
  validFrom: '2024-01-01',
  validTo: null,
  commissionPercent: 20,
  commissionBase: 'GrossExclTouristTax',
  commissionIncludesVat: false,
  cleaningFlatRate: 80,
  linenFlatRate: null,
  passthroughPaymentFees: false,
  withholdingTreatment: 'NotDeductible',
  monthlyFrequency: 1,
  hasDocument: false,
  createdAt: '2024-01-01T08:00:00Z',
  createdByUserId: 'auth0|admin',
  ...overrides,
});

const address = (overrides: Partial<OwnerAddress> = {}): OwnerAddress => ({
  ownerId: OWNER_ID,
  street: 'Via Nassa',
  buildingNumber: '5',
  postalCode: '6900',
  town: 'Lugano',
  province: null,
  country: 'CH',
  ...overrides,
});

beforeEach(async () => {
  vi.resetAllMocks();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_admin' }];
  await i18n.changeLanguage('it');
  api.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
  api.getOnboardingReadiness.mockResolvedValue(null);
  api.listPolicies.mockResolvedValue([policy()]);
  api.listMandates.mockResolvedValue([mandate()]);
  api.getAddress.mockResolvedValue(address());
});

afterEach(() => cleanup());

describe('the mandate and the billing address of an owner (E13/F02/US01/T01)', () => {
  it('reads the optional signed PDF first, requires review and saves the file only on confirmation', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, settlementCurrency: 'CHF' })]);
    api.readMandateDocument.mockResolvedValue({ validFrom: null, commissionPercent: 17.5, commissionBase: null, commissionIncludesVat: true, cleaningFlatRate: 42, linenFlatRate: null, passthroughPaymentFees: null, currency: 'CHF' });
    api.createMandateWithDocument.mockResolvedValue(mandate({ documentUploaded: true, hasDocument: true }));
    renderPage();
    fireEvent.click(await screen.findByTestId('mandate-new-version'));
    const dialog = await screen.findByTestId('mandate-dialog');
    expect(within(dialog).queryByTestId('mandate-percent')).toBeNull();
    const file = new File(['%PDF-1.7 signed agreement'], 'mandato.pdf', { type: 'application/pdf' });
    fireEvent.change(within(dialog).getByTestId('mandate-upload-input'), { target: { files: [file] } });
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    await waitFor(() => expect(api.readMandateDocument).toHaveBeenCalledWith(OWNER_ID, file, expect.any(AbortSignal)));
    expect(await within(dialog).findByTestId('mandate-percent')).toHaveValue('17,50');
    expect(api.createMandateWithDocument).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByTestId('mandate-percent'), { target: { value: '18' } });
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    expect(within(dialog).getByTestId('mandate-cleaning')).toHaveValue('42,00');
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    expect(within(dialog).getByTestId('mandate-review')).toHaveTextContent('mandato.pdf');
    expect(api.createMandateWithDocument).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    await waitFor(() => expect(api.createMandateWithDocument).toHaveBeenCalledWith(OWNER_ID, expect.objectContaining({ commissionPercent: 18, cleaningFlatRate: 42 }), file));
    expect(api.createMandate).not.toHaveBeenCalled();
  });

  it('allows manual entry and retains the PDF when document reading fails', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, settlementCurrency: 'CHF' })]);
    api.readMandateDocument.mockRejectedValue(new Error('unavailable'));
    api.createMandateWithDocument.mockResolvedValue(mandate({ hasDocument: true }));
    renderPage();
    fireEvent.click(await screen.findByTestId('mandate-new-version'));
    const dialog = await screen.findByTestId('mandate-dialog');
    const file = new File(['%PDF-1.7 scanned'], 'scan.pdf', { type: 'application/pdf' });
    fireEvent.change(within(dialog).getByTestId('mandate-upload-input'), { target: { files: [file] } });
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    expect(await within(dialog).findByText(text('ownerMandate.wizard.readUnavailable'))).toBeInTheDocument();
    expect(within(dialog).getByTestId('mandate-percent')).toHaveValue('20,00');
    for (let step = 1; step <= 3; step++) fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    await waitFor(() => expect(api.createMandateWithDocument).toHaveBeenCalledWith(OWNER_ID, expect.anything(), file));
  });

  it('does not convert a contract fee from another currency into the owner currency', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, settlementCurrency: 'CHF' })]);
    api.readMandateDocument.mockResolvedValue({ validFrom: null, commissionPercent: null, commissionBase: null, commissionIncludesVat: null, cleaningFlatRate: 99, linenFlatRate: null, passthroughPaymentFees: null, currency: 'EUR' });
    renderPage();
    fireEvent.click(await screen.findByTestId('mandate-new-version'));
    const dialog = await screen.findByTestId('mandate-dialog');
    fireEvent.change(within(dialog).getByTestId('mandate-upload-input'), { target: { files: [new File(['%PDF-1.7'], 'eur.pdf')] } });
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    await within(dialog).findByTestId('mandate-percent');
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    expect(within(dialog).getByTestId('mandate-cleaning')).toHaveValue('80,00');
    expect(api.createMandateWithDocument).not.toHaveBeenCalled();
  });

  it('OwnerMandate_WithoutFinancialManage_IsReadOnly_AndNothingIsAskedOrWritten', async () => {
    // The server answers the profile masked to a caller that does not hold `agency.owner.financial.manage`: the page follows it.
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: true, settlementCurrency: 'CHF' })]);
    renderPage();

    const section = await screen.findByTestId('owner-mandate-section');
    // The versions are read (`agency.owner.view`): the one in force is marked, with its terms.
    const versions = await within(section).findByTestId('owner-mandate-versions');
    expect(within(versions).getByTestId('owner-mandate-terms')).toHaveTextContent('20%');
    expect(within(versions).getByTestId('owner-mandate-version')).toHaveAttribute('data-in-force', 'true');
    expect(screen.queryByTestId('mandate-new-version')).toBeNull();
    expect(screen.queryByTestId('profile-edit-3')).toBeNull();
    expect(within(section).getByTestId('owner-mandate-read-only')).toBeInTheDocument();
    cleanup();

    // The address is personal data: it is not even asked for.
    renderPage('payments');
    expect(await screen.findByTestId('owner-address-read-only')).toHaveTextContent(text('ownerAddress.notForYou'));
    expect(screen.queryByTestId('owner-address-form')).toBeNull();
    expect(api.getAddress).not.toHaveBeenCalled();
    for (const write of [api.createMandate, api.saveAddress]) expect(write).not.toHaveBeenCalled();
  });

  it('OwnerMandate_TheVersionInForceHasTheTermsInEvidence_AndTheOthersStayInAList', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, settlementCurrency: 'EUR' })]);
    api.listMandates.mockResolvedValue([
      mandate({ id: 'c1000000-0000-4000-8000-000000000002', validFrom: '2025-01-01', commissionPercent: 22, linenFlatRate: 15, hasDocument: true }),
      mandate({ validFrom: '2024-01-01', validTo: '2024-12-31', commissionPercent: 18 }),
    ]);
    renderPage();

    const section = await screen.findByTestId('owner-mandate-section');
    const versions = await within(section).findByTestId('owner-mandate-versions');
    const rows = within(versions).getAllByTestId('owner-mandate-version');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('data-in-force', 'true');
    expect(within(rows[0]).getByTestId('owner-mandate-terms')).toHaveTextContent('22%');
    expect(within(rows[0]).getByTestId('owner-mandate-terms')).toHaveTextContent('15,00');
    expect(rows[0]).toHaveTextContent(text('ownerMandate.version.documentPresent'));
    expect(rows[1]).toHaveAttribute('data-in-force', 'false');
    expect(rows[1]).toHaveTextContent('18%');
    expect(rows[1]).toHaveTextContent(text('ownerMandate.version.ended'));
    expect(within(rows[1]).queryByTestId('owner-mandate-terms')).toBeNull();
    expect(section).toHaveTextContent(text('ownerMandate.version.others', { count: 1 }));
  });

  it('OwnerMandate_WithFinancialManage_SavesANewVersionFromTheTermsInForce_AndCarriesTheTreatmentOver', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, settlementCurrency: 'CHF' })]);
    api.createMandate.mockResolvedValue(mandate({ id: 'c1000000-0000-4000-8000-000000000002', validFrom: todayInRome(), commissionPercent: 25, commissionIncludesVat: true }));
    renderPage();

    fireEvent.click(await screen.findByTestId('mandate-new-version'));
    const dialog = await screen.findByTestId('mandate-dialog');
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    // The form starts from the version it replaces, and the flat fee says its currency: the one of the profile, never an assumed euro.
    expect(within(dialog).getByTestId('mandate-percent')).toHaveValue('20,00');

    fireEvent.change(within(dialog).getByTestId('mandate-percent'), { target: { value: '25,5' } });
    fireEvent.change(within(dialog).getByTestId('mandate-vat'), { target: { value: 'included' } });
    const submit = within(dialog).getByTestId('mandate-dialog-submit');
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(within(dialog).getByTestId('mandate-cleaning')).toHaveValue('80,00');
    expect(dialog).toHaveTextContent(`${text('ownerMandate.fields.cleaningFlatRate')} (CHF)`);
    fireEvent.click(submit);
    expect(within(dialog).getByTestId('mandate-review')).toBeInTheDocument();
    expect(api.createMandate).not.toHaveBeenCalled();
    fireEvent.click(submit);

    await waitFor(() => expect(api.createMandate).toHaveBeenCalledTimes(1));
    expect(api.createMandate).toHaveBeenCalledWith(OWNER_ID, {
      validFrom: todayInRome(),
      commissionPercent: 25.5,
      commissionBase: 'GrossExclTouristTax',
      commissionIncludesVat: true,
      cleaningFlatRate: 80,
      linenFlatRate: null,
      passthroughPaymentFees: false,
      // The form has no field for it: the new version keeps what the one it replaces says.
      withholdingTreatment: 'NotDeductible',
    });
  });

  it('OwnerMandate_ADayThatDoesNotStartAfterTheLatestVersion_IsNotSent', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    renderPage();

    fireEvent.click(await screen.findByTestId('mandate-new-version'));
    const dialog = await screen.findByTestId('mandate-dialog');
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    // The server refuses a version that does not start after the newest one (409): the form says so first and keeps its button off.
    fireEvent.change(within(dialog).getByTestId('mandate-valid-from'), { target: { value: '2024-01-01' } });
    expect(await within(dialog).findByText(/2024/)).toBeInTheDocument();
    expect(within(dialog).getByTestId('mandate-dialog-submit')).toBeDisabled();
    fireEvent.click(within(dialog).getByTestId('mandate-dialog-submit'));
    expect(api.createMandate).not.toHaveBeenCalled();
  });

  it('OwnerMandate_FlatFeesOfAnOwnerWithoutCurrency_AreWrittenWithoutSymbolAndSaySo', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, settlementCurrency: null })]);
    renderPage();

    const section = await screen.findByTestId('owner-mandate-section');
    await within(section).findByTestId('owner-mandate-versions');
    // 80,00 and the sentence that the currency is not set: never «€» for a currency nobody said.
    expect(section).toHaveTextContent('80,00');
    expect(section.textContent).not.toMatch(/[€$]|EUR|CHF/);
    expect(within(section).getByTestId('owner-mandate-currency-missing')).toBeInTheDocument();
  });

  it('OwnerMandate_FlatFeesInTheCurrencyOfTheProfile_AreWrittenInIt', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, settlementCurrency: 'CHF' })]);
    renderPage();

    const section = await screen.findByTestId('owner-mandate-section');
    await within(section).findByTestId('owner-mandate-versions');
    expect(plain(section.textContent ?? '')).toContain(money(80, 'CHF'));
    expect(screen.queryByTestId('owner-mandate-currency-missing')).toBeNull();
  });

  it('OwnerAddress_WithFinancialManage_SavesTheWholeAddress_AndItalyAsksForTheProvince', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    api.saveAddress.mockResolvedValue(address({ town: 'Como', province: 'CO', country: 'IT' }));
    renderPage('payments');

    expect(screen.queryByTestId('owner-address-form')).toBeNull();
    expect(await screen.findByTestId('owner-address-summary')).toHaveTextContent('Via Nassa');
    fireEvent.click(await screen.findByTestId('owner-address-edit'));
    const form = await screen.findByTestId('owner-address-form');
    expect(within(form).getByTestId('address-street')).toHaveValue('Via Nassa');
    // Nothing changed yet: nothing to save.
    expect(within(form).getByTestId('address-save')).toBeDisabled();

    fireEvent.change(within(form).getByTestId('address-town'), { target: { value: 'Como' } });
    fireEvent.change(within(form).getByTestId('address-country'), { target: { value: 'it' } });
    // In Italy the province is required, as the server decides: no save without it.
    await waitFor(() => expect(within(form).getByTestId('address-save')).toBeDisabled());
    fireEvent.change(within(form).getByTestId('address-province'), { target: { value: 'co' } });
    const save = within(form).getByTestId('address-save');
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(api.saveAddress).toHaveBeenCalledTimes(1));
    expect(api.saveAddress).toHaveBeenCalledWith(OWNER_ID, { street: 'Via Nassa', buildingNumber: '5', postalCode: '6900', town: 'Como', province: 'co', country: 'IT' });
  });

  it('OwnerAddress_ARefusedRead_IsToldAsSuch_NeverAsAnEmptyAddress', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    // The server does not give the address to this caller (403): the read answers `null`.
    api.getAddress.mockResolvedValue(null);
    renderPage('payments');

    expect(await screen.findByTestId('owner-address-read-only')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-address-form')).toBeNull();
    expect(api.saveAddress).not.toHaveBeenCalled();
  });
});
