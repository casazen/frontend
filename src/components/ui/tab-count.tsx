import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';

export type TabTone = StatusTone;

interface TabCountProps {
  count?: number;
  label?: string;
  tone?: TabTone;
}

/**
 * The number beside the name of a tab (`Tabs`, `RouteTabs`): things waiting in it. `tone` colors it like a status
 * (`warning` for what needs an answer, `danger` for what failed); the number is still the text, and `label` says what it
 * counts, so the meaning is never the color alone.
 */
export function TabCount({ count, label, tone }: TabCountProps) {
  if (!count || count <= 0) return null;
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none',
        tone ? cn('ring-1 ring-inset', STATUS_TONE_CLASSES[tone]) : 'bg-primary text-primary-foreground',
      )}
    >
      <span aria-hidden={label ? 'true' : undefined}>{count > 99 ? '99+' : count}</span>
      {label ? <span className="sr-only">{`, ${label}`}</span> : null}
    </span>
  );
}
