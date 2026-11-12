import { createElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { MessageHubChannel } from '@/types';
import { channelIcon, channelLabel } from '../lib/channels';

const ICON_PROPS = { className: 'size-3', 'aria-hidden': true };

/**
 * Where a conversation comes from, as an icon and one word: the site of the host («Diretto») or the channel. The word says it, the
 * icon only helps to find it again: the meaning is never the icon alone. `channelIcon` hands back one of the icons of a fixed table,
 * never a new component, so it is safe to use as an element type; `createElement` says so to the linter that cannot know it.
 */
export function ChannelBadge({ channel }: { channel: MessageHubChannel }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className="gap-1 whitespace-nowrap font-medium" data-testid="channel-badge" data-channel={channel}>
      {createElement(channelIcon(channel), ICON_PROPS)}
      {channelLabel(channel, t)}
    </Badge>
  );
}
