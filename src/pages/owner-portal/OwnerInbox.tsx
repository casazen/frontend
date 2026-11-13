import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquarePlus } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { NewConversationForm } from '@/features/owner-portal/new-conversation-form';
import { initialFromSearch } from '@/features/owner-portal/owner-portal-model';
import { CheckRow, PortalLoading, PortalPageHeading, PortalReadProblem, TOUCH } from '@/features/owner-portal/portal-parts';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import { getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useOwnerConversations, useOwnerInboxPreferences, useSetOwnerInboxPreferences } from '@/queries/ownerPortal';

const WHEN: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };

/** The notification preference: an e-mail when the agency writes. The e-mail only says that there is a message and links back here, never its words. */
function InboxPreferences() {
  const { t } = useTranslation();
  const preferences = useOwnerInboxPreferences();
  const save = useSetOwnerInboxPreferences();

  if (preferences.isLoading) return null;
  if (preferences.isError) {
    return (
      <Alert variant="warning" data-testid="owner-preferences-error">
        {getProblemMessage(preferences.error, t) ?? t('ownerPortal.inbox.preferences.readFailed')}
      </Alert>
    );
  }
  if (!preferences.data) return null;

  return (
    <div className="rounded-md border bg-card p-3" data-testid="owner-preferences">
      <CheckRow
        id="owner-email-notifications"
        checked={preferences.data.emailNotifications}
        disabled={save.isPending}
        onChange={(checked) => save.mutate(checked)}
        label={t('ownerPortal.inbox.preferences.label')}
        description={t('ownerPortal.inbox.preferences.description')}
        testId="owner-email-notifications"
      />
      {save.isError ? (
        <Alert variant="danger" className="mt-2" data-testid="owner-preferences-failed">
          {getProblemMessage(save.error, t) ?? t('ownerPortal.inbox.preferences.saveFailed')}
        </Alert>
      ) : null}
    </div>
  );
}

/**
 * The inbox of the owner (E07/F07/US01/T03, AC-NF111-5): the conversations with the agency, the latest first, a new one about a property, a stay, a document or a published
 * statement of the person's own, and the choice of an e-mail when the agency writes. A link of the portal can open the form already pointed at its item
 * (`?topic=document&documentId=...`: ids only); what was typed is never in the address. A part that is not open or not permitted says so instead of an empty list.
 */
export function OwnerInbox() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const conversations = useOwnerConversations();
  // The address asks for a form with a topic; the person can also open it. Not kept anywhere: the address is the only memory.
  const [formOpen, setFormOpen] = useState(() => searchParams.has('topic'));

  return (
    <div className="space-y-6">
      <PortalPageHeading
        title={t('ownerPortal.inbox.title')}
        description={t('ownerPortal.inbox.description')}
        actions={
          formOpen ? null : (
            <Button type="button" className={TOUCH} onClick={() => setFormOpen(true)} data-testid="owner-new-conversation-open">
              <MessageSquarePlus aria-hidden="true" className="h-4 w-4" />
              {t('ownerPortal.inbox.new.open')}
            </Button>
          )
        }
      />

      {formOpen ? <NewConversationForm initial={initialFromSearch(searchParams)} onCancel={() => setFormOpen(false)} /> : null}

      <InboxPreferences />

      <section aria-labelledby="owner-conversations-title" className="space-y-3">
        <h2 id="owner-conversations-title" className="text-xl font-semibold text-[#1f3a3d]">
          {t('ownerPortal.inbox.listTitle')}
        </h2>
        {conversations.isLoading ? (
          <PortalLoading label={t('ownerPortal.inbox.loading')} />
        ) : conversations.isError ? (
          <PortalReadProblem
            error={conversations.error}
            failedTitle={t('ownerPortal.inbox.error')}
            onRetry={() => void conversations.refetch()}
            testId="owner-conversations-error"
          />
        ) : conversations.data && conversations.data.length > 0 ? (
          <ul className="space-y-3" data-testid="owner-conversations">
            {conversations.data.map((conversation) => (
              <li key={conversation.id} className="relative min-w-0 rounded-md border bg-card p-4 focus-within:ring-2 focus-within:ring-ring hover:bg-muted/40">
                <Link
                  to={ownerPortalPaths.conversation(conversation.id)}
                  className="block min-h-11 break-words font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {conversation.subject}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`ownerPortal.inbox.topic.${conversation.topic}`)} · {t('ownerPortal.inbox.lastMessage', { when: formatRomeDateTime(conversation.lastMessageAt, i18n.language, WHEN) })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" data-testid="owner-conversations-empty">
            {t('ownerPortal.inbox.empty')}
          </p>
        )}
      </section>
    </div>
  );
}
