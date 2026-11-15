import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { orgTeamApi } from '@/api/org-team.api';
import { propertiesApi } from '@/api/properties.api';
import { propertyCleaningApi } from '@/api/property-cleaning.api';
import { fetchSuppliersByProperty } from '@/api/service-requests.api';
import i18n from '@/i18n/config';
import type { OrgMember } from '@/types/org-team.types';
import type { Property } from '@/types';
import { BulkCleaningDialog } from '../components/bulk-cleaning-dialog';

vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/property-cleaning.api', () => ({ propertyCleaningApi: { get: vi.fn(), save: vi.fn(), saveBulk: vi.fn() } }));
vi.mock('@/api/org-team.api', () => ({ orgTeamApi: { listMembers: vi.fn() } }));
vi.mock('@/api/service-requests.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/service-requests.api')>()),
  fetchSuppliersByProperty: vi.fn(),
}));
const workspace = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => workspace.permissions.includes(`${context}:${permission}`) }),
}));

const PROPERTIES = [
  { id: 'p1', name: 'Casa Mare', city: 'Lugano', currency: 'CHF', comuneIstatCode: null },
  { id: 'p2', name: 'Casa Monti', city: 'Locarno', currency: 'CHF', comuneIstatCode: null },
  { id: 'p3', name: 'Villa Roma', city: 'Roma', currency: 'EUR', comuneIstatCode: '058091' },
  { id: 'p4', name: 'Villa Tevere', city: 'Roma', currency: 'EUR', comuneIstatCode: '058091' },
] as unknown as Property[];

const MEMBER: OrgMember = {
  id: 'm1',
  userId: 'user-1',
  email: 'anna@example.test',
  firstName: 'Anna',
  lastName: 'Rossi',
  role: 'PropertyManager',
  status: 'Active',
  propertyScope: 'All',
  areas: ['short-rent'],
  createdAt: '2026-01-01T00:00:00Z',
  deactivatedAt: null,
};

function httpError(status: number, data: Record<string, unknown> = {}): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function renderDialog(props: { routineLink?: boolean } = {}) {
  const onOpenChange = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BulkCleaningDialog open onOpenChange={onOpenChange} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

/** Chooses two properties in francs and a member of the staff, with a price: the form of the dialog filled in. */
async function fillTheForm() {
  fireEvent.click(await screen.findByTestId('bulk-cleaning-property-p1'));
  fireEvent.click(screen.getByTestId('bulk-cleaning-property-p2'));
  await screen.findByRole('option', { name: 'Anna Rossi' });
  fireEvent.change(screen.getByTestId('bulk-cleaning-staff'), { target: { value: 'user-1' } });
  fireEvent.change(screen.getByTestId('bulk-cleaning-price'), { target: { value: '45' } });
}

describe('who cleans, for many properties (E24/F01/US02/T01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    workspace.permissions = ['short-rent:property.write', 'account:org.members.manage'];
    vi.mocked(propertiesApi.getAll).mockResolvedValue(PROPERTIES);
    vi.mocked(orgTeamApi.listMembers).mockResolvedValue({
      items: [MEMBER],
      seats: { max: 5, used: 1, available: 4, activeMembers: 1, pendingInvitations: 0, unlimited: false, canInvite: true },
    });
    vi.mocked(fetchSuppliersByProperty).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  it('BulkCleaningDialog_SomeNotSaved_SaysSoForEachPropertyAndNeverAllSaved', async () => {
    vi.mocked(propertyCleaningApi.saveBulk).mockResolvedValue({
      results: [
        { propertyId: 'p1', saved: true, code: null, message: null },
        { propertyId: 'p2', saved: false, code: 'cleaning_setup_staff_invalid', message: 'La persona scelta non è valida.' },
      ],
      saved: 1,
      failed: 1,
    });
    renderDialog();

    await fillTheForm();
    fireEvent.click(screen.getByTestId('bulk-cleaning-save'));

    // The price goes with the currency of the properties chosen, and every property is named.
    await waitFor(() => expect(propertyCleaningApi.saveBulk).toHaveBeenCalledTimes(1));
    expect(propertyCleaningApi.saveBulk).toHaveBeenCalledWith({
      cleanerKind: 'Staff',
      supplierOrgId: null,
      staffUserId: 'user-1',
      priceCents: 4500,
      currency: 'CHF',
      startTime: null,
      durationMinutes: null,
      active: true,
      propertyIds: ['p1', 'p2'],
    });
    expect(await screen.findByTestId('bulk-cleaning-some-failed')).toHaveTextContent('Immobili salvati: 1. Non salvati: 1.');
    expect(screen.queryByTestId('bulk-cleaning-all-saved')).not.toBeInTheDocument();
    expect(screen.getByTestId('bulk-cleaning-line-p1')).toHaveTextContent('Casa Mare');
    expect(screen.getByTestId('bulk-cleaning-line-p1')).toHaveTextContent('Salvato.');
    expect(screen.getByTestId('bulk-cleaning-line-p2')).toHaveTextContent('Casa Monti');
    expect(screen.getByTestId('bulk-cleaning-line-p2')).toHaveTextContent('non è un membro attivo della tua organizzazione');
  });

  it('BulkCleaningDialog_RetryOfTheOnesNotSaved_ChoosesOnlyThemAndKeepsTheForm', async () => {
    vi.mocked(propertyCleaningApi.saveBulk).mockResolvedValue({
      results: [
        { propertyId: 'p1', saved: true, code: null, message: null },
        { propertyId: 'p2', saved: false, code: 'cleaning_setup_staff_invalid', message: null },
      ],
      saved: 1,
      failed: 1,
    });
    renderDialog();

    await fillTheForm();
    fireEvent.click(screen.getByTestId('bulk-cleaning-save'));
    fireEvent.click(await screen.findByTestId('bulk-cleaning-retry-failed'));

    expect(await screen.findByTestId('bulk-cleaning-count')).toHaveTextContent('1 immobile scelto');
    expect(screen.getByTestId('bulk-cleaning-property-p2')).toBeChecked();
    expect(screen.getByTestId('bulk-cleaning-property-p1')).not.toBeChecked();
  });

  it('BulkCleaningDialog_EveryPropertySaved_SaysSoOnlyThen', async () => {
    vi.mocked(propertyCleaningApi.saveBulk).mockResolvedValue({
      results: [
        { propertyId: 'p1', saved: true, code: null, message: null },
        { propertyId: 'p2', saved: true, code: null, message: null },
      ],
      saved: 2,
      failed: 0,
    });
    renderDialog();

    await fillTheForm();
    fireEvent.click(screen.getByTestId('bulk-cleaning-save'));

    expect(await screen.findByTestId('bulk-cleaning-all-saved')).toHaveTextContent('tutti e 2 gli immobili');
    expect(screen.queryByTestId('bulk-cleaning-some-failed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-cleaning-retry-failed')).not.toBeInTheDocument();
    // The routine that makes the cleanings is the next step, told once the cleaners are saved.
    expect(screen.getByTestId('bulk-cleaning-routine-link')).toHaveAttribute('href', '/app/short-rent/automations');
  });

  it('BulkCleaningDialog_OpenedFromTheRoutines_DoesNotSendTheHostThereAgain', async () => {
    vi.mocked(propertyCleaningApi.saveBulk).mockResolvedValue({ results: [{ propertyId: 'p1', saved: true, code: null, message: null }], saved: 1, failed: 0 });
    renderDialog({ routineLink: false });

    fireEvent.click(await screen.findByTestId('bulk-cleaning-property-p1'));
    await screen.findByRole('option', { name: 'Anna Rossi' });
    fireEvent.change(screen.getByTestId('bulk-cleaning-staff'), { target: { value: 'user-1' } });
    fireEvent.click(screen.getByTestId('bulk-cleaning-save'));

    expect(await screen.findByTestId('bulk-cleaning-all-saved')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-cleaning-routine-link')).not.toBeInTheDocument();
  });

  it('BulkCleaningDialog_APropertyInAnotherCurrency_CannotBeChosenWithTheOnesChosen', async () => {
    renderDialog();

    fireEvent.click(await screen.findByTestId('bulk-cleaning-property-p1'));

    // The price is in the currency of the property: one currency at a time, the other properties are set apart.
    expect(screen.getByTestId('bulk-cleaning-property-p3')).toBeDisabled();
    expect(screen.getByTestId('bulk-cleaning-properties')).toHaveTextContent('in EUR: da impostare a parte');
    expect(screen.getByLabelText(/Prezzo concordato \(CHF\)/)).toBeInTheDocument();
  });

  it('BulkCleaningDialog_SelectAll_ChoosesTheOnesOfTheCurrencyOfTheFirstOne', async () => {
    renderDialog();

    fireEvent.click(await screen.findByTestId('bulk-cleaning-select-all'));

    expect(screen.getByTestId('bulk-cleaning-count')).toHaveTextContent('2 immobili scelti');
    expect(screen.getByTestId('bulk-cleaning-property-p3')).not.toBeChecked();
  });

  it('BulkCleaningDialog_NoPropertyChosen_AsksToChooseOneAndSavesNothing', async () => {
    renderDialog();

    expect(await screen.findByTestId('bulk-cleaning-choose-first')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-cleaning-save')).toBeDisabled();
    expect(propertyCleaningApi.saveBulk).not.toHaveBeenCalled();
  });

  it('BulkCleaningDialog_ListThatCannotBeRead_IsNotOfferedAsTheListOfTheProperties', async () => {
    vi.mocked(propertiesApi.getAll).mockRejectedValue(httpError(500));
    renderDialog();

    expect(await screen.findByTestId('bulk-cleaning-list-error')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-cleaning-property-p1')).not.toBeInTheDocument();
  });

  it('BulkCleaningDialog_RequestRefusedAsAWhole_SaysWhyAndKeepsTheForm', async () => {
    vi.mocked(propertyCleaningApi.saveBulk).mockRejectedValue(httpError(422, { code: 'cleaning_setup_price_invalid' }));
    renderDialog();

    await fillTheForm();
    fireEvent.click(screen.getByTestId('bulk-cleaning-save'));

    expect(await screen.findByTestId('bulk-cleaning-error')).toHaveTextContent('Il prezzo concordato parte da 1 centesimo');
    expect(screen.getByTestId('bulk-cleaning-form')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-cleaning-result')).not.toBeInTheDocument();
  });

  it('BulkCleaningDialog_SupplierForPropertiesOfOneComune_AsksOnceAndSaysHowManyItCovers', async () => {
    workspace.permissions = ['short-rent:property.write'];
    vi.mocked(fetchSuppliersByProperty).mockImplementation(
      async () =>
        ({
          items: [
            { orgId: 's-1', legalName: 'Pulizie Lago' },
            { orgId: 's-2', legalName: 'Impresa Monti' },
          ],
          totalCount: 2,
          page: 1,
          pageSize: 20,
        }) as never,
    );
    renderDialog();

    // Two properties in euro, in the same comune: the suppliers are asked for once, and each says how many of the two it covers.
    fireEvent.click(await screen.findByTestId('bulk-cleaning-property-p3'));
    fireEvent.click(screen.getByTestId('bulk-cleaning-property-p4'));

    expect(screen.getByTestId('bulk-cleaning-kind-supplier')).toBeChecked();
    await screen.findByRole('option', { name: 'Pulizie Lago (copre 2 immobili)' });
    expect(screen.getByRole('option', { name: 'Impresa Monti (copre 2 immobili)' })).toBeInTheDocument();
    expect(fetchSuppliersByProperty).toHaveBeenCalledTimes(1);
    expect(fetchSuppliersByProperty).toHaveBeenCalledWith('p3', 'cleaning');
  });
});
