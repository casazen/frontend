import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { propertyModeApi } from '@/api/property-mode.api';
import { AppShellContext } from '@/components/layout/app-shell-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import * as propertyQueries from '@/queries/use-properties';
import type { Property, PropertyDetailDto } from '@/types';
import type { PropertyModeChange, PropertyModeState } from '@/types/property-mode.types';
import { PropertyDetailPage } from '../../property-detail-page';
import { LongRentPropertyDetailPage } from '../../long-rent/long-rent-property-detail-page';
import { ScheduledChangeNotice } from '../components/scheduled-change-notice';
import { useModeChangeMenuItems } from '../use-mode-entry';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/queries/use-properties');
vi.mock('@/api/property-mode.api', () => ({
  propertyModeApi: { getState: vi.fn(), preview: vi.fn(), schedule: vi.fn(), cancel: vi.fn() },
}));
vi.mock('@/api/service-requests.api', () => ({
  fetchServiceRequests: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 }),
  markServiceRequestPaid: vi.fn(),
  markLongRentServiceRequestPaid: vi.fn(),
}));
vi.mock('@/queries/use-cin', () => ({ useUpdatePropertyCin: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => false }) }));
vi.mock('../../components/ical-settings', () => ({ IcalSettings: () => <div /> }));
vi.mock('../../components/property-cadastral-card', () => ({ PropertyCadastralCard: () => <div /> }));
vi.mock('../../components/property-documents-section', () => ({ PropertyDocumentsSection: () => <div /> }));
vi.mock('@/features/service-requests/components/long-rent-service-requests', () => ({ LongRentServiceRequests: () => <div /> }));

const PROPERTY_ID = 'prop-1';
const WAIT = { timeout: 5000 };

const waiting = (overrides: Partial<PropertyModeChange> = {}): PropertyModeChange => ({
  id: 'c1',
  propertyId: PROPERTY_ID,
  fromMode: 'Short',
  toMode: 'Long',
  effectiveDate: '2026-12-01',
  status: 'Scheduled',
  createdAt: '2026-10-01T10:00:00Z',
  appliedAt: null,
  cancelledAt: null,
  failedAt: null,
  failureReason: null,
  ...overrides,
});

const state = (scheduledChange: PropertyModeChange | null = null, rentalMode: 'Short' | 'Long' = 'Short'): PropertyModeState => ({
  propertyId: PROPERTY_ID,
  rentalMode,
  scheduledChange,
  lastChange: null,
});

interface Setup {
  flag?: boolean;
  /** The areas where the person may write properties. */
  writes?: Array<'short-rent' | 'long-rent'>;
}

function providers({ flag = true, writes = ['short-rent', 'long-rent'] }: Setup = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const workspace = {
    hasPermission: (area: string, permission: string) => permission === 'property.write' && (writes as string[]).includes(area),
  } as unknown as WorkspaceContextValue;
  return function Providers({ children, path }: { children: ReactNode; path?: string }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, propertyModeChange: flag }, isLoading: false }}>
            <WorkspaceContext.Provider value={workspace}>
              <AppShellContext.Provider value={{ contextKey: 'long-rent' }}>
                <MemoryRouter initialEntries={[path ?? '/']}>{children}</MemoryRouter>
              </AppShellContext.Provider>
            </WorkspaceContext.Provider>
          </FeatureFlagsContext.Provider>
        </QueryClientProvider>
      </I18nextProvider>
    );
  };
}

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('it');
  vi.mocked(propertyModeApi.getState).mockResolvedValue(state());
});

afterEach(() => cleanup());

describe('useModeChangeMenuItems (PM-03)', () => {
  it('useModeChangeMenuItems_FlagOffOrNoPermission_GivesNoEntry', () => {
    const entries = [
      { setup: { flag: false }, area: 'short-rent' as const },
      { setup: { flag: true, writes: [] }, area: 'short-rent' as const },
      // The permission of the other area does not open this one.
      { setup: { flag: true, writes: ['long-rent' as const] }, area: 'short-rent' as const },
    ];
    for (const { setup, area } of entries) {
      const { result } = renderHook(() => useModeChangeMenuItems(area, PROPERTY_ID), { wrapper: providers(setup) });
      expect(result.current).toEqual([]);
    }
  });

  it('useModeChangeMenuItems_FlagOnAndPermission_IsTheWizardOfTheSectionOfThePage', () => {
    const short = renderHook(() => useModeChangeMenuItems('short-rent', PROPERTY_ID), { wrapper: providers() });
    expect(short.result.current).toEqual([
      expect.objectContaining({ label: 'Cambia modalità', to: '/app/short-rent/properties/prop-1/mode', testId: 'property-mode-change' }),
    ]);
    const long = renderHook(() => useModeChangeMenuItems('long-rent', PROPERTY_ID), { wrapper: providers() });
    expect(long.result.current[0]).toMatchObject({ to: '/app/long-rent/properties/prop-1/mode' });
  });

  it('useModeChangeMenuItems_OutsideTheWorkspace_GivesNoEntryInsteadOfFailing', () => {
    const OnlyFlag = ({ children }: { children: ReactNode }) => (
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, propertyModeChange: true }, isLoading: false }}>
        {children}
      </FeatureFlagsContext.Provider>
    );
    const { result } = renderHook(() => useModeChangeMenuItems('short-rent', PROPERTY_ID), { wrapper: OnlyFlag });
    expect(result.current).toEqual([]);
  });
});

describe('the pages of a property (PM-03)', () => {
  const detail = {
    id: PROPERTY_ID,
    ownerId: 'owner',
    name: 'Test Villa',
    description: '',
    address: 'Via Roma 1',
    city: 'Roma',
    postalCode: '00100',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 100,
    cleaningFee: 0,
    damageDeposit: 0,
    cinCode: null,
    cinStatus: 'Missing',
    timezone: 'Europe/Rome',
    amenities: [],
    photoUrls: [],
    houseRules: '',
    isActive: true,
    isPaused: false,
    pausedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    documents: [],
    otaIntegrations: [],
    bookingsSummary: { totalBookings: 0, upcomingBookings: 0, activeBookings: 0, nextCheckIn: null, nextCheckOut: null },
    pricingAdapterSummary: { isEnabled: false, lastAdaptedAt: null, nextRunOn: null },
  } as unknown as PropertyDetailDto;

  beforeEach(() => {
    vi.mocked(propertyQueries.usePropertyDetail).mockReturnValue({ data: detail, isLoading: false, isError: false } as ReturnType<typeof propertyQueries.usePropertyDetail>);
    vi.mocked(propertyQueries.usePauseProperty).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof propertyQueries.usePauseProperty>);
    vi.mocked(propertyQueries.useActivateProperty).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof propertyQueries.useActivateProperty>);
    vi.mocked(propertyQueries.useProperty).mockReturnValue({
      data: { id: PROPERTY_ID, name: 'Bilocale Monza', city: 'Monza', rentalMode: 'Long', address: 'Via Italia 1', postalCode: '20900', bedrooms: 2, bathrooms: 1 } as unknown as Property,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
    } as unknown as ReturnType<typeof propertyQueries.useProperty>);
    vi.mocked(propertyQueries.usePropertyDocuments).mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof propertyQueries.usePropertyDocuments>);
  });

  function renderShort(setup?: Setup) {
    const Providers = providers(setup);
    return render(
      <Providers path={`/app/short-rent/properties/${PROPERTY_ID}`}>
        <Routes>
          <Route path="/app/short-rent/properties/:id" element={<PropertyDetailPage />} />
        </Routes>
      </Providers>,
    );
  }

  function renderLong(setup?: Setup) {
    const Providers = providers(setup);
    return render(
      <Providers path={`/app/long-rent/properties/${PROPERTY_ID}`}>
        <Routes>
          <Route path="/app/long-rent/properties/:id" element={<LongRentPropertyDetailPage />} />
        </Routes>
      </Providers>,
    );
  }

  async function openTheMenu() {
    fireEvent.keyDown(screen.getByRole('button', { name: i18n.t('pageHeader.moreActions') }), { key: 'Enter' });
    return screen.findByRole('menu');
  }

  it('PropertyDetailPage_FlagOn_OffersTheChangeInTheMenuOfTheThreeDots', async () => {
    renderShort();

    // The other actions of the page stay where they were (the pause, the supplier, the edit); this one is in the menu.
    expect(screen.getByTestId('property-pause-toggle')).toBeInTheDocument();
    const menu = await openTheMenu();
    expect(within(menu).getByRole('menuitem', { name: 'Cambia modalità' })).toHaveAttribute('href', '/app/short-rent/properties/prop-1/mode');
  });

  it('PropertyDetailPage_FlagOff_HasNoMenuNoRowAndNeverAsksForTheMode', () => {
    renderShort({ flag: false });

    // The header is the one it always was: no "⋯" at all, and nothing of the feature runs, not even the request for the state.
    expect(screen.queryByRole('button', { name: i18n.t('pageHeader.moreActions') })).not.toBeInTheDocument();
    expect(screen.getByTestId('property-pause-toggle')).toBeInTheDocument();
    expect(propertyModeApi.getState).not.toHaveBeenCalled();
  });

  it('PropertyDetailPage_WithoutTheWritePermission_HasNoEntry', () => {
    renderShort({ flag: true, writes: [] });

    expect(screen.queryByRole('button', { name: i18n.t('pageHeader.moreActions') })).not.toBeInTheDocument();
  });

  it('LongRentPropertyDetailPage_FlagOn_PutsTheChangeInTheMenuNextToTheEdit', async () => {
    renderLong();

    fireEvent.keyDown(screen.getByRole('button', { name: i18n.t('pageHeader.moreActions') }), { key: 'Enter' });
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: i18n.t('longRentProperties.detail.edit') })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Cambia modalità' })).toHaveAttribute(
      'href',
      '/app/long-rent/properties/prop-1/mode',
    );
  });

  it('LongRentPropertyDetailPage_FlagOff_TheMenuIsWhatItWas', async () => {
    renderLong({ flag: false });

    fireEvent.keyDown(screen.getByRole('button', { name: i18n.t('pageHeader.moreActions') }), { key: 'Enter' });
    const menu = await screen.findByRole('menu');
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(1);
    expect(within(menu).queryByRole('menuitem', { name: 'Cambia modalità' })).not.toBeInTheDocument();
    expect(propertyModeApi.getState).not.toHaveBeenCalled();
  });

  it('thePages_AChangeWaits_ShowTheRowOfStatusInTheirOwnSection', async () => {
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state(waiting()));
    renderShort();
    expect(await screen.findByTestId('property-mode-notice', undefined, WAIT)).toHaveTextContent("Passaggio all'affitto lungo il 1 dicembre 2026");
    cleanup();

    vi.mocked(propertyModeApi.getState).mockResolvedValue(state(waiting({ fromMode: 'Long', toMode: 'Short' }), 'Long'));
    renderLong();
    const notice = await screen.findByTestId('property-mode-notice', undefined, WAIT);
    expect(notice).toHaveTextContent("Passaggio all'affitto breve il 1 dicembre 2026");
    expect(notice).toHaveTextContent("Fino ad allora l'immobile resta in Affitti lunghi.");
  });
});

describe('ScheduledChangeNotice (PM-03)', () => {
  function renderNotice(setup?: Setup) {
    const Providers = providers(setup);
    return render(
      <Providers>
        <ScheduledChangeNotice area="short-rent" propertyId={PROPERTY_ID} />
      </Providers>,
    );
  }

  it('ScheduledChangeNotice_FlagOff_RendersNothingAndAsksForNothing', () => {
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state(waiting()));
    const { container } = renderNotice({ flag: false });

    expect(container).toBeEmptyDOMElement();
    expect(propertyModeApi.getState).not.toHaveBeenCalled();
  });

  it('ScheduledChangeNotice_NoChangeWaiting_RendersNothing', async () => {
    const { container } = renderNotice();

    await waitFor(() => expect(propertyModeApi.getState).toHaveBeenCalledWith(PROPERTY_ID), WAIT);
    expect(container).toBeEmptyDOMElement();
  });

  it('ScheduledChangeNotice_AChangeWaits_SaysWhatAndWhenAndWithdrawsItAfterAsking', async () => {
    let current: PropertyModeChange | null = waiting();
    vi.mocked(propertyModeApi.getState).mockImplementation(async () => state(current));
    vi.mocked(propertyModeApi.cancel).mockImplementation(async () => {
      current = null;
    });
    renderNotice();

    const notice = await screen.findByTestId('property-mode-notice', undefined, WAIT);
    expect(notice).toHaveTextContent("Passaggio all'affitto lungo il 1 dicembre 2026");
    expect(notice).toHaveTextContent("Fino ad allora l'immobile resta in Affitti brevi.");

    fireEvent.click(screen.getByTestId('property-mode-notice-cancel'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('confirmation-consequences')).toHaveTextContent("L'immobile resta in Affitti brevi.");
    // Nothing is withdrawn by opening the question.
    expect(propertyModeApi.cancel).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('propertyMode.cancel.action') }));

    await waitFor(() => expect(propertyModeApi.cancel).toHaveBeenCalledWith(PROPERTY_ID, 'c1'), WAIT);
    expect(toast.success).toHaveBeenCalledWith(i18n.t('propertyMode.cancel.done'));
    // The state is read again and the row is gone.
    await waitFor(() => expect(screen.queryByTestId('property-mode-notice')).not.toBeInTheDocument(), WAIT);
  });

  it('ScheduledChangeNotice_KeepTheChange_WithdrawsNothing', async () => {
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state(waiting()));
    renderNotice();

    fireEvent.click(await screen.findByTestId('property-mode-notice-cancel', undefined, WAIT));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('propertyMode.cancel.keep') }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), WAIT);
    expect(propertyModeApi.cancel).not.toHaveBeenCalled();
    expect(screen.getByTestId('property-mode-notice')).toBeInTheDocument();
  });

  it('ScheduledChangeNotice_WithoutTheWritePermission_ShowsTheRowButNotTheWithdrawal', async () => {
    vi.mocked(propertyModeApi.getState).mockResolvedValue(state(waiting()));
    renderNotice({ writes: [] });

    expect(await screen.findByTestId('property-mode-notice', undefined, WAIT)).toHaveTextContent('Passaggio');
    expect(screen.queryByTestId('property-mode-notice-cancel')).not.toBeInTheDocument();
  });

  it('ScheduledChangeNotice_TheWithdrawalFails_SaysWhyAndShowsTheStateTheServerHas', async () => {
    let current: PropertyModeChange | null = waiting();
    vi.mocked(propertyModeApi.getState).mockImplementation(async () => state(current));
    vi.mocked(propertyModeApi.cancel).mockImplementation(async () => {
      // Someone else did it first: the change is not waiting any more.
      current = null;
      throw axiosError(409, { code: 'property_mode_change_not_scheduled' });
    });
    renderNotice();

    fireEvent.click(await screen.findByTestId('property-mode-notice-cancel', undefined, WAIT));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('propertyMode.cancel.action') }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('apiErrors.codes.propertyModeChangeNotScheduled')), WAIT);
    expect(toast.success).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId('property-mode-notice')).not.toBeInTheDocument(), WAIT);
  });
});
