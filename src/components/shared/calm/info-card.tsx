import * as React from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';
import { QUIET_ACTION } from './calm-styles';
import { TONE_STYLES, type CalmTone } from './calm-tone';

export interface InfoCardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  icon: LucideIcon;
  title: string;
  titleAs?: 'h2' | 'h3';
  tone?: CalmTone;
  status?: React.ReactNode;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  action?: CalmAction;
  children?: React.ReactNode;
}

export function InfoCard({ icon: Icon, title, titleAs: Title = 'h2', tone = 'neutral', status, hint, aside, action, children, className, ...props }: InfoCardProps) {
  const titleId = React.useId();
  const style = TONE_STYLES[tone];

  return (
    <section {...props} aria-labelledby={titleId} className={cn('flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4', className)}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <div className="flex min-w-0 flex-initial items-center gap-2">
          <span aria-hidden="true" className={cn('cz-icon-tile shrink-0 forced-colors:outline-1 [--cz-icon-tile-size:2rem] [--cz-icon-size:1rem]', style.badge, style.accent)}>
            <Icon strokeWidth={1.75} />
          </span>
          <Title id={titleId} className="min-w-0 break-words text-base font-semibold leading-snug">
            {title}
          </Title>
          {hint}
        </div>
        {status || aside || action ? (
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
            {status}
            {aside}
            {action ? <CalmActionButton action={action} variant="ghost" size="sm" iconRight={<ArrowRight />} className={QUIET_ACTION} /> : null}
          </div>
        ) : null}
      </header>
      {children}
    </section>
  );
}
