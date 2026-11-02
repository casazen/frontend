import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SupplierBackup, SupplierServiceRequest } from '@/types/service-request';
import type { SupplierInboxCounts, SupplierInboxResponse } from '@/types/supplier';
import { actionsOf, isBackup, phaseOf, reasonText, respondByText } from '../requests/request-model';
import { SupplierInboxPage } from '../supplier-inbox-page';

const api = vi.hoisted(() => ({ fetchSupplierInbox: vi.fn(), fetchSupplierInboxCounts: vi.fn(), fetchSupplierProfile: vi.fn() }));
const requestsApi = vi.hoisted(() => ({ takeServiceRequest: vi.fn(), acceptServiceRequestAsBackup: vi.fn() }));
const servicesApi = vi.hoisted(() => ({ fetchSupplierServices: vi.fn() }));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...api,
}));
// The list also reads the catalog of the supplier, for the choices of its filter by service.
vi.mock('@/api/supplier-services.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/supplier-services.api')>()),
  ...servicesApi,
}));
vi.mock('@/api/service-requests.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/service-requests.api')>()),
  ...requestsApi,
}));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => ({ userId: 'tester', context: 'supplier' }) }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const SOON = new Date(Date.now() + 30 * 60_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

const backup = (state: string, overrides: Partial<SupplierBackup> = {}): SupplierBackup => ({ role: 'backup', state, primaryDueAt: SOON, ...overrides });

const NEW_REQUEST: SupplierServiceRequest = {
  id: 'r-backup',
  rentalContext: 'ShortRent',
  status: 'Richiesto',
  phase: 'to_answer',
  category: 'cleaning',
  urgency: 'Normal',
  notes: null,
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
  propertyId: null,
  propertyName: null,
  city: 'Roma',
  postalCode: '00184',
  address: null,
  scheduledFor: '2026-10-12',
  scheduledStart: '2026-10-12T08:00:00Z',
  scheduledEnd: '2026-10-12T10:00:00Z',
  stay: null,
  contactDisclosed: false,
  hostContact: null,
  clientName: 'Zen Stays',
  price: { amountCents: 5000 },
  respondBy: SOON,
};

const WAITING: SupplierServiceRequest = { ...NEW_REQUEST, id: 'r-waiting', backup: backup('waiting') };
const ACCEPTED: SupplierServiceRequest = { ...NEW_REQUEST, id: 'r-accepted', backup: backup('accepted', { acceptedAt: '2026-09-20T08:10:00Z' }) };
const ACTIVE: SupplierServiceRequest = { ...NEW_REQUEST, id: 'r-active', backup: backup('active', { backupDueAt: SOON }) };
const PRIMARY: SupplierServiceRequest = { ...NEW_REQUEST, id: 'r-primary', backup: { role: 'primary', state: 'priority', primaryDueAt: SOON } };

const COUNTS: SupplierInboxCounts = { toAnswer: 4, awaitingCustomer: 0, scheduled: 0, toCollect: 0, archive: 0, paymentsLate: 0 };

function page(items: SupplierServiceRequest[]): SupplierInboxResponse {
  return { items, total: items.length, page: 1, pageSize: 20 };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/supplier/inbox']}>
          <SupplierInboxPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

const t = (key: string, options?: Record<string, unknown>) => `${key}|${JSON.stringify(options ?? {})}`;

describe('a request the supplier has as a backup (SP-BKP): the model', () => {
  const base = { status: 'Richiesto' as const, phase: 'to_answer' };

  it('phaseOf_ARequestSentAsABackup_IsReadFromTheStateOfTheGroup', () => {
    expect(phaseOf({ ...base, backup: backup('waiting') })).toBe('backupWaiting');
    expect(phaseOf({ ...base, backup: backup('accepted') })).toBe('backupAccepted');
    expect(phaseOf({ ...base, backup: backup('active') })).toBe('backupActive');
    // A state this version does not know is read as waiting; the chosen supplier and a request in no group are the usual «da rispondere».
    expect(phaseOf({ ...base, backup: backup('somethingNew') })).toBe('backupWaiting');
    expect(phaseOf({ ...base, backup: { role: 'primary', state: 'priority', primaryDueAt: SOON } })).toBe('toAnswer');
    expect(phaseOf(base)).toBe('toAnswer');
    // Once the job is the backup's it is a request like any other.
    expect(phaseOf({ status: 'PresoInCarico', phase: 'scheduled', backup: backup('won') })).toBe('scheduled');
    expect(isBackup({ ...base, backup: backup('accepted') })).toBe(true);
    expect(isBackup({ status: 'PresoInCarico', phase: 'scheduled', backup: backup('won') })).toBe(false);
  });

  it('actionsOf_ABackup_AcceptsAsABackupOrRefuses_AndNeverAnswersWithAQuote', () => {
    const priced = { ...base, price: { amountCents: 5000 } };

    expect(actionsOf({ ...priced, backup: backup('waiting') })).toEqual({ primary: 'acceptBackup', secondary: 'reject', more: [] });
    // It said yes: nothing more to do, but it may change its mind.
    expect(actionsOf({ ...priced, backup: backup('accepted') })).toEqual({ more: ['reject'] });
    // The job is free: the usual «Accetta», the first to accept has it.
    expect(actionsOf({ ...priced, backup: backup('active') })).toEqual({ primary: 'take', secondary: 'reject', more: [] });
    // A request with no price puts the quote first for a supplier that was chosen, never for a backup.
    expect(actionsOf({ ...base, backup: backup('active') })).toEqual({ primary: 'take', secondary: 'reject', more: [] });
    expect(actionsOf({ ...base })).toEqual({ primary: 'quote', secondary: 'take', more: ['reject'] });
  });

  it('respondByText_ABackup_SaysUntilWhenThePrimaryHasTheJob_OrByWhenTheJobIsFree', () => {
    expect(respondByText({ ...base, respondBy: SOON, backup: backup('waiting') }, 'it', t)).toContain('supplier.requests.backup.primaryUntil');
    expect(respondByText({ ...base, respondBy: SOON, backup: backup('accepted') }, 'it', t)).toContain('supplier.requests.backup.primaryUntil');
    expect(respondByText({ ...base, respondBy: SOON, backup: backup('active', { backupDueAt: SOON }) }, 'it', t)).toContain('supplier.requests.respondBy');
    // A window that has passed says nothing.
    expect(respondByText({ ...base, respondBy: PAST, backup: backup('waiting', { primaryDueAt: PAST }) }, 'it', t)).toBeNull();
  });

  it('reasonText_TheCodesOfABackupRequestClosedByCasaZen_AreSentencesAndNotCodes', async () => {
    await i18n.changeLanguage('it');
    for (const code of ['PrimaryTookIt', 'TakenByBackup', 'RequestCancelledByHost', 'BackupSlotUnavailable', 'BackupRaceClosed']) {
      const sentence = reasonText(code, i18n.t.bind(i18n));
      expect(sentence).toBeTruthy();
      expect(sentence).not.toBe(code);
      expect(sentence).not.toContain('supplier.requests.reason');
    }

    // The backup that found the race closed (another backup accepted first) is told plainly that it lost nothing, in both languages.
    expect(reasonText('BackupRaceClosed', i18n.t.bind(i18n))).toContain('nessuna penalità');
    await i18n.changeLanguage('en');
    expect(reasonText('BackupRaceClosed', i18n.t.bind(i18n))).toContain('no penalty');
    await i18n.changeLanguage('it');
  });
});

describe('a request the supplier has as a backup (SP-BKP): the list', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    api.fetchSupplierInbox.mockResolvedValue(page([WAITING, ACCEPTED, ACTIVE, PRIMARY]));
    api.fetchSupplierInboxCounts.mockResolvedValue(COUNTS);
    api.fetchSupplierProfile.mockResolvedValue({ status: 'Active' });
    servicesApi.fetchSupplierServices.mockResolvedValue({ items: [], total: 0, limit: 30 });
    requestsApi.acceptServiceRequestAsBackup.mockResolvedValue({});
    requestsApi.takeServiceRequest.mockResolvedValue({});
    await i18n.changeLanguage('it');
  });

  it('SupplierInboxPage_ABackupThatWaits_AcceptsAsABackup_AndTheOtherRowsKeepTheirOwnAction', async () => {
    renderPage();

    const table = within(await screen.findByRole('table', { name: 'Richieste' }));
    const accept = await table.findByTestId('accept-backup-r-waiting');
    expect(accept).toHaveTextContent('Accetta come riserva');
    // It is a backup: no «Accetta» that would take the job from the supplier the host chose.
    expect(table.queryByTestId('take-r-waiting')).not.toBeInTheDocument();
    // It said yes already: nothing to press. The job is free: the usual button. The chosen supplier: the usual button.
    expect(table.queryByTestId('accept-backup-r-accepted')).not.toBeInTheDocument();
    expect(table.queryByTestId('take-r-accepted')).not.toBeInTheDocument();
    expect(table.getByTestId('take-r-active')).toBeEnabled();
    expect(table.getByTestId('take-r-primary')).toBeEnabled();
    // The state says «Riserva» until the job is the supplier's.
    expect(table.getByText('Riserva')).toBeInTheDocument();
    expect(table.getByText('Riserva accettata')).toBeInTheDocument();
    expect(table.getByText('Riserva: da accettare')).toBeInTheDocument();

    fireEvent.click(accept);

    await waitFor(() => expect(requestsApi.acceptServiceRequestAsBackup).toHaveBeenCalledWith('r-waiting'));
    expect(requestsApi.takeServiceRequest).not.toHaveBeenCalled();
  });

  it('SupplierInboxPage_SuspendedSupplier_CannotAcceptAsABackup', async () => {
    api.fetchSupplierProfile.mockResolvedValue({ status: 'Suspended' });
    renderPage();

    const accept = await within(await screen.findByRole('table', { name: 'Richieste' })).findByTestId('accept-backup-r-waiting');
    await waitFor(() => expect(accept).toBeDisabled());
  });
});
