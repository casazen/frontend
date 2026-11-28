import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { CalmTone } from '@/components/shared/calm/calm-tone';
import { CARD_LIFT } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { ToneTile } from './tone-tile';

interface PickCardProps {
  icon: LucideIcon;
  tone: CalmTone;
  title: string;
  description?: string;
  footer?: ReactNode;
  badge?: string;
  onPick: () => void;
  disabled?: boolean;
  testId?: string;
  className?: string;
}

export function PickCard({ icon, tone, title, description, footer, badge, onPick, disabled, testId, className }: PickCardProps) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        'group flex min-h-11 w-full min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4 text-left',
        CARD_LIFT,
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <ToneTile icon={icon} tone={tone} />
        {badge ? (
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-text">{badge}</span>
        ) : null}
      </span>
      <span className="min-w-0 space-y-1">
        <span className="block break-words font-semibold leading-snug">{title}</span>
        {description ? <span className="block break-words text-sm text-foreground/70">{description}</span> : null}
      </span>
      {footer ? <span className="mt-auto flex min-h-6 items-center gap-2 pt-1 text-sm font-medium">{footer}</span> : null}
    </button>
  );
}
