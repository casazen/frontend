import { useId, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { SwissStepId, SwissStepState } from './swiss-day-model';

interface SwissStepSectionProps {
  id: SwissStepId;
  /** The number of the step (1 to 3). */
  position: number;
  state: SwissStepState;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** The mark before the name of a step: the check of a done one, otherwise its number; a step that needs something is amber, in words too (never the color alone). */
function StepMark({ state, position }: { state: SwissStepState; position: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
        state === 'done' && 'bg-primary text-primary-foreground',
        state === 'attention' &&
          'bg-[color:var(--color-warning-soft,#fef4e2)] text-[color:var(--color-warning-foreground,#8a4b05)] ring-1 ring-inset ring-[color:var(--color-warning-border,#f5d49a)]',
        state === 'todo' && 'bg-background text-muted-foreground ring-1 ring-inset ring-border',
      )}
    >
      {state === 'done' ? <Check className="size-3.5" /> : position}
    </span>
  );
}

/**
 * One step of the layer of the assisted notification: a line with its number, its name and how it stands, which opens its content. One step is open at a time, but the content of the
 * others stays in the page (hidden), so that what the person was doing in one (the guest they copied from) is still there when they come back to it.
 */
export function SwissStepSection({ id, position, state, open, onToggle, children }: SwissStepSectionProps) {
  const { t } = useTranslation();
  const base = useId();
  const headingId = `${base}-title`;
  const panelId = `${base}-panel`;

  return (
    <li data-testid={`swiss-step-${id}`} data-state={state} data-open={open ? 'true' : 'false'}>
      <h3>
        <button
          type="button"
          id={headingId}
          aria-expanded={open}
          aria-controls={panelId}
          aria-current={open ? 'step' : undefined}
          onClick={onToggle}
          data-testid={`swiss-step-${id}-toggle`}
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-1 py-2 text-left text-sm font-semibold hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StepMark state={state} position={position} />
          <span className="min-w-0 flex-1 break-words">{t(`swissNotification.steps.${id}.title`)}</span>
          <span className={cn('shrink-0 text-xs font-medium', state === 'attention' ? 'text-[color:var(--color-warning-foreground,#8a4b05)]' : 'text-foreground/70')}>
            {t(`swissNotification.steps.state.${state}`)}
          </span>
          <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={headingId} hidden={!open} className="space-y-3 pb-4 pl-10 pr-1 pt-1">
        {children}
      </div>
    </li>
  );
}
