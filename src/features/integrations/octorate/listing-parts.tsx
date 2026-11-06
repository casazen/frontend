import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import type { OctorateListing } from '@/types';
import { LISTING_STATES, channelName, channelStateText, listingName, listingStateOf } from './listing-labels';

interface StepNoticeProps {
  title: string;
  text: string;
  /** What the host can do about it: a button, which must be `type="button"` (the steps are inside the form of the wizard). */
  action?: ReactNode;
  testId: string;
}

/** A step with nothing to show but a reason, and the one thing to do about it. */
export function StepNotice({ title, text, action, testId }: StepNoticeProps) {
  return (
    <div className="space-y-2 rounded-lg bg-muted p-4 text-sm" data-testid={testId}>
      <p className="font-medium">{title}</p>
      <p className="break-words text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

interface StepProblemProps {
  /** What failed to load, already translated. */
  title: string;
  /** The error of the failed read: its message in the words of the app is shown under the title when there is one. */
  error?: unknown;
  onRetry: () => void;
  testId: string;
}

/**
 * The error of a read that failed, with "Riprova". The shared `ErrorState` has a retry button without a type, which would submit the
 * form of the wizard around the step and move the host on; this one is a `type="button"`.
 */
export function StepProblem({ title, error, onRetry, testId }: StepProblemProps) {
  const { t } = useTranslation();
  const detail = error === undefined ? undefined : getProblemMessage(error, t);

  return (
    <div role="alert" className="space-y-2 rounded-lg border p-4 text-sm" data-testid={testId}>
      <p className="font-medium">{title}</p>
      {detail ? <p className="break-words text-muted-foreground">{detail}</p> : null}
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t('shared.errorState.retry')}
      </Button>
    </div>
  );
}

interface ListingStateBadgeProps {
  listing: OctorateListing;
}

/** The one state of a listing, in a word or two. It never relies on its color alone: the word is the state. */
export function ListingStateBadge({ listing }: ListingStateBadgeProps) {
  const { t } = useTranslation();
  const state = listingStateOf(listing);

  return (
    <Badge variant={LISTING_STATES[state].variant} className="shrink-0 whitespace-nowrap" data-testid={`octorate-listing-state-${state}`}>
      {t(LISTING_STATES[state].labelKey)}
    </Badge>
  );
}

interface ChannelListProps {
  listing: OctorateListing;
}

/**
 * The channels a listing is on, each with its state where the channel manager reports one. The server reads the channels of a listing
 * only when a person links it (confirm or import), so a listing found and not linked yet has none stored: that says nothing about the
 * listing, and the card says when they will show instead of saying it is on none. Only a linked listing with no channel is on none; an
 * excluded one says nothing about channels.
 */
export function ChannelList({ listing }: ChannelListProps) {
  const { t } = useTranslation();

  if (listing.channels.length === 0) {
    if (listing.status === 'Rejected') return null;
    return (
      <p className="text-sm text-muted-foreground">
        {listing.status === 'Confirmed' ? t('octorate.connect.channelsFound.noChannels') : t('octorate.connect.channelsFound.channelsAfterLink')}
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2" role="list" aria-label={t('octorate.connect.channelsFound.channelsOf', { name: listingName(listing, t) })}>
      {listing.channels.map((channel) => (
        <li
          key={`${channel.channelId}:${channel.externalId}`}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm"
          data-testid={`octorate-channel-${channel.channelId}`}
        >
          <span className="font-medium">{channelName(channel.channelId, t)}</span>
          <span className="text-foreground/70">{channelStateText(channel.state, t)}</span>
        </li>
      ))}
    </ul>
  );
}
