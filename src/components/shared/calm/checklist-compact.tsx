import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';

export interface ChecklistCompactProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  /** What is being set up ("Configura Affitti brevi"). */
  title: string;
  /** Steps done and steps in all. */
  done: number;
  total: number;
  /** The same count as the person reads it, already translated ("2 di 5"). */
  progress: string;
  /** The step to take next, with its time if known ("Prossimo: Collega Stripe · 5 minuti"). */
  next?: string;
  /** The name of the bar for a screen reader. Default: "Avanzamento". */
  progressLabel?: string;
  /** The step to take ("Continua"). */
  primary?: CalmAction;
  /** The whole list ("Tutti i passi"). */
  secondary?: CalmAction;
}

/**
 * The checklist of a home in one line: a title with how far it is, the step to take next, a thin bar and the way on. A home
 * shows it only while the list is incomplete (`CONVENZIONI.md` §7bis); the full list lives behind "Tutti i passi".
 */
export function ChecklistCompact({ title, done, total, progress, next, progressLabel, primary, secondary, className, ...props }: ChecklistCompactProps) {
  const { t } = useTranslation();
  const titleId = React.useId();
  const percent = total > 0 ? Math.round((Math.min(Math.max(done, 0), total) / total) * 100) : 0;

  return (
    <section
      aria-labelledby={titleId}
      className={cn('grid min-w-0 gap-x-4 gap-y-3 rounded-lg border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center', className)}
      {...props}
    >
      <div className="min-w-0">
        <h2 id={titleId} className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold">
          <span className="break-words">{title}</span>{' '}
          <span className="text-sm font-medium text-foreground/70">{progress}</span>
        </h2>
        {next ? <p className="mt-0.5 break-words text-sm text-foreground/70">{next}</p> : null}
      </div>

      {primary || secondary ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {secondary ? <CalmActionButton action={secondary} variant="ghost" size="sm" /> : null}
          {primary ? <CalmActionButton action={primary} variant="outline" size="sm" iconRight={<ArrowRight />} /> : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-label={progressLabel ?? t('calm.checklistCompact.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.min(Math.max(done, 0), total)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted sm:col-span-2"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
