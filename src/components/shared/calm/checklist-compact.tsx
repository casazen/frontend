import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';

export interface ChecklistCompactProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'children'> {
  title: string;
  done: number;
  total: number;
  progress: string;
  next?: string;
  progressLabel?: string;
  primary?: CalmAction;
  secondary?: CalmAction;
}

export function ChecklistCompact({ title, done, total, progress, next, progressLabel, primary, secondary, className, ...props }: ChecklistCompactProps) {
  const titleId = React.useId();
  const percent = total > 0 ? (Math.min(Math.max(done, 0), total) / total) * 100 : 0;

  return (
    <section
      {...props}
      aria-labelledby={titleId}
      className={cn('grid min-w-0 gap-x-4 gap-y-3 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center', className)}
    >
      <div className="min-w-0">
        <h2 id={titleId} className="break-words text-base font-semibold">
          {title} <span className="text-sm font-medium text-foreground/70">{progress}</span>
        </h2>
        {next ? <p className="mt-0.5 break-words text-sm text-foreground/70">{next}</p> : null}
      </div>

      {primary || secondary ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {primary ? <CalmActionButton action={primary} variant="outline" size="sm" iconRight={<ArrowRight />} /> : null}
          {secondary ? <CalmActionButton action={secondary} variant="ghost" size="sm" /> : null}
        </div>
      ) : null}

      <Progress size="sm" value={percent} label={progressLabel} valueText={progress} className="sm:col-span-2" />
    </section>
  );
}
