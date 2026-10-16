import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasDetailParam, isValidDetailId, readDetail, searchWithDetail, type DetailRef } from '@/lib/detail-address';
import { focusedElement, rememberOpener } from './detail-opener';
import { getDetail, getDetailsVersion, isHostMounted, subscribeToDetails } from './detail-registry';

export interface OpenDetailOptions {
  /**
   * The element to give the focus back to when the drawer closes: the button that was pressed. Default: the element that has
   * the focus when `open` is called, which is the button for a keyboard and for most clicks (not in Safari, which does not
   * focus a button that is clicked: pass `event.currentTarget` there).
   */
  opener?: HTMLElement | null;
}

export interface DetailDrawerApi {
  /**
   * Opens the drawer of a registered kind on the thing `id`. One drawer at a time: if one is open, this one takes its place.
   * Returns false, and changes nothing, when the kind is not registered, the id is not valid (see `lib/detail-address`) or
   * the page has no drawer host (a route outside the shell).
   */
  open: (kind: string, id: string, options?: OpenDetailOptions) => boolean;
  /** Closes the drawer, whoever opened it. Does nothing if none is open, and it is safe to call late or twice. */
  close: () => void;
  /** What the address asks for: null when no drawer is open, or when the address names a kind nobody registered or an id that is not valid. */
  current: DetailRef | null;
}

/**
 * The entry of the history that `open` adds says so in its state, so that closing can go Back instead of adding another one:
 * what was pushed is taken off the same way, and the history does not end up with two entries for the same page. An address
 * that was typed or shared has no mark, and is closed by replacing the entry.
 */
const OPENED_HERE = 'casazenDetailDrawer';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const withMark = (state: unknown): Record<string, unknown> => ({ ...(isRecord(state) ? state : {}), [OPENED_HERE]: true });

const wasOpenedHere = (state: unknown): boolean => isRecord(state) && state[OPENED_HERE] === true;

/** How long a navigation that was asked for may take to show up in the address before another one is allowed anyway. */
const PENDING_MS = 1000;

/**
 * The global detail drawer (UI-15), from any component inside the router: `open(kind, id)` shows what was registered with
 * `registerDetail` in the drawer of the shell (`DetailDrawerHost`), `close()` takes it away. The state is in the address
 * (`?detail=booking:3f2a`), so the drawer can be shared, Back closes it and a refresh brings it back.
 *
 * `open` and `close` are stable, and they read the address as it is when they are called, not as it was when they were made: a
 * `close` that a content kept through an `await` (`await save(); close()`) does nothing if the drawer is already closed, instead of
 * going Back once more. A second call before the first one has reached the address (Esc held down, a double tap) is ignored.
 */
export function useDetailDrawer(): DetailDrawerApi {
  const location = useLocation();
  const navigate = useNavigate();
  // A kind registered after the first render (a chunk that loaded later) opens a drawer that the address already asked for:
  // the hook renders again when the registry changes.
  useSyncExternalStore(subscribeToDetails, getDetailsVersion, getDetailsVersion);

  const { pathname, search, hash, state, key } = location;

  const live = useRef({ pathname, search, hash, state });
  const pending = useRef(false);
  useEffect(() => {
    live.current = { pathname, search, hash, state };
    pending.current = false;
  }, [pathname, search, hash, state, key]);

  const asked = readDetail(search);
  const known = asked !== null && getDetail(asked.kind) !== undefined;
  const currentKind = known ? asked.kind : null;
  const currentId = known ? asked.id : null;
  const current = useMemo<DetailRef | null>(
    () => (currentKind !== null && currentId !== null ? { kind: currentKind, id: currentId } : null),
    [currentKind, currentId],
  );

  const open = useCallback(
    (kind: string, id: string, options: OpenDetailOptions = {}): boolean => {
      // A registered kind is a valid one (`registerDetail` refuses the others).
      if (!isValidDetailId(id) || !getDetail(kind) || !isHostMounted()) {
        if (import.meta.env.DEV) {
          console.warn(`useDetailDrawer: "${kind}:${id}" was not opened: the kind is not registered, the id is not valid, or there is no DetailDrawerHost on this page.`);
        }
        return false;
      }
      if (pending.current) return true;

      const here = live.current;
      const showing = readDetail(here.search);
      // A drawer that is open is swapped, not stacked: one Back closes whichever is on the screen.
      const swapping = showing !== null && getDetail(showing.kind) !== undefined;
      // Who gets the focus back is whoever opened the first one.
      if (!swapping) rememberOpener(options.opener !== undefined ? options.opener : focusedElement());
      pending.current = true;
      window.setTimeout(() => {
        pending.current = false;
      }, PENDING_MS);
      void navigate(
        { pathname: here.pathname, search: searchWithDetail(here.search, { kind, id }), hash: here.hash },
        { replace: swapping, state: swapping ? here.state : withMark(here.state), preventScrollReset: true },
      );
      return true;
    },
    [navigate],
  );

  const close = useCallback(() => {
    const here = live.current;
    if (pending.current || !hasDetailParam(here.search)) return;
    pending.current = true;
    window.setTimeout(() => {
      pending.current = false;
    }, PENDING_MS);
    if (wasOpenedHere(here.state)) {
      void navigate(-1);
      return;
    }
    void navigate({ pathname: here.pathname, search: searchWithDetail(here.search, null), hash: here.hash }, { replace: true, state: here.state, preventScrollReset: true });
  }, [navigate]);

  return useMemo(() => ({ open, close, current }), [open, close, current]);
}
