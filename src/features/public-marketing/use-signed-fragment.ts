import { useEffect, useState } from 'react';

/** The values a page takes from the fragment of its link: the ones it cannot go on without and the ones it takes when they are there. */
export interface SignedFragmentFields<Required extends string, Optional extends string = never> {
  readonly required: readonly Required[];
  readonly optional?: readonly Optional[];
}

/** What was read: every required value and, when the link has them, the optional ones. */
export type SignedFragmentValues<Required extends string, Optional extends string = never> = Record<Required, string> &
  Partial<Record<Optional, string>>;

/**
 * The known values of a fragment (`#name=value&…`), or `null` when one of the required ones is missing or empty. Whatever the page does
 * not know is left out, so a link cannot make the page carry what it did not ask for. The values are returned as the link had them
 * (decoded once, as a browser does), because the page posts them back unchanged. Pure: it reads nothing but the text it is given.
 */
export function parseSignedFragment<Required extends string, Optional extends string = never>(
  hash: string,
  fields: SignedFragmentFields<Required, Optional>,
): SignedFragmentValues<Required, Optional> | null {
  const source = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const values: Record<string, string> = {};
  for (const name of fields.required) {
    const value = source.get(name);
    if (!value) return null;
    values[name] = value;
  }
  for (const name of fields.optional ?? []) {
    const value = source.get(name);
    if (value) values[name] = value;
  }
  return values as SignedFragmentValues<Required, Optional>;
}

/** Takes the fragment out of the address bar, leaving the path, the query and the state of the history entry (the router's) as they are. */
function clearAddressBar(): void {
  const { pathname, search, hash } = window.location;
  if (hash === '') return;
  window.history.replaceState(window.history.state, '', `${pathname}${search}`);
}

/**
 * The signed values of the link of an e-mail (`/unsubscribe#orgId=…&signature=…`), which travel in the fragment: a browser never sends it to a
 * server, so the values are in no access log. The page reads them once, when it opens, and the address bar is cleaned right after
 * (`history.replaceState`), so they stay in no bookmark, no shared address and no history entry. They are kept in the memory of the open
 * page only: never stored, never logged and never put in a link. `null` when the link does not carry what the page needs (a link opened
 * again after the first time has no fragment left).
 *
 * `fields` is read when the page opens: give it a constant.
 */
export function useSignedFragment<Required extends string, Optional extends string = never>(
  fields: SignedFragmentFields<Required, Optional>,
): SignedFragmentValues<Required, Optional> | null {
  // Read while rendering and cleaned in an effect: the render may run twice (StrictMode) and must give the same answer both times.
  const [values] = useState(() => parseSignedFragment(window.location.hash, fields));

  useEffect(() => {
    clearAddressBar();
  }, []);

  return values;
}
