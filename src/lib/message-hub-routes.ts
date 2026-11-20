/** The page of the messages of the host: every conversation, the ones of the channels and the direct ones (E05/F02/US03). */
export const MESSAGES_PATH = '/app/short-rent/messages';

/**
 * The page of the messages narrowed to one booking (`view=all&booking=<id>`): the conversations of that booking or, when it has none, how
 * the guest can be written to (NF-63). The way from the tab or the drawer of a booking to the hub of the messages.
 */
export function messagesOfBookingPath(bookingId: string): string {
  return `${MESSAGES_PATH}?view=all&booking=${encodeURIComponent(bookingId)}`;
}

/**
 * The page of one conversation, from the key the server gave it (`ota:…` or `direct:…`). The key goes in the address escaped: the page
 * reads it back with `useParams`, and the API takes it escaped in its own address.
 */
export function messageThreadPath(threadKey: string): string {
  return `${MESSAGES_PATH}/${encodeURIComponent(threadKey)}`;
}

/**
 * The page of one review of a guest, from the key the server gave it (`otareview:…` of a channel, `review:…` of the booking site, E05/F06/US02): the list beside it is the one of the reviews
 * (`view=reviews`), as the rows of that list open it. The way from the booking, and from the queue of the approvals, to a review.
 */
export function reviewThreadPath(threadKey: string): string {
  return `${messageThreadPath(threadKey)}?view=reviews`;
}
