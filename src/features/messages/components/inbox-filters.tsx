import { useCallback, useEffect, useId, useState } from 'react';
import { Inbox, Mail, MessageCircleReply, Search, Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MESSAGE_HUB_CHANNELS, type MessageHubChannel } from '@/types';
import { DEFAULT_INBOX_VIEW, INBOX_SEARCH_MAX_LENGTH, type InboxState, type InboxView } from '../lib/inbox-state';
import { channelLabel } from '../lib/channels';

/** The search is applied this long after the last key, not on every one (A1-26). */
const SEARCH_DEBOUNCE_MS = 300;

/** A property the list can be narrowed to. */
export interface InboxPropertyOption {
  id: string;
  name: string;
}

interface InboxSearchProps {
  /** The search as the address holds it. */
  value: string;
  onCommit: (q: string) => void;
}

/**
 * The box of the search: it matches the name of the guest, the code of the booking and the name of the property, never the words of a
 * message (those are not searched). What is typed is applied 300 ms after the last key. The box follows the address when that changes by
 * itself (a link, the Back button, «Azzera i filtri»), and leaves what the person is typing alone when the change is its own.
 */
function InboxSearch({ value, onCommit }: InboxSearchProps) {
  const { t } = useTranslation();
  const id = useId();
  const [input, setInput] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== input.trim()) setInput(value);
  }

  const typed = input.trim();
  useEffect(() => {
    if (typed === value) return;
    const timer = window.setTimeout(() => onCommit(typed), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [typed, value, onCommit]);

  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="sr-only">
        {t('messages.search.label')}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        maxLength={INBOX_SEARCH_MAX_LENGTH}
        autoComplete="off"
        enterKeyHint="search"
        placeholder={t('messages.search.placeholder')}
        className="pl-9"
        data-testid="messages-search"
      />
    </div>
  );
}

interface InboxFiltersProps {
  compact?: boolean;
  state: InboxState;
  onChange: (changes: Partial<InboxState>) => void;
  /** The properties of the host; the filter by property is offered when there are two or more. */
  properties: readonly InboxPropertyOption[];
}

/**
 * What narrows the list of the messages (NF-61): «Da rispondere», «Tutte» and «Non lette» (one at a time, the first is where the page
 * starts), the chip «Recensioni» (E05/F06/US02: the reviews of the guests, which are in no other view; while it is on, none of the three is), the channel, the property when the
 * host has more than one, the search, and the one booking the page may have been opened for.
 * Everything is in the address (`onChange` writes it), so the list is the same after a refresh and beside an open conversation.
 */
export function InboxFilters({ state, onChange, properties, compact = false }: InboxFiltersProps) {
  const { t } = useTranslation();
  const commitSearch = useCallback((q: string) => onChange({ q }), [onChange]);
  // What the button «Azzera i filtri» takes away: the booking has its own way out, below.
  const narrowed = state.channel !== null || state.propertyId !== null || state.q !== '';
  const reviewsOn = state.view === 'reviews';
  const views: SegmentedOption<InboxView>[] = [
    { value: 'toRespond', icon: MessageCircleReply, label: t('messages.filter.toRespond'), testId: 'messages-view-toRespond' },
    { value: 'all', icon: Inbox, label: t('messages.filter.all'), testId: 'messages-view-all' },
    { value: 'unread', icon: Mail, label: t('messages.filter.unread'), testId: 'messages-view-unread' },
  ];

  return (
    <div className="@container space-y-3" role="search" aria-label={t('messages.search.label')} data-testid="messages-filters">
      <InboxSearch value={state.q} onCommit={commitSearch} />
      <Segmented label={t('messages.filter.label')} options={views} value={state.view} onValueChange={(view) => onChange({ view })} className={cn("grid w-full grid-cols-3 [&_button]:min-w-0 [&_button]:flex-col [&_button]:gap-1 [&_button]:whitespace-normal [&_button]:px-1 [&_button]:py-2", !compact && "lg:grid-cols-1 lg:bg-transparent lg:p-0 lg:[&_button]:flex-row lg:[&_button]:justify-start lg:[&_button]:gap-3 lg:[&_button]:px-3")} />
      {/* The reviews are not conversations: a chip of their own, pressed while their list is shown. The shape (the filled star), not the tint alone, says it is on. */}
      <Button
        type="button"
        variant={reviewsOn ? 'soft' : 'outline'}
        size="sm"
        aria-pressed={reviewsOn}
        onClick={() => onChange({ view: reviewsOn ? DEFAULT_INBOX_VIEW : 'reviews' })}
        data-testid="messages-view-reviews"
      >
        <Star className={cn('size-4', reviewsOn && 'fill-current')} aria-hidden="true" />
        {t('reviews.hub.filter')}
      </Button>

      <div className={cn('grid gap-2', properties.length >= 2 && '@min-[26rem]:grid-cols-2')}>
        <Select
          size="sm"
          aria-label={t('messages.filter.channel')}
          value={state.channel ?? ''}
          onChange={(event) => onChange({ channel: (event.target.value || null) as MessageHubChannel | null })}
          data-testid="messages-channel-filter"
        >
          <option value="">{t('messages.filter.channelAll')}</option>
          {MESSAGE_HUB_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channelLabel(channel, t)}
            </option>
          ))}
        </Select>
        {properties.length >= 2 ? (
          <Select
            size="sm"
            aria-label={t('messages.filter.property')}
            value={state.propertyId ?? ''}
            onChange={(event) => onChange({ propertyId: event.target.value || null })}
            data-testid="messages-property-filter"
          >
            <option value="">{t('messages.filter.propertyAll')}</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {state.bookingId ? (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="messages-booking-filter">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium">{t('messages.filter.booking')}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ bookingId: null })}>
            <X className="size-4" aria-hidden="true" />
            {t('messages.filter.bookingClear')}
          </Button>
        </p>
      ) : null}

      {narrowed ? (
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onChange({ channel: null, propertyId: null, q: '' })} data-testid="messages-clear-filters">
          {t('messages.filter.clear')}
        </Button>
      ) : null}
    </div>
  );
}
