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
/** Intl writes a no-break space between a figure and its unit: the text of the page is compared with plain spaces. */
const plain = (value: string) => value.replace(/\s/g, ' ');

const SETTLED_ID = 'aa000000-0000-4000-8000-000000000001';
const UNSETTLED_ID = 'aa000000-0000-4000-8000-000000000002';

/** A row of `GET api/owners` as the server writes it: the person, the properties, the kind and currency of the profile, and the owner's own mandate in force today. */
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

/** A version of a mandate as `GET api/owners/{id}/mandates` writes it. */
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
  // Data rule: the list says the owner's own mandate in force; where it says none, the owner may still have a mandate of a single property or one that starts later, which the list does not count.
  // Without the versions read for those rows they would say «manca il mandato» about an owner who has one. A row the list settles asks for nothing.
  it('OwnersList_ARowWithItsMandateInForceReadsNothing_AndARowWithNoneStillReadsTheVersionsOfItsMandate', async () => {
    api.listOwners.mockResolvedValue([
      owner(),
      owner({ id: UNSETTLED_ID, firstName: 'Luca', lastName: 'Bianchi', mandateInForce: null }),
    ]);
    api.listMandates.mockResolvedValue([mandate({ ownershipId: 'oo000000-0000-4000-8000-000000000001', commissionPercent: 18 })]);
    renderPage();

    const settled = await rowOf(SETTLED_ID);
    // The row the list settles draws the commission of the list, and nothing else was asked for it.
    expect(within(settled).getByTestId('owner-mandate-line').textContent).toContain(plain(text('ownerMandate.vat.excluded')));
    expect(settled.querySelector('[data-state="active"]')).not.toBeNull();
    // The row with no mandate in the list reads the versions of its own mandate: a mandate of a single property in force today is a mandate, not a missing one.
    const unsettled = await rowOf(UNSETTLED_ID);
    await waitFor(() => expect(within(unsettled).getByTestId('owner-mandate-line').querySelector('[data-state="active"]')).not.toBeNull());
    expect(within(unsettled).queryByText(text('owners.row.mandateMissing'))).toBeNull();

    expect(api.listMandates).toHaveBeenCalledTimes(1);
    expect(api.listMandates).toHaveBeenCalledWith(UNSETTLED_ID);
    // The profile is the list's too: no read of the fiscal profile for any row.
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
    // «Riprova» reads the versions again, and only for this row.
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
    // A currency the profile does not have is said so, never a currency of the code.
    expect(line(await rowOf(UNSETTLED_ID))).toBe(plain(`${text('owners.row.kindNoCurrency', { kind: text('ownerProfile.options.entityKind.LegalEntity') })} · ${text('owners.row.properties', { count: 1 })}`));
    // An owner with no profile and no property says both.
    expect(line(await rowOf('aa000000-0000-4000-8000-000000000003'))).toBe(plain(`${text('owners.row.noProfile')} · ${text('owners.row.noProperties')}`));
  });

  // Data rule: a fact the list did not write is not a fact the owner lacks. `null` is the server saying the owner has no profile, and it is told; an absent member (a server older than the list) is not
  // told at all, so the row never says «nessun profilo fiscale» about an owner whose profile it could not read.
  it('OwnersList_AProfileTheServerDidNotWrite_IsNeverToldAsNoProfile_WhileAnOwnerTheServerSaysHasNoneIs', async () => {
    const olderServerRow: PropertyOwnerSummary = { id: UNSETTLED_ID, firstName: 'Luca', lastName: 'Bianchi', ibanMasked: null };
    api.listOwners.mockResolvedValue([owner({ entityKind: null, settlementCurrency: null, propertyCount: 0 }), olderServerRow]);
    renderPage();

    const noProfile = await rowOf(SETTLED_ID);
    expect(plain(within(noProfile).getByTestId('owner-profile-line').textContent ?? '')).toBe(plain(`${text('owners.row.noProfile')} · ${text('owners.row.noProperties')}`));

    const older = await rowOf(UNSETTLED_ID);
    // Nothing is told of the kind, the currency or the properties: no line at all, and no «nessun profilo fiscale» nor «nessun immobile».
    expect(within(older).queryByTestId('owner-profile-line')).toBeNull();
    expect(older).not.toHaveTextContent(text('owners.row.noProfile'));
    expect(older).not.toHaveTextContent(text('owners.row.noProperties'));
  });
});
