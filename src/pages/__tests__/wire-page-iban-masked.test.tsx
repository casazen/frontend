import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import axios from '@/lib/axios';
import i18n from '@/i18n/config';
import { WireTransferPage } from '../WireTransferPage';
import { payout, problem, wireBatch } from './agency-money-fixtures';

// The real wire API runs on top of a mocked client: what the server answers is what the page gets, so the proof covers the whole way an account could take to the screen.
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const OWNER_1 = 'a0000000-0000-4000-8000-0000000000a1';
const OWNER_2 = 'b0000000-0000-4000-8000-0000000000b1';
const PAYOUT_1 = payout({ id: 'c0000000-0000-4000-8000-000000000001', ownerId: OWNER_1, currency: 'CHF', netAmount: 1234.5 });
const PAYOUT_2 = payout({ id: 'c0000000-0000-4000-8000-000000000002', ownerId: OWNER_2, currency: 'CHF', netAmount: 800 });
const BATCH = wireBatch({ id: 'c1c1c1c1-0000-4000-8000-000000000001', status: 'Downloaded', transferCount: 2, totalAmount: 2034.5 });

/** An account in full, in its compact form and with the groups of its print. */
const FULL_IBAN = 'CH9300762011623852957';
const PRINTED_IBAN = 'CH93 0076 2011 6238 5295 7';
/** Whatever looks like an account in full once the spaces are gone: two letters, two digits and at least eleven more characters. */
const ACCOUNT_SHAPE = /[A-Z]{2}\d{2}[A-Z0-9]{11,30}/;

const answers: Record<string, unknown> = {
  '/owner-accounting/payouts': [PAYOUT_1, PAYOUT_2],
  '/wire-transfers/batches': [BATCH],
  // The registry answers the IBAN masked, with the e-mail and the phone of the owner. The second answer is a server that wrote the account in full by mistake.
  '/owners': [
    { id: OWNER_1, firstName: 'Marta', lastName: 'Rossi', email: 'marta.rossi@example.com', phone: '+41790000001', taxRegime: 'Private', ibanMasked: '****3456', createdAt: '2026-10-01T09:00:00Z' },
    { id: OWNER_2, firstName: 'Luca', lastName: 'Bianchi', email: 'luca.bianchi@example.com', phone: null, taxRegime: 'Private', ibanMasked: FULL_IBAN, createdAt: '2026-10-01T09:00:00Z' },
  ],
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
  vi.mocked(axios.get).mockImplementation(async (url: string) => ({ status: 200, data: answers[url] }));
});

afterEach(() => cleanup());

describe('the wire page never shows an IBAN in full (privacy: the account of an owner is the end of it and nothing else)', () => {
  it('WirePage_Payouts_ShowOnlyTheEndOfEachAccount_EvenFromAServerThatSentItInFull_AndKeepNothingElse', async () => {
    const client = renderPage();

    const first = await screen.findByTestId(`wire-payout-${PAYOUT_1.id}`);
    const second = screen.getByTestId(`wire-payout-${PAYOUT_2.id}`);
    expect(within(first).getByTestId('wire-payout-iban')).toHaveTextContent('IBAN •••• 3456');
    // The account that came in full is cut to its last four characters before it is kept or drawn.
    expect(within(second).getByTestId('wire-payout-iban')).toHaveTextContent('IBAN •••• 2957');
    await screen.findByTestId(`wire-batch-${BATCH.id}`);

    const kept = everythingKept(client);
    expect(kept).not.toContain(FULL_IBAN);
    expect(kept.replace(/\s/g, '')).not.toMatch(ACCOUNT_SHAPE);
    // The registry also answers the e-mail and the phone of the owners: the page does not keep them.
    expect(kept).not.toContain('marta.rossi@example.com');
    expect(kept).not.toContain('+41790000001');
    // What the cache holds of the owners is the name and the end of the account.
    expect(JSON.stringify(client.getQueryCache().find({ queryKey: ['wire-transfers', 'owners'] })?.state.data)).toBe(
      JSON.stringify([
        { id: OWNER_1, name: 'Marta Rossi', ibanEnd: '•••• 3456' },
        { id: OWNER_2, name: 'Luca Bianchi', ibanEnd: '•••• 2957' },
      ]),
    );
  });

  it('WirePage_RefusalThatQuotesAnAccount_IsToldWithTheAccountCut_AndTheOwnersAreNamedWithoutTheirAccount', async () => {
    const client = renderPage();
    await screen.findByTestId(`wire-payout-${PAYOUT_1.id}`);
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
});
