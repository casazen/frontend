import { MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { useWorkspace } from '@/hooks/use-workspace';
import { ContactOptionsPanel } from './components/contact-options-panel';
import { InboxPane } from './components/inbox-pane';

/**
 * `/app/short-rent/messages`: every conversation with the guests in one list, the ones of the channels and the direct ones (NF-61).
 * It starts on «Da rispondere»; the filters (all, not read, channel, property, one booking) and the search are in the address, and
 * each row opens the conversation. From a wide screen the open conversation takes the place of the empty column on the right, with
 * the list beside it (`ThreadPage`); on a phone the list leads to the conversation.
 *
 * Opened for one booking (`?booking=<id>`, the way a booking leads here) that has no conversation yet, it says how the guest can be
 * reached instead of an empty list: the conversation of the channel or of the site when there is one, an e-mail through CasaZen for a channel
 * with no chat, or why there is no way (`ContactOptionsPanel`, NF-63).
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
      <div className="space-y-6" data-testid="messages-inbox-page">
        <PageHeader title={t('messages.inbox.title')} description={t('messages.inbox.description')} />
        <div className="grid grid-cols-1 gap-8 2xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] 2xl:items-start">
          <InboxPane noConversation={(state) => (state.bookingId ? <ContactOptionsPanel bookingId={state.bookingId} canWrite={canWrite} /> : null)} />
          <div
            className="hidden min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center 2xl:flex"
            data-testid="messages-no-selection"
          >
            <MessageSquare className="size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-lg font-semibold">{t('messages.inbox.noSelection.title')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('messages.inbox.noSelection.description')}</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
