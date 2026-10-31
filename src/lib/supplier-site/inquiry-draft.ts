import { comuneOf } from './booking-draft';
import { EMPTY_INQUIRY_DRAFT, INQUIRY_LIMITS, type InquiryDraft } from './inquiry-flow';

/**
 * The draft of a request on measure, kept on the device so that a reload, the back button or a trip to the e-mail does not lose what was
 * written (SP-12c). Like the draft of a booking it is **per supplier** (the key carries the slug: nothing typed on one site is read on
 * another), **expires** after a few hours without a change, and **never holds the consent**: the type has no member for it and what is
 * read back is rebuilt member by member, so an old or hand-edited file cannot bring anything else in. It is dropped as soon as the
 * request is sent.
 */
const KEY_PREFIX = 'casazen.supplier-inquiry.';
const FORMAT = 1;
/** How long a draft lives after its last change. */
export const INQUIRY_DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

const keyOf = (slug: string) => `${KEY_PREFIX}${slug}`;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** A draft rebuilt from what the storage held, member by member; null when it is not one. */
function rebuild(value: unknown): InquiryDraft | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const comune = comuneOf(raw.comune);
  return {
    service: typeof raw.service === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(raw.service) ? raw.service : null,
    ...(comune !== undefined ? { comune } : {}),
    message: text(raw.message, INQUIRY_LIMITS.messageMax),
    fullName: text(raw.fullName, 100),
    email: text(raw.email, 254),
    phone: text(raw.phone, 60),
  };
}

/** The draft of this supplier, or null when there is none, it has expired or it cannot be read. */
export function readInquiryDraft(slug: string, now: number = Date.now()): InquiryDraft | null {
  try {
    const raw = window.localStorage.getItem(keyOf(slug));
    if (!raw) return null;
    const stored = JSON.parse(raw) as { v?: unknown; savedAt?: unknown; draft?: unknown };
    if (stored.v !== FORMAT || typeof stored.savedAt !== 'number' || now - stored.savedAt > INQUIRY_DRAFT_TTL_MS || now < stored.savedAt) {
      window.localStorage.removeItem(keyOf(slug));
      return null;
    }
    return rebuild(stored.draft);
  } catch {
    return null;
  }
}

export function writeInquiryDraft(slug: string, draft: InquiryDraft, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(keyOf(slug), JSON.stringify({ v: FORMAT, savedAt: now, draft }));
  } catch {
    // Storage full or blocked (private mode): the request works, it only does not survive a reload.
  }
}

export function clearInquiryDraft(slug: string): void {
  try {
    window.localStorage.removeItem(keyOf(slug));
  } catch {
    // Nothing to clear.
  }
}

/**
 * A draft that starts from what the address of the page said (the service slug and the ISTAT code of the comune the buttons of the site
 * know), over whatever the device remembered of this supplier. A comune named by the address wins over a different one remembered
 * (the person came here from a message about that comune); the code is resolved to a name by the page, so only a remembered comune is
 * kept or dropped here.
 */
export function startingInquiryDraft(slug: string, seed: { service?: string; comune?: string }): InquiryDraft {
  const { comune: remembered, ...rest } = readInquiryDraft(slug) ?? EMPTY_INQUIRY_DRAFT;
  const keepComune = remembered !== undefined && (!seed.comune || remembered?.istatCode === seed.comune);
  return { ...EMPTY_INQUIRY_DRAFT, ...rest, ...(keepComune ? { comune: remembered } : {}), ...(seed.service ? { service: seed.service } : {}) };
}
