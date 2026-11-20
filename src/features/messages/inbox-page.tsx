import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { ChatAvailabilityBanner } from './components/chat-availability-banner';
import { ContactOptionsPanel } from './components/contact-options-panel';
import { InboxPane } from './components/inbox-pane';

/**
 * `/app/short-rent/messages`: every conversation with the guests in one list, the ones of the channels and the direct ones (NF-61).
 * It starts on «Da rispondere»; the filters (all, not read, channel, property, one booking) and the search are in the address, and
 * each row opens the conversation. On desktop the open conversation takes the place of the empty column on the right, with
 * the list beside it (`ThreadPage`); on a phone the list leads to the conversation.
 *
 * The chip «Recensioni» (`?view=reviews`, E05/F06/US02, NF-69) lists the reviews of the guests, of the booking site and of the channels, with their stars and «Senza risposta»;
 * a row opens the review (`ThreadPage`, which tells a review from a conversation by its key). The reviews are in no other view: «Da rispondere» is the conversations.
 *
 * Opened for one booking (`?booking=<id>`, the way a booking leads here) that has no conversation yet, it says how the guest can be
 * reached instead of an empty list: the conversation of the channel or of the site when there is one, an e-mail through CasaZen for a channel
 * with no chat, or why there is no way (`ContactOptionsPanel`, NF-63).
 *
 * When the chat of some listings is not active yet it says so above the list (`ChatAvailabilityBanner`, E23/F01/US02): «Per N annunci la chat dei portali
 * non è ancora attiva», instead of leaving their conversations missing without a word.
 *
 * Reading asks `booking.read`; what the host sees follows its reach on the properties (the server applies it), so a collaborator
 * «Solo alcuni» lists the conversations of its own properties only.
 */
export function InboxPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', 'booking.write');

  return (
    <AppShell>
      <div className="flex flex-1 flex-col gap-4 lg:min-h-0" data-app-viewport data-testid="messages-inbox-page">
        <PageHeader title={t('messages.inbox.title')} description={t('messages.inbox.description')} />
        <ChatAvailabilityBanner />
        <div className="grid min-w-0 flex-1 overflow-hidden rounded-2xl border bg-card lg:min-h-[26rem] lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]" data-testid="messages-workspace">
          <InboxPane canWrite={canWrite} noConversation={(state) => (state.bookingId ? <ContactOptionsPanel bookingId={state.bookingId} canWrite={canWrite} /> : null)} />
          <div
            className="hidden flex-col items-center justify-center gap-3 border-l bg-muted/30 p-10 text-center lg:flex"
            data-testid="messages-no-selection"
          >
            <div className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <MessageSquare className="size-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold">{t('messages.inbox.noSelection.title')}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">{t('messages.inbox.noSelection.description')}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
