/**
 * `validateStatus` of a read that takes a refusal (403) as an answer: the shared client sends the whole app to the page of no access on a 403 for a read, so a
 * page that can tell «the access is not there» by itself asks this way, and gets `null` from the call instead of an error.
 */
export const acceptsRefusal = (status: number): boolean => (status >= 200 && status < 300) || status === 403;
