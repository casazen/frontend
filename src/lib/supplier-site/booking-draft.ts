import { EMPTY_DRAFT, type BookingDraft, type DraftComune } from './booking-flow';

/**
 * The draft of a booking, kept on the device so that a reload, the back button or a trip to the e-mail does not lose what was typed
 * (SP-12b). It is **per supplier** (the key carries the slug: nothing typed on one site is read on another), **expires** after a few
 * hours of no change, and **never holds the consent** nor a password: the type has no member for them and what is read back is
 * rebuilt member by member, so an old or hand-edited file cannot bring anything else in. It is dropped as soon as the booking is sent.
 */
const KEY_PREFIX = 'casazen.supplier-booking.';
const FORMAT = 1;
/** How long a draft lives after its last change. */
export const BOOKING_DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

const keyOf = (slug: string) => `${KEY_PREFIX}${slug}`;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function whole(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 9999 ? value : null;
}

function comuneOf(value: unknown): DraftComune | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object' || value === undefined) return undefined;
  const { istatCode, name, provinceCode } = value as Record<string, unknown>;
  if (typeof istatCode !== 'string' || !/^\d{6}$/.test(istatCode) || typeof name !== 'string' || !name) return undefined;
  return { istatCode, name: name.slice(0, 100), provinceCode: typeof provinceCode === 'string' ? provinceCode.slice(0, 2) : '' };
}

/** A draft rebuilt from what the storage held, member by member; null when it is not one. */
function rebuild(value: unknown): BookingDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const options: Record<string, number> = {};
  if (typeof raw.options === 'object' && raw.options !== null) {
    for (const [code, units] of Object.entries(raw.options as Record<string, unknown>).slice(0, 10)) {
      const count = whole(units);
      if (/^[A-Za-z0-9_-]{1,40}$/.test(code) && count !== null && count <= 99) options[code] = count;
    }
  }
  const comune = comuneOf(raw.comune);
  const startUtc = typeof raw.startUtc === 'string' && !Number.isNaN(new Date(raw.startUtc).getTime()) ? raw.startUtc : null;
  return {
    service: typeof raw.service === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(raw.service) ? raw.service : null,
    quantity: whole(raw.quantity),
    surface: whole(raw.surface),
    options,
    urgent: raw.urgent === true,
    ...(comune !== undefined ? { comune } : {}),
    startUtc,
    postalCode: text(raw.postalCode, 10),
    address: text(raw.address, 200),
    floor: text(raw.floor, 60),
    accessNotes: text(raw.accessNotes, 500),
    fullName: text(raw.fullName, 100),
    email: text(raw.email, 254),
    phone: text(raw.phone, 60),
  };
}

/** The draft of this supplier, or null when there is none, it has expired or it cannot be read. */
export function readBookingDraft(slug: string, now: number = Date.now()): BookingDraft | null {
  try {
    const raw = window.localStorage.getItem(keyOf(slug));
    if (!raw) return null;
    const stored = JSON.parse(raw) as { v?: unknown; savedAt?: unknown; draft?: unknown };
    if (stored.v !== FORMAT || typeof stored.savedAt !== 'number' || now - stored.savedAt > BOOKING_DRAFT_TTL_MS || now < stored.savedAt) {
      window.localStorage.removeItem(keyOf(slug));
      return null;
    }
    return rebuild(stored.draft);
  } catch {
    return null;
  }
}

export function writeBookingDraft(slug: string, draft: BookingDraft, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(keyOf(slug), JSON.stringify({ v: FORMAT, savedAt: now, draft }));
  } catch {
    // Storage full or blocked (private mode): the booking works, it only does not survive a reload.
  }
}

export function clearBookingDraft(slug: string): void {
  try {
    window.localStorage.removeItem(keyOf(slug));
  } catch {
    // Nothing to clear.
  }
}

/**
 * A draft that starts from what the address of the page said, over whatever the device remembered. If the address names another service
 * than the one remembered, what was chosen for that one (quantity, options, the slot) is left behind: it does not fit the new one.
 */
export function startingDraft(slug: string, seed: Partial<BookingDraft>): BookingDraft {
  const stored = readBookingDraft(slug);
  const changedService = stored !== null && seed.service !== undefined && stored.service !== seed.service;
  const kept = stored && changedService ? { ...stored, quantity: null, surface: null, options: {}, urgent: false, startUtc: null } : stored;
  return { ...EMPTY_DRAFT, ...(kept ?? {}), ...seed };
}
