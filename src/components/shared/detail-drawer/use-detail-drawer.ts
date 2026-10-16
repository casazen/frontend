import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasDetailParam, isValidDetailId, isValidDetailKind, readDetail, searchWithDetail, type DetailRef } from '@/lib/detail-address';
import { focusedElement, rememberOpener } from './detail-opener';
import { getDetail, getDetailsVersion, subscribeToDetails } from './detail-registry';

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
   * Returns false, and changes nothing, when the kind is not registered or the kind or the id is not valid.
   */
  open: (kind: string, id: string, options?: OpenDetailOptions) => boolean;
  /** Closes the drawer, whoever opened it. Does nothing if none is open. */
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

function withMark(state: unknown): Record<string, unknown> {
  return { ...(isRecord(state) ? state : {}), [OPENED_HERE]: true };
}

function withoutMark(state: unknown): unknown {
  if (!isRecord(state) || !(OPENED_HERE in state)) return state;
  const rest = { ...state };
  delete rest[OPENED_HERE];
  return Object.keys(rest).length > 0 ? rest : null;
}

const wasOpenedHere = (state: unknown): boolean => isRecord(state) && state[OPENED_HERE] === true;

/**
 * The global detail drawer (UI-15), from any component inside the router: `open(kind, id)` shows what was registered with
 * `registerDetail` in the drawer of the shell (`DetailDrawerHost`), `close()` takes it away. The state is in the address
 * (`?detail=booking:3f2a`), so the drawer can be shared, Back closes it and a refresh brings it back.
 */
export function useDetailDrawer(): DetailDrawerApi {
  const location = useLocation();
  const navigate = useNavigate();
  // A kind registered after the first render (a chunk that loaded later) opens a drawer that the address already asked for:
  // the hook renders again when the registry changes.
  useSyncExternalStore(subscribeToDetails, getDetailsVersion, getDetailsVersion);

  const { pathname, search, hash, state } = location;

  const asked = readDetail(search);
  const currentKind = asked && getDetail(asked.kind) ? asked.kind : null;
  const currentId = currentKind ? (asked?.id ?? null) : null;
  const current = useMemo<DetailRef | null>(
    () => (currentKind && currentId ? { kind: currentKind, id: currentId } : null),
    [currentKind, currentId],
  );

  const open = useCallback(
    (kind: string, id: string, options: OpenDetailOptions = {}): boolean => {
      if (!isValidDetailKind(kind) || !isValidDetailId(id) || !getDetail(kind)) {
        if (import.meta.env.DEV) console.warn(`useDetailDrawer: "${kind}:${id}" was not opened: the kind is not registered or the kind or the id is not valid.`);
        return false;
      }
      // A drawer that is open is swapped, not stacked: one Back closes whichever is on the screen.
      const swapping = readDetail(search) !== null;
      // Who gets the focus back is whoever opened the first one.
      if (!swapping) rememberOpener(options.opener !== undefined ? options.opener : focusedElement());
      void navigate(
        { pathname, search: searchWithDetail(search, { kind, id }), hash },
        { replace: swapping, state: swapping ? state : withMark(state), preventScrollReset: true },
      );
      return true;
    },
    [navigate, pathname, search, hash, state],
  );

  const close = useCallback(() => {
    if (!hasDetailParam(search)) return;
    if (wasOpenedHere(state)) {
      void navigate(-1);
      return;
    }
    void navigate({ pathname, search: searchWithDetail(search, null), hash }, { replace: true, state: withoutMark(state), preventScrollReset: true });
  }, [navigate, pathname, search, hash, state]);

  return useMemo(() => ({ open, close, current }), [open, close, current]);
}
