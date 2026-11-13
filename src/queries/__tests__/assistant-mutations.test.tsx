import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { approvalQueueApi } from '@/api/approvalQueue.api';
import { assistantDraftsApi } from '@/api/assistant-drafts.api';
import { assistantSettingsApi } from '@/api/assistant-settings.api';
import { StaleSettingsError } from '@/features/assistant/lib/assistant-model';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import type { AssistantRules, SaveAssistantRulesRequest } from '@/types/assistant-settings.types';
import { useApproveItem, useEditItem, useRejectItem, useSaveAndApproveItem } from '../approvalQueue';
import { useRequestDraft } from '../use-assistant-drafts';
import { useSaveAssistantRules, useSaveKnowledgeEntry } from '../use-assistant-settings';

vi.mock('@/api/approvalQueue.api', () => ({ approvalQueueApi: { getPending: vi.fn(), edit: vi.fn(), approve: vi.fn(), reject: vi.fn() } }));
vi.mock('@/api/assistant-drafts.api', () => ({ assistantDraftsApi: { requestDraft: vi.fn() } }));
vi.mock('@/api/assistant-settings.api', () => ({
  assistantSettingsApi: { createPropertyEntry: vi.fn(), createOrganizationEntry: vi.fn(), getRules: vi.fn(), saveRules: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const GUEST_TEXT = 'Buongiorno Sofia, la password del wifi è tramonto2026';

function item(overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return {
    id: 'a1',
    itemType: 'MessageDraft',
    itemId: 'i1',
    contentText: GUEST_TEXT,
    contentVersion: null,
    isAiGenerated: true,
    status: 'Approved',
    approvedByUserId: null,
    approvedAt: null,
    createdAt: '2026-11-10T08:00:00Z',
    expiresAt: '2026-11-17T08:00:00Z',
    propertyId: 'p1',
    originAction: 'SendGuestMessage',
    originActionStatus: 'Executed',
    originActionError: null,
    originActionExecutedAt: null,
    originActionResult: 'Sent',
    confidenceScore: 0.9,
    situationCode: 'wifi',
    threadKey: 'ota:6f1c9a52-1111-4222-8333-944455556666',
    editedContentText: null,
    editedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

/** A refusal as axios makes it: it carries the request that was sent, with the text of the host in its body. */
function refusal(status: number, data: Record<string, unknown>): AxiosError {
  const config = { headers: new AxiosHeaders({ Authorization: 'Bearer secret-token' }), data: JSON.stringify({ text: GUEST_TEXT }) } as InternalAxiosRequestConfig;
  return new AxiosError('failed', String(status), config, { sent: GUEST_TEXT }, { status, data, statusText: '', headers: {}, config });
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('the mutations that carry the text of a message or a draft keep nothing after the screen is left', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(approvalQueueApi.getPending).mockResolvedValue([]);
  });

  afterEach(() => cleanup());

  /** Runs the mutation, leaves the screen, and says what the cache of the mutations still holds. */
  async function heldAfterLeaving<TVariables>(hook: () => { mutateAsync: (variables: TVariables) => Promise<unknown> }, variables: TVariables) {
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(hook, { wrapper });
    await result.current.mutateAsync(variables);
    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    return client.getMutationCache().getAll();
  }

  it('useApproveItem_AfterTheScreenIsLeft_KeepsNoTextOfTheGuestInTheMutationCache', async () => {
    vi.mocked(approvalQueueApi.approve).mockResolvedValue(item());

    expect(await heldAfterLeaving(() => useApproveItem(), 'a1')).toEqual([]);
  });

  it('useEditItem_AfterTheScreenIsLeft_KeepsNoTextOfTheHostInTheMutationCache', async () => {
    vi.mocked(approvalQueueApi.edit).mockResolvedValue(item({ editedContentText: GUEST_TEXT }));

    expect(await heldAfterLeaving(() => useEditItem(), { id: 'a1', text: GUEST_TEXT })).toEqual([]);
  });

  it('useSaveAndApproveItem_AfterTheScreenIsLeft_KeepsNoTextInTheMutationCache', async () => {
    vi.mocked(approvalQueueApi.edit).mockResolvedValue(item());
    vi.mocked(approvalQueueApi.approve).mockResolvedValue(item());

    expect(await heldAfterLeaving(() => useSaveAndApproveItem(), { id: 'a1', text: GUEST_TEXT })).toEqual([]);
  });

  it('useRejectItem_AfterTheScreenIsLeft_KeepsNoReasonInTheMutationCache', async () => {
    vi.mocked(approvalQueueApi.reject).mockResolvedValue(item({ status: 'Rejected' }));

    expect(await heldAfterLeaving(() => useRejectItem(), { id: 'a1', data: { reason: GUEST_TEXT } })).toEqual([]);
  });

  it('useRequestDraft_AfterTheScreenIsLeft_KeepsNothingInTheMutationCache', async () => {
    vi.mocked(assistantDraftsApi.requestDraft).mockResolvedValue({
      inboundMessageId: 'm1',
      decision: 'Drafted',
      reason: null,
      situation: 'WiFi',
      situationCode: 'wifi',
      urgency: 'Normal',
      confidenceScore: 0.9,
      approvalItemId: 'a1',
      activityId: null,
    });

    expect(await heldAfterLeaving(() => useRequestDraft('ota:6f1c9a52-1111-4222-8333-944455556666'), undefined)).toEqual([]);
  });

  it('useSaveKnowledgeEntry_AfterTheScreenIsLeft_KeepsNoAnswerOfTheHostWhichMayHoldAPassword', async () => {
    vi.mocked(assistantSettingsApi.createPropertyEntry).mockResolvedValue({} as never);

    const held = await heldAfterLeaving(() => useSaveKnowledgeEntry(), {
      scope: { propertyId: 'p1' },
      entryId: null,
      request: { topic: 'WiFi', kind: 'Fact', title: null, text: GUEST_TEXT, language: null, isActive: true },
    });

    expect(held).toEqual([]);
  });

  const RULES: AssistantRules = {
    enabled: true,
    tone: 'Neutral',
    languages: ['it'],
    signature: 'Sofia',
    hoursFrom: null,
    hoursTo: null,
    allowedTopics: [],
    forbiddenTopics: [],
    confidenceThreshold: 0.85,
    instructionVersion: 2,
  };
  const RULES_REQUEST: SaveAssistantRulesRequest = {
    enabled: true,
    tone: 'Neutral',
    languages: ['it'],
    signature: 'Sofia',
    hoursFrom: null,
    hoursTo: null,
    allowedTopics: [],
    forbiddenTopics: [],
    confidenceThreshold: 0.85,
  };

  it('useSaveAssistantRules_AfterTheScreenIsLeft_KeepsNothingInTheMutationCache', async () => {
    vi.mocked(assistantSettingsApi.getRules).mockResolvedValue(RULES);
    vi.mocked(assistantSettingsApi.saveRules).mockResolvedValue({} as never);

    const held = await heldAfterLeaving(() => useSaveAssistantRules(), { request: RULES_REQUEST, base: RULES });

    expect(held).toEqual([]);
  });

  it('useSaveAssistantRules_RulesChangedMeanwhile_RefusesWithoutSendingPutsTheServersValuesOnTheScreenAndKeepsNothing', async () => {
    vi.mocked(assistantSettingsApi.getRules).mockResolvedValue({ ...RULES, tone: 'Formal', instructionVersion: 3 });
    const { client, wrapper } = setup();
    const { result, unmount } = renderHook(() => useSaveAssistantRules(), { wrapper });

    const failure = await result.current.mutateAsync({ request: RULES_REQUEST, base: RULES }).then(
      () => null,
      (error: unknown) => error,
    );

    // Nothing was sent, the refusal says what it is, and the rules the server holds are the ones in the cache now.
    expect(failure).toBeInstanceOf(StaleSettingsError);
    expect(assistantSettingsApi.saveRules).not.toHaveBeenCalled();
    expect(client.getQueryData(['assistant', 'rules'])).toMatchObject({ tone: 'Formal', instructionVersion: 3 });
    unmount();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it.each([
    ['useApproveItem', () => useApproveItem(), 'a1', () => vi.mocked(approvalQueueApi.approve)],
    ['useEditItem', () => useEditItem(), { id: 'a1', text: GUEST_TEXT }, () => vi.mocked(approvalQueueApi.edit)],
    ['useRejectItem', () => useRejectItem(), { id: 'a1', data: { reason: GUEST_TEXT } }, () => vi.mocked(approvalQueueApi.reject)],
  ] as const)('%s_RefusedByTheServer_KeepsTheAnswerButNotTheRequestThatCarriedTheText', async (_name, hook, variables, api) => {
    api().mockRejectedValue(refusal(409, { code: 'approval_origin_action_failed', originActionError: 'thread_closed' }));
    const { wrapper } = setup();
    const { result } = renderHook(hook as () => { mutateAsync: (v: unknown) => Promise<unknown> }, { wrapper });

    const failure = await result.current.mutateAsync(variables).then(
      () => null,
      (error: unknown) => error as AxiosError,
    );

    expect(failure).toBeInstanceOf(AxiosError);
    // What a screen turns into words stays: the status and the body of the answer.
    expect(failure?.response?.status).toBe(409);
    expect(failure?.response?.data).toMatchObject({ code: 'approval_origin_action_failed', originActionError: 'thread_closed' });
    // What carried the text, and the access token of the call, does not.
    expect(failure?.request).toBeUndefined();
    expect(failure?.config?.data).toBeUndefined();
    expect(JSON.stringify(failure?.config?.headers ?? {})).not.toContain('secret-token');
    expect(JSON.stringify(failure?.config ?? {})).not.toContain('tramonto2026');
  });
});
