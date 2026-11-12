import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { messageHubApi } from '@/api/message-hub.api';
import type { MessageHubPage } from '@/types';
import { MESSAGE_HUB_POLL_MS, totalUnread, useMessageHubThreads, useMessageHubUnread } from '../use-message-hub';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '../use-notifications';

vi.mock('@/api/message-hub.api', () => ({ messageHubApi: { list: vi.fn(), unread: vi.fn() } }));

const PAGE: MessageHubPage = { items: [], totalCount: 0, page: 1, pageSize: 20 };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('the hooks of the hub of messages (NF-61)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(messageHubApi.list).mockResolvedValue(PAGE);
    vi.mocked(messageHubApi.unread).mockResolvedValue({ items: [] });
  });
  afterEach(() => cleanup());

  it('useMessageHubThreads_EveryVisit_ReadsTheListAgainEvenWhenItIsStillFresh', async () => {
    const { wrapper } = setup();

    const first = renderHook(() => useMessageHubThreads({ needsReply: true }), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();
    const second = renderHook(() => useMessageHubThreads({ needsReply: true }), { wrapper });
    await waitFor(() => expect(messageHubApi.list).toHaveBeenCalledTimes(2));

    // The list is changed by other screens (an answer from a booking, a thread read): the second visit does not trust the first one.
    expect(second.result.current.data).toEqual(PAGE);
    expect(messageHubApi.list).toHaveBeenCalledWith({ needsReply: true });
  });

  it('useMessageHubThreads_WhileThePageIsVisible_ReadsAgainEveryMinuteAndOnReturnToTheWindow', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useMessageHubThreads({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const options = client.getQueryCache().findAll({ queryKey: ['message-hub', 'threads'] })[0].observers[0].options;
    expect(options.refetchInterval).toBe(MESSAGE_HUB_POLL_MS);
    expect(MESSAGE_HUB_POLL_MS).toBe(60_000);
    // Not while the tab is hidden: the poll pauses by itself.
    expect(options.refetchIntervalInBackground).toBeFalsy();
    expect(options.refetchOnWindowFocus).toBe(true);
  });

  it('useMessageHubThreads_InAppNotificationsChange_ReadsTheListAndTheCountersAgain', async () => {
    const { client, wrapper } = setup();
    const threads = renderHook(() => useMessageHubThreads({}), { wrapper });
    const unread = renderHook(() => useMessageHubUnread(), { wrapper });
    await waitFor(() => expect(threads.result.current.isSuccess && unread.result.current.isSuccess).toBe(true));
    expect(messageHubApi.list).toHaveBeenCalledTimes(1);
    expect(messageHubApi.unread).toHaveBeenCalledTimes(1);

    // What the real-time channel does when a guest writes: it writes the count of the bell.
    act(() => {
      client.setQueryData(UNREAD_COUNT_KEY, 3);
    });

    await waitFor(() => expect(messageHubApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(messageHubApi.unread).toHaveBeenCalledTimes(2));
  });

  it('useMessageHubThreads_ListOfTheNotificationsRead_AlsoReadsTheListAgain', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useMessageHubThreads({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      client.setQueryData([NOTIFICATIONS_QUERY, 'list'], { pages: [], pageParams: [] });
    });

    await waitFor(() => expect(messageHubApi.list).toHaveBeenCalledTimes(2));
  });

  it('useMessageHubThreads_InAppNotificationsChange_ReadsAgainTheOpenConversationButNotTheFilesTheTemplatesOrTheContacts', async () => {
    const { client, wrapper } = setup();
    // The queries of an open conversation, with the keys the hooks of `use-message-thread` give them.
    const reads = {
      thread: vi.fn().mockResolvedValue({}),
      file: vi.fn().mockResolvedValue(new Blob(['x'])),
      templates: vi.fn().mockResolvedValue([]),
      channelTemplates: vi.fn().mockResolvedValue([]),
      contacts: vi.fn().mockResolvedValue({}),
    };
    const { result } = renderHook(
      () => ({
        threads: useMessageHubThreads({}),
        thread: useQuery({ queryKey: ['message-hub', 'thread', 'ota:1'], queryFn: reads.thread }),
        file: useQuery({ queryKey: ['message-hub', 'attachment', 'm-1'], queryFn: reads.file, staleTime: Infinity }),
        templates: useQuery({ queryKey: ['message-hub', 'templates'], queryFn: reads.templates }),
        channelTemplates: useQuery({ queryKey: ['message-hub', 'channel-templates', 'ota:1'], queryFn: reads.channelTemplates }),
        contacts: useQuery({ queryKey: ['message-hub', 'contact-options', 'b-1'], queryFn: reads.contacts }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(Object.values(result.current).every((query) => query.isSuccess)).toBe(true));

    // What the window coming back to the front, a thread read or the real-time channel do: the notifications are written.
    act(() => {
      client.setQueryData(UNREAD_COUNT_KEY, 3);
    });

    // The list and the conversation that is open follow it...
    await waitFor(() => expect(messageHubApi.list).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(reads.thread).toHaveBeenCalledTimes(2));
    // ...the pictures, the templates and the ways to reach the guest do not: each would be a request to the channel for nothing.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(reads.file).toHaveBeenCalledTimes(1);
    expect(reads.templates).toHaveBeenCalledTimes(1);
    expect(reads.channelTemplates).toHaveBeenCalledTimes(1);
    expect(reads.contacts).toHaveBeenCalledTimes(1);
  });

  it('useMessageHubThreads_ChangeOfAnotherQuery_DoesNotReadTheListAgain', async () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useMessageHubThreads({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      client.setQueryData(['bookings', 'approval-requests'], []);
    });
    // Give a wrongly triggered reading the time to start.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(messageHubApi.list).toHaveBeenCalledTimes(1);
  });

  it('useMessageHubThreads_NotEnabled_AsksNothingAndWatchesNothing', async () => {
    const { client, wrapper } = setup();
    renderHook(() => useMessageHubThreads({}, false), { wrapper });

    act(() => {
      client.setQueryData(UNREAD_COUNT_KEY, 3);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(messageHubApi.list).not.toHaveBeenCalled();
  });
});

describe('totalUnread', () => {
  it('totalUnread_CountersOfEveryConversation_AreSummed', () => {
    expect(totalUnread({ items: [{ threadKey: 'ota:a', unreadCount: 2 }, { threadKey: 'direct:b', bookingId: 'b', unreadCount: 3 }] })).toBe(5);
    expect(totalUnread({ items: [] })).toBe(0);
  });

  it('totalUnread_AnswerThatIsNotTheShapeOfTheApi_IsNotANumber', () => {
    expect(totalUnread(undefined)).toBeUndefined();
    expect(totalUnread('<!doctype html>' as never)).toBeUndefined();
    expect(totalUnread({ items: 'x' } as never)).toBeUndefined();
  });

  it('totalUnread_NegativeOrBrokenCounters_CountForNothing', () => {
    expect(totalUnread({ items: [{ threadKey: 'a', unreadCount: -4 }, { threadKey: 'b', unreadCount: Number.NaN }, { threadKey: 'c', unreadCount: 2.9 }] })).toBe(2);
  });
});
