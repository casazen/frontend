import { createContext, useContext } from 'react';

export interface CommandPaletteApi {
  isOpen: boolean;
  open: (opener?: HTMLElement | null) => void;
  close: (options?: { navigated?: boolean }) => void;
  toggle: () => void;
}

export const CommandPaletteContext = createContext<CommandPaletteApi | null>(null);

export function useCommandPalette(): CommandPaletteApi {
  const api = useContext(CommandPaletteContext);
  if (!api) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return api;
}
