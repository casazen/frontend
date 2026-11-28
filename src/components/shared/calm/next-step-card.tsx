import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';

export interface NextStepCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
  kicker: string;
  title: string;
  titleAs?: 'p' | 'h2' | 'h3' | 'h4';
  detail?: string;
  position?: string;
  cta?: CalmAction;
}

export function NextStepCard({ kicker, title, titleAs: Title = 'h2', detail, position, cta, className, ...props }: NextStepCardProps) {
  return (
    <div
      {...props}
      className={cn(
        'relative overflow-hidden rounded-lg border bg-card p-4 pl-5 text-left shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary',
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">{kicker}</p>
      <Title className="mt-1 text-base font-semibold">{title}</Title>
      {detail ? <p className="mt-1 text-sm text-foreground/70">{detail}</p> : null}
      {position ? <p className="mt-2 text-xs text-foreground/70">{position}</p> : null}
      {cta ? <CalmActionButton action={cta} className="mt-3" /> : null}
    </div>
  );
}
