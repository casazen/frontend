import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { OwnerMandate, PropertyOwnerSummary } from '@/types';
import { OwnersListPage } from '../owners-list-page';

const api = vi.hoisted(() => ({ listOwners: vi.fn(), listMandates: vi.fn(), listFiscalProfiles: vi.fn() }));
vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const plain = (value: string) => value.replace(/\s/g, ' ');

const SETTLED_ID = 'aa000000-0000-4000-8000-000000000001';
const UNSETTLED_ID = 'aa000000-0000-4000-8000-000000000002';

function owner(overrides: Partial<PropertyOwnerSummary> = {}): PropertyOwnerSummary {
  return {
    id: SETTLED_ID,
    firstName: 'Marta',
    lastName: 'Rossi',
    ibanMasked: '****3456',
    propertyCount: 2,
    entityKind: 'NaturalPerson',
    settlementCurrency: 'CHF',
    mandateInForce: { id: 'mm000000-0000-4000-8000-000000000001', validFrom: '2025-01-01', validTo: null, commissionPercent: 20, commissionBase: 'GrossExclTouristTax', commissionIncludesVat: false },
    ...overrides,
  };
}

function mandate(overrides: Partial<OwnerMandate> = {}): OwnerMandate {
  return {
    id: 'mm000000-0000-4000-8000-0000000000a1',
    ownerId: UNSETTLED_ID,
    ownershipId: null,
    validFrom: '2025-01-01',
    validTo: null,
    commissionPercent: 18,
    commissionBase: 'GrossExclTouristTax',
    commissionIncludesVat: true,
    cleaningFlatRate: null,
    linenFlatRate: null,
    passthroughPaymentFees: false,
    withholdingTreatment: 'Deductible',
    monthlyFrequency: 1,
    hasDocument: false,
    createdAt: '2025-01-01T00:00:00Z',
    createdByUserId: null,
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(OwnersListPage))));
}

const rowOf = async (id: string) => {
  const rows = await screen.findAllByTestId('owner-row');
  return rows.find((row) => row.getAttribute('data-owner') === id) as HTMLElement;
};

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  api.listMandates.mockResolvedValue([]);
});

afterEach(() => cleanup());

describe('the list of the owners draws each row from the list itself (E13/F02/US01/T01, FIX/FE-OWNERS-ADOPT)', () => {
  it('OwnersList_ARowWithItsMandateInForceReadsNothing_AndARowWithNoneStillReadsTheVersionsOfItsMandate', async () => {
    api.listOwners.mockResolvedValue([
      owner(),
      owner({ id: UNSETTLED_ID, firstName: 'Luca', lastName: 'Bianchi', mandateInForce: null }),
    ]);
    api.listMandates.mockResolvedValue([mandate({ ownershipId: 'oo000000-0000-4000-8000-000000000001', commissionPercent: 18 })]);
    renderPage();

    const settled = await rowOf(SETTLED_ID);
    expect(within(settled).getByTestId('owner-mandate-line').textContent).toContain(plain(text('ownerMandate.vat.excluded')));
    expect(settled.querySelector('[data-state="active"]')).not.toBeNull();
    const unsettled = await rowOf(UNSETTLED_ID);
    await waitFor(() => expect(within(unsettled).getByTestId('owner-mandate-line').querySelector('[data-state="active"]')).not.toBeNull());
    expect(within(unsettled).queryByText(text('owners.row.mandateMissing'))).toBeNull();

    expect(api.listMandates).toHaveBeenCalledTimes(1);
    expect(api.listMandates).toHaveBeenCalledWith(UNSETTLED_ID);
    expect(api.listFiscalProfiles).not.toHaveBeenCalled();
  });

  it('OwnersList_ARowWithNoMandateAnywhere_SaysTheMandateIsMissing_AfterReadingItsVersions', async () => {
    api.listOwners.mockResolvedValue([owner({ id: UNSETTLED_ID, mandateInForce: null })]);
    api.listMandates.mockResolvedValue([]);
    renderPage();

    const row = await rowOf(UNSETTLED_ID);
    await waitFor(() => expect(within(row).getByText(text('owners.row.mandateMissing'))).toBeInTheDocument());
    expect(api.listMandates).toHaveBeenCalledWith(UNSETTLED_ID);
  });

  it('OwnersList_ARowWhoseVersionsCouldNotBeRead_SaysSoAndNeverThatTheMandateIsMissing', async () => {
    api.listOwners.mockResolvedValue([owner({ id: UNSETTLED_ID, mandateInForce: null })]);
    api.listMandates.mockRejectedValue(new Error('network'));
    renderPage();

    const row = await rowOf(UNSETTLED_ID);
    await waitFor(() => expect(within(row).getByRole('alert')).toHaveTextContent(text('owners.row.mandateError')));
    expect(within(row).queryByText(text('owners.row.mandateMissing'))).toBeNull();
    api.listMandates.mockResolvedValue([mandate()]);
    fireEvent.click(within(row).getByRole('button', { name: text('shared.errorState.retry') }));
    await waitFor(() => expect(row.querySelector('[data-state="active"]')).not.toBeNull());
  });

  it('OwnersList_TheKindTheCurrencyAndThePropertiesAreTheOnesOfTheList', async () => {
    api.listOwners.mockResolvedValue([
      owner(),
      owner({ id: UNSETTLED_ID, entityKind: 'LegalEntity', settlementCurrency: null, propertyCount: 1 }),
      owner({ id: 'aa000000-0000-4000-8000-000000000003', entityKind: null, settlementCurrency: null, propertyCount: 0 }),
    ]);
    renderPage();

    const first = await rowOf(SETTLED_ID);
    const line = (row: HTMLElement) => plain(within(row).getByTestId('owner-profile-line').textContent ?? '');
    expect(line(first)).toBe(plain(`${text('owners.row.kindAndCurrency', { kind: text('ownerProfile.options.entityKind.NaturalPerson'), currency: 'CHF' })} · ${text('owners.row.properties', { count: 2 })}`));
    expect(line(await rowOf(UNSETTLED_ID))).toBe(plain(`${text('owners.row.kindNoCurrency', { kind: text('ownerProfile.options.entityKind.LegalEntity') })} · ${text('owners.row.properties', { count: 1 })}`));
    expect(line(await rowOf('aa000000-0000-4000-8000-000000000003'))).toBe(plain(`${text('owners.row.noProfile')} · ${text('owners.row.noProperties')}`));
  });

  it('OwnersList_AProfileTheServerDidNotWrite_IsNeverToldAsNoProfile_WhileAnOwnerTheServerSaysHasNoneIs', async () => {
    const olderServerRow: PropertyOwnerSummary = { id: UNSETTLED_ID, firstName: 'Luca', lastName: 'Bianchi', ibanMasked: null };
    api.listOwners.mockResolvedValue([owner({ entityKind: null, settlementCurrency: null, propertyCount: 0 }), olderServerRow]);
    renderPage();

    const noProfile = await rowOf(SETTLED_ID);
    expect(plain(within(noProfile).getByTestId('owner-profile-line').textContent ?? '')).toBe(plain(`${text('owners.row.noProfile')} · ${text('owners.row.noProperties')}`));

    const older = await rowOf(UNSETTLED_ID);
    expect(within(older).queryByTestId('owner-profile-line')).toBeNull();
    expect(older).not.toHaveTextContent(text('owners.row.noProfile'));
    expect(older).not.toHaveTextContent(text('owners.row.noProperties'));
  });
});
