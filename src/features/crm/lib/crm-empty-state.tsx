import { Info, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CalmActionButton, type CalmAction } from '@/components/shared/calm/calm-action';

interface CrmEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: CalmAction;
  secondaryAction?: CalmAction;
  helpLink?: { label: string; href: string };
  testId?: string;
}

export function CrmEmptyState({ icon: Icon, title, description, action, secondaryAction, helpLink, testId }: CrmEmptyStateProps) {
  return (
    <div data-testid={testId} className="flex flex-col items-center rounded-2xl border bg-card px-4 py-12 text-center sm:px-8">
      <span aria-hidden="true" className="grid size-20 place-items-center rounded-3xl bg-primary-soft text-primary-text">
        <Icon className="size-10" strokeWidth={1.5} />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-md text-foreground/70">{description}</p>
      {action || secondaryAction ? (
        <div className="mt-6 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
          {action ? <CalmActionButton action={action} /> : null}
          {secondaryAction ? <CalmActionButton action={secondaryAction} variant="outline" /> : null}
        </div>
      ) : null}
      {helpLink ? (
        <Link
          to={helpLink.href}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Info aria-hidden="true" className="size-4" />
          {helpLink.label}
        </Link>
      ) : null}
    </div>
  );
}
