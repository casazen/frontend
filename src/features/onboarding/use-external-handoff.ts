import { useCallback, useEffect, useRef, useState } from 'react';
import { isHttpsAddress, isPanelWindowOpen, navigatePanelWindow, openPanelWindow } from '@/lib/onboarding-panel';
import type { PanelStepHandoffMode } from '@/types/onboarding.types';

export interface HandoffStart {
  handoffMode: PanelStepHandoffMode | null;
  panelUrl: string | null;
  alreadyComplete?: boolean;
}

interface UseExternalHandoffOptions {
  start: () => Promise<HandoffStart>;
  onTrigger: () => void;
  watching: boolean;
}

export interface ExternalHandoff {
  open: () => Promise<void>;
  launched: boolean;
  blocked: boolean;
  ended: boolean;
  starting: boolean;
  error: unknown;
  closeWindow: () => void;
}

const MIN_TRIGGER_GAP_MS = 5_000;

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
        opened?.close();
        window.location.assign(started.panelUrl);
        await new Promise<never>(() => undefined);
      }

      if (opened) {
        navigatePanelWindow(opened, started.panelUrl);
        windowRef.current = opened;
        setLaunched(true);
        leftRef.current = true;
      } else {
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
