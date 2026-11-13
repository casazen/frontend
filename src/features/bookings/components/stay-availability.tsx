import { useTranslation } from 'react-i18next';
import { Alert, type AlertProps } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatStayDate } from '@/lib/stay-dates';
import type { BookingChannel, StayAvailability, StayAvailabilityConflict, StayAvailabilityWindow } from '@/types';
import { channelManagerBlockedMessage, channelManagerConflict, portalName, type LinkedBlock } from '../lib/new-booking-model';

const RANGE_DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

/** The states of the availability the host may go on from: free, free but under the minimum stay, a portal's reservation to link. A taken or impossible stay stops the step. */
const STATES_THE_HOST_MAY_GO_ON_FROM: ReadonlySet<StayAvailability['state']> = new Set(['ok', 'belowMinimum', 'linkableBlock']);

/** "10 nov – 13 nov": a stay as the notice says it. */
function stayRange(from: string, to: string, language: string): string {
  return `${formatStayDate(from, language, RANGE_DAY)} – ${formatStayDate(to, language, RANGE_DAY)}`;
}

/** The box of the answer: the state it speaks of is on it for the tests and for whoever reads the page. */
function Notice({ state, ...props }: AlertProps & { state: StayAvailability['state'] }) {
  return <Alert data-testid="booking-availability" data-state={state} {...props} />;
}

/** One line of "what takes these dates": the stay of someone, a portal's reservation or a block of the host. */
function ConflictLine({ conflict, language }: { conflict: StayAvailabilityConflict; language: string }) {
  const { t } = useTranslation();
  const range = stayRange(conflict.from, conflict.to, language);
  const title = conflict.title?.trim();

  if (conflict.type === 'booking') {
    return (
      <>
        {title
          ? t('booking.create.availability.conflict.booking', { name: title, range })
          : t('booking.create.availability.conflict.bookingUnnamed', { range })}
      </>
    );
  }
  if (conflict.type === 'ical') {
    return <>{t('booking.create.availability.conflict.ical', { portal: portalName(conflict.channel, t), range })}</>;
  }
  // The channel manager says the nights cannot be booked: it names the channel only when the API does (never invented here).
  if (conflict.type === 'channelManager') {
    return title
      ? <>{t('booking.create.availability.conflict.channelManagerNamed', { channel: title, range })}</>
      : <>{t('booking.create.availability.conflict.channelManager', { range })}</>;
  }
  return (
    <>
      {title
        ? t('booking.create.availability.conflict.block', { title, range })
        : t('booking.create.availability.conflict.blockUnnamed', { range })}
    </>
  );
}

interface StayAvailabilityNoticeProps {
  /** The answer of the API, once it came. */
  availability: StayAvailability | undefined;
  /** The request is on its way and there is no answer yet. */
  isLoading: boolean;
  /** The block the host linked for these dates, if any. */
  link: LinkedBlock | null;
  /** "Use these dates": the nearest free dates replace the ones asked. */
  onUseWindow: (window: StayAvailabilityWindow) => void;
  /** "Link": the block of the portal is the one this booking completes. */
  onLink: (block: { blockId: string; channel: BookingChannel | null }) => void;
}

/**
 * Whether the dates are free (SR-06a), said under the dates as soon as they are known: free, free but under the minimum stay (the
 * host may go on), taken (what takes them, the channel manager included, and the nearest free dates), or a portal's reservation that only arrived as a block of its
 * calendar (the host completes it instead of creating a second booking). It is advice: nothing is shown while the answer cannot be
 * had, and the API checks again when the booking is created. When the channel manager could not be asked (`channelManagerChecked === false`) it is said under
 * the answer, without blocking anything: the dates are CasaZen's own answer and the check on the channel manager is repeated when the booking is created. It is said
 * only where the host may go on (`STATES_THE_HOST_MAY_GO_ON_FROM`): a taken stay stops the step whatever the channel manager could say, and "you can go on" would
 * not be true.
 */
export function StayAvailabilityNotice(props: StayAvailabilityNoticeProps) {
  const { t } = useTranslation();
  const { availability } = props;
  const state = <AvailabilityState {...props} />;

  if (availability?.channelManagerChecked !== false || !STATES_THE_HOST_MAY_GO_ON_FROM.has(availability.state)) return state;
  return (
    <div className="space-y-3">
      {state}
      <Alert variant="warning" data-testid="booking-availability-unchecked">
        {t('booking.create.availability.channelManagerUnchecked')}
      </Alert>
    </div>
  );
}

/** The answer of the availability for the dates (without the line about a channel manager that could not be asked). */
function AvailabilityState({ availability, isLoading, link, onUseWindow, onLink }: StayAvailabilityNoticeProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  if (!availability) {
    return isLoading ? (
      <p role="status" className="text-sm text-foreground/70" data-testid="booking-availability-checking">
        {t('booking.create.availability.checking')}
      </p>
    ) : null;
  }

  switch (availability.state) {
    case 'ok':
      return <Notice state="ok" variant="success" title={t('booking.create.availability.ok', { count: availability.nights })} />;

    case 'belowMinimum':
      return (
        <Notice state="belowMinimum" variant="warning" title={t('booking.create.availability.belowMinimum.title')}>
          {t('booking.create.availability.belowMinimum.text', { min: availability.minNights ?? 0, nights: availability.nights })}
        </Notice>
      );

    case 'occupied': {
      const window = availability.nearestFreeWindow;
      const channelManager = channelManagerConflict(availability);
      // Taken only on the channel manager: CasaZen's own calendar is free, so there is no list of stays and no window to offer, only the reason.
      const channelManagerOnly = channelManager !== undefined && availability.conflicts.every((conflict) => conflict.type === 'channelManager');
      return (
        <Notice
          state="occupied"
          variant="danger"
          title={t('booking.create.availability.occupied.title')}
          action={
            window ? (
              <Button type="button" size="sm" variant="secondary" data-testid="booking-availability-use-window" onClick={() => onUseWindow(window)}>
                {t('booking.create.availability.occupied.useWindow', { range: stayRange(window.from, window.to, language) })}
              </Button>
            ) : undefined
          }
        >
          {channelManagerOnly ? (
            <p data-testid="booking-availability-channel-manager">{channelManagerBlockedMessage(channelManager, t)}</p>
          ) : (
            <>
              <ul className="list-disc space-y-0.5 pl-5">
                {availability.conflicts.map((conflict, index) => (
                  // The conflict of the channel manager has no id of its own (the empty one): the position tells it apart.
                  <li key={`${conflict.id}-${index}`}>
                    <ConflictLine conflict={conflict} language={language} />
                  </li>
                ))}
              </ul>
              <p className="mt-1">
                {window
                  ? t('booking.create.availability.occupied.window', { count: availability.nights, range: stayRange(window.from, window.to, language) })
                  : t('booking.create.availability.occupied.noWindow')}
              </p>
            </>
          )}
        </Notice>
      );
    }

    case 'linkableBlock': {
      const channel = availability.conflicts[0]?.channel ?? null;
      const portal = portalName(channel, t);
      const blockId = availability.linkableBlockId;
      if (link) {
        return (
          <Notice state="linkableBlock" variant="success" title={t('booking.create.availability.link.linked', { portal })}>
            {t('booking.create.availability.link.linkedText')}
          </Notice>
        );
      }
      return (
        <Notice
          state="linkableBlock"
          variant="info"
          title={t('booking.create.availability.link.title', { portal })}
          action={
            blockId ? (
              <Button type="button" size="sm" variant="secondary" data-testid="booking-availability-link" onClick={() => onLink({ blockId, channel })}>
                {t('booking.create.availability.link.action')}
              </Button>
            ) : undefined
          }
        >
          {t('booking.create.availability.link.text')}
        </Notice>
      );
    }

    case 'invalid':
      return (
        <Notice state="invalid" variant="danger" title={t(`booking.create.availability.invalid.${availability.invalidReason ?? 'checkOutNotAfterCheckIn'}`)} />
      );

    default:
      return null;
  }
}
