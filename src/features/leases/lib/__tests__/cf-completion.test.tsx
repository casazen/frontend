import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConcordatoFacileApi } from '@/api/concordatofacile.api';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { CF_SYNC_POLL_MS, CF_SYNC_QUERY_KEY } from '@/queries/use-concordatofacile';
import type { CfSyncResponse } from '@/types/concordatofacile.types';
import type { LeaseDetail } from '@/types';
import { buildDetail, httpError } from '../../__tests__/lease-test-utils';
import { followsThePractice, useCfCompletion } from '../cf-completion';

vi.mock('@/api/concordatofacile.api', () => ({ ConcordatoFacileApi: { sync: vi.fn() } }));

const sync = vi.mocked(ConcordatoFacileApi.sync);

/** The API keeps 1 January 3000 as the start of a draft saved with only its property. */
const PLACEHOLDER_DATE = '3000-01-01T00:00:00Z';

/** A canone concordato draft saved with only its property, for the guided service. */
const partnerDraft = (overrides: Partial<LeaseDetail> = {}) => buildDetail({ status: 'Draft', contractType: 'Concordato', startDate: PLACEHOLDER_DATE, ...overrides });

const answer = (state: CfSyncResponse['state'], leaseStatus: CfSyncResponse['leaseStatus'] = 'Draft'): CfSyncResponse => ({ state, leaseStatus });

interface Setup {
  flags?: Partial<FeatureFlags>;
  /** The permissions of the person (`true` for all, none given: a page rendered with no workspace). */
  workspace?: 'all' | { deny: string[] };
}

function setup({ flags = { concordatoFacile: true }, workspace }: Setup = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const value =
    workspace === undefined
      ? undefined
      : ({ hasPermission: (_context: string, permission: string) => workspace === 'all' || !workspace.deny.includes(permission) } as WorkspaceContextValue);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading: false }}>
          <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
        </FeatureFlagsContext.Provider>
      </QueryClientProvider>
    );
  }
  return { client, invalidate, Wrapper };
}

const invalidatedKeys = (invalidate: ReturnType<typeof setup>['invalidate']) => invalidate.mock.calls.map(([filters]) => filters?.queryKey);

describe('followsThePractice', () => {
  it.each([
    ['the draft made for the service', partnerDraft(), true],
    ['a concordato draft with its own dates, not marked as the service’s', buildDetail({ status: 'Draft', contractType: 'Concordato' }), false],
    ['a draft the server marked as the service’s (its data were read from the documents)', buildDetail({ status: 'Draft', contractType: 'Concordato', isConcordatoFacileSource: true }), true],
    ['the signed contract of the service, waiting for the receipt', buildDetail({ status: 'Signed', contractType: 'Concordato', isConcordatoFacileSource: true }), true],
    ['a signed contract that is not the service’s', buildDetail({ status: 'Signed', contractType: 'Concordato' }), false],
    ['the registered contract of the service: nothing left to follow', buildDetail({ status: 'Registered', contractType: 'Concordato', isConcordatoFacileSource: true }), false],
    ['a libero draft', buildDetail({ status: 'Draft', contractType: 'Libero', startDate: PLACEHOLDER_DATE }), false],
  ])('%s', (_label, lease, expected) => {
    expect(followsThePractice(lease)).toBe(expected);
  });
});

describe('useCfCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sync.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks the server to move the draft of the service on when its sheet opens, and gives back what it answered', async () => {
    sync.mockResolvedValue(answer('WaitingForContract'));
    const { Wrapper } = setup();

    const { result } = renderHook(() => useCfCompletion(partnerDraft()), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.state).toBe('WaitingForContract'));
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith('lease-1');
  });

  it.each([
    ['the service is off', { flags: { concordatoFacile: false }, lease: partnerDraft() }],
    ['the lease is a concordato draft with its own data (not the service’s)', { lease: buildDetail({ status: 'Draft', contractType: 'Concordato' }) }],
    ['the lease is registered', { lease: buildDetail({ status: 'Registered', contractType: 'Concordato', isConcordatoFacileSource: true }) }],
    ['the person may not register contracts (the server would answer 403)', { workspace: { deny: ['lease.register'] }, lease: partnerDraft() }],
    ['the person may not sign contracts (the server would answer 403)', { workspace: { deny: ['lease.sign'] }, lease: partnerDraft() }],
  ] as const)('asks nothing when %s', async (_label, { lease, ...options }) => {
    const { Wrapper } = setup(options as Setup);

    const { result } = renderHook(() => useCfCompletion(lease), { wrapper: Wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sync).not.toHaveBeenCalled();
    expect(result.current.state).toBeUndefined();
  });

  it('asks when the person may sign and register', async () => {
    sync.mockResolvedValue(answer('WaitingForContract'));
    const { Wrapper } = setup({ workspace: 'all' });

    renderHook(() => useCfCompletion(partnerDraft()), { wrapper: Wrapper });

    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
  });

  it('reads the lease, its documents and the reading of its draft again when the server moved the lease on', async () => {
    sync.mockResolvedValue(answer('Completed', 'Registered'));
    const { Wrapper, invalidate } = setup();

    renderHook(() => useCfCompletion(partnerDraft({ isConcordatoFacileSource: true })), { wrapper: Wrapper });

    await waitFor(() => expect(invalidatedKeys(invalidate)).toContainEqual(['leases']));
    expect(invalidatedKeys(invalidate)).toContainEqual(['lease-documents', 'lease-1']);
    expect(invalidatedKeys(invalidate)).toContainEqual(['lease-draft', 'lease-1']);
  });

  it('reads the lease again, once, when the server has just marked an old draft as the service’s', async () => {
    sync.mockResolvedValue(answer('ReadingContract'));
    const { Wrapper, invalidate } = setup();

    renderHook(() => useCfCompletion(partnerDraft()), { wrapper: Wrapper });

    await waitFor(() => expect(invalidatedKeys(invalidate)).toContainEqual(['leases']));
    expect(invalidatedKeys(invalidate).filter((key) => key?.[0] === 'leases')).toHaveLength(1);
  });

  it.each([
    ['a lease that is the service’s and stays a draft', partnerDraft({ isConcordatoFacileSource: true }), answer('WaitingForSignature')],
    ['a lease that is not marked and the server says it is not the service’s', partnerDraft(), answer('NotApplicable')],
  ])('leaves the lease alone for %s', async (_label, lease, response) => {
    sync.mockResolvedValue(response);
    const { Wrapper, invalidate } = setup();

    const { result } = renderHook(() => useCfCompletion(lease), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.state).toBe(response.state));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('asks again every few seconds while the server reads a document, and stops once it is done', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sync
      .mockResolvedValueOnce(answer('ReadingContract'))
      .mockResolvedValueOnce(answer('ReadingContract'))
      .mockResolvedValue(answer('WaitingForSignature'));
    const { Wrapper } = setup();

    const { result } = renderHook(() => useCfCompletion(partnerDraft({ isConcordatoFacileSource: true })), { wrapper: Wrapper });
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CF_SYNC_POLL_MS);
    });
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CF_SYNC_POLL_MS);
    });
    await waitFor(() => expect(result.current.state).toBe('WaitingForSignature'));
    expect(sync).toHaveBeenCalledTimes(3);

    // The practice is what the lease waits for now: nothing changes by itself in a few seconds, so it is not asked again.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CF_SYNC_POLL_MS * 3);
    });
    expect(sync).toHaveBeenCalledTimes(3);
  });

  it('does not ask again after a failure (no permission, no lease): the sheet is the sheet it was', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    sync.mockRejectedValue(httpError(403));
    const { Wrapper } = setup();

    const { result } = renderHook(() => useCfCompletion(partnerDraft()), { wrapper: Wrapper });
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CF_SYNC_POLL_MS * 3);
    });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBeUndefined();
  });

  it('asks again when a document is uploaded (whoever uploads invalidates the sync of the lease)', async () => {
    sync.mockResolvedValue(answer('WaitingForContract'));
    const { Wrapper, client } = setup();

    renderHook(() => useCfCompletion(partnerDraft({ isConcordatoFacileSource: true })), { wrapper: Wrapper });
    await waitFor(() => expect(sync).toHaveBeenCalledTimes(1));

    await act(async () => {
      await client.invalidateQueries({ queryKey: CF_SYNC_QUERY_KEY('lease-1') });
    });

    await waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
  });
});
