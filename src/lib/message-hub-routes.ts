/** The page of the messages of the host: every conversation, the ones of the channels and the direct ones (E05/F02/US03). */
export const MESSAGES_PATH = '/app/short-rent/messages';

/**
 * The page of one conversation, from the key the server gave it (`ota:…` or `direct:…`). The key goes in the address escaped: the page
 * reads it back with `useParams`, and the API takes it escaped in its own address.
 */
export function messageThreadPath(threadKey: string): string {
  return `${MESSAGES_PATH}/${encodeURIComponent(threadKey)}`;
}
