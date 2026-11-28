import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSwipe, type SwipeSide } from './use-swipe';
import type { ListCardContent, ListSwipeAction } from './list-types';

export interface BuiltCard {
  content: ListCardContent;
  title: ReactNode;
}

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

const UNDER_TONE: Record<NonNullable<ListSwipeAction['tone']>, string> = {
  accent: 'bg-primary text-primary-foreground',
  success: 'bg-success-soft text-success-foreground',
  neutral: 'bg-secondary text-secondary-foreground',
  danger: 'bg-danger-soft text-danger-foreground',
};

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
  right?: ListSwipeAction | null;
  left?: ListSwipeAction | null;
  enabled?: boolean;
  children: ReactNode;
}

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
