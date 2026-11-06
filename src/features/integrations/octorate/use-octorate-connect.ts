import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCompleteOctorateConnect,
  useOctorateConnection,
  useStartOctorateConnect,
} from '@/queries/use-octorate-connection';
import { readOctorateCallback, withoutOctorateCallback } from './octorate-callback';

/**
 * Where the consent stands, in the words of the screen:
 * - `checking`: the state of the connection is being read;
 * - `ready`: not connected (yet): the host can start the consent;
 * - `completing`: the host is back from the channel manager and the code is being exchanged;
 * - `connected`: the connection works (just now, or it already did);
 * - `attention`: a connection exists but cannot be used: it has to be made again;
 * - `denied`: the host came back without giving the consent;
 * - `failed`: the host came back with the consent and the connection did not open.
 */
export type ConnectPhase = 'checking' | 'ready' | 'completing' | 'connected' | 'attention' | 'denied' | 'failed';

export interface OctorateConnect {
  phase: ConnectPhase;
  /** The host came back to the page from the channel manager: the address had its answer (the code and the state, or a refusal). */
  returned: boolean;
  /** How many properties the consent covers. Known only right after the consent was completed in this visit. */
  propertyCount: number | null;
  /** Why the connection did not open (`failed`). */
  error: unknown;
  /**
   * Sends the host to the page of the channel manager, in the same tab. It settles only when it fails: when it works the page is left,
   * and a wizard that waited for it must not go on to another step in the meantime.
   */
  start: () => Promise<void>;
}

/** The consent page is an https address; anything else is not followed, whatever the answer says. */
function isHttpsAddress(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The consent of the host to the connection of the org to its channel manager (E02/F01/US01/T04, ADR-023): starting it, and finishing
 * it when the host comes back to the page with the `code` and the `state` of the callback.
 *
 * The callback is read once, when the wizard opens, and its parts leave the address at once: they are single-use secrets, they do not
 * stay in the history or in a reload. The code is then exchanged by the server, once: a second page of the same wizard never sends it
 * again. Nothing of it is logged or kept.
 */
export function useOctorateConnect(): OctorateConnect {
  const [searchParams, setSearchParams] = useSearchParams();
  const [callback] = useState(() => readOctorateCallback(searchParams));
  // Back from the channel manager the answer comes from the exchange of the code, not from a second reading of the state.
  const connection = useOctorateConnection({ enabled: callback === null });
  const startConsent = useStartOctorateConnect();
  const { mutate: completeConsent, isSuccess, isError, error, data } = useCompleteOctorateConnect();
  const handled = useRef(false);

  useEffect(() => {
    if (!callback || handled.current) return;
    handled.current = true;
    setSearchParams((previous) => withoutOctorateCallback(previous), { replace: true });
    if (callback.kind === 'granted') completeConsent({ code: callback.code, state: callback.state });
  }, [callback, completeConsent, setSearchParams]);

  // Back from the channel manager with the "back" button, the browser may bring this page back as it was left, button busy included.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const phase = ((): ConnectPhase => {
    if (callback?.kind === 'refused') return 'denied';
    if (callback?.kind === 'granted') return isSuccess ? 'connected' : isError ? 'failed' : 'completing';
    if (connection.isPending) return 'checking';
    if (connection.data?.status === 'Connected') return 'connected';
    return connection.data?.status === 'Error' ? 'attention' : 'ready';
  })();

  const start = async (): Promise<void> => {
    const { authorizationUrl } = await startConsent.mutateAsync();
    if (!isHttpsAddress(authorizationUrl)) throw new Error('The consent address is not an https address');
    window.location.assign(authorizationUrl);
    await new Promise<never>(() => undefined);
  };

  return { phase, returned: callback !== null, propertyCount: data?.propertyCount ?? null, error: isError ? error : null, start };
}
