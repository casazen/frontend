import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import axios from '@/lib/axios';
import i18n from '@/i18n/config';
import { WireTransferPage } from '../WireTransferPage';
import { problem, wireBatch, wirePayout } from './agency-money-fixtures';

// The real wire API runs on top of a mocked client: what the server answers is what the page gets, so the proof covers the whole way an account could take to the screen.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const OWNER_1 = 'a0000000-0000-4000-8000-0000000000a1';
const OWNER_2 = 'b0000000-0000-4000-8000-0000000000b1';
const PAYOUT_1 = wirePayout({ payoutId: 'c0000000-0000-4000-8000-000000000001', ownerId: OWNER_1, ownerName: 'Marta Rossi', currency: 'CHF', amount: 1234.5 });
const PAYOUT_2 = wirePayout({ payoutId: 'c0000000-0000-4000-8000-000000000002', ownerId: OWNER_2, ownerName: 'Luca Bianchi', currency: 'CHF', amount: 800 });
const BATCH = wireBatch({ id: 'c1c1c1c1-0000-4000-8000-000000000001', status: 'Downloaded', transferCount: 2, totalAmount: 2034.5 });

/** An account in full, in its compact form and with the groups of its print. */
const FULL_IBAN = 'CH9300762011623852957';
const PRINTED_IBAN = 'CH93 0076 2011 6238 5295 7';
/** Whatever looks like an account in full once the spaces are gone: two letters, two digits and at least eleven more characters. */
const ACCOUNT_SHAPE = /[A-Z]{2}\d{2}[A-Z0-9]{11,30}/;

/** A server that wrote more than the contract by mistake: the account of the owner in full, in two forms, and the address and the e-mail of the owner. */
const withExtras = <T extends object>(item: T) => ({ ...item, iban: FULL_IBAN, ownerIban: PRINTED_IBAN, street: 'Via Roma 1', email: 'marta.rossi@example.com' });

let payableAnswers: Record<string, unknown>;
const answers: Record<string, unknown> = {
  '/wire-transfers/batches': [BATCH],
  [`/wire-transfers/batch/${BATCH.id}/payouts`]: { batch: BATCH, payouts: [withExtras(PAYOUT_1), withExtras(PAYOUT_2)] },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60_000 }, mutations: { retry: false } } });
  const router = createMemoryRouter([{ path: '/app/account/wire-transfers', element: createElement(WireTransferPage) }], { initialEntries: ['/app/account/wire-transfers'] });
  render(createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router })));
  return client;
}

/** Everything of the page a person could read or a browser could keep: the text, the links, the cache, the storage. */
function everythingKept(client: QueryClient): string {
  const links = [...document.querySelectorAll('a[href]')].map((link) => link.getAttribute('href')).join(' ');
  const cache = JSON.stringify(client.getQueryCache().getAll().map((query) => query.state.data));
  const mutations = JSON.stringify(client.getMutationCache().getAll().map((mutation) => [mutation.state.variables, mutation.state.error]));
  const storage = JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
  return [document.body.textContent ?? '', links, cache, mutations, storage].join('\n');
}

beforeEach(async () => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  payableAnswers = { CHF: [withExtras(PAYOUT_1), withExtras(PAYOUT_2)], EUR: [] };
  vi.mocked(axios.get).mockImplementation(async (url: string, config?: { params?: { currency?: string } }) => ({
    status: 200,
    data: url === '/wire-transfers/payable-payouts' ? payableAnswers[config?.params?.currency ?? ''] : answers[url],
  }));
});

afterEach(() => cleanup());

describe('the wire page never shows or keeps an IBAN (privacy: the server says only whether an owner has one, and the page keeps no more than that)', () => {
  it('WirePage_AnswersThatCarryMoreThanTheContract_AreCutToItsMembers_AndNoAccountAnAddressOrAnEmailIsKeptOrDrawn', async () => {
    const client = renderPage();

    await screen.findByTestId(`wire-payout-${PAYOUT_1.payoutId}`);
    await screen.findByTestId(`wire-batch-${BATCH.id}`);
    // The payouts of the file are read too, from an answer that carries the same extras.
    fireEvent.click(within(screen.getByTestId(`wire-batch-${BATCH.id}`)).getByTestId('wire-batch-payouts-toggle'));
    await screen.findByTestId(`wire-batch-payout-${PAYOUT_2.payoutId}`);

    const kept = everythingKept(client);
    expect(kept).not.toContain(FULL_IBAN);
    expect(kept).not.toContain(PRINTED_IBAN);
    expect(kept.replace(/\s/g, '')).not.toMatch(ACCOUNT_SHAPE);
    expect(kept).not.toContain('Via Roma');
    expect(kept).not.toContain('marta.rossi@example.com');
    // What the cache holds of the payouts is the members of the contract and nothing else, in the list of the currency and in the payouts of the file.
    expect(client.getQueryCache().find({ queryKey: ['wire-transfers', 'payable', 'CHF'] })?.state.data).toEqual([PAYOUT_1, PAYOUT_2]);
    expect(client.getQueryCache().find({ queryKey: ['wire-transfers', 'batch-payouts', BATCH.id] })?.state.data).toEqual({ batch: BATCH, payouts: [PAYOUT_1, PAYOUT_2] });
  });

  it('WirePage_RefusalThatQuotesAnAccount_IsToldWithTheAccountCut_AndTheOwnersAreNamedWithoutTheirAccount', async () => {
    const client = renderPage();
    await screen.findByTestId(`wire-payout-${PAYOUT_1.payoutId}`);
    fireEvent.click(screen.getByTestId('wire-select-group-CHF'));
    await waitFor(() => expect(screen.getByTestId('wire-create')).toBeEnabled());

    // A refusal the app has no words for, which quotes an account in its text: the page tells it with the account cut.
    vi.mocked(axios.post).mockRejectedValueOnce(problem(422, 'some_new_refusal', { detail: `The bank rejected ${PRINTED_IBAN} for this transfer.` }));
    fireEvent.click(screen.getByTestId('wire-create'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Crea i file per la banca' }));
    const unknown = await screen.findByTestId('wire-refused-CHF');
    expect(unknown).toHaveTextContent('The bank rejected •••• for this transfer.');
    expect(everythingKept(client)).not.toContain('CH93 0076');

    // A refusal that lists owners: they are named, with a way to their page, and no account comes with them.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('wire-create')).toBeEnabled());
    vi.mocked(axios.post).mockRejectedValueOnce(problem(422, 'wire_owner_iban_missing', { ownerIds: [OWNER_1, OWNER_2] }));
    fireEvent.click(screen.getByTestId('wire-create'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Crea i file per la banca' }));
    await waitFor(() => expect(screen.getByTestId('wire-owner-problems')).toBeInTheDocument());
    const problems = screen.getByTestId('wire-owner-problems');
    expect(problems).toHaveTextContent('Marta Rossi');
    expect(problems).toHaveTextContent('Luca Bianchi');
    expect(within(problems).getAllByRole('link')[0]).toHaveAttribute('href', `/app/account/owners/${OWNER_1}/financial`);

    const kept = everythingKept(client);
    expect(kept).not.toContain(FULL_IBAN);
    expect(kept).not.toContain(PRINTED_IBAN);
    expect(kept.replace(/\s/g, '')).not.toMatch(ACCOUNT_SHAPE);
    // The mutations that carried the payouts are dropped: nothing of a request is kept.
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('WirePage_OwnerWithoutAnIban_IsToldAsAYesOrANoOnly_AndAnUnknownAnswerBlocksTheChoice', async () => {
    // The server says «no» for the first owner and sends nothing at all for the second (a server that does not know the member): neither can be chosen, and nothing of an account is drawn.
    const withoutTheMember: Partial<typeof PAYOUT_2> = { ...PAYOUT_2 };
    delete withoutTheMember.ownerHasIban;
    payableAnswers.CHF = [{ ...PAYOUT_1, ownerHasIban: false }, withoutTheMember];

    const client = renderPage();
    await screen.findByTestId(`wire-payout-${PAYOUT_1.payoutId}`);

    for (const item of [PAYOUT_1, PAYOUT_2]) {
      const row = screen.getByTestId(`wire-payout-${item.payoutId}`);
      expect(row.querySelector('input[type="checkbox"]')).toBeDisabled();
      expect(within(row).getByTestId('wire-payout-iban-badge')).toHaveTextContent('IBAN mancante');
    }
    expect(everythingKept(client).replace(/\s/g, '')).not.toMatch(ACCOUNT_SHAPE);
  });
});
