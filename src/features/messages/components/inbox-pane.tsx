import { useCallback, useMemo, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useListReturn } from '@/hooks/use-list-return';
import { MESSAGES_PATH } from '@/lib/message-hub-routes';
import { useMessageHubThreads } from '@/queries/use-message-hub';
import { useProperties } from '@/queries/use-properties';
import { inboxFilters, parseInboxState, withInboxState, type InboxState } from '../lib/inbox-state';
import { InboxFilters, type InboxPropertyOption } from './inbox-filters';
import { ThreadList } from './thread-list';

interface InboxPaneProps {
  /** The conversation that is open beside the list. */
  selectedKey?: string;
  /** The column beside an open conversation: the fields go one under the other and the rows are shorter. */
  compact?: boolean;
  /** What stands in for an empty list when it is the one of a booking that has no conversation yet. */
  noConversation?: (state: InboxState) => ReactNode;
}

/**
 * The inbox: the filters and the list of the conversations, with their state in the address. It is the page of the messages and, as
 * the left column, what the page of a conversation draws beside the open thread; the list is the same in both, and every row keeps the
 * filters in its address.
 */
export function InboxPane({ selectedKey, compact = false, noConversation }: InboxPaneProps) {
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  useListReturn(MESSAGES_PATH);

  const state = useMemo(() => parseInboxState(params), [params]);
  const update = useCallback(
    (changes: Partial<InboxState>) => setParams((previous) => withInboxState(previous, changes), { replace: true }),
    [setParams],
  );
  const filters = useMemo(() => inboxFilters(state), [state]);

  const threads = useMessageHubThreads(filters);
  const properties = useProperties({ mode: 'short' });
  const propertyOptions = useMemo<InboxPropertyOption[]>(
    () => (Array.isArray(properties.data) ? properties.data.map((property) => ({ id: property.id, name: property.name })) : []),
    [properties.data],
  );

  return (
    <div className="min-w-0 space-y-4" data-testid="messages-inbox">
      <InboxFilters state={state} onChange={update} properties={propertyOptions} compact={compact} />
      <ThreadList
        page={threads.data}
        loading={threads.isPending}
        error={threads.error}
        onRetry={() => void threads.refetch()}
        state={state}
        search={search}
        selectedKey={selectedKey}
        compact={compact}
        onChange={update}
        noConversation={noConversation ? noConversation(state) : undefined}
      />
    </div>
  );
}
