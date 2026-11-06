import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClient } from '@/api/client';
import i18n from '@/i18n/config';
import type { MarketplaceCatalogEntry, MarketplaceEntryDetail } from '@/types';
import { marketplaceLanguage, useMarketplaceActive, useMarketplaceCatalog, useMarketplaceEntry, usePartnersByServiceCategory } from '../use-marketplace';

vi.mock('@/api/client', () => ({ ApiClient: { get: vi.fn() } }));

const workspace = vi.hoisted(() => ({ canReadBookings: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (context: string, permission: string) => workspace.canReadBookings && context === 'short-rent' && permission === 'booking.read',
  }),
}));

const get = vi.mocked(ApiClient.get);

const PROPERTY_ID = 'prop-1';

function partner(code: string, serviceCategories: string[]): MarketplaceCatalogEntry {
  return {
    kind: 'Partner',
    code,
    name: `TEST partner ${code}`,
    logoUrl: null,
    benefit: `Benefit of ${code}`,
    cost: { text: null, invoicedBy: 'Unknown' },
    status: 'NotActive',
    statusScope: 'Org',
    canActivate: true,
    reason: null,
    job: 'Cleaning',
    websiteUrl: 'https://example.com/',
    serviceCategories,
    octoratePortalCode: null,
  };
}

// The ids of the groups are written as the backend may write them (member names): the module reads them as the page spells them.
const CATALOG = {
  octorate: { enabled: true, connected: false },
  groups: [
    { id: 'SalesChannels', unchangedFlow: false, entries: [] },
    { id: 'ConnectedTools', unchangedFlow: false, entries: [] },
    { id: 'ChannelManagerFunctions', unchangedFlow: false, entries: [] },
    { id: 'HomeServices', unchangedFlow: true, entries: [] },
    { id: 'Partners', unchangedFlow: false, entries: [partner('cleaners-one', ['cleaning']), partner('checkin-one', ['check-in']), partner('both-one', ['cleaning', 'maintenance'])] },
  ],
};

const DETAIL = {
  kind: 'Channel',
  code: 'AIRBNB',
  name: 'Airbnb',
  logoUrl: null,
  status: 'NotActive',
  whatItDoes: 'It sells.',
  audience: 'Hosts.',
  activation: { type: 'api', requirements: null, needsOctoratePanel: false },
  cost: { text: null, invoicedBy: 'Unknown' },
  dataShared: null,
  deactivation: { text: '', guided: false },
  faq: null,
  actions: { canActivate: true, reason: null },
} as unknown as MarketplaceEntryDetail;

const ACTIVE = { integrations: [], providers: [] };

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

function answer(url: string): unknown {
  if (url === '/marketplace/catalog') return CATALOG;
  if (url.startsWith('/marketplace/entries/')) return DETAIL;
  if (url === '/marketplace/active') return ACTIVE;
  throw new Error(`unexpected request ${url}`);
}

beforeEach(async () => {
  vi.clearAllMocks();
  workspace.canReadBookings = true;
  await i18n.changeLanguage('it');
  // The defaults of the app: what was read in the last 5 minutes is not read again when a page opens.
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60_000, refetchOnMount: false }, mutations: { retry: false } } });
  get.mockImplementation(((url: string) => Promise.resolve(answer(url))) as never);
});

afterEach(() => queryClient.clear());

describe('marketplaceLanguage', () => {
  it.each([
    ['it', 'it'],
    ['it-IT', 'it'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['EN', 'en'],
    ['de', 'it'],
    [undefined, 'it'],
  ])('marketplaceLanguage_%s_Is_%s', (language, expected) => {
    expect(marketplaceLanguage(language)).toBe(expected);
  });
});

describe('useMarketplaceCatalog', () => {
  it('useMarketplaceCatalog_PropertyAndLanguage_AsksThroughTheApiModuleAndReadsTheGroupsAsThePageSpellsThem', async () => {
    const { result } = renderHook(() => useMarketplaceCatalog(PROPERTY_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(get).toHaveBeenCalledWith('/marketplace/catalog', { propertyId: PROPERTY_ID, lang: 'it' });
    expect(result.current.data?.groups.map((group) => group.id)).toEqual([
      'salesChannels',
      'connectedTools',
      'channelManagerFunctions',
      'homeServices',
      'partners',
    ]);
    expect(result.current.data?.octorate).toEqual({ enabled: true, connected: false });
    expect(result.current.data?.groups[3].unchangedFlow).toBe(true);
  });

  it('useMarketplaceCatalog_LanguageChanges_AsksAgainInTheNewLanguage', async () => {
    const { result } = renderHook(() => useMarketplaceCatalog(PROPERTY_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      await i18n.changeLanguage('en');
    });

    await waitFor(() => expect(get).toHaveBeenCalledWith('/marketplace/catalog', { propertyId: PROPERTY_ID, lang: 'en' }));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('useMarketplaceCatalog_NoProperty_AsksForTheWholeScope', async () => {
    const { result } = renderHook(() => useMarketplaceCatalog(undefined), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(get).toHaveBeenCalledWith('/marketplace/catalog', { propertyId: undefined, lang: 'it' });
  });

  it('useMarketplaceCatalog_PageOpensAgain_ReadsAgainEvenWhatWasReadMinutesAgoNotOnlyWhatIsStale', async () => {
    const first = renderHook(() => useMarketplaceCatalog(PROPERTY_ID), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    expect(get).toHaveBeenCalledTimes(1);

    // A wizard activated something in between: the page that opens shows what the server says now.
    renderHook(() => useMarketplaceCatalog(PROPERTY_ID), { wrapper });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });

  it('useMarketplaceCatalog_AnswerThatIsNotACatalog_IsALoadErrorNotAnEmptyMarketplace', async () => {
    get.mockResolvedValue('<!doctype html><html></html>' as never);

    const { result } = renderHook(() => useMarketplaceCatalog(PROPERTY_ID), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useMarketplaceEntry', () => {
  it('useMarketplaceEntry_KindAndCode_AsksThatEntryForThePropertyInTheLanguage', async () => {
    const { result } = renderHook(() => useMarketplaceEntry('Channel', 'AIRBNB', PROPERTY_ID), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(get).toHaveBeenCalledWith('/marketplace/entries/Channel/AIRBNB', { propertyId: PROPERTY_ID, lang: 'it' });
    // The lists the card draws are always lists, whatever the server leaves out.
    expect(result.current.data?.activation.requirements).toEqual([]);
    expect(result.current.data?.dataShared).toEqual([]);
    expect(result.current.data?.faq).toEqual([]);
  });

  it('useMarketplaceEntry_CodeThatCouldCarryAPath_IsEncodedIntoOneSegment', async () => {
    const { result } = renderHook(() => useMarketplaceEntry('Partner', '../admin', undefined), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(get).toHaveBeenCalledWith('/marketplace/entries/Partner/..%2Fadmin', { propertyId: undefined, lang: 'it' });
  });

  it.each([
    ['no kind', undefined, 'AIRBNB'],
    ['no code', 'Channel', undefined],
    ['an empty kind', '', 'AIRBNB'],
    ['an empty code', 'Channel', ''],
  ])('useMarketplaceEntry_%s_SendsNoRequest', async (_name, kind, code) => {
    const { result } = renderHook(() => useMarketplaceEntry(kind, code, PROPERTY_ID), { wrapper });

    // Let a query that was not started have its chance to start.
    await act(async () => {
      await Promise.resolve();
    });

    expect(get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useMarketplaceActive', () => {
  it('useMarketplaceActive_Property_AsksTheActiveListAndReadsItAgainWhenThePageOpens', async () => {
    const first = renderHook(() => useMarketplaceActive(PROPERTY_ID), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/marketplace/active', { propertyId: PROPERTY_ID });
    first.unmount();

    renderHook(() => useMarketplaceActive(PROPERTY_ID), { wrapper });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
  });
});

describe('usePartnersByServiceCategory', () => {
  it('usePartnersByServiceCategory_Category_ReturnsOnlyThePartnersThatListIt_WithoutAProperty', async () => {
    const { result } = renderHook(() => usePartnersByServiceCategory(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // A partner does not depend on a property: the catalog is read without one.
    expect(get).toHaveBeenCalledWith('/marketplace/catalog', { propertyId: undefined, lang: 'it' });
    expect(result.current.partnersFor('cleaning').map((entry) => entry.code)).toEqual(['cleaners-one', 'both-one']);
    expect(result.current.partnersFor('maintenance').map((entry) => entry.code)).toEqual(['both-one']);
    expect(result.current.partnersFor('check-in').map((entry) => entry.code)).toEqual(['checkin-one']);
    expect(result.current.partnersFor('plumbing')).toEqual([]);
    expect(result.current.hasPartners).toBe(true);
  });

  it('usePartnersByServiceCategory_WhileTheCatalogLoads_OffersNoneAndSaysItIsLoading', async () => {
    const { result } = renderHook(() => usePartnersByServiceCategory(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.partnersFor('cleaning')).toEqual([]);
    expect(result.current.hasPartners).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('usePartnersByServiceCategory_CatalogFails_OffersNone', async () => {
    get.mockRejectedValue(new Error('boom') as never);

    const { result } = renderHook(() => usePartnersByServiceCategory(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.partnersFor('cleaning')).toEqual([]);
    expect(result.current.hasPartners).toBe(false);
  });

  it('usePartnersByServiceCategory_PersonWhoMayNotReadTheCatalog_NeverAsksForIt', async () => {
    // A read they may not make would send them to the page of no access, out of the request they are making.
    workspace.canReadBookings = false;

    const { result } = renderHook(() => usePartnersByServiceCategory(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });
    expect(get).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.partnersFor('cleaning')).toEqual([]);
  });

  it('usePartnersByServiceCategory_AlreadyRead_ServesTheCacheWithoutAskingAgainOnMount', async () => {
    const first = renderHook(() => usePartnersByServiceCategory(), { wrapper });
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    first.unmount();

    // The steps of the wizard each ask for the partners: one read serves them all.
    const second = renderHook(() => usePartnersByServiceCategory(), { wrapper });

    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.partnersFor('cleaning')).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
