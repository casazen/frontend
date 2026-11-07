import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { holdForUndo } from '@/lib/hold-for-undo';
import { toastUndo } from '@/lib/toast-undo';
import type { RentRegisterPage, RentRegisterRow } from '@/types';
import { BANK_IMPORT_KEY } from '../lib/bank-import';
import { RentsPage } from '../rents-page';
import { renderAt } from './lease-test-utils';

// The rents page with the real hooks and the real dialog: only the HTTP layer and the permissions are replaced. What is under test is the
// way in to the import of a bank statement («Importa estratto conto»): who sees it, and that it opens the dialog.
const permissions = vi.hoisted(() => new Set<string>());

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permissions.has(permission) }),
}));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => ({ userId: 'auth0|tester', context: 'long-rent' }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
// The six seconds of «Annulla» are not waited for: the toast is a stand-in whose `undo` is what the landlord presses.
vi.mock('@/lib/toast-undo', () => ({ toastUndo: vi.fn() }));

const get = vi.mocked(axios.get);

function row(): RentRegisterRow {
  return {
    id: 'installment-1',
    leaseId: 'lease-1',
    propertyId: 'property-1',
    propertyName: 'Casa Trastevere',
    tenantFirstName: 'Giulia',
    tenantLastName: 'Verdi',
    tenantAnonymized: false,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    dueDate: '2026-10-05',
    amount: 950,
    currency: 'EUR',
    status: 'Scheduled',
    isOverdue: true,
    daysOverdue: 19,
    paidVia: null,
    paidOn: null,
    paymentRequestedAt: null,
    lastReminderAt: null,
    reminderCount: 0,
    canRemind: true,
  };
}

function register(overrides: Partial<RentRegisterPage['counters']> = {}): RentRegisterPage {
  return {
    month: '2026-10',
    counters: {
      expected: { count: 2, amount: 1900 },
      collected: { count: 1, amount: 950 },
      pending: { count: 0, amount: 0 },
      overdue: { count: 1, amount: 950 },
      ...overrides,
    },
    items: [row()],
    total: 1,
    page: 1,
    pageSize: 25,
    onlinePaymentsAvailable: false,
    reminderIntervalHours: 24,
  };
}

function renderPage() {
  return renderAt('/app/long-rent/rents', '/app/long-rent/rents', createElement(RentsPage));
}

describe('RentsPage: the import of the bank statement', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    permissions.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    // Whatever a test left waiting is let go, so the next one starts with the way in open.
    act(() => {
      for (const [, options] of vi.mocked(toastUndo).mock.calls) options.undo();
    });
  });

  it('render_TheLandlordWithRentToCollect_SeesAQuietWayToImportTheStatement_ThatOpensTheDialog', async () => {
    permissions.add('lease.create');
    get.mockImplementation((url: string) => Promise.resolve({ data: url === '/long-rent/rents' ? register() : [] }));

    renderPage();

    expect(await screen.findByTestId('condominium-bank-link')).not.toHaveTextContent('Ho effettuato il bonifico');
    const hint = await screen.findByTestId('rents-import-hint');
    expect(hint).toHaveTextContent('Hai ricevuto dei bonifici?');
    expect(screen.queryByTestId('bank-import-dialog')).not.toBeInTheDocument();

    fireEvent.click(within(hint).getByRole('button', { name: 'Importa estratto conto' }));

    const dialog = await screen.findByTestId('bank-import-dialog');
    expect(dialog).toHaveAttribute('data-stage', 'choose');
    expect(within(dialog).getByRole('heading', { name: 'Importa estratto conto' })).toBeInTheDocument();
    // Opening it reads nothing and writes nothing.
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('render_TheMenuOfThePage_HasTheImportToo_ForTheDaysNothingIsToCollect', async () => {
    permissions.add('lease.create');
    get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url === '/long-rent/rents' ? register({ overdue: { count: 0, amount: 0 }, pending: { count: 0, amount: 0 } }) : [],
      }),
    );

    renderPage();

    await screen.findByTestId('rents-numbers');
    // Nothing to collect: the quiet line is not there, the menu is.
    expect(screen.queryByTestId('rents-import-hint')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('page-header-more'), { key: 'Enter' });
    fireEvent.click(await screen.findByTestId('rents-import-statement'));

    expect(await screen.findByTestId('bank-import-dialog')).toBeInTheDocument();
  });

  it('render_AnImportStillWaitingItsSixSeconds_CannotBeStartedAgain_FromTheLineOrTheMenu', async () => {
    permissions.add('lease.create');
    get.mockImplementation((url: string) => Promise.resolve({ data: url === '/long-rent/rents' ? register() : [] }));
    holdForUndo({ key: BANK_IMPORT_KEY, message: "Registro 2 incassi dall'estratto conto", commit: async () => undefined });

    renderPage();

    const hint = await screen.findByTestId('rents-import-hint');
    const line = within(hint).getByRole('button', { name: 'Importa estratto conto' });
    expect(line).toBeDisabled();
    fireEvent.keyDown(screen.getByTestId('page-header-more'), { key: 'Enter' });
    expect(await screen.findByTestId('rents-import-statement')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(line);
    expect(screen.queryByTestId('bank-import-dialog')).not.toBeInTheDocument();

    // «Annulla» (or the end of the recording): the way in is open again.
    act(() => {
      vi.mocked(toastUndo).mock.calls[0][1].undo();
    });
    expect(line).toBeEnabled();
  });

  it('render_WhoMayOnlyReadTheRents_SeesNoWayToImport', async () => {
    get.mockImplementation((url: string) => Promise.resolve({ data: url === '/long-rent/rents' ? register() : [] }));

    renderPage();

    await screen.findByTestId('rents-numbers');
    expect(screen.queryByTestId('rents-import-hint')).not.toBeInTheDocument();
    expect(screen.queryByTestId('page-header-more')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Importa estratto conto' })).not.toBeInTheDocument();
  });
});
