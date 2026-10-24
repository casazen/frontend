import { useState } from 'react';
import { Link, type To } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepMark } from './wizard-model';

/**
 * One step of the list. The server decides the state of each step (`flow`); the mark is never only a color (a check, an exclamation
 * mark, a lock, the number) and the state is also written under the name.
 */
export interface StepperEntry {
  step: number;
  label: string;
  mark: StepMark;
  /** Where the step is; none while the step is not open or the contract does not exist yet. */
  to?: To;
}

const MARK_BOX: Record<StepMark, string> = {
  current: 'bg-background text-primary ring-2 ring-primary',
  done: 'bg-primary text-primary-foreground',
  issue: 'bg-background text-[color:var(--color-warning-foreground,#8a4b05)] ring-2 ring-[color:var(--color-warning-border,#f5d49a)]',
  todo: 'bg-background text-muted-foreground ring-1 ring-inset ring-border',
  locked: 'bg-muted text-muted-foreground',
};

function StepItem({ entry, number, current }: { entry: StepperEntry; number: number; current: boolean }) {
  const { t } = useTranslation();
  const body = (
    <>
      <span aria-hidden="true" className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold', MARK_BOX[entry.mark])}>
        {entry.mark === 'done' ? <Check className="size-4" /> : entry.mark === 'issue' ? <AlertCircle className="size-4" /> : entry.mark === 'locked' ? <Lock className="size-3.5" /> : number}
      </span>
      <span className="min-w-0">
        <span className={cn('block break-words text-sm font-semibold', entry.mark === 'current' ? 'text-foreground' : 'text-foreground/80')}>{entry.label}</span>
        <span className="block text-xs text-muted-foreground">{t(`leaseWizard.stepper.state.${entry.mark}`)}</span>
      </span>
    </>
  );
  const box = 'flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left';
  return (
    <li data-testid={`lease-wizard-step-${entry.step}`}>
      {entry.to && entry.mark !== 'locked' ? (
        <Link
          to={entry.to}
          aria-current={current ? 'step' : undefined}
          className={cn(box, 'outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring')}
        >
          {body}
        </Link>
      ) : (
        <div aria-current={current ? 'step' : undefined} className={cn(box, entry.mark === 'locked' && 'opacity-70')}>
          {body}
        </div>
      )}
    </li>
  );
}

/**
 * The steps of the wizard (LR-06a): a list on the side of a computer, and on a phone one line, «Passo 3 di 5», that opens the list.
 * The steps are the ones that apply to this contract, numbered in order.
 */
export function LeaseWizardStepper({ entries, current }: { entries: StepperEntry[]; current: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const index = Math.max(entries.findIndex((entry) => entry.step === current), 0);
  const list = (
    <ol className="space-y-1">
      {entries.map((entry, position) => (
        <StepItem key={entry.step} entry={entry} number={position + 1} current={entry.step === current} />
      ))}
    </ol>
  );

  return (
    <nav aria-label={t('leaseWizard.stepper.label')} data-testid="lease-wizard-stepper" className="min-w-0">
      {/* Phone: one line that opens the list. Hidden with CSS from `lg`, so assistive technology reads one version. */}
      <div className="space-y-2 lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          data-testid="lease-wizard-stepper-toggle"
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left ring-1 ring-inset ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="shrink-0 text-sm font-semibold">{t('leaseWizard.stepper.position', { current: index + 1, total: entries.length })}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{entries[index]?.label}</span>
          <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {open ? list : null}
      </div>
      <div className="hidden lg:block">{list}</div>
    </nav>
  );
}
