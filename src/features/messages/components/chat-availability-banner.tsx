import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useMessageChannelStatus } from '@/queries/use-message-hub';
import type { MessageChannelStatus, MessageChannelStatusItem } from '@/types';

/**
 * The listings whose chat is not active yet: the ones the server reports as `waiting_permission` (the chat is not in the license of the listing). Any other
 * state says nothing here, and an answer that is not the shape of the API (a page served instead of it) counts for none: the banner is a hint and never an error.
 */
function listingsWaitingForTheChat(status: MessageChannelStatus | undefined): MessageChannelStatusItem[] {
  const items = status?.items;
  return Array.isArray(items) ? items.filter((item) => item.status === 'waiting_permission') : [];
}

/**
 * «Per N annunci la chat dei portali non è ancora attiva» (E23/F01/US02, NF-61, NF-62): what the inbox says, in one block and one line of explanation, when the
 * chat of some listings is not in the license of the channel manager yet, so that their conversations are not read and cannot be answered here, instead of an
 * empty list. The listings are in a disclosure under it. Nothing is drawn while all the chats work, while there is no connection to the channels (the flag
 * `octorateConnector` is off: nothing is asked) and while the state cannot be read. It follows the state the server stored, so it goes away by itself once the
 * chat is active.
 */
export function ChatAvailabilityBanner() {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const status = useMessageChannelStatus(flags.octorateConnector);
  // A failed read leaves the last answer in the query: it is not the state of the chats now, so the banner says nothing until a read works again.
  const waiting = status.isError ? [] : listingsWaitingForTheChat(status.data);
  if (waiting.length === 0) return null;

  return (
    <Alert variant="warning" title={t('messages.channelStatus.title', { count: waiting.length })} data-testid="chat-availability-banner">
      <p>{t('messages.channelStatus.explanation')}</p>
      <details className="mt-2" data-testid="chat-availability-listings">
        <summary className="min-h-11 cursor-pointer py-2 font-medium md:min-h-0 md:py-0">{t('messages.channelStatus.which')}</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {waiting.map((listing, index) => (
            // Two listings can lead to one property: the position keeps their keys apart.
            <li key={`${listing.propertyId}:${index}`} data-testid="chat-availability-listing">
              {listing.propertyName}
            </li>
          ))}
        </ul>
      </details>
    </Alert>
  );
}
