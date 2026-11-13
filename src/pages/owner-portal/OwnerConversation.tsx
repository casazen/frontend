import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageList, ReplyForm } from '@/features/owner-portal/conversation-thread';
import { PortalLoading, PortalNotice, PortalReadProblem, TOUCH } from '@/features/owner-portal/portal-parts';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { useOwnerConversations, useOwnerMessages } from '@/queries/ownerPortal';

/**
 * One conversation of the inbox (`/portale-proprietari/messaggi/:conversationId`, the link of the e-mail that tells the owner the agency wrote: the id only). It reads the messages
 * and the list of conversations (for the subject), shows the thread and the reply form. A conversation that is not the person's own, or that does not exist, is the same
 * «not found» (the server answers 404 for both): the page never says which. No polling: the thread is read when it opens and when the window comes back, and «Aggiorna» reads it again.
 */
export function OwnerConversation() {
  const { t } = useTranslation();
  const { conversationId } = useParams<{ conversationId: string }>();
  const messages = useOwnerMessages(conversationId);
  const conversations = useOwnerConversations();
  const conversation = conversations.data?.find((item) => item.id === conversationId);

  const back = (
    <Button asChild variant="ghost" className={`${TOUCH} -ml-3`}>
      <Link to={ownerPortalPaths.messages}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t('ownerPortal.inbox.thread.back')}
      </Link>
    </Button>
  );

  if (!conversationId) return <PortalNotice state="unavailable" testId="owner-conversation-missing" />;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {back}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-[#1f3a3d] sm:text-3xl" data-testid="owner-conversation-subject">
              {conversation?.subject ?? t('ownerPortal.inbox.thread.title')}
            </h1>
            {conversation ? <p className="text-sm text-muted-foreground">{t(`ownerPortal.inbox.topic.${conversation.topic}`)}</p> : null}
          </div>
          <Button type="button" variant="outline" className={TOUCH} onClick={() => void messages.refetch()} loading={messages.isFetching && !messages.isLoading}>
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            {t('ownerPortal.inbox.thread.refresh')}
          </Button>
        </div>
      </div>

      {messages.isLoading ? (
        <PortalLoading label={t('ownerPortal.inbox.loading')} />
      ) : messages.isError ? (
        <PortalReadProblem
          error={messages.error}
          failedTitle={t('ownerPortal.inbox.thread.error')}
          onRetry={() => void messages.refetch()}
          testId="owner-messages-error"
        />
      ) : messages.data ? (
        <>
          {messages.data.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-messages-empty">
              {t('ownerPortal.inbox.thread.empty')}
            </p>
          ) : (
            <MessageList conversationId={conversationId} messages={messages.data} />
          )}
          <ReplyForm conversationId={conversationId} />
        </>
      ) : null}
    </div>
  );
}
