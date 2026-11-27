import type { AlloggiatiChannelManagerGuestDto, AlloggiatiRetryResultDto, AlloggiatiStatusDto, AlloggiatiWebStatus } from '@/types/alloggiati.types';

/**
 * The stay on the channel manager (E20/F01/US02): what the page says about a stay whose guests are entrusted to the channel manager, which sends them to the police
 * (PO-02). CasaZen writes the guests and keeps the lead, but never says «sent» for what the channel manager has not confirmed: the stay is green only with an archived
 * receipt (CHK-12), and every state that is not complete is told as such. The server decides every state and light; this file only reads them.
 */

/** The error code of a guest held back because a place of its data is not one the channel manager knows: asking again cannot mend it, the data has to be corrected. */
export const PLACE_NOT_RECOGNIZED = 'place_not_recognized';

const RETRY_ACTION = 'RetryOctorateWrite';

/**
 * How the stay is told once it is on the channel manager: entrusted and waiting for the receipt (yellow), the receipt archived (green), entrusted with the receipt missing while the
 * server's light is red (a notice in the tone a red line has in the product: warning, danger once the term has passed), or to correct (red: a guest could not be written).
 */
export type StayChannelView = 'entrusted' | 'receiptArchived' | 'receiptMissing' | 'toCorrect';

/**
 * An archived receipt covers a stay unless the communication failed or is not due.
 * Entrusted stays without a receipt use the server's light to distinguish waiting from missing.
 */
export function stayChannelViewOf(status: Pick<AlloggiatiStatusDto, 'status' | 'channelManager'>): StayChannelView | null {
  if (status.status === 'ChannelManagerWriteFailed') return 'toCorrect';
  const block = status.channelManager;
  const failure = status.status === 'Errore' || status.status === 'Rifiutato';
  if (status.status !== 'NotDue' && !failure && block?.receiptCoverage?.archived === true) return 'receiptArchived';
  if (status.status !== 'EntrustedToChannelManager') return null;
  return block?.light === 'Red' ? 'receiptMissing' : 'entrusted';
}

export function guestsToCorrect(status: Pick<AlloggiatiStatusDto, 'channelManager'>): AlloggiatiChannelManagerGuestDto[] {
  return (status.channelManager?.guests ?? []).filter((guest) => guest.state === 'Failed').sort((left, right) => left.position - right.position);
}

/** Whether the server offers the retry: asking again can mend a write that failed (the host needs `alloggiati.submit` to use it). */
export function canRetryWrite(status: Pick<AlloggiatiStatusDto, 'channelManager'>): boolean {
  return status.channelManager?.actions?.includes(RETRY_ACTION) === true;
}

export function needsPlaceCorrection(guests: readonly AlloggiatiChannelManagerGuestDto[]): boolean {
  return guests.some((guest) => guest.errorCode === PLACE_NOT_RECOGNIZED);
}

/** The codes of a failed write that have words of their own (`alloggiati.channelManager.reason.<code>`); any other code says the generic ones, never the raw code. */
const GUEST_ERRORS: ReadonlySet<string> = new Set([
  PLACE_NOT_RECOGNIZED,
  'octorate_auth',
  'octorate_conflict',
  'octorate_guest_rejected',
  'octorate_not_found',
  'octorate_rate_limited',
  'octorate_server',
]);

export function guestErrorKey(code: string | null): string {
  return `alloggiati.channelManager.reason.${code !== null && GUEST_ERRORS.has(code) ? code : 'unknown'}`;
}

const PLACE_FIELDS = ['birthComune', 'residenceComune', 'documentIssuePlace'] as const;
export type PlaceField = (typeof PLACE_FIELDS)[number];

export function placeFieldsOf(errorFields: string | null | undefined): PlaceField[] {
  const named = (errorFields ?? '').split(',').map((field) => field.trim());
  return PLACE_FIELDS.filter((field) => named.includes(field));
}

/** What the retry did, in the words the page has for it. */
export type RetryOutcome = 'sent' | 'partlyFailed' | 'failed' | 'nothingToSend' | 'notApplicable';

/**
 * The outcome of a retry: the guests that went, some of them, none, nothing to try (a guest held back for a place is corrected, not retried), or a stay that is not on the channel manager.
 * `answered` is the status of the stay the retry answered with. `Sent` only says that every guest the retry tried went: a guest held back for a place is never tried again, so the stay can
 * still be to correct. The words of «done» are for a stay the server now says is entrusted; any other status says that some guests went and others did not.
 */
export function retryOutcomeOf(retry: AlloggiatiRetryResultDto, answered: AlloggiatiWebStatus): RetryOutcome {
  switch (retry.state) {
    case 'Sent':
      return answered === 'EntrustedToChannelManager' ? 'sent' : 'partlyFailed';
    case 'PartlyFailed':
      return 'partlyFailed';
    case 'Failed':
      return 'failed';
    case 'NothingToSend':
      return 'nothingToSend';
    default:
      return 'notApplicable';
  }
}
