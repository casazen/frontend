import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';

export interface NextStepCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** A few words above the title ("Prossimo passo"). */
  kicker: string;
  /** The step, as a short sentence. */
  title: string;
  /**
   * What the title is in the page. `h2` (default) when the card stands in a page of its own; `p` when the card sits inside a
   * block that already has its heading (the activation checklist), so the outline of the page is not split.
   */
  titleAs?: 'p' | 'h2' | 'h3' | 'h4';
  /** Why, or what is missing, in a sentence. */
  detail?: string;
  /** Where the step is in the whole path, already translated ("Passo 3 di 7"). */
  position?: string;
  /** The way to do it. Left out when the person cannot (no permission): the card then only tells. */
  cta?: CalmAction;
}

/**
 * The one step to take next, told on a small card: what, why, where it is in the path and the button for it. It was the
 * "next step" of the activation checklist and is now shared, so the other areas tell their next step the same way.
 * A page has either this or a checklist, not both (`CONVENZIONI.md` §7bis): the guide arrives one thing at a time.
 */
export function NextStepCard({ kicker, title, titleAs: Title = 'h2', detail, position, cta, className, ...props }: NextStepCardProps) {
  return (
    <div className={cn('rounded-lg border border-primary/30 bg-primary/5 p-4 text-left', className)} {...props}>
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">{kicker}</p>
      <Title className="mt-1 text-base font-semibold">{title}</Title>
      {detail ? <p className="mt-1 text-sm text-foreground/70">{detail}</p> : null}
      {position ? <p className="mt-2 text-xs text-foreground/70">{position}</p> : null}
      {cta ? <CalmActionButton action={cta} className="mt-3" /> : null}
    </div>
  );
}
