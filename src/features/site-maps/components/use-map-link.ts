import { useState, type FocusEventHandler, type MouseEventHandler } from 'react';

export interface MapLinkProps {
  onMouseEnter: MouseEventHandler;
  onMouseLeave: MouseEventHandler;
  onFocus: FocusEventHandler;
  onBlur: FocusEventHandler;
  'data-map-active': 'true' | undefined;
}

export interface MapLink {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  bind: (id: string) => MapLinkProps;
}

export function useMapLink(initial: string | null = null): MapLink {
  const [activeId, setActiveId] = useState<string | null>(initial);
  return {
    activeId,
    setActiveId,
    bind: (id) => ({
      onMouseEnter: () => setActiveId(id),
      onMouseLeave: () => setActiveId(null),
      onFocus: () => setActiveId(id),
      onBlur: () => setActiveId(null),
      'data-map-active': activeId === id ? 'true' : undefined,
    }),
  };
}
