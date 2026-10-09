import { createContext, useContext } from 'react';

export interface CommandPaletteApi {
  /** The palette is open. */
  isOpen: boolean;
  /**
   * Opens the palette. `opener` is where the focus goes back when it closes: pass the button that was pressed (a click does
   * not focus a button in Safari, so the palette cannot find it by itself). Without it, whatever has the focus.
   */
  open: (opener?: HTMLElement | null) => void;
  /** Closes it. `navigated`: the choice led to another page, whose heading takes the focus, so it is not given back. */
  close: (options?: { navigated?: boolean }) => void;
  toggle: () => void;
}

export const CommandPaletteContext = createContext<CommandPaletteApi | null>(null);

/** The palette of the shell: open it from a button, or from a command of your own. Only inside `CommandPaletteProvider`. */
export function useCommandPalette(): CommandPaletteApi {
  const api = useContext(CommandPaletteContext);
  if (!api) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return api;
}
