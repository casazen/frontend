import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { MessageThread } from '@/components/shared/message-thread';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { FROM_DESKTOP_QUERY, FROM_WIDE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { usePageVisible } from '@/hooks/use-page-visible';
import { usePageTitle } from '@/hooks/use-page-title';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { withListReturn } from '@/lib/list-return';
import { MESSAGES_PATH } from '@/lib/message-hub-routes';
import { useMarkHubThreadRead, useMessageThread, useSendHubReply } from '@/queries/use-message-thread';
import type { MessageHubThreadDetail } from '@/types';
import { BookingCard } from './components/booking-card';
import { ChannelBadge } from './components/channel-badge';
import { DraftPanel } from './components/draft-panel';
import { GuestAvatar } from './components/guest-avatar';
import { InboxPane } from './components/inbox-pane';
import { MessageBubble, type BubbleActions } from './components/message-bubble';
import { ReplyComposer } from './components/reply-composer';
import { guestProfilePath } from './lib/guest-profile';
import { buildThreadItems, resendKeyOf, resentMessageIds, type HubThreadItem } from './lib/thread-items';

/** The sentence for a conversation the host can read and not answer, from the reason the server gives. */
function cannotReplyKey(reason: string | null | undefined): string {
  if (reason === 'mapping_not_confirmed') return 'messages.actions.mappingNotConfirmed';
  if (reason === 'thread_closed') return 'messages.actions.threadClosed';
  // The chat of the listing is not in the license of the channel manager yet: a reply would be refused, so the box says it instead of failing (E23/F01/US01/T03).
  if (reason === 'chat_not_licensed') return 'messages.actions.chatNotLicensed';
  return 'messages.actions.cannotReply';
}

function ThreadSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3" data-testid="messages-thread-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-64 w-full rounded-xl motion-reduce:animate-none" />
        <Skeleton className="h-28 w-full rounded-xl motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** What stands in the place of the box when the host can read the conversation and not answer it: the one sentence that says why. */
function CannotReply({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm" role="status" data-testid="thread-cannot-reply">
      {children}
    </div>
  );
}

interface ConversationProps {
  threadKey: string;
  thread: MessageHubThreadDetail;
  title: string;
  listPath: string;
  bookingDetails?: ReactNode;
  items: HubThreadItem[];
  actions: BubbleActions;
  resent: ReadonlySet<string>;
  canWrite: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
}

/** The middle column: where the conversation comes from, its messages oldest first, and the box that answers it, or why there is none. */
function Conversation({ threadKey, thread, title, listPath, bookingDetails, items, actions, resent, canWrite, draft, onDraft, onSend, busy }: ConversationProps) {
  const { t, i18n } = useTranslation();
  const online = useOnlineStatus();
  const hostLanguage = i18n.language.startsWith('en') ? 'en' : 'it';
  const name = thread.guestName?.trim() || thread.booking?.guestName || t('messages.thread.sender.guest');
  const { allowedActions } = thread;
  const stateWord = thread.state === 'Closed' ? t('messages.thread.closed') : thread.state === 'Archived' ? t('messages.thread.archived') : null;

  return (
    <section className="min-w-0 lg:border-l" aria-label={t('messages.thread.title')} data-testid="messages-conversation">
      <header className="space-y-2 border-b px-4 py-3 sm:px-5">
        <Link to={listPath} className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('messages.thread.backToList')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
            <GuestAvatar name={thread.guestName ?? thread.booking?.guestName} />
            <div className="min-w-0">
              <h1 className="break-words text-xl font-semibold tracking-tight">{title}</h1>
              {thread.propertyName ? <p className="break-words text-sm text-muted-foreground">{thread.propertyName}</p> : null}
            </div>
          </div>
          {bookingDetails}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ChannelBadge channel={thread.channel} />
          {thread.kind === 'Request' ? (
            <Badge variant="secondary" data-testid="thread-request-label">
              {t('messages.thread.request')}
            </Badge>
          ) : null}
          {stateWord ? <span>{stateWord}</span> : null}
          {thread.unassigned ? <span>{t('messages.thread.unassigned')}</span> : null}
        </div>
      </header>

      <div className="space-y-2 p-3 sm:p-5">
        {thread.anonymized ? (
          <p className="text-sm text-muted-foreground" data-testid="thread-anonymized">
            {t('messages.actions.anonymized')}
          </p>
        ) : null}
        {thread.hasEarlierMessages ? <p className="text-xs text-muted-foreground">{t('messages.thread.earlier')}</p> : null}

        <MessageThread
          items={items}
          label={t('messages.thread.logLabel', { name })}
          emptyText={t('messages.thread.empty')}
          className="max-h-[min(30rem,55dvh)] min-h-48 rounded-xl border-transparent bg-muted/25 p-3 sm:p-4"
          renderItem={(item) => (
            <MessageBubble item={item} threadKey={threadKey} hostLanguage={hostLanguage} canWrite={canWrite} resent={resent} actions={actions} />
          )}
        />
      </div>

      <div className="space-y-3 border-t bg-muted/15 p-3 sm:p-5">
        {!allowedActions.canReply ? (
          <CannotReply>
            <p>{t(cannotReplyKey(allowedActions.reason))}</p>
          </CannotReply>
        ) : !canWrite ? (
          <CannotReply>
            <p>{t('messages.actions.readOnly')}</p>
          </CannotReply>
        ) : (
          <>
            {/* The draft of the assistant (E05/F05/US04): only with the flag `messageAssistant` and the permission to decide approvals; it renders nothing otherwise. */}
            <DraftPanel threadKey={threadKey} canAsk />
            <ReplyComposer
              threadKey={threadKey}
              withChannelTemplates={thread.source === 'Ota'}
              value={draft}
              onChange={onDraft}
              onSend={onSend}
              busy={busy}
              disabledReason={online ? null : t('messages.composer.offline')}
              contactDetailsAllowed={allowedActions.contactDetailsAllowed}
            />
          </>
        )}
      </div>
    </section>
  );
}

function ThreadView({ threadKey }: { threadKey: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const { search } = useLocation();
  const canWrite = hasPermission('short-rent', 'booking.write');
  const visible = usePageVisible();
  const withList = useMediaQuery(FROM_DESKTOP_QUERY);
  const withBookingPane = useMediaQuery(FROM_WIDE_QUERY);
  const thread = useMessageThread(threadKey);
  const { mutate: markAsRead } = useMarkHubThreadRead(threadKey);
  const { pending, send, retry, discard } = useSendHubReply(threadKey);
  const [draft, setDraft] = useState('');
  const [resent, setResent] = useState<ReadonlySet<string>>(() => new Set());
  const data = thread.data;
  // A refused message offered again loses its «Riprova» at once (`resent`, this page) and for good (a later message of the host with the
  // same text: the conversation opened again lists it), and the key of the send is made from the message: a second click, from this page
  // or from another one, never writes it twice.
  const messages = data?.messages;
  const alreadyResent = useMemo(() => new Set([...resent, ...resentMessageIds(messages ?? [])]), [resent, messages]);

  // The guest's messages are marked as read once the host has the conversation in front of it (the page visible, and the right to write:
  // marking is a write); the newest one already marked is remembered, so that a failed mark is not repeated at every render.
  const unread = data?.unreadCount ?? 0;
  const newest = data?.messages.at(-1)?.id ?? null;
  const marked = useRef<string | null>(null);
  useEffect(() => {
    if (!canWrite || !visible || unread === 0 || newest === null || marked.current === newest) return;
    marked.current = newest;
    markAsRead();
  }, [canWrite, visible, unread, newest, markAsRead]);

  const busy = pending.some((message) => message.status === 'sending');
  const actions: BubbleActions = {
    onResend: (message) => {
      setResent((all) => new Set(all).add(message.id));
      send(message.text, resendKeyOf(message.id));
    },
    onCheck: () => void thread.refetch(),
    checking: thread.isFetching,
    onRetryPending: retry,
    onEditPending: (item) => {
      // The box stays open while a message is refused, so the host may have typed another one: that is not thrown away, the refused
      // words go in front of it.
      setDraft(draft.trim() ? `${item.text}\n\n${draft}` : item.text);
      discard(item.key);
    },
  };
  const items = data
    ? buildThreadItems(data, pending, {
        guest: t('messages.thread.sender.guest'),
        you: t('messages.thread.sender.you'),
        assistant: t('messages.thread.sender.assistant'),
        automation: t('messages.thread.sender.automation'),
      })
    : [];

  const title = data ? data.guestName?.trim() || data.booking?.guestName || (data.kind === 'Request' ? t('messages.thread.request') : t('messages.thread.title')) : t('messages.thread.title');
  usePageTitle(title);
  const listPath = search ? `${MESSAGES_PATH}${search}` : withListReturn(MESSAGES_PATH);

  let content: ReactNode;
  if (thread.isPending) {
    content = <ThreadSkeleton label={t('messages.thread.loading')} />;
  } else if (!data) {
    const status = getHttpStatus(thread.error);
    content =
      status === 404 || status === 400 ? (
        <EmptyState
          icon={SearchX}
          title={t('messages.thread.notFound')}
          description={t('messages.thread.notFoundHint')}
          action={{ label: t('messages.thread.backToList'), href: withListReturn(MESSAGES_PATH) }}
        />
      ) : (
        <ErrorState testId="messages-thread-error" title={t('messages.thread.loadError')} error={thread.error} onRetry={() => void thread.refetch()} />
      );
  } else {
    const booking = data.booking ? (
      <BookingCard
        card={data.booking}
        bookingPath={`/app/short-rent/bookings/${encodeURIComponent(data.booking.bookingId)}`}
        profilePath={guestProfilePath(data.customer?.guestId, hasPermission, flags)}
      />
    ) : (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground" data-testid="booking-card-none">
        {t('messages.bookingCard.none')}
      </p>
    );
    content = (
      <div className="grid min-w-0 overflow-hidden rounded-2xl border bg-card lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_minmax(16rem,23%)]">
        {withList ? (
          <aside aria-label={t('messages.inbox.title')} className="min-w-0">
            <InboxPane selectedKey={threadKey} compact canWrite={canWrite} />
          </aside>
        ) : null}
        <Conversation
          threadKey={threadKey}
          thread={data}
          title={title}
          listPath={listPath}
          bookingDetails={withBookingPane ? null : (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {t('messages.bookingCard.details')}
                </Button>
              </DialogTrigger>
              <DialogContent aria-describedby={undefined} className="sm:max-h-[85dvh] sm:overflow-y-auto">
                <DialogHeader><DialogTitle>{t('messages.bookingCard.details')}</DialogTitle></DialogHeader>
                {booking}
              </DialogContent>
            </Dialog>
          )}
          items={items}
          actions={actions}
          resent={alreadyResent}
          canWrite={canWrite}
          draft={draft}
          onDraft={setDraft}
          onSend={(text) => {
            send(text);
            setDraft('');
          }}
          busy={busy}
        />
        {withBookingPane ? <aside aria-label={t('messages.bookingCard.details')} className="min-w-0 border-l bg-muted/20 p-3">{booking}</aside> : null}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4" data-testid="messages-thread-page">
        {!data ? <PageHeader title={title} crumbs="auto" /> : null}
        {thread.isError && data ? (
          <p className="text-sm text-destructive" role="alert">
            {t('messages.thread.refreshError')}
          </p>
        ) : null}
        {content}
      </div>
    </AppShell>
  );
}

/**
 * `/app/short-rent/messages/:threadKey`: one conversation (NF-61, NF-63, NF-64). The messages in the middle, oldest first, with the inbox beside them on desktop and the booking in a third pane on wide screens. On narrower screens the booking opens on demand. A conversation with no booking yet is a «Richiesta», and offers
 * only what its channel allows. It reads again when it opens, on return to the window and every minute while visible, and marks the
 * guest's messages as read once it is in front of the host.
 *
 * The state of the page (the draft, what was sent again) belongs to the conversation: another one starts clean.
 */
export function ThreadPage() {
  const { threadKey = '' } = useParams<{ threadKey: string }>();
  return <ThreadView key={threadKey} threadKey={threadKey} />;
}
