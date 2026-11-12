import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ListPagination } from '@/components/shared/list-view/list-pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { UnreadMessagesBadge } from '@/components/shared/unread-messages-badge';
import { Badge } from '@/components/ui/badge';
import { SkeletonList } from '@/components/ui/skeleton';
import { useNow } from '@/hooks/use-now';
import { messageThreadPath } from '@/lib/message-hub-routes';
import { cn } from '@/lib/utils';
import type { MessageHubPage, MessageHubThread } from '@/types';
import { hasInboxFilters, type InboxState } from '../lib/inbox-state';
import { formatListTime, formatStayRange } from '../lib/thread-format';
import { ChannelBadge } from './channel-badge';

interface ThreadRowProps {
  thread: MessageHubThread;
  selected: boolean;
  /** The query string the row keeps, so that the page of the conversation draws the same list. */
  search: string;
  now: Date;
  /** The words «Da rispondere» on the row: the view «Da rispondere» says it for all of them. */
  showNeedsReply: boolean;
  compact: boolean;
}

/**
 * One conversation of the list: the guest, the start of the last message, when it was, the channel in one word, the booking code or
 * «Richiesta» when there is no booking yet, the property and the days of the stay, and how many messages wait to be read. The whole
 * row opens the conversation.
 */
function ThreadRow({ thread, selected, search, now, showNeedsReply, compact }: ThreadRowProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const guest = thread.guestName?.trim() || t('messages.thread.sender.guest');
  const origin = thread.lastMessageOrigin;
  const prefix = origin === 'Person' ? t('messages.thread.sender.you') : origin === 'Assistant' ? t('messages.thread.sender.assistant') : null;
  const text = thread.preview?.trim();
  const preview = text ? (prefix ? `${prefix}: ${text}` : text) : t('messages.thread.fileOnly');
  const stay = formatStayRange(thread.checkInDate, thread.checkOutDate, locale);
  const unread = thread.unreadCount > 0;
  const stateWord = thread.state === 'Closed' ? t('messages.thread.closed') : thread.state === 'Archived' ? t('messages.thread.archived') : null;

  return (
    <li>
      <Link
        to={`${messageThreadPath(thread.threadKey)}${search}`}
        aria-current={selected ? 'true' : undefined}
        data-testid="message-thread-row"
        data-thread-key={thread.threadKey}
        className={cn(
          'block min-h-11 rounded-lg border px-4 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring',
          selected ? 'border-primary bg-accent/60' : 'bg-card',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn('truncate', unread ? 'font-bold' : 'font-semibold')}>{guest}</p>
            <p className={cn('mt-0.5 line-clamp-2 break-words text-sm', unread ? 'text-foreground' : 'text-foreground/70')}>{preview}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <time dateTime={thread.lastMessageAt} className="text-xs text-foreground/70">
              {formatListTime(thread.lastMessageAt, locale, now)}
            </time>
            <UnreadMessagesBadge count={thread.unreadCount} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/70">
          <ChannelBadge channel={thread.channel} />
          {thread.bookingCode ? (
            <span>{thread.bookingCode}</span>
          ) : !thread.bookingId ? (
            <Badge variant="secondary" data-testid="thread-request-label">
              {t('messages.thread.request')}
            </Badge>
          ) : null}
          {thread.unassigned ? <span>{t('messages.thread.unassigned')}</span> : thread.propertyName ? <span className="min-w-0 truncate">{thread.propertyName}</span> : null}
          {!compact && stay ? <span>{stay}</span> : null}
          {stateWord ? <span>{stateWord}</span> : null}
          {showNeedsReply && thread.needsReply ? <Badge variant="warning">{t('messages.filter.toRespond')}</Badge> : null}
        </div>
      </Link>
    </li>
  );
}

interface ThreadListProps {
  page: MessageHubPage | undefined;
  /** The first reading: there is no row to show yet. */
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  state: InboxState;
  /** The query string every row keeps (`?view=unread`). */
  search: string;
  /** The conversation that is open beside the list: its row is the marked one. */
  selectedKey?: string;
  /** The column beside an open conversation: shorter rows. */
  compact?: boolean;
  onChange: (changes: Partial<InboxState>) => void;
  /** What stands in for an empty list when it is the one of a booking that has no conversation yet (how the guest can be reached). */
  noConversation?: ReactNode;
}

/**
 * The rows of the messages, with what the person needs when there are none (NF-61): the words while it loads, a retry when it fails
 * (never an empty list for an error), the page empty because nothing waits for an answer, or because the search finds nothing, each in
 * simple words with the one thing to do about it. Pagination at the bottom when there is more than a page.
 */
export function ThreadList({ page, loading, error, onRetry, state, search, selectedKey, compact = false, onChange, noConversation }: ThreadListProps) {
  const { t } = useTranslation();
  const nowMs = useNow();
  const now = useMemo(() => new Date(nowMs), [nowMs]);

  if (loading) return <SkeletonList items={compact ? 4 : 5} label={t('messages.inbox.loading')} />;
  if (error && !page) return <ErrorState testId="messages-error" title={t('messages.loadError')} error={error} onRetry={onRetry} />;

  const items = page?.items ?? [];
  if (items.length === 0) {
    const className = compact ? 'py-8' : undefined;
    if (state.bookingId && noConversation) return <>{noConversation}</>;
    if (hasInboxFilters(state)) {
      return (
        <EmptyState
          className={className}
          icon={SearchX}
          title={t('messages.empty.noMatch')}
          description={t('messages.empty.noMatchHint')}
          action={{ label: t('messages.filter.clear'), onClick: () => onChange({ channel: null, propertyId: null, bookingId: null, q: '' }) }}
        />
      );
    }
    if (state.view === 'toRespond') {
      return (
        <EmptyState
          className={className}
          icon={Inbox}
          title={t('messages.empty.toRespond')}
          description={t('messages.empty.toRespondHint')}
          action={{ label: t('messages.empty.showAll'), onClick: () => onChange({ view: 'all' }) }}
        />
      );
    }
    return (
      <EmptyState
        className={className}
        icon={Inbox}
        title={state.view === 'unread' ? t('messages.empty.unread') : t('messages.empty.all')}
        description={state.view === 'unread' ? t('messages.empty.unreadHint') : t('messages.empty.allHint')}
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="message-thread-list">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t('messages.loadError')}
        </p>
      ) : null}
      <ul aria-label={t('messages.inbox.listLabel')} className="space-y-2">
        {items.map((thread) => (
          <ThreadRow
            key={thread.threadKey}
            thread={thread}
            selected={thread.threadKey === selectedKey}
            search={search}
            now={now}
            showNeedsReply={state.view !== 'toRespond'}
            compact={compact}
          />
        ))}
      </ul>
      {page ? <ListPagination page={page.page} pageSize={page.pageSize} totalCount={page.totalCount} onPageChange={(next) => onChange({ page: next })} /> : null}
    </div>
  );
}
