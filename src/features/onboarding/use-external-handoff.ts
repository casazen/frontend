import { useCallback, useEffect, useRef, useState } from 'react';
import { isHttpsAddress, isPanelWindowOpen, navigatePanelWindow, openPanelWindow } from '@/lib/onboarding-panel';
import type { PanelStepHandoffMode } from '@/types/onboarding.types';

/** What the server answers when a handoff starts: how the person goes to the panel and where. Both are `null` when there is nothing to open. */
export interface HandoffStart {
  handoffMode: PanelStepHandoffMode | null;
  /** The address of the panel exactly as the server returned it: https, with no organization, property or person in it. */
  panelUrl: string | null;
  /** The step was already done: nothing to open. */
  alreadyComplete?: boolean;
}

interface UseExternalHandoffOptions {
  /**
   * Starts (or starts again) the handoff on the server: it stores the step and the point to come back to BEFORE it answers. The window is
   * sent to the panel only with its answer, so nothing external opens before the state is durable.
   */
  start: () => Promise<HandoffStart>;
  /** Asks the server for one check: the window was closed, or the person came back to the tab. */
  onTrigger: () => void;
  /** The handoff is being followed: the window and the tab are watched while it is. */
  watching: boolean;
}

export interface ExternalHandoff {
  /** The person pressed «Apri il pannello» (or «Riapri»): the window is opened from this click. Resolves when the step is stored and the panel is on its way. */
  open: () => Promise<void>;
  /** The secondary window is open, or the page of the panel is open in it. */
  launched: boolean;
  /** The browser did not let the window open: the step is stored and the person is asked to allow it and try again. */
  blocked: boolean;
  /** The person left the panel: its window was closed, or the tab came back to the front. The check that follows says whether the step is done. */
  ended: boolean;
  /** The start is on its way. */
  starting: boolean;
  /** Why the start failed, if it did. */
  error: unknown;
  /** Closes the window CasaZen opened (the step is done): a window the person closed or CasaZen does not own is left alone. */
  closeWindow: () => void;
}

/** The least time between two checks the tab asks for by itself (the server holds its own minimum gap on top). */
const MIN_TRIGGER_GAP_MS = 5_000;

/** How often the window is asked whether it is still open (`closed` is readable across origins, nothing else of the window is). */
const CLOSED_POLL_MS = 1_000;

/**
 * The hand-over of the person to the panel of the channel manager, in a secondary window that CasaZen manages while the step stays on screen
 * (E10/F03/US02/T01, NF-107, UX-02 point 3):
 *
 * - the window is opened synchronously from the click (a popup blocker lets only that through), blank; the step is then stored on the server and
 *   only after its answer is the window sent to the exact address it returned. A blocked window leaves CasaZen on the stored step, never on a
 *   dead external page. A step whose panel sends the person back (`redirectCallback`) goes the same tab instead;
 * - while the handoff is followed the tab and the window are watched: the tab coming back to the front (`focus`, `visibilitychange`) and the window
 *   closing each ask for one check, and tell the screen the person left the panel. The page of the panel is never read.
 */
export function useExternalHandoff({ start, onTrigger, watching }: UseExternalHandoffOptions): ExternalHandoff {
  const windowRef = useRef<Window | null>(null);
  const startRef = useRef(start);
  const triggerRef = useRef(onTrigger);
  const lastTriggerRef = useRef(0);
  const leftRef = useRef(false);
  const [launched, setLaunched] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [ended, setEnded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    startRef.current = start;
    triggerRef.current = onTrigger;
  });

  const open = useCallback(async (): Promise<void> => {
    // First, synchronously: the only moment the browser lets a window through.
    const opened = openPanelWindow();
    setStarting(true);
    setError(null);
    setBlocked(false);
    setEnded(false);
    leftRef.current = false;
    try {
      const started = await startRef.current();
      if (started.alreadyComplete || !started.panelUrl) {
        opened?.close();
        return;
      }
      if (!isHttpsAddress(started.panelUrl)) throw new Error('The address of the panel is not an https address');

      if (started.handoffMode === 'redirectCallback') {
        // The panel sends the person back to CasaZen: the same tab, and the page does not come back from it. The button waits for the browser.
        opened?.close();
        window.location.assign(started.panelUrl);
        await new Promise<never>(() => undefined);
      }

      if (opened) {
        navigatePanelWindow(opened, started.panelUrl);
        windowRef.current = opened;
        setLaunched(true);
        // The person is on the panel from now on. The `blur` of the window that opened it comes before the step is stored (the listeners are attached only
        // while the step is followed), so it cannot be waited for: without this the `focus` of the person's return would be taken for nothing.
        leftRef.current = true;
      } else {
        // Stored, not opened: the step waits where the person left it.
        windowRef.current = null;
        setLaunched(false);
        setBlocked(true);
      }
    } catch (failure) {
      opened?.close();
      windowRef.current = null;
      setLaunched(false);
      setError(failure);
    } finally {
      setStarting(false);
    }
  }, []);

  const closeWindow = useCallback(() => {
    const owned = windowRef.current;
    windowRef.current = null;
    if (!isPanelWindowOpen(owned)) return;
    try {
      owned.close();
    } catch {
      // A window that cannot be closed by script stays for the person to close.
    }
  }, []);

  // Watching: the tab coming back asks for one check (focus and visibility), and so does the window closing.
  useEffect(() => {
    if (!watching) return undefined;

    const trigger = () => {
      const now = Date.now();
      if (now - lastTriggerRef.current < MIN_TRIGGER_GAP_MS) return;
      lastTriggerRef.current = now;
      triggerRef.current();
    };
    const comeBack = () => {
      if (!leftRef.current) return;
      leftRef.current = false;
      setEnded(true);
      trigger();
    };
    const leave = () => {
      leftRef.current = true;
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? leave() : comeBack());

    window.addEventListener('blur', leave);
    window.addEventListener('focus', comeBack);
    document.addEventListener('visibilitychange', onVisibility);
    const poll = setInterval(() => {
      const owned = windowRef.current;
      if (owned && !isPanelWindowOpen(owned)) {
        windowRef.current = null;
        setLaunched(false);
        setEnded(true);
        trigger();
      }
    }, CLOSED_POLL_MS);

    return () => {
      window.removeEventListener('blur', leave);
      window.removeEventListener('focus', comeBack);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(poll);
    };
  }, [watching]);

  return { open, launched, blocked, ended, starting, error, closeWindow };
}
