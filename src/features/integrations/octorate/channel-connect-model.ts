import type { ConnectChannelAccommodation, OctorateListing } from '@/types';
import type { ChannelAccessView } from './existing-inventory';

/**
 * How a channel of the step «Portali» is connected, in the words of the host. A portal that needs only the id of each structure on it (the catalog says
 * so: `connectByPropertyId`) is connected from CasaZen: the host writes the ids, the channel manager is told, and the last step is the approval on the
 * portal's own site, which CasaZen sees by itself. Every other portal goes through the panel of the channel manager, and the row says exactly what to do
 * there. The server decides the states; this only chooses what the row asks of the host.
 */

/** The portal codes the channel manager gives: the ones the texts of the step name (Booking, Airbnb, Expedia, Vrbo). */
const PORTAL_CODE = { booking: '142', airbnb: '274', expedia: '4', vrbo: '235' } as const;

/** What the host is told about a portal: the sentence under the button of the panel, the sentence of the last step and where to go to do it. */
interface PortalGuide {
  /** Under the button of the panel, for a portal that goes through it: what to do there. */
  panelHintKey: string;
  /** For a portal connected by id, once the ids are with the channel manager: the one thing left to do, on the portal itself. */
  lastStepKey: string;
  /** The portal's own site, where the channel manager is approved; none for a portal CasaZen has no page to send the host to. */
  extranet: { href: string; labelKey: string } | null;
}

const OTHER_PORTAL: PortalGuide = {
  panelHintKey: 'octorate.connect.existing.channels.panelHint.other',
  lastStepKey: 'octorate.connect.existing.channels.byId.lastStep.other',
  extranet: null,
};

const GUIDES: Readonly<Record<string, PortalGuide>> = {
  [PORTAL_CODE.booking]: {
    ...OTHER_PORTAL,
    lastStepKey: 'octorate.connect.existing.channels.byId.lastStep.booking',
    extranet: { href: 'https://admin.booking.com/', labelKey: 'octorate.connect.existing.channels.byId.lastStep.bookingLink' },
  },
  [PORTAL_CODE.expedia]: {
    ...OTHER_PORTAL,
    lastStepKey: 'octorate.connect.existing.channels.byId.lastStep.expedia',
    extranet: { href: 'https://www.expediapartnercentral.com/', labelKey: 'octorate.connect.existing.channels.byId.lastStep.expediaLink' },
  },
  [PORTAL_CODE.airbnb]: { ...OTHER_PORTAL, panelHintKey: 'octorate.connect.existing.channels.panelHint.airbnb' },
  [PORTAL_CODE.vrbo]: { ...OTHER_PORTAL, panelHintKey: 'octorate.connect.existing.channels.panelHint.vrbo' },
};

/** What the row says for a portal; a portal CasaZen does not know by code gets the general words, with its name from the catalog. */
export function portalGuide(code: string): PortalGuide {
  return Object.hasOwn(GUIDES, code) ? GUIDES[code] : OTHER_PORTAL;
}

/** What a channel that is not connected asks of the host: nothing yet (`reading`), the ids (`ids`), the approval on the portal (`lastStep`) or the panel (`panel`). */
export type ChannelRowMode = 'panel' | 'reading' | 'ids' | 'lastStep';

interface ChannelRowModeInput {
  /** The catalog says the portal needs only the id of each structure on it. */
  byId: boolean;
  view: ChannelAccessView;
  /** The ids are with the channel manager: the connect answered, or the channel lists the structures it connected. */
  idsSent: boolean;
  /** The structures the channel manager holds are being read. */
  reading: boolean;
  /** How many structures there are to ask the id of. */
  structures: number;
}

/**
 * A portal that is not connected by id goes through the panel. One that is asks for the ids; once they are sent (and the access did not stop) the last
 * step is the approval on the portal itself. With no structure to ask the id of, the panel is the way, and so it is for a channel already followed
 * there (an access started on the panel before). While the structures are read nothing is offered, so the host is never sent to the panel by a flash.
 */
export function channelRowMode({ byId, view, idsSent, reading, structures }: ChannelRowModeInput): ChannelRowMode {
  if (!byId) return 'panel';
  if (idsSent && view !== 'error') return 'lastStep';
  if (view !== 'notStarted' && view !== 'error') return 'panel';
  if (reading) return 'reading';
  return structures > 0 ? 'ids' : 'panel';
}

/** The longest id of a structure on a portal the server takes, and the characters it takes. */
export const PORTAL_ID_MAX_LENGTH = 64;
const PORTAL_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

/** True for an id a portal can have: letters, numbers, dots, dashes and underscores, up to 64 characters. */
export function isPortalId(value: string): boolean {
  return value.length <= PORTAL_ID_MAX_LENGTH && PORTAL_ID_PATTERN.test(value);
}

/** What the host wrote for each structure, by the accommodation id the channel manager gives it. */
export type PortalIds = Readonly<Record<string, string>>;

/** What the ids written come to: exactly what is sent, and which of them a portal cannot have. */
export interface PortalIdsCheck {
  /** The structures that have an id, in the order they are listed, the id trimmed: a structure left empty is not on the portal and is not sent. */
  accommodations: ConnectChannelAccommodation[];
  /** The accommodation ids whose id has characters a portal does not have, or is too long. */
  invalid: string[];
}

export function checkPortalIds(structures: readonly Pick<OctorateListing, 'octorateAccommodationId'>[], ids: PortalIds): PortalIdsCheck {
  const accommodations = structures
    .map(({ octorateAccommodationId }) => ({
      accommodationId: octorateAccommodationId,
      hotelId: (Object.hasOwn(ids, octorateAccommodationId) ? ids[octorateAccommodationId] : '').trim(),
    }))
    .filter((entry) => entry.hotelId !== '');

  return { accommodations, invalid: accommodations.filter((entry) => !isPortalId(entry.hotelId)).map((entry) => entry.accommodationId) };
}

/** The structures the host can give an id for: the ones the channel manager holds, except those the host said are not theirs. */
export function connectableStructures(listings: readonly OctorateListing[] | undefined): OctorateListing[] {
  return (listings ?? []).filter((listing) => listing.status !== 'Rejected');
}
