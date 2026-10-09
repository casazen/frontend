import {
  useCallback,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/** Space between the edge of the rail and its tooltip (px). */
const GAP = 8;

interface Anchor {
  top: number;
  left: number;
}

// One tooltip at a time: an icon the keyboard has the focus on and another one under the pointer would each show its name,
// two labels in the rail. The last one asked for wins; the others put themselves away.
let owner: string | null = null;
const ownerListeners = new Set<() => void>();

function setOwner(next: string | null) {
  if (owner === next) return;
  owner = next;
  for (const listener of [...ownerListeners]) listener();
}

function subscribeToOwner(listener: () => void) {
  ownerListeners.add(listener);
  return () => {
    ownerListeners.delete(listener);
  };
}

const getOwner = () => owner;
const getServerOwner = () => null;

/** True when the focus is the keyboard's: a click that gives a button the focus must not call for a tooltip. */
function isKeyboardFocus(target: HTMLElement): boolean {
  try {
    return target.matches(':focus-visible');
  } catch {
    // A browser (or a test environment) that does not know the selector: any focus counts.
    return true;
  }
}

interface RailTooltip {
  /** Handlers to spread on the element the tooltip names (the icon of the rail). */
  triggerProps: {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave: () => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
  };
  /** The tooltip, to render next to the element (it is moved to the end of the page, see below); `null` while hidden. */
  tooltip: ReactNode;
}

/**
 * The name of an icon of the sidebar when it is reduced to the icons, on a tablet or by the choice of the user (UI-04b).
 * It shows beside the rail while the pointer is on the icon **and while the keyboard has the focus on it**: a name that
 * only a mouse can see would leave a keyboard user with a column of unnamed icons. Esc hides it, the focus staying put
 * (WCAG 1.4.13), and so does scrolling the menu, which would leave it behind. It is a visual aid only: the icon is a link
 * or a button that already has its name for a screen reader, so the tooltip is hidden from assistive technology rather
 * than read twice. It has no dependency: a small piece of state and a `fixed` box.
 *
 * It is placed in the `body`, beside the edge of the sidebar: the menu scrolls and clips what overflows it, a tooltip
 * that lived inside it would be cut off at the edge of the rail. `enabled` is "the sidebar is a rail": when it is wide
 * the names are on the screen and nothing shows.
 */
export function useRailTooltip(label: string, enabled: boolean): RailTooltip {
  const id = useId();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const current = useSyncExternalStore(subscribeToOwner, getOwner, getServerOwner);
  const visible = enabled && anchor !== null && current === id;

  const hide = useCallback(() => {
    setAnchor(null);
    if (getOwner() === id) setOwner(null);
  }, [id]);
  const show = useCallback(
    (target: HTMLElement) => {
      const rect = target.getBoundingClientRect();
      const edge = target.closest('aside')?.getBoundingClientRect().right ?? rect.right;
      setAnchor({ top: rect.top + rect.height / 2, left: edge + GAP });
      setOwner(id);
    },
    [id],
  );

  useEffect(() => {
    if (!visible) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKeyDown);
    // Captured: the menu is a scrolling box inside the sidebar, its scroll does not bubble up to the window.
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', hide, true);
    };
  }, [visible, hide]);

  // An icon that goes away with its tooltip showing (the sidebar unmounts) leaves no owner behind.
  useEffect(
    () => () => {
      if (getOwner() === id) setOwner(null);
    },
    [id],
  );

  return {
    triggerProps: {
      onPointerEnter: (event) => {
        // A finger has no hover: the tooltip would only flash while the page opens.
        if (enabled && event.pointerType !== 'touch') show(event.currentTarget);
      },
      onPointerLeave: hide,
      onFocus: (event) => {
        if (enabled && isKeyboardFocus(event.currentTarget)) show(event.currentTarget);
      },
      onBlur: hide,
    },
    tooltip:
      visible && anchor
        ? createPortal(
            <div
              aria-hidden="true"
              data-testid="rail-tooltip"
              style={{ top: anchor.top, left: anchor.left }}
              className="pointer-events-none fixed z-[60] -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background shadow-md"
            >
              {label}
            </div>,
            document.body,
          )
        : null,
  };
}
