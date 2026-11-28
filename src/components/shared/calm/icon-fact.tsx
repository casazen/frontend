import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IconFactsProps extends React.HTMLAttributes<HTMLUListElement> {
  layout?: 'stack' | 'inline';
}

export function IconFacts({ layout = 'stack', className, ...props }: IconFactsProps) {
  return <ul role="list" {...props} className={cn('min-w-0', layout === 'inline' ? 'flex flex-wrap gap-x-4 gap-y-1.5' : 'space-y-2', className)} />;
}

export interface IconFactProps extends Omit<React.LiHTMLAttributes<HTMLLIElement>, 'title'> {
  icon: LucideIcon;
  label?: string;
}

export function IconFact({ icon: Icon, label, className, children, ...props }: IconFactProps) {
  return (
    <li {...props} title={label} className={cn('flex min-w-0 items-start gap-2 text-sm', className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground/70" />
      <span className="min-w-0 break-words">
        {label ? <span className="sr-only">{label}: </span> : null}
        {children}
      </span>
    </li>
  );
}

export function Figures({ className, ...props }: React.HTMLAttributes<HTMLDListElement>) {
  return <dl {...props} className={cn('grid min-w-0 gap-x-4 gap-y-3', className)} />;
}

const FIGURE_SIZES = {
  sm: 'text-sm font-medium',
  md: 'text-base font-semibold tabular-nums',
  lg: 'text-2xl font-bold tabular-nums tracking-tight',
} as const;

export interface FigureProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  size?: keyof typeof FIGURE_SIZES;
  children: React.ReactNode;
}

export function Figure({ icon: Icon, label, size = 'md', className, children, ...props }: FigureProps) {
  return (
    <div {...props} className={cn('min-w-0', className)}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 break-words">{label}</span>
      </dt>
      <dd className={cn('mt-0.5 break-words', FIGURE_SIZES[size])}>{children}</dd>
    </div>
  );
}
