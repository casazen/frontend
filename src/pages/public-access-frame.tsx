import type { ReactNode } from 'react';
import { CircleCheck, type LucideIcon } from 'lucide-react';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { cn } from '@/lib/utils';

export interface AccessContent {
  title: string;
  description?: ReactNode;
  success?: boolean;
  children?: ReactNode;
}

interface PublicAccessFrameProps extends AccessContent {
  icon: LucideIcon;
  testId?: string;
  outcome?: string;
}

export function PublicAccessFrame({ title, description, success, icon, testId, outcome, children }: PublicAccessFrameProps) {
  const Icon = success ? CircleCheck : icon;
  return (
    <main className="grid min-h-svh place-items-center bg-muted/50 px-4 py-8 sm:px-8">
      <section data-testid={testId} data-outcome={outcome}
        className={cn('grid w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-lg', children && 'md:max-w-4xl md:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)]')}>
        <header className="flex min-w-0 flex-col items-start gap-4 border-t-4 border-primary bg-muted/40 p-6 sm:p-8">
          <CasaZenLogo size={30} tone="mono" className="text-foreground" />
          <span aria-hidden="true" className={cn('mt-2 grid size-11 place-items-center rounded-2xl', success ? 'bg-success-soft text-success-foreground' : 'bg-primary/10 text-primary-text')}>
            <Icon className="size-5" />
          </span>
          <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
          {description && <div className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</div>}
        </header>
        {children && <div className="grid min-w-0 content-center gap-4 p-6 sm:p-8">{children}</div>}
      </section>
    </main>
  );
}
