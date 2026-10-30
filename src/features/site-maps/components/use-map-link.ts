import { useState, type FocusEventHandler, type MouseEventHandler } from 'react';

export interface MapLinkProps {
  onMouseEnter: MouseEventHandler;
  onMouseLeave: MouseEventHandler;
  onFocus: FocusEventHandler;
  onBlur: FocusEventHandler;
  /** `true` while the item is the active one: style it with `data-[map-active=true]:…`. */
  'data-map-active': 'true' | undefined;
}

export interface MapLink {
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  /** Spread on a card or a row of the list: it lights the pin of the same id, and the pin lights it. */
  bind: (id: string) => MapLinkProps;
}

/**
 * The link between a list and a map: the id of the item that is hovered or focused, on either side. The map takes it as
 * `activeId` / `onActiveChange`, the list spreads `bind(id)` on its items. Nothing is redrawn but the two highlights.
 */
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
