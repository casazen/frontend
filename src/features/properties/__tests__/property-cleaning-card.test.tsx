import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { orgTeamApi } from '@/api/org-team.api';
import { propertiesApi } from '@/api/properties.api';
import { propertyCleaningApi } from '@/api/property-cleaning.api';
import { routinesApi } from '@/api/routines.api';
import { fetchServiceRequests, fetchSuppliersByProperty } from '@/api/service-requests.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import type { OrgMember } from '@/types/org-team.types';
import type { Property, PropertyCleaningSetup, PropertyDetailDto, Routine } from '@/types';
import { PropertyActivityTab } from '../components/property-activity-tab';
import { PropertyCleaningCard } from '../components/property-cleaning-card';

vi.mock('@/api/property-cleaning.api', () => ({ propertyCleaningApi: { get: vi.fn(), save: vi.fn(), saveBulk: vi.fn() } }));
vi.mock('@/api/properties.api', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/properties.api')>();
  return { ...original, propertiesApi: { ...original.propertiesApi, getById: vi.fn() } };
});
vi.mock('@/api/routines.api', () => ({ routinesApi: { getAll: vi.fn() } }));
vi.mock('@/api/org-team.api', () => ({ orgTeamApi: { listMembers: vi.fn() } }));
vi.mock('@/api/service-requests.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/service-requests.api')>()),
  fetchServiceRequests: vi.fn(),
  fetchSuppliersByProperty: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const workspace = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => workspace.permissions.includes(`${context}:${permission}`) }),
}));

const PROPERTY_ID = 'p1';

function setupOf(overrides: Partial<PropertyCleaningSetup> = {}): PropertyCleaningSetup {
  return {
    propertyId: PROPERTY_ID,
    configured: true,
    cleanerKind: 'Staff',
    supplierOrgId: null,
    supplierName: null,
    supplierIsTrusted: false,
    staffUserId: 'user-1',
    priceCents: 4500,
    currency: 'CHF',
    startTime: null,
    effectiveStartTime: '11:00:00',
    durationMinutes: null,
    effectiveDurationMinutes: 120,
    active: true,
    updatedAt: '2026-11-14T10:00:00Z',
    ...overrides,
  };
}

/** What `GET cleaning-setup` answers for a property that has none: the defaults of its currency. */
const withoutSetup = (currency: string) =>
  setupOf({ configured: false, cleanerKind: null, staffUserId: null, priceCents: null, currency, updatedAt: null });

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

function routine(overrides: Partial<Routine>): Routine {
  return {
    id: 'r1',
    orgId: 'org-1',
    name: 'Pulizia al check-out',
    eventType: 'AfterCheckout',
    eventConfig: '{"days":0,"hours":0}',
    conditionJson: '{}',
    actionsJson: JSON.stringify([{ type: 'CreateCleaningRequest', config: {} }]),
    testMode: false,
    active: true,
    ...overrides,
  };
}

function renderCard(client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PropertyCleaningCard propertyId={PROPERTY_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

describe('the cleaner of a property (E24/F01/US02/T01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    workspace.permissions = ['short-rent:property.write', 'account:org.members.manage'];
    vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf());
    // The record of the property: it has a check-out time (the page of the property has read it already).
    vi.mocked(propertiesApi.getById).mockResolvedValue({ id: PROPERTY_ID, checkOutBy: '11:00:00' } as Property);
    vi.mocked(routinesApi.getAll).mockResolvedValue([]);
    vi.mocked(orgTeamApi.listMembers).mockResolvedValue({
      items: [MEMBER],
      seats: { max: 5, used: 1, available: 4, activeMembers: 1, pendingInvitations: 0, unlimited: false, canInvite: true },
    });
    vi.mocked(fetchSuppliersByProperty).mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  describe('the price', () => {
    it.each([
      ['CHF', 4500, '45,00 CHF'],
      ['EUR', 4550, '45,50 €'],
    ])('PropertyCleaningCard_PriceOfAPropertyIn%s_IsToldInTheCurrencyOfTheProperty', async (currency, priceCents, expected) => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf({ currency, priceCents }));
      renderCard();

      const price = await screen.findByTestId('property-cleaning-price');

      expect(price).toHaveTextContent(expected);
      // Never the sign of the other currency: it comes from the data, not from the code.
      expect(price).not.toHaveTextContent(currency === 'CHF' ? '€' : 'CHF');
    });

    it('PropertyCleaningCard_PriceInEnglish_IsToldInTheCurrencyOfTheProperty', async () => {
      await i18n.changeLanguage('en');
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf({ currency: 'CHF', priceCents: 4500 }));
      renderCard();

      expect(await screen.findByTestId('property-cleaning-price')).toHaveTextContent('CHF 45.00');
    });

    it('PropertyCleaningCard_AnAmountWithNoCurrency_IsToldWithoutASymbolAndSaysSo', async () => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf({ currency: '', priceCents: 4500 }));
      renderCard();

      const price = await screen.findByTestId('property-cleaning-price');

      expect(price).toHaveTextContent('45,00');
      expect(price).not.toHaveTextContent(/€|CHF|EUR/);
      expect(price).toHaveTextContent('La valuta non è indicata');
    });

    it('PropertyCleaningCard_SaveWithAPrice_SendsTheCurrencyOfThePropertyWithIt', async () => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(withoutSetup('CHF'));
      vi.mocked(propertyCleaningApi.save).mockResolvedValue(setupOf({ priceCents: 4550 }));
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-set'));
      // A property in francs takes a member of the staff: the suppliers work in euro.
      expect(screen.getByTestId('property-cleaning-kind-supplier')).toBeDisabled();
      await screen.findByRole('option', { name: 'Anna Rossi' });
      fireEvent.change(screen.getByTestId('property-cleaning-staff'), { target: { value: 'user-1' } });
      fireEvent.change(screen.getByTestId('property-cleaning-price'), { target: { value: '45,50' } });
      fireEvent.click(screen.getByTestId('property-cleaning-save'));

      await waitFor(() => expect(propertyCleaningApi.save).toHaveBeenCalledTimes(1));
      expect(propertyCleaningApi.save).toHaveBeenCalledWith(PROPERTY_ID, {
        cleanerKind: 'Staff',
        supplierOrgId: null,
        staffUserId: 'user-1',
        priceCents: 4550,
        currency: 'CHF',
        startTime: null,
        durationMinutes: null,
        active: true,
      });
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it('PropertyCleaningCard_SaveWithNoPrice_SendsNoCurrencyEither', async () => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(withoutSetup('CHF'));
      vi.mocked(propertyCleaningApi.save).mockResolvedValue(setupOf({ priceCents: null }));
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-set'));
      await screen.findByRole('option', { name: 'Anna Rossi' });
      fireEvent.change(screen.getByTestId('property-cleaning-staff'), { target: { value: 'user-1' } });
      fireEvent.click(screen.getByTestId('property-cleaning-save'));

      await waitFor(() => expect(propertyCleaningApi.save).toHaveBeenCalledTimes(1));
      expect(propertyCleaningApi.save).toHaveBeenCalledWith(PROPERTY_ID, expect.objectContaining({ priceCents: null, currency: null }));
    });
  });

  describe('what the card knows', () => {
    it('PropertyCleaningCard_ReadThatFails_SaysItDoesNotKnow_AndOffersToTryAgain', async () => {
      vi.mocked(propertyCleaningApi.get).mockRejectedValue(httpError(500));
      renderCard();

      expect(await screen.findByTestId('property-cleaning-error')).toHaveTextContent('non sappiamo come è impostato');
      expect(screen.queryByTestId('property-cleaning-summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('property-cleaning-none')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Riprova' })).toBeEnabled();
    });

    it('PropertyCleaningCard_ReadAgainFails_NeverShowsTheOldAnswerAsCurrent', async () => {
      const { client } = renderCard();
      expect(await screen.findByTestId('property-cleaning-price')).toHaveTextContent('45,00 CHF');

      // The query keeps the old data on the error: the card must not.
      vi.mocked(propertyCleaningApi.get).mockRejectedValue(httpError(500));
      await client.refetchQueries({ queryKey: ['property-cleaning'] });

      expect(await screen.findByTestId('property-cleaning-error')).toBeInTheDocument();
      expect(screen.queryByTestId('property-cleaning-price')).not.toBeInTheDocument();
      expect(screen.queryByTestId('property-cleaning-edit')).not.toBeInTheDocument();
    });

    it('PropertyCleaningCard_Answer404_IsToldAsNotFoundEvenWithTheOldAnswerInTheCache', async () => {
      const { client } = renderCard();
      await screen.findByTestId('property-cleaning-summary');

      vi.mocked(propertyCleaningApi.get).mockRejectedValue(httpError(404, { code: 'property_not_found' }));
      await client.refetchQueries({ queryKey: ['property-cleaning'] });

      expect(await screen.findByTestId('property-cleaning-error')).toHaveTextContent('Non troviamo più questo immobile');
      expect(screen.queryByTestId('property-cleaning-summary')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Riprova' })).not.toBeInTheDocument();
    });

    it('PropertyCleaningCard_NoCleaner_SaysTheCleaningStaysToDoAndOffersToSetOne', async () => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(withoutSetup('EUR'));
      renderCard();

      expect(await screen.findByTestId('property-cleaning-none')).toHaveTextContent('Pulizia da richiedere');
      expect(screen.getByTestId('property-cleaning-set')).toBeEnabled();
    });

    it('PropertyCleaningCard_SetupSwitchedOff_IsToldAsOff', async () => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf({ active: false }));
      renderCard();

      expect(await screen.findByTestId('property-cleaning-state')).toHaveTextContent('Spenta');
    });

    it('PropertyCleaningCard_TheTimeOfTheProperty_IsToldAsWhatItIs', async () => {
      renderCard();

      // The record of the property says it has a check-out time: the empty time of the setup is that time.
      await waitFor(() => expect(screen.getByTestId('property-cleaning-time')).toHaveTextContent('11:00 (l\'ora del check-out dell\'immobile)'));
    });

    it('PropertyCleaningCard_PropertyWithNoCheckOutTime_TellsTheDefaultTimeAndNeverCallsItTheCheckOut', async () => {
      vi.mocked(propertiesApi.getById).mockResolvedValue({ id: PROPERTY_ID, checkOutBy: null } as Property);
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf({ effectiveStartTime: '10:00:00' }));
      renderCard();

      // The server tells 10:00, which is its default and not the check-out of a property that has none.
      await waitFor(() => expect(screen.getByTestId('property-cleaning-time')).toHaveTextContent('10:00 (orario predefinito: l\'immobile non ha un\'ora di check-out)'));
      expect(screen.getByTestId('property-cleaning-time')).not.toHaveTextContent('l\'ora del check-out dell\'immobile');
    });

    it('PropertyCleaningCard_RecordOfThePropertyThatCannotBeRead_TellsTheTimeWithoutSayingWhereItComesFrom', async () => {
      vi.mocked(propertiesApi.getById).mockRejectedValue(httpError(500));
      renderCard();

      const time = await screen.findByTestId('property-cleaning-time');
      await waitFor(() => expect(propertiesApi.getById).toHaveBeenCalled());
      expect(time).toHaveTextContent(/^11:00$/);
    });

    it('PropertyCleaningCard_FormOfAPropertyWithNoCheckOutTime_SaysTheEmptyTimeIsTheDefaultOne', async () => {
      vi.mocked(propertiesApi.getById).mockResolvedValue({ id: PROPERTY_ID, checkOutBy: null } as Property);
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf({ effectiveStartTime: '10:00:00' }));
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-edit'));

      expect(await screen.findByText('Se la lasci vuota, la pulizia parte alle 10:00: l\'immobile non ha un\'ora di check-out.')).toBeInTheDocument();
    });

    it('PropertyCleaningCard_FormOfAPropertyWithACheckOutTime_NamesIt', async () => {
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-edit'));

      expect(await screen.findByText('Se la lasci vuota, la pulizia parte all\'ora del check-out dell\'immobile (11:00).')).toBeInTheDocument();
    });

    it('PropertyCleaningCard_RoutineOn_SaysThatTheCleaningStartsByItself', async () => {
      vi.mocked(routinesApi.getAll).mockResolvedValue([routine({})]);
      renderCard();

      expect(await screen.findByTestId('property-cleaning-routine')).toHaveTextContent('è attiva: la pulizia parte da sola al check-out');
    });

    it('PropertyCleaningCard_RoutineOnButNoCleaner_SaysNothingStartsForThisProperty', async () => {
      vi.mocked(routinesApi.getAll).mockResolvedValue([routine({})]);
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(withoutSetup('EUR'));
      renderCard();

      // The routine is on, but a property with no cleaner is blocked by it: the card never says that its cleaning starts by itself.
      const line = await screen.findByTestId('property-cleaning-routine');
      expect(line).toHaveTextContent('questo immobile non ha chi pulisce attivo');
      expect(line).not.toHaveTextContent('parte da sola');
    });

    it('PropertyCleaningCard_RoutineOnButSetupSwitchedOff_SaysNothingStartsForThisProperty', async () => {
      vi.mocked(routinesApi.getAll).mockResolvedValue([routine({})]);
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf({ active: false }));
      renderCard();

      const line = await screen.findByTestId('property-cleaning-routine');
      expect(line).toHaveTextContent('questo immobile non ha chi pulisce attivo');
      expect(line).not.toHaveTextContent('parte da sola');
    });

    it.each([
      ['a routine in test mode', [routine({ testMode: true })]],
      ['a routine that is off', [routine({ active: false })]],
    ])('PropertyCleaningCard_%s_SaysThatNothingStartsByItself', async (_name, routines) => {
      vi.mocked(routinesApi.getAll).mockResolvedValue(routines);
      renderCard();

      expect(await screen.findByTestId('property-cleaning-routine')).toHaveTextContent('non è attiva');
    });

    it('PropertyCleaningCard_EmptyListOfRoutines_NeverSaysTheRoutineIsOff_AndSendsToTheAutomations', async () => {
      // The server answers an empty list also to who reaches only some of the properties (the routines act on all of them, so such a person sees none): the card cannot tell.
      vi.mocked(routinesApi.getAll).mockResolvedValue([]);
      renderCard();

      const line = await screen.findByTestId('property-cleaning-routine');
      expect(line).toHaveTextContent('Da qui non sappiamo se la routine');
      expect(line).toHaveTextContent('controlla nelle automazioni');
      expect(line).not.toHaveTextContent('non è attiva');
      expect(within(line).getByRole('link', { name: 'Vai alle automazioni' })).toHaveAttribute('href', '/app/short-rent/automations');
    });

    it('PropertyCleaningCard_RoutinesThatCannotBeRead_SayNothingOfTheRoutine', async () => {
      vi.mocked(routinesApi.getAll).mockRejectedValue(httpError(500));
      renderCard();

      await screen.findByTestId('property-cleaning-summary');
      await waitFor(() => expect(routinesApi.getAll).toHaveBeenCalled());
      expect(screen.queryByTestId('property-cleaning-routine')).not.toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('PropertyCleaningCard_SupplierWithNoPrice_AsksForItAndSendsNothing', async () => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(withoutSetup('EUR'));
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-set'));
      fireEvent.click(screen.getByTestId('property-cleaning-save'));

      expect(await screen.findByText('Scegli il fornitore che pulisce.')).toBeInTheDocument();
      expect(screen.getByText('Per un fornitore serve il prezzo concordato.')).toBeInTheDocument();
      expect(propertyCleaningApi.save).not.toHaveBeenCalled();
    });

    it('PropertyCleaningCard_RefusedByTheServer_SaysWhyAndKeepsTheForm', async () => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf());
      vi.mocked(propertyCleaningApi.save).mockRejectedValue(httpError(422, { code: 'cleaning_setup_staff_invalid' }));
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-edit'));
      await screen.findByRole('option', { name: 'Anna Rossi' });
      fireEvent.click(screen.getByTestId('property-cleaning-save'));

      expect(await screen.findByTestId('property-cleaning-save-error')).toHaveTextContent('non è un membro attivo');
      expect(screen.getByTestId('property-cleaning-form')).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('PropertyCleaningCard_SaveInFlight_KeepsEveryControlOfTheCardWaiting', async () => {
      const pending = deferred<PropertyCleaningSetup>();
      vi.mocked(propertyCleaningApi.save).mockReturnValue(pending.promise);
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-edit'));
      await screen.findByRole('option', { name: 'Anna Rossi' });
      fireEvent.click(screen.getByTestId('property-cleaning-save'));

      await waitFor(() => expect(screen.getByTestId('property-cleaning-cancel')).toBeDisabled());
      for (const control of ['property-cleaning-price', 'property-cleaning-time', 'property-cleaning-duration', 'property-cleaning-staff']) {
        expect(screen.getByTestId(control), control).toBeDisabled();
      }
      // A second press does not send a second save.
      fireEvent.click(screen.getByTestId('property-cleaning-save'));
      expect(propertyCleaningApi.save).toHaveBeenCalledTimes(1);

      pending.resolve(setupOf());
      await waitFor(() => expect(screen.queryByTestId('property-cleaning-form')).not.toBeInTheDocument());
    });

    it('PropertyCleaningCard_Team_IsReadAgainEveryTimeTheCardOpens', async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      const first = renderCard(client);
      await screen.findByTestId('property-cleaning-summary');
      await waitFor(() => expect(orgTeamApi.listMembers).toHaveBeenCalledTimes(1));
      first.unmount();

      // Opened again within the minutes the app keeps a list for: the team is read again, and not taken from the cache.
      renderCard(client);
      await screen.findByTestId('property-cleaning-summary');

      await waitFor(() => expect(orgTeamApi.listMembers).toHaveBeenCalledTimes(2));
    });

    it('PropertyCleaningCard_SuppliersOfTheArea_AreReadAgainWhenTheChoiceStartsAgain', async () => {
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(withoutSetup('EUR'));
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-set'));
      await waitFor(() => expect(fetchSuppliersByProperty).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByTestId('property-cleaning-cancel'));
      fireEvent.click(await screen.findByTestId('property-cleaning-set'));

      // A supplier may have been suspended in the meantime: the list is not the one of a minute ago.
      await waitFor(() => expect(fetchSuppliersByProperty).toHaveBeenCalledTimes(2));
    });

    it('PropertyCleaningCard_PersonWhoMayNotManageTheTeam_CannotChooseAMemberAndIsToldWhy', async () => {
      workspace.permissions = ['short-rent:property.write'];
      vi.mocked(propertyCleaningApi.get).mockResolvedValue(withoutSetup('CHF'));
      renderCard();

      fireEvent.click(await screen.findByTestId('property-cleaning-set'));

      expect(screen.getByText(/serve il permesso di gestire il team/)).toBeInTheDocument();
      // The team is not asked for: the server would answer 403, which sends the whole app to the page of no access.
      expect(orgTeamApi.listMembers).not.toHaveBeenCalled();
    });
  });
});

describe('the card in the tab «Prenotazioni e interventi» (flag and permission as in the backend)', () => {
  const property = {
    id: PROPERTY_ID,
    bookingsSummary: { totalBookings: 0, upcomingBookings: 0, activeBookings: 0, nextCheckIn: null, nextCheckOut: null },
  } as unknown as PropertyDetailDto;

  function renderTab({ routines, canWrite }: { routines: boolean; canWrite: boolean }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, routines }, isLoading: false }}>
          <MemoryRouter>
            <PropertyActivityTab property={property} canReadBookings canCreateBooking canWrite={canWrite} />
          </MemoryRouter>
        </FeatureFlagsContext.Provider>
      </QueryClientProvider>,
    );
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    workspace.permissions = ['short-rent:property.write'];
    vi.mocked(propertyCleaningApi.get).mockResolvedValue(setupOf());
    vi.mocked(propertiesApi.getById).mockResolvedValue({ id: PROPERTY_ID, checkOutBy: '11:00:00' } as Property);
    vi.mocked(routinesApi.getAll).mockResolvedValue([]);
    vi.mocked(fetchServiceRequests).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 } as never);
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  it('PropertyActivityTab_RoutinesFlagOnAndWriter_ShowsTheCard', async () => {
    renderTab({ routines: true, canWrite: true });

    expect(await screen.findByTestId('property-cleaning-card')).toBeInTheDocument();
    await screen.findByTestId('property-cleaning-summary');
  });

  it('PropertyActivityTab_RoutinesFlagOff_NothingChanges_AndNothingIsAsked', async () => {
    renderTab({ routines: false, canWrite: true });

    await waitFor(() => expect(screen.getByTestId('property-bookings-link')).toBeInTheDocument());
    expect(screen.queryByTestId('property-cleaning-card')).not.toBeInTheDocument();
    expect(propertyCleaningApi.get).not.toHaveBeenCalled();
    expect(routinesApi.getAll).not.toHaveBeenCalled();
  });

  it('PropertyActivityTab_WhoMayNotWriteTheProperty_NeverSeesTheCard', async () => {
    renderTab({ routines: true, canWrite: false });

    await waitFor(() => expect(screen.getByTestId('property-bookings-link')).toBeInTheDocument());
    expect(screen.queryByTestId('property-cleaning-card')).not.toBeInTheDocument();
    expect(propertyCleaningApi.get).not.toHaveBeenCalled();
  });
});
