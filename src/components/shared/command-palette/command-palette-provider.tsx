import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { AppContextKey } from '@/config/route-manifest';
import { CommandPalette } from './command-palette';
import { CommandPaletteContext, type CommandPaletteApi } from './command-palette-context';
import { isShortcutKey, shortcutIsTaken } from './shortcut';
import type { RemoteCommandSource } from './types';

function anotherModalIsOpen(): boolean {
  return (
    document.querySelector(
      '[role="dialog"][data-state="open"]:not([data-command-palette-dialog]), [role="alertdialog"][data-state="open"]',
    ) !== null
  );
}

interface CommandPaletteProviderProps {
  contextKey: AppContextKey;
  userId?: string | null;
  remoteSource?: RemoteCommandSource;
  children: React.ReactNode;
}

/**
 * Holds the palette of the shell (UI-06): whether it is open, the keyboard shortcut that opens it from anywhere, and where
 * the focus goes when it closes. `AppShellLayout` mounts it once around the header and the page; the search of the header
 * (`CommandPaletteTrigger`) and any command of a feature open it through `useCommandPalette`.
 *
 * Ctrl+K (Cmd+K on a Mac) opens it, and closes it when it is open. It does nothing where the key already means something
 * (see `shortcut.ts`) and while another dialog is open. The palette is open for the page it was opened on: when the address
 * changes (a choice, the Back button) it closes.
 */
export function CommandPaletteProvider({ contextKey, userId = null, remoteSource, children }: CommandPaletteProviderProps) {
  const { pathname } = useLocation();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  if (openedOn !== null && openedOn !== pathname) setOpenedOn(null);
  const isOpen = openedOn === pathname;

  const opener = useRef<HTMLElement | null>(null);
  const leaveFocusToThePage = useRef(false);

  const open = useCallback(
    (from?: HTMLElement | null) => {
      const focused = document.activeElement;
      opener.current = from ?? (focused instanceof HTMLElement && focused !== document.body ? focused : null);
      leaveFocusToThePage.current = false;
      setOpenedOn(pathname);
    },
    [pathname],
  );

  const close = useCallback((options?: { navigated?: boolean }) => {
    leaveFocusToThePage.current = options?.navigated === true;
    setOpenedOn(null);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) close();
    else open();
  }, [isOpen, open, close]);

  const latest = useRef({ isOpen, toggle });
  useEffect(() => {
    latest.current = { isOpen, toggle };
  }, [isOpen, toggle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isShortcutKey(event) || shortcutIsTaken(event)) return;
      if (!latest.current.isOpen && anotherModalIsOpen()) return;
      event.preventDefault();
      latest.current.toggle();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    if (leaveFocusToThePage.current) {
      leaveFocusToThePage.current = false;
      return;
    }
    const back = opener.current;
    if (back?.isConnected) back.focus();
  }, []);

  const api = useMemo<CommandPaletteApi>(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);

  return (
    <CommandPaletteContext.Provider value={api}>
      {children}
      <CommandPalette
        open={isOpen}
        onOpenChange={(next) => (next ? open() : close())}
        contextKey={contextKey}
        userId={userId}
        remoteSource={remoteSource}
        onChosen={close}
        onCloseAutoFocus={handleCloseAutoFocus}
      />
    </CommandPaletteContext.Provider>
  );
}
