import type { AlloggiatiChannelManagerGuestDto, AlloggiatiRetryResultDto, AlloggiatiStatusDto, AlloggiatiWebStatus } from '@/types/alloggiati.types';

/**
 * The stay on the channel manager (E20/F01/US02): what the page says about a stay whose guests are entrusted to the channel manager, which sends them to the police
 * (PO-02). CasaZen writes the guests and keeps the lead, but never says «sent» for what the channel manager has not confirmed: the stay is green only with an archived
 * receipt (CHK-12), and every state that is not complete is told as such. The server decides every state and light; this file only reads them.
 */

/** The error code of a guest held back because a place of its data is not one the channel manager knows: asking again cannot mend it, the data has to be corrected. */
export const PLACE_NOT_RECOGNIZED = 'place_not_recognized';

/** The action of the status when asking again can mend a write that failed (`AlloggiatiStayActions.RetryOctorateWrite` of the backend). */
const RETRY_ACTION = 'RetryOctorateWrite';

/**
 * How the stay is told once it is on the channel manager: entrusted and waiting for the receipt (yellow), the receipt archived (green), entrusted with the receipt missing while the
 * server's light is red (a notice in the tone a red line has in the product: warning, danger once the term has passed), or to correct (red: a guest could not be written).
 */
export type StayChannelView = 'entrusted' | 'receiptArchived' | 'receiptMissing' | 'toCorrect';

/**
 * The view of a stay, or `null` when the stay is not on the channel manager (any other status: the page tells it as it always did). `ChannelManagerWriteFailed` is to
 * correct whatever else exists; an entrusted stay is green only when the server says an archived receipt covers it, and a receipt that is missing when the server says its light is
 * red (the receipt did not come in time). The client never works a light out.
 */
export function stayChannelViewOf(status: Pick<AlloggiatiStatusDto, 'status' | 'channelManager'>): StayChannelView | null {
  if (status.status === 'ChannelManagerWriteFailed') return 'toCorrect';
  if (status.status !== 'EntrustedToChannelManager') return null;

  const block = status.channelManager;
  if (block?.receiptCoverage?.archived === true) return 'receiptArchived';
  return block?.light === 'Red' ? 'receiptMissing' : 'entrusted';
}

/** The guests whose write failed, by position: the ones the page lists with their reason. */
export function guestsToCorrect(status: Pick<AlloggiatiStatusDto, 'channelManager'>): AlloggiatiChannelManagerGuestDto[] {
  return (status.channelManager?.guests ?? []).filter((guest) => guest.state === 'Failed').sort((left, right) => left.position - right.position);
}

/** Whether the server offers the retry: asking again can mend a write that failed (the host needs `alloggiati.submit` to use it). */
export function canRetryWrite(status: Pick<AlloggiatiStatusDto, 'channelManager'>): boolean {
  return status.channelManager?.actions?.includes(RETRY_ACTION) === true;
}

/** Whether a guest was held back for a place the channel manager does not know: only a correction of its data helps. */
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

/** The key of the words that tell why a guest was not taken by the channel manager. */
export function guestErrorKey(code: string | null): string {
  return `alloggiati.channelManager.reason.${code !== null && GUEST_ERRORS.has(code) ? code : 'unknown'}`;
}

/** The fields of a guest a place can be wrong in (`errorFields` of `place_not_recognized`): the ones the page names, each with its own words. */
const PLACE_FIELDS = ['birthComune', 'residenceComune', 'documentIssuePlace'] as const;
export type PlaceField = (typeof PLACE_FIELDS)[number];

/** The fields named by `errorFields` (comma separated), in the order of the record; a name this version does not know is left out (the words then say «i luoghi indicati»). */
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
