import { useCallback, useMemo, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Inbox, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useListReturn } from '@/hooks/use-list-return';
import { MESSAGES_PATH } from '@/lib/message-hub-routes';
import { useMessageHubThreads } from '@/queries/use-message-hub';
import { useProperties } from '@/queries/use-properties';
import { inboxFilters, parseInboxState, withInboxState, type InboxState } from '../lib/inbox-state';
import { InboxFilters, type InboxPropertyOption } from './inbox-filters';
import { ThreadList } from './thread-list';

interface InboxPaneProps {
  selectedKey?: string;
  compact?: boolean;
  noConversation?: (state: InboxState) => ReactNode;
  canWrite?: boolean;
}

export function InboxPane({ selectedKey, compact = false, noConversation, canWrite = false }: InboxPaneProps) {
  const { t } = useTranslation();
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
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !compact && "lg:grid lg:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)]")} data-testid="messages-inbox">
      <div className={cn("shrink-0 border-b bg-surface-2 p-3 sm:p-4", !compact && "lg:overflow-y-auto lg:border-e lg:border-b-0")}>
        {!compact && (
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal aria-hidden="true" className="size-4 text-primary-text" />
            {t('messages.filter.label')}
          </h2>
        )}
        <InboxFilters compact={compact} state={state} onChange={update} properties={propertyOptions} />
      </div>
      <div className="min-h-0 min-w-0 flex-1 p-2 lg:overflow-y-auto lg:overscroll-contain">
        {!compact && (
          <h2 className="flex items-center gap-2 border-b px-3 py-3 text-base font-semibold">
            <Inbox aria-hidden="true" className="size-5 text-primary-text" />
            {t('messages.inbox.listLabel')}
          </h2>
        )}
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
          canWrite={canWrite}
        />
      </div>
    </div>
  );
}
