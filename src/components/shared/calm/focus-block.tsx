import * as React from 'react';
import { ArrowRight, Clock, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';
import { TONE_STYLES, type CalmTone } from './calm-tone';

export interface FocusBlockProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'children'> {
  tone?: CalmTone;
  kicker?: string;
  title: string;
  body?: React.ReactNode;
  who?: string;
  when?: string;
  primary: CalmAction;
  secondary?: CalmAction;
  then?: string;
  icon?: LucideIcon;
}

export function FocusBlock({ tone = 'neutral', kicker, title, body, who, when, primary, secondary, then, icon, className, ...props }: FocusBlockProps) {
  const titleId = React.useId();
  const style = TONE_STYLES[tone];
  const Icon = icon ?? style.Icon;

  return (
    <section
      {...props}
      aria-labelledby={titleId}
      data-tone={tone}
      className={cn(
        'cz-enter flex min-w-0 items-start gap-2.5',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('cz-icon-tile forced-colors:outline-1 [--cz-icon-tile-size:2rem] [--cz-icon-size:1rem]', style.badge, style.accent)}>
        <Icon strokeWidth={1.75} />
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        {kicker ? <p className={cn('break-words text-xs font-semibold uppercase tracking-wide', style.accent)}>{kicker}</p> : null}
        <h2 id={titleId} className="break-words text-base font-semibold leading-snug">
          {title}
        </h2>
        {body ? <div className="break-words text-sm text-foreground/80">{body}</div> : null}

        {who || when ? (
          <ul role="list" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/70">
            {who ? (
              <li className="flex min-w-0 items-center gap-1.5">
                <UserRound aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{who}</span>
              </li>
            ) : null}
            {when ? (
              <li className="flex min-w-0 items-center gap-1.5">
                <Clock aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 break-words">{when}</span>
              </li>
            ) : null}
          </ul>
        ) : null}

        {then ? (
          <p className="flex items-start gap-1.5 text-sm text-foreground/70">
            <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{then}</span>
          </p>
        ) : null}

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <CalmActionButton action={primary} className="w-full sm:w-auto" />
          {secondary ? <CalmActionButton action={secondary} variant="outline" className="w-full sm:w-auto" /> : null}
        </div>
      </div>
    </section>
  );
}
