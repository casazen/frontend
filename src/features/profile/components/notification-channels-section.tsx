import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/use-media-query';
import { useSaveNotificationPreferences } from '@/queries/use-notification-preferences';
import { NOTIFICATION_CHANNELS, type NotificationChannel, type NotificationPreferences } from '@/types';
import {
  CHANNEL_TEXTS,
  EVENT_TEXTS,
  channelAvailability,
  channelCell,
  eventRows,
  eventSave,
  isLegalDeadline,
  withChannel,
  type ChannelAvailability,
  type EventRowModel,
} from '../notification-preferences-model';

interface NotificationChannelsSectionProps {
  preferences: NotificationPreferences;
}

/**
 * The matrix of the page (E05/F03/US02, NF-65): one row for each kind of event and one switch for each channel. A switch saves as it is
 * moved (the channels of that one kind of event, the others stay as they are), so there is no form and no «Salva». On a computer it is a
 * table, on a phone a card for each kind of event with its four switches under it (a table of five columns does not fit 360 px).
 *
 * What the person cannot do is said, not hidden: a channel that cannot deliver yet is off and disabled with one line under its name, and the
 * last channel of a legal deadline cannot be switched off (a legal alert is never fully off), with the sentence that says why.
 */
export function NotificationChannelsSection({ preferences }: NotificationChannelsSectionProps) {
  const { t } = useTranslation();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const idPrefix = useId();
  const rows = eventRows(preferences);
  const availability = channelAvailability(preferences);

  return (
    <PlainSection title={t('notificationPreferences.channelsTitle')} data-testid="notification-channels">
      <p className="text-sm text-foreground/70">{t('notificationPreferences.channelsHint')}</p>

      {isPhone ? (
        <ul role="list" aria-label={t('notificationPreferences.tableCaption')} className="divide-y rounded-lg border" data-testid="notification-cards">
          {rows.map((row) => (
            <EventRow key={row.eventType} row={row} availability={availability} layout="card" idPrefix={idPrefix} />
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm" data-testid="notification-table">
            <caption className="sr-only">{t('notificationPreferences.tableCaption')}</caption>
            <thead>
              <tr className="bg-muted/40">
                <th scope="col" className="px-4 py-3 text-left align-bottom font-medium">
                  {t('notificationPreferences.eventColumn')}
                </th>
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <th key={channel} scope="col" className="w-28 px-2 py-3 text-center align-bottom font-medium">
                    {t(CHANNEL_TEXTS[channel].labelKey)}
                    {availability[channel] ? null : (
                      <span id={reasonId(idPrefix, channel)} className="mt-0.5 block text-xs font-normal text-foreground/70">
                        {t('notificationPreferences.channelUnavailable')}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <EventRow key={row.eventType} row={row} availability={availability} layout="table" idPrefix={idPrefix} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-foreground/70">{t('notificationPreferences.bellNote')}</p>
    </PlainSection>
  );
}

/** The id of the line that says why a channel cannot be switched, which the switches of that channel point at (a card has its own copy). */
function reasonId(idPrefix: string, channel: NotificationChannel, eventType?: string): string {
  return `${idPrefix}-reason-${eventType ? `${eventType}-` : ''}${channel}`;
}

interface EventRowProps {
  row: EventRowModel;
  availability: ChannelAvailability;
  layout: 'table' | 'card';
  idPrefix: string;
}

/** One kind of event: its name, one line about it, a mark when the caller never chose, and its four switches. It saves by itself. */
function EventRow({ row, availability, layout, idPrefix }: EventRowProps) {
  const { t } = useTranslation();
  const save = useSaveNotificationPreferences();
  const eventLabel = t(EVENT_TEXTS[row.eventType].labelKey);
  const legalId = `${idPrefix}-${row.eventType}-legal`;
  const titleId = `${idPrefix}-${row.eventType}-title`;

  // While a save is on its way the row shows what is being saved and never what the server had a moment ago, so a switch does not jump back and
  // forth; a second switch moved in the meantime builds on it. A refused save ends the wait and the row shows the server's again.
  const channels = save.isPending ? (save.variables?.events?.[0]?.channels ?? row.channels) : row.channels;

  const change = (channel: NotificationChannel, on: boolean) => {
    const next = withChannel(row.eventType, channels, channel, on, availability);
    if (next) save.mutate(eventSave(row.eventType, next));
  };

  const heading = (
    <>
      <span id={titleId} className="text-sm font-medium">
        {eventLabel}
      </span>
      {row.isDefault ? (
        <Badge variant="outline" className="ml-2 align-middle" data-testid={`notification-default-${row.eventType}`}>
          {t('notificationPreferences.defaultBadge')}
        </Badge>
      ) : null}
      <p className="mt-0.5 text-sm font-normal text-foreground/70">{t(EVENT_TEXTS[row.eventType].hintKey)}</p>
      {isLegalDeadline(row.eventType) ? (
        <p id={legalId} className="mt-1 text-sm font-normal text-foreground/70">
          {t('notificationPreferences.legalNeverOff')}
        </p>
      ) : null}
    </>
  );

  const switchFor = (channel: NotificationChannel) => {
    const cell = channelCell(row.eventType, channels, channel, availability);
    const describedBy =
      cell.lock === 'unavailable'
        ? reasonId(idPrefix, channel, layout === 'card' ? row.eventType : undefined)
        : cell.lock === 'last-legal-channel'
          ? legalId
          : undefined;
    return (
      <Switch
        checked={cell.checked}
        disabled={cell.disabled}
        onCheckedChange={(on) => change(channel, on)}
        aria-label={t('notificationPreferences.switchLabel', { event: eventLabel, channel: t(CHANNEL_TEXTS[channel].labelKey) })}
        aria-describedby={describedBy}
        data-testid={`notification-switch-${row.eventType}-${channel}`}
      />
    );
  };

  if (layout === 'table') {
    return (
      <tr className="border-t align-top" aria-busy={save.isPending || undefined} data-testid={`notification-row-${row.eventType}`}>
        <th scope="row" className="px-4 py-3 text-left font-normal">
          {heading}
        </th>
        {NOTIFICATION_CHANNELS.map((channel) => (
          <td key={channel} className="px-2 py-1 text-center">
            {/* The label is the target (44 px): the switch is 24 px high, and the touch rules leave switches out of their hit area. */}
            <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center has-[:disabled]:cursor-not-allowed">
              {switchFor(channel)}
            </label>
          </td>
        ))}
      </tr>
    );
  }

  return (
    <li className="p-4" aria-busy={save.isPending || undefined} data-testid={`notification-row-${row.eventType}`}>
      <div role="group" aria-labelledby={titleId}>
        <div>{heading}</div>
        <ul role="list" className="mt-2 divide-y">
          {NOTIFICATION_CHANNELS.map((channel) => (
            <li key={channel}>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 has-[:disabled]:cursor-not-allowed">
                <span className="min-w-0 text-sm">
                  {t(CHANNEL_TEXTS[channel].labelKey)}
                  {availability[channel] ? null : (
                    <span id={reasonId(idPrefix, channel, row.eventType)} className="block text-xs text-foreground/70">
                      {t('notificationPreferences.channelUnavailable')}
                    </span>
                  )}
                </span>
                {switchFor(channel)}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}
