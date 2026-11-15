import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { orgTeamApi } from '@/api/org-team.api';
import { propertiesApi } from '@/api/properties.api';
import { propertyCleaningApi } from '@/api/property-cleaning.api';
import { fetchSuppliersByProperty } from '@/api/service-requests.api';
import i18n from '@/i18n/config';
import type { OrgMember } from '@/types/org-team.types';
import type { CleaningSetupBulkResponse, Property, PropertyCleaningSetup } from '@/types';
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

// The rows of the list of the properties as the API sends them: no currency (`PropertyResponse` has none). The currency of each property is in its cleaning setup.
const PROPERTIES = [
  { id: 'p1', name: 'Casa Mare', city: 'Lugano', comuneIstatCode: null },
  { id: 'p2', name: 'Casa Monti', city: 'Locarno', comuneIstatCode: null },
  { id: 'p3', name: 'Villa Roma', city: 'Roma', comuneIstatCode: '058091' },
  { id: 'p4', name: 'Villa Tevere', city: 'Roma', comuneIstatCode: '058091' },
  { id: 'p5', name: 'Villa Navigli', city: 'Milano', comuneIstatCode: '015146' },
] as unknown as Property[];

const CURRENCIES: Record<string, string> = { p1: 'CHF', p2: 'CHF', p3: 'EUR', p4: 'EUR', p5: 'EUR' };

/** What `GET cleaning-setup` answers for a property that has none: the defaults, with the currency of the property. */
function setupOf(propertyId: string, overrides: Partial<PropertyCleaningSetup> = {}): PropertyCleaningSetup {
  return {
    propertyId,
    configured: false,
    cleanerKind: null,
    supplierOrgId: null,
    supplierName: null,
    supplierIsTrusted: false,
    staffUserId: null,
    priceCents: null,
    currency: CURRENCIES[propertyId] ?? 'EUR',
    startTime: null,
    effectiveStartTime: '10:00:00',
    durationMinutes: null,
    effectiveDurationMinutes: 120,
    active: false,
    updatedAt: null,
    ...overrides,
  };
}

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
  return { onOpenChange, client };
}

/** Chooses a property once the server has said its currency: its box is on only from then. */
async function choose(propertyId: string) {
  const box = await screen.findByTestId(`bulk-cleaning-property-${propertyId}`);
  await waitFor(() => expect(box).toBeEnabled());
  fireEvent.click(box);
}

/** Chooses two properties in francs and a member of the staff, with a price: the form of the dialog filled in. */
async function fillTheForm() {
  await choose('p1');
  await choose('p2');
  await screen.findByRole('option', { name: 'Anna Rossi' });
  fireEvent.change(screen.getByTestId('bulk-cleaning-staff'), { target: { value: 'user-1' } });
  fireEvent.change(screen.getByTestId('bulk-cleaning-price'), { target: { value: '45' } });
}

describe('who cleans, for many properties (E24/F01/US02/T01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    workspace.permissions = ['short-rent:property.write', 'account:org.members.manage'];
    vi.mocked(propertiesApi.getAll).mockResolvedValue(PROPERTIES);
    vi.mocked(propertyCleaningApi.get).mockImplementation(async (propertyId) => setupOf(propertyId));
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

    // The price goes with the currency of the properties chosen (the one their setups say), and every property is named.
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

    await choose('p1');
    await screen.findByRole('option', { name: 'Anna Rossi' });
    fireEvent.change(screen.getByTestId('bulk-cleaning-staff'), { target: { value: 'user-1' } });
    fireEvent.click(screen.getByTestId('bulk-cleaning-save'));

    expect(await screen.findByTestId('bulk-cleaning-all-saved')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-cleaning-routine-link')).not.toBeInTheDocument();
  });

  describe('the currency of the properties (the list of the properties has none: each setup says it)', () => {
    it('BulkCleaningDialog_ListRowsWithNoCurrency_TakeTheCurrencyFromTheSetupOfEachProperty', async () => {
      renderDialog();

      await choose('p1');

      // The form is there, with the price in the currency the setup of the property says.
      expect(await screen.findByLabelText(/Prezzo concordato \(CHF\)/)).toBeInTheDocument();
      expect(screen.queryByTestId('bulk-cleaning-choose-first')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bulk-cleaning-currency-state')).not.toBeInTheDocument();
      for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) expect(propertyCleaningApi.get).toHaveBeenCalledWith(id);
    });

    it('BulkCleaningDialog_APropertyInAnotherCurrency_CannotBeChosenWithTheOnesChosen', async () => {
      renderDialog();

      await choose('p1');

      // The price is in the currency of the property: one currency at a time, the other properties are set apart.
      await waitFor(() => expect(screen.getByTestId('bulk-cleaning-properties')).toHaveTextContent('in EUR: da impostare a parte'));
      expect(screen.getByTestId('bulk-cleaning-property-p3')).toBeDisabled();
      expect(screen.getByLabelText(/Prezzo concordato \(CHF\)/)).toBeInTheDocument();
    });

    it('BulkCleaningDialog_SelectAll_ChoosesTheOnesOfTheCurrencyOfTheFirstOne', async () => {
      renderDialog();

      const all = await screen.findByTestId('bulk-cleaning-select-all');
      await waitFor(() => expect(all).toBeEnabled());
      fireEvent.click(all);

      expect(screen.getByTestId('bulk-cleaning-count')).toHaveTextContent('2 immobili scelti');
      expect(screen.getByTestId('bulk-cleaning-property-p3')).not.toBeChecked();
    });

    it('BulkCleaningDialog_CurrencyThatCannotBeRead_IsToldAsNotReadAndTheOnesWithItCannotBeChosen', async () => {
      vi.mocked(propertyCleaningApi.get).mockImplementation(async (propertyId) => {
        if (propertyId === 'p2') throw httpError(500);
        return setupOf(propertyId);
      });
      renderDialog();

      const alert = await screen.findByTestId('bulk-cleaning-currency-unread');
      expect(alert).toHaveTextContent('Non riusciamo a leggere la valuta di 1 immobile');
      expect(screen.getByTestId('bulk-cleaning-properties')).toHaveTextContent('valuta non letta');
      expect(screen.getByTestId('bulk-cleaning-property-p2')).toBeDisabled();
      // The others are not held back by it.
      await choose('p1');
      expect(await screen.findByLabelText(/Prezzo concordato \(CHF\)/)).toBeInTheDocument();

      // Read again, it can be chosen.
      vi.mocked(propertyCleaningApi.get).mockImplementation(async (propertyId) => setupOf(propertyId));
      fireEvent.click(within(alert).getByRole('button', { name: 'Riprova' }));
      await waitFor(() => expect(screen.getByTestId('bulk-cleaning-property-p2')).toBeEnabled());
      expect(screen.queryByTestId('bulk-cleaning-currency-unread')).not.toBeInTheDocument();
    });

    it('BulkCleaningDialog_ReadThatFailsAfterAnAnswer_IsNeverTheOldCurrency_AndTheFormWaits', async () => {
      const { client } = renderDialog();
      await choose('p1');
      expect(await screen.findByLabelText(/Prezzo concordato \(CHF\)/)).toBeInTheDocument();

      // The query keeps the old data on the error: the dialog must not use it.
      vi.mocked(propertyCleaningApi.get).mockRejectedValue(httpError(500));
      await client.refetchQueries({ queryKey: ['property-cleaning', 'p1'] });

      expect(await screen.findByTestId('bulk-cleaning-currency-state')).toHaveTextContent('Finché non leggiamo la valuta');
      expect(screen.queryByLabelText(/Prezzo concordato/)).not.toBeInTheDocument();
      expect(screen.getByTestId('bulk-cleaning-save')).toBeDisabled();
      expect(screen.getByTestId('bulk-cleaning-properties')).toHaveTextContent('valuta non letta');
      // What was chosen can still be taken out, so the person is never stuck.
      expect(screen.getByTestId('bulk-cleaning-property-p1')).toBeEnabled();
      fireEvent.click(screen.getByTestId('bulk-cleaning-property-p1'));
      expect(await screen.findByTestId('bulk-cleaning-choose-first')).toBeInTheDocument();
    });
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

  describe('the suppliers of the properties chosen', () => {
    beforeEach(() => {
      workspace.permissions = ['short-rent:property.write'];
    });

    it('BulkCleaningDialog_SupplierForPropertiesOfOneComune_AsksOnceAndSaysHowManyItCovers', async () => {
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
      await choose('p3');
      await choose('p4');

      expect(screen.getByTestId('bulk-cleaning-kind-supplier')).toBeChecked();
      await screen.findByRole('option', { name: 'Pulizie Lago (copre 2 immobili)' });
      expect(screen.getByRole('option', { name: 'Impresa Monti (copre 2 immobili)' })).toBeInTheDocument();
      expect(fetchSuppliersByProperty).toHaveBeenCalledTimes(1);
      expect(fetchSuppliersByProperty).toHaveBeenCalledWith('p3', 'cleaning');
    });

    it('BulkCleaningDialog_SuppliersThatFailToBeReadAgain_AreNotOfferedAsIfTheyWereStillThere', async () => {
      vi.mocked(fetchSuppliersByProperty).mockResolvedValue({ items: [{ orgId: 's-1', legalName: 'Pulizie Lago' }], totalCount: 1, page: 1, pageSize: 20 } as never);
      const { client } = renderDialog();

      await choose('p3');
      await screen.findByRole('option', { name: 'Pulizie Lago (copre 1 immobile)' });

      // The query keeps the old list on the error: the dialog must not offer it.
      vi.mocked(fetchSuppliersByProperty).mockRejectedValue(httpError(500));
      await client.refetchQueries({ queryKey: ['suppliers', 'property', 'p3', 'cleaning'] });

      expect(await screen.findByTestId('bulk-cleaning-suppliers-error')).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Pulizie Lago/ })).not.toBeInTheDocument();
    });

    it('BulkCleaningDialog_ThreePropertiesInTwoComuni_AsksOncePerComuneAndASupplierOfOneComuneCoversOneOfThree', async () => {
      // Roma (two of the properties) is served by one supplier, Milano (the third) by another: neither covers all three.
      vi.mocked(fetchSuppliersByProperty).mockImplementation(
        async (propertyId) =>
          ({
            items: propertyId === 'p5' ? [{ orgId: 's-milano', legalName: 'Pulizie Milano' }] : [{ orgId: 's-roma', legalName: 'Impresa Roma' }],
            totalCount: 1,
            page: 1,
            pageSize: 20,
          }) as never,
      );
      renderDialog();

      await choose('p3');
      await choose('p4');
      await choose('p5');

      await screen.findByRole('option', { name: 'Pulizie Milano (copre 1 immobile)' });
      expect(screen.getByRole('option', { name: 'Impresa Roma (copre 2 immobili)' })).toBeInTheDocument();
      // One read for each comune (the first property of it), never one for each property.
      await waitFor(() => expect(fetchSuppliersByProperty).toHaveBeenCalledTimes(2));
      expect(fetchSuppliersByProperty).toHaveBeenCalledWith('p3', 'cleaning');
      expect(fetchSuppliersByProperty).toHaveBeenCalledWith('p5', 'cleaning');
    });
  });

  describe('what the save replaces', () => {
    it('BulkCleaningDialog_PropertyThatHasACleanerAlready_IsNamedAndNothingIsSavedUntilThePersonSaysYes', async () => {
      // «Casa Monti» has a cleaner and a price agreed already: the save would replace the whole of it.
      vi.mocked(propertyCleaningApi.get).mockImplementation(async (propertyId) =>
        propertyId === 'p2'
          ? setupOf(propertyId, { configured: true, cleanerKind: 'Staff', staffUserId: 'user-1', priceCents: 3000, active: true })
          : setupOf(propertyId),
      );
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

      // The question comes first, with the name of the property that would lose its setup, and nothing is saved.
      const confirm = await screen.findByTestId('bulk-cleaning-confirm');
      expect(confirm).toHaveTextContent("Per 1 immobile c'è già chi pulisce");
      expect(screen.getByTestId('bulk-cleaning-confirm-list')).toHaveTextContent('Casa Monti');
      expect(screen.getByTestId('bulk-cleaning-confirm-list')).not.toHaveTextContent('Casa Mare');
      expect(propertyCleaningApi.saveBulk).not.toHaveBeenCalled();

      // Back: the form is as it was left, and still nothing is saved (the buttons of the question never submit the form).
      fireEvent.click(screen.getByTestId('bulk-cleaning-replace-back'));
      expect(await screen.findByTestId('bulk-cleaning-form')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-cleaning-price')).toHaveValue('45');
      expect(propertyCleaningApi.saveBulk).not.toHaveBeenCalled();

      // Yes: now it is saved.
      fireEvent.click(screen.getByTestId('bulk-cleaning-save'));
      fireEvent.click(await screen.findByTestId('bulk-cleaning-replace-confirm'));
      await waitFor(() => expect(propertyCleaningApi.saveBulk).toHaveBeenCalledTimes(1));
      expect(await screen.findByTestId('bulk-cleaning-all-saved')).toBeInTheDocument();
    });

    it('BulkCleaningDialog_NoPropertyHasACleanerYet_SavesAtOnceWithNoQuestionAndTheTextSaysItReplaces', async () => {
      vi.mocked(propertyCleaningApi.saveBulk).mockResolvedValue({
        results: [
          { propertyId: 'p1', saved: true, code: null, message: null },
          { propertyId: 'p2', saved: true, code: null, message: null },
        ],
        saved: 2,
        failed: 0,
      });
      renderDialog();

      // What the layer tells before anything is chosen: it replaces what is already set.
      expect(await screen.findByTestId('bulk-cleaning-dialog')).toHaveTextContent('sostituisce quello che è già impostato');
      await fillTheForm();
      fireEvent.click(screen.getByTestId('bulk-cleaning-save'));

      expect(await screen.findByTestId('bulk-cleaning-all-saved')).toBeInTheDocument();
      expect(screen.queryByTestId('bulk-cleaning-confirm')).not.toBeInTheDocument();
    });
  });

  describe('closing the layer', () => {
    it('BulkCleaningDialog_SaveOnItsWay_DoesNotCloseWithEscOrTheXAndTheResultIsStillTold', async () => {
      const pending = deferred<CleaningSetupBulkResponse>();
      vi.mocked(propertyCleaningApi.saveBulk).mockReturnValue(pending.promise);
      const { onOpenChange } = renderDialog();

      await fillTheForm();
      fireEvent.click(screen.getByTestId('bulk-cleaning-save'));
      await waitFor(() => expect(screen.getByTestId('bulk-cleaning-cancel')).toBeDisabled());

      // Esc and the X ask to close: nothing closes while the save is on its way.
      fireEvent.keyDown(screen.getByTestId('bulk-cleaning-dialog'), { key: 'Escape' });
      fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
      expect(onOpenChange).not.toHaveBeenCalled();

      pending.resolve({
        results: [
          { propertyId: 'p1', saved: true, code: null, message: null },
          { propertyId: 'p2', saved: false, code: 'cleaning_setup_staff_invalid', message: null },
        ],
        saved: 1,
        failed: 1,
      });

      // What was done for each property is there to be read, and from now on the layer closes as it always did.
      expect(await screen.findByTestId('bulk-cleaning-some-failed')).toBeInTheDocument();
      fireEvent.keyDown(screen.getByTestId('bulk-cleaning-dialog'), { key: 'Escape' });
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    });

    it('BulkCleaningDialog_NothingOnItsWay_ClosesWithTheXAsAlways', async () => {
      const { onOpenChange } = renderDialog();

      await screen.findByTestId('bulk-cleaning-choose-first');
      fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
