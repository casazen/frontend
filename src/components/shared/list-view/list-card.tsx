import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSwipe, type SwipeSide } from './use-swipe';
import type { ListCardContent, ListSwipeAction } from './list-types';

/** What a card says about a row, with its title already made into whatever opens the row (a link, a button). */
export interface BuiltCard {
  content: ListCardContent;
  title: ReactNode;
}

/**
 * What a row is on a phone (UI-14): a card with the few things that matter, in the order of the priorities of the columns, and
 * the actions of the row at its foot. The title is whatever opens the row (a link, a button): it comes in already made.
 */
export function ListCardBody({ content, title }: { content: ListCardContent; title: ReactNode }) {
  const { lead, sub, status, meta, foot } = content;
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        {lead ? <div className="shrink-0">{lead}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="break-words text-base font-semibold leading-snug">{title}</div>
          {sub ? <div className="mt-0.5 break-words text-sm text-foreground/70">{sub}</div> : null}
        </div>
        {status ? <div className="max-w-[45%] shrink-0">{status}</div> : null}
      </div>
      {meta && meta.length > 0 ? (
        // Not a list: "Total: € 450, Channel: direct" read as a line is what a person wants to hear, and a list in each card of a list
        // of cards would be announced over and over.
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/70">
          {meta.map((item, index) => {
            const Icon = item.icon;
            return (
              <span key={index} className="inline-flex min-w-0 items-center gap-1.5">
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                {item.label ? <span className="sr-only">{item.label}: </span> : null}
                <span className="min-w-0 break-words">{item.text}</span>
              </span>
            );
          })}
        </div>
      ) : null}
      {foot ? <div className="mt-3">{foot}</div> : null}
    </div>
  );
}

// The action under the card, by tone. The pairs are those of the semantic tokens (text on its own background meets AA; the solid
// red of `destructive` with white text is 4.48:1, a hair under it, so the danger tone is the soft one like the badges).
const UNDER_TONE: Record<NonNullable<ListSwipeAction['tone']>, string> = {
  accent: 'bg-primary text-primary-foreground',
  success: 'bg-success-soft text-success-foreground',
  neutral: 'bg-secondary text-secondary-foreground',
  danger: 'bg-danger-soft text-danger-foreground',
};

/** What shows under the card as it is pulled: the icon and the name of the action it will run. */
function UnderAction({ action }: { action?: ListSwipeAction | null }) {
  if (!action) return <span />;
  const Icon = action.icon;
  return (
    <div className={cn('flex w-24 flex-col items-center justify-center gap-1 px-2 text-center text-xs font-semibold', UNDER_TONE[action.tone ?? 'accent'])}>
      {Icon ? <Icon className="size-5" aria-hidden="true" /> : null}
      <span className="break-words">{action.label}</span>
    </div>
  );
}

interface SwipeSurfaceProps {
  /** What a swipe to the right does (the finger goes right: it is at the left edge, under the card). */
  right?: ListSwipeAction | null;
  /** What a swipe to the left does. */
  left?: ListSwipeAction | null;
  /** Off while the person is selecting rows: a tap selects, a swipe has no meaning. */
  enabled?: boolean;
  children: ReactNode;
}

/**
 * A card that can be pulled sideways to run an action (see `useSwipe`). The actions under it are for the eyes only: the
 * gesture is not the only way, the same actions are in the menu of the card, which a keyboard and a screen reader reach.
 */
export function SwipeSurface({ right, left, enabled = true, children }: SwipeSurfaceProps) {
  const navigate = useNavigate();
  const fire = useCallback(
    (side: SwipeSide) => {
      const action = side === 'right' ? right : left;
      if (!action) return;
      if (action.href) void navigate(action.href);
      else action.onSelect?.();
    },
    [left, navigate, right],
  );
  const { surfaceRef, handlers } = useSwipe({ enabled: enabled && Boolean(right || left), canRight: Boolean(right), canLeft: Boolean(left), onFire: fire });

  if (!right && !left) return <>{children}</>;
  return (
    <div className="relative overflow-hidden" data-testid="swipe-card">
      <div aria-hidden="true" className="absolute inset-0 flex items-stretch justify-between">
        <UnderAction action={right} />
        <UnderAction action={left} />
      </div>
      <div ref={surfaceRef} className="relative touch-pan-y bg-background" {...handlers}>
        {children}
      </div>
    </div>
  );
}
