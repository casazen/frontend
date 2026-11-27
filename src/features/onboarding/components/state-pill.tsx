import type { LucideIcon } from 'lucide-react';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';

interface StatePillProps {
  tone: StatusTone;
  icon: LucideIcon;
  /** The state in words: the tint and the icon alone would tell it by color (UX-09). */
  label: string;
  className?: string;
  'data-testid'?: string;
  'data-state'?: string;
}

/** A state told three ways at once: a tint, an icon and its words (UX-09). The same pill is the badge of the connection, of a bulk outcome and of an assist request. */
export function StatePill({ tone, icon: Icon, label, className, ...rest }: StatePillProps) {
  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES[tone], className)}
      {...rest}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 break-words">{label}</span>
    </span>
  );
}
