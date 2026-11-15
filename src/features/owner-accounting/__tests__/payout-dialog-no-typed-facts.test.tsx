import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { todayInRome } from '@/lib/stay-dates';
import { PayoutDialog } from '../components/payout-dialog';
import { forgetPayoutKeys, type ActionContext } from '../owner-accounting-model';
import { OWNER_ID, VERSION_ID, payout, payoutFacts, payoutPreview, stayFact, version } from './owner-accounting-fixtures';

const api = vi.hoisted(() => ({ getPayoutPreview: vi.fn(), confirmPayout: vi.fn() }));

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-properties', () => ({ useProperties: () => ({ data: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Casa Mare' }] }) }));

vi.setConfig({ testTimeout: 30_000 });

/**
 * The money of a payout to an owner (E18/F01/US01/T01, E18/F02/US01/T01, NF-117, ADR-018): what is paid is the balance the statement owes and the facts the withholding is decided on (the stays, whether the agency
 * collected, whether it is a short let, whether the portal already withheld) are the ledger's. The dialog shows them as evidence and asks the person for nothing about them: no amount, no «the agency collected», no
 * «it is a short let», no base. A person who could type them could pay an owner a gross that the ledger does not owe or take a withholding off a stay that has it.
 */

const ctx = (overrides: Partial<ActionContext> = {}): ActionContext => ({
  period: { year: 2025, month: 1 },
  ownerId: OWNER_ID,
  ownerName: 'Marta Rossi',
  version: version(),
  versionIds: [VERSION_ID],
  ...overrides,
});

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(PayoutDialog, { open: true, onOpenChange: vi.fn(), ctx: ctx() }))),
  );
}

beforeEach(async () => {
  vi.resetAllMocks();
  forgetPayoutKeys();
  await i18n.changeLanguage('it');
  api.getPayoutPreview.mockResolvedValue(payoutPreview());
});

afterEach(() => cleanup());

describe('the payout dialog and the facts of the withholding (money)', () => {
  it('PayoutDialog_NoTypedFacts_TheFactsAreTheLedgersAndNothingAboutTheMoneyOrTheApplicabilityCanBeTyped', async () => {
    renderDialog();
    const dialog = await screen.findByTestId('payout-form');
    const facts = await within(dialog).findByTestId('payout-facts');

    // The facts are shown as read evidence: the stay, what the owner's gross of it is without the tourist tax, who collected, and that it is in the base.
    const stay = within(facts).getByTestId('payout-fact-stay');
    expect(stay).toHaveAttribute('data-in-base', 'true');
    expect(stay).toHaveTextContent('Casa Mare');
    expect(within(stay).getByTestId('payout-fact-gross')).toHaveTextContent('800,00');
    expect(stay).toHaveTextContent('12,00');
    expect(stay).toHaveTextContent(i18n.t('ownerAccounting.facts.collection.casazenPayment'));
    expect(api.getPayoutPreview).toHaveBeenCalledWith(VERSION_ID, todayInRome());

    // The only things the person writes are the day and the reference of the wire: no amount, no answer about the collection or the short let, no base, no component.
    const controls = [...dialog.querySelectorAll('input, select, textarea')].map((control) => control.getAttribute('data-testid'));
    expect(controls.sort()).toEqual(['payout-paid-on', 'payout-reference']);
    for (const typed of ['payout-gross', 'payout-agency-collected', 'payout-qualifying', 'payout-component-rent', 'payout-use-left']) expect(screen.queryByTestId(typed)).toBeNull();
  });

  it('PayoutDialog_NoTypedFacts_TheCommandCarriesNoAmountAndNoFact_AndTheAmountsShownAreTheServers', async () => {
    // The server decides the withholding when it confirms: a figure the page could not have worked out, to see that the page writes the server's and none of its own.
    api.confirmPayout.mockResolvedValue(payout({ grossAmount: 800, withholdingAmount: 169.5, netAmount: 630.5 }));
    renderDialog();
    const dialog = await screen.findByTestId('payout-form');
    await waitFor(() => expect(within(dialog).getByTestId('payout-confirm')).toBeEnabled());
    fireEvent.change(within(dialog).getByTestId('payout-reference'), { target: { value: ' CRO 77 ' } });

    fireEvent.click(within(dialog).getByTestId('payout-confirm'));

    await waitFor(() => expect(api.confirmPayout).toHaveBeenCalledTimes(1));
    const sent = api.confirmPayout.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['currency', 'idempotencyKey', 'ownerId', 'paidOn', 'reference', 'statementVersionId']);
    expect(sent).toMatchObject({ ownerId: OWNER_ID, statementVersionId: VERSION_ID, currency: 'EUR', paidOn: todayInRome(), reference: 'CRO 77' });
    for (const member of ['grossAmount', 'agencyCollected', 'qualifyingShortLet', 'components', 'withholdingAmount', 'netAmount']) expect(sent).not.toHaveProperty(member);

    const done = await screen.findByTestId('payout-done');
    expect(done).toHaveTextContent('800,00');
    expect(done).toHaveTextContent('169,50');
    expect(done).toHaveTextContent('630,50');
  });

  it('PayoutDialog_ForAnOwnerPaidInFrancs_EveryFigureIsInTheCurrencyOfItsOwnData_TheWithholdingInEuroAndTheWireInFrancs', async () => {
    api.getPayoutPreview.mockResolvedValue(
      payoutPreview({
        currency: 'CHF',
        balance: 760,
        withholdingAmount: 160.4,
        netAmount: 599.6,
        facts: payoutFacts({
          currency: 'CHF',
          balance: 760,
          fx: { from: 'EUR', to: 'CHF', rate: 0.955, source: 'Banca', day: '2025-02-05' },
          stays: [stayFact({ grossCurrency: 'CHF', gross: 760, touristTax: 0, baseAmount: 795.8 })],
        }),
      }),
    );
    renderDialog();
    const dialog = await screen.findByTestId('payout-form');
    await within(dialog).findByTestId('payout-facts');

    // What is paid and what is wired are francs; the base of the withholding and the withholding for the F24 are euro; the amount kept from the wire is francs again.
    expect(within(dialog).getByTestId('payout-balance').textContent).toMatch(/760,00\s*CHF/);
    expect(within(dialog).getByTestId('payout-net').textContent).toMatch(/599,60\s*CHF/);
    expect(within(dialog).getByTestId('payout-base').textContent).toMatch(/800,00\s*€/);
    expect(within(dialog).getByTestId('payout-withholding-euro').textContent).toMatch(/168,00\s*€/);
    expect(within(dialog).getByTestId('payout-withholding-kept').textContent).toMatch(/160,40\s*CHF/);
    expect(within(dialog).getByTestId('payout-fact-gross').textContent).toMatch(/760,00\s*CHF/);
    // The rate of the day is told, not hidden: the withholding decided in euro is kept at it.
    expect(within(dialog).getByTestId('payout-facts-fx').textContent).toMatch(/1 EUR = 0,955 CHF/);
    expect(within(dialog).getByTestId('payout-balance').textContent).not.toMatch(/€/);
  });

  it('PayoutDialog_WhatTheServerWouldRefuse_IsToldBeforeAnythingIsPressed_AndNothingIsSent', async () => {
    // An owner paid in francs with no rate of the day: the server cannot keep a withholding decided in euro, and the dialog says which fact is missing.
    api.getPayoutPreview.mockResolvedValue(
      payoutPreview({ decision: null, reasonCode: null, grossBase: null, ratePercent: null, rounding: null, withholdingInEuro: null, taxCode: null, withholdingAmount: null, netAmount: null, blockingCode: 'tax_applicability_unresolved', blockingField: 'fxRate' }),
    );
    renderDialog();

    const blocked = await screen.findByTestId('payout-unresolved');
    expect(blocked).toHaveTextContent(i18n.t('ownerAccounting.fields.fxRate'));
    expect(screen.getByTestId('payout-confirm')).toBeDisabled();
    // A withholding that the server did not decide is not drawn as one.
    expect(screen.queryByTestId('payout-withholding-euro')).toBeNull();
    fireEvent.submit(screen.getByTestId('payout-form'));
    expect(api.confirmPayout).not.toHaveBeenCalled();
  });
});
