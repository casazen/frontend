import { useTranslation } from 'react-i18next';
import { Alert, type AlertVariant } from '@/components/ui/alert';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useMessageChannelStatus } from '@/queries/use-message-hub';
import type { MessageChannelStatusCode, MessageChannelStatusItem } from '@/types';

interface ListingStatusNotice {
  status: MessageChannelStatusCode;
  variant: AlertVariant;
  title: string;
  explanation: string;
}

const NOTICES: readonly ListingStatusNotice[] = [
  { status: 'waiting_permission', variant: 'warning', title: 'messages.channelStatus.title', explanation: 'messages.channelStatus.explanation' },
  { status: 'error', variant: 'warning', title: 'messages.channelStatus.errorTitle', explanation: 'messages.channelStatus.errorExplanation' },
  { status: 'pending_sync', variant: 'info', title: 'messages.channelStatus.pendingTitle', explanation: 'messages.channelStatus.pendingExplanation' },
];

/** Shows the properties whose portal chat may be missing messages from the inbox. */
export function ChatAvailabilityBanner() {
  const { flags } = useFeatureFlags();
  const status = useMessageChannelStatus(flags.octorateConnector);
  const items = status.data?.items;
  if (!flags.octorateConnector || status.isError || !Array.isArray(items)) return null;

  return NOTICES.map((notice) => {
    const listings = items.filter((item) => item.status === notice.status);
    return listings.length ? <AvailabilityNotice key={notice.status} notice={notice} listings={listings} /> : null;
  });
}

function AvailabilityNotice({ notice, listings }: { notice: ListingStatusNotice; listings: MessageChannelStatusItem[] }) {
  const { t } = useTranslation();
  const permission = notice.status === 'waiting_permission';

  return (
    // One line above the inbox, every time it is opened: the why and the listings are one click away (UX round 2026-11).
    <Alert variant={notice.variant} title={t(notice.title, { count: listings.length })} data-testid={permission ? 'chat-availability-banner' : `chat-${notice.status}`}>
      <details className="mt-1" data-testid={permission ? 'chat-availability-listings' : undefined}>
        <summary className="min-h-11 cursor-pointer py-2 font-medium md:min-h-0 md:py-0">{t('messages.channelStatus.which')}</summary>
        <p className="mt-1">{t(notice.explanation)}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {listings.map((listing, index) => (
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
