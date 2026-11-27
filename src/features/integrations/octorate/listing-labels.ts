import type { TFunction } from 'i18next';
import type { OctorateListing, OctorateRoom } from '@/types';

/**
 * How the steps after the consent name what the channel manager holds (E02/F01/US02/T05): one state for each listing in simple words
 * (NF-28), the channels by their names (the OTAs are named, the channel manager never is, NF-12), the rooms and the address. Plain data and
 * functions: the keys are written out so that the i18n test finds a missing translation.
 */

/** Where a listing stands, in the words of the host. */
export type ListingState = 'toConfirm' | 'new' | 'toChoose' | 'linked' | 'excluded';

/**
 * `Proposed` with a property is one clear match the host confirms; without one nothing in CasaZen matches and the listing is offered for
 * import; `Ambiguous` is close or tied candidates the host chooses from.
 */
export function listingStateOf(listing: OctorateListing): ListingState {
  switch (listing.status) {
    case 'Confirmed':
      return 'linked';
    case 'Rejected':
      return 'excluded';
    case 'Ambiguous':
      return 'toChoose';
    case 'Proposed':
      return listing.proposedProperty && !listing.offeredForImport ? 'toConfirm' : 'new';
  }
}

export interface ListingStateText {
  /** The state, in a word or two (a badge). */
  labelKey: string;
  /** The state, in a sentence (`{{property}}`: the proposed or confirmed property, when there is one). */
  hintKey: string;
  variant: 'secondary' | 'warning' | 'success' | 'outline';
}

export const LISTING_STATES: Readonly<Record<ListingState, ListingStateText>> = {
  toConfirm: {
    labelKey: 'octorate.connect.channelsFound.state.toConfirm.label',
    hintKey: 'octorate.connect.channelsFound.state.toConfirm.hint',
    variant: 'secondary',
  },
  new: {
    labelKey: 'octorate.connect.channelsFound.state.new.label',
    hintKey: 'octorate.connect.channelsFound.state.new.hint',
    variant: 'secondary',
  },
  toChoose: {
    labelKey: 'octorate.connect.channelsFound.state.toChoose.label',
    hintKey: 'octorate.connect.channelsFound.state.toChoose.hint',
    variant: 'warning',
  },
  linked: {
    labelKey: 'octorate.connect.channelsFound.state.linked.label',
    hintKey: 'octorate.connect.channelsFound.state.linked.hint',
    variant: 'success',
  },
  excluded: {
    labelKey: 'octorate.connect.channelsFound.state.excluded.label',
    hintKey: 'octorate.connect.channelsFound.state.excluded.hint',
    variant: 'outline',
  },
};

/** The channels the channel manager reports by code that CasaZen can name (142 Booking.com, 274 Airbnb, 235 Vrbo, 4 Expedia). */
const KNOWN_CHANNELS: ReadonlyArray<{ code: string; nameKey: string }> = [
  { code: '142', nameKey: 'octorate.connect.channelsFound.channels.booking' },
  { code: '274', nameKey: 'octorate.connect.channelsFound.channels.airbnb' },
  { code: '235', nameKey: 'octorate.connect.channelsFound.channels.vrbo' },
  { code: '4', nameKey: 'octorate.connect.channelsFound.channels.expedia' },
];

/** The state of a listing in a sentence, with the property it is proposed or confirmed to; none while that property is not there to name. */
export function listingStateHint(listing: OctorateListing, t: TFunction): string {
  const state = listingStateOf(listing);
  const property = listing.proposedProperty?.name ?? '';
  if (!property && (state === 'toConfirm' || state === 'linked')) return '';
  return t(LISTING_STATES[state].hintKey, { property });
}

/** The name of a channel by its code; a code CasaZen does not know is shown as it is, never guessed. */
export function channelName(code: string, t: TFunction): string {
  const known = KNOWN_CHANNELS.find((channel) => channel.code === code.trim());
  return known ? t(known.nameKey) : t('octorate.connect.channelsFound.channels.other', { code });
}

/** The state of the connection of the listing to a channel: the channel manager reports `Connected`; anything else is "to check". */
export function channelStateText(state: string, t: TFunction): string {
  return state === 'Connected' ? t('octorate.connect.channelsFound.onChannel.connected') : t('octorate.connect.channelsFound.onChannel.other');
}

/** The name the channel manager gives a listing; a listing with none is named by its id, so that two of them are never alike. */
export function listingName(listing: OctorateListing, t: TFunction): string {
  return listing.name?.trim() || t('octorate.connect.channelsFound.unnamed', { id: listing.octorateAccommodationId });
}

/** Street and city of a listing as the channel manager has them; empty when it has neither. */
export function listingAddress(listing: Pick<OctorateListing, 'address' | 'city'>): string {
  return [listing.address, listing.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ');
}

/** "up to 4 guests", or nothing while the capacity is not known. */
export function capacityText(guests: number | null | undefined, t: TFunction): string {
  return guests && guests > 0 ? t('octorate.connect.channelsFound.capacity', { count: guests }) : '';
}

/** A room by its name (and the guests it takes); a room with no name is named by its id. */
export function roomName(room: OctorateRoom, t: TFunction): string {
  const name = room.name?.trim() || t('octorate.connect.channelsFound.roomUnnamed', { id: room.id });
  const capacity = capacityText(room.maxGuests, t);
  return capacity ? `${name} · ${capacity}` : name;
}

/** The parts of a line of details, without the empty ones: "Via Roma 12, Milano · up to 4 guests". */
export function detailsLine(...parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part && part.trim() !== '').join(' · ');
}
