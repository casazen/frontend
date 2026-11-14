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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`/app/account/owners/${OWNER_ID}/financial`] },
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
  it('OwnerMandate_WithoutFinancialManage_IsReadOnly_AndNothingIsAskedOrWritten', async () => {
    // The server answers the profile masked to a caller that does not hold `agency.owner.financial.manage`: the page follows it.
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: true, settlementCurrency: 'CHF' })]);
    renderPage();

    const section = await screen.findByTestId('owner-mandate-section');
    // The versions are read (`agency.owner.view`): the one in force is marked, with its terms.
    const versions = await within(section).findByTestId('owner-mandate-versions');
    expect(within(versions).getByTestId('owner-mandate-terms')).toHaveTextContent('20%');
    expect(within(versions).getByTestId('owner-mandate-version')).toHaveAttribute('data-in-force', 'true');
    // ...and nothing can be written: no new version, and the address (personal data) is not even asked for.
    expect(screen.queryByTestId('mandate-new-version')).toBeNull();
    expect(within(section).getByTestId('owner-mandate-read-only')).toBeInTheDocument();
    expect(await screen.findByTestId('owner-address-read-only')).toHaveTextContent(text('ownerAddress.notForYou'));
    expect(screen.queryByTestId('owner-address-form')).toBeNull();
    expect(api.getAddress).not.toHaveBeenCalled();
    for (const write of [api.createMandate, api.saveAddress]) expect(write).not.toHaveBeenCalled();
  });

  it('OwnerMandate_WithFinancialManage_SavesANewVersionFromTheTermsInForce_AndCarriesTheTreatmentOver', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, settlementCurrency: 'CHF' })]);
    api.createMandate.mockResolvedValue(mandate({ id: 'c1000000-0000-4000-8000-000000000002', validFrom: todayInRome(), commissionPercent: 25, commissionIncludesVat: true }));
    renderPage();

    fireEvent.click(await screen.findByTestId('mandate-new-version'));
    const dialog = await screen.findByTestId('mandate-dialog');
    // The form starts from the version it replaces, and the flat fee says its currency: the one of the profile, never an assumed euro.
    expect(within(dialog).getByTestId('mandate-percent')).toHaveValue('20,00');
    expect(within(dialog).getByTestId('mandate-cleaning')).toHaveValue('80,00');
    expect(dialog).toHaveTextContent(`${text('ownerMandate.fields.cleaningFlatRate')} (CHF)`);

    fireEvent.change(within(dialog).getByTestId('mandate-percent'), { target: { value: '25,5' } });
    fireEvent.change(within(dialog).getByTestId('mandate-vat'), { target: { value: 'included' } });
    const submit = within(dialog).getByTestId('mandate-dialog-submit');
    await waitFor(() => expect(submit).toBeEnabled());
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
    renderPage();

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
    renderPage();

    expect(await screen.findByTestId('owner-address-read-only')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-address-form')).toBeNull();
    expect(api.saveAddress).not.toHaveBeenCalled();
  });
});
