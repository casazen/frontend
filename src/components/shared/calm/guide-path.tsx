import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CalmActionButton, type CalmAction } from './calm-action';
import type { CalmTone } from './calm-tone';

/** Where a step of a path stands: behind the person, the one to do now, or ahead. */
export type GuidePathState = 'done' | 'current' | 'upcoming';

export interface GuidePathStep {
  /** Unique in the path. */
  id: string;
  /** What the step is, as a short sentence ("Collega Octorate"). */
  title: string;
  /** One line under it: on what, or why ("Prenotazione · Villa del Lago"). */
  detail?: string;
  /** A short note: when it is due or how long it takes ("Scaduta: mer 23 set", "5 minuti"), already translated. */
  note?: string;
  /**
   * The tone of the note, and only of the note: a deadline that has passed is told by its words and their color, never by painting the
   * whole step (a tinted block reads as an error). Default `neutral`.
   */
  noteTone?: CalmTone;
  /** A few words above the title, already translated ("Adesso"). */
  kicker?: string;
  state: GuidePathState;
  /** The way to do the step: a full button on the current step, a quiet one on the others. */
  action?: CalmAction;
}

export interface GuidePathProps extends Omit<React.HTMLAttributes<HTMLOListElement>, 'children'> {
  /** The name of the path for a screen reader ("I tuoi prossimi passi"). */
  label: string;
  steps: readonly GuidePathStep[];
  /** Smaller markers and type, for a panel or a dialog. */
  density?: 'regular' | 'compact';
}

const NOTE_TONE: Record<CalmTone, string> = {
  neutral: 'text-foreground/70',
  info: 'text-info-foreground',
  success: 'text-success-foreground',
  warning: 'font-medium text-warning-foreground',
  danger: 'font-medium text-danger-foreground',
};

const MARKER: Record<GuidePathState, string> = {
  done: 'bg-primary text-primary-foreground',
  current: 'bg-background text-primary-text ring-2 ring-primary',
  upcoming: 'bg-background text-foreground/60 ring-1 ring-inset ring-border',
};

/**
 * A path of steps (UI-16, the guide): what is behind, the one step to do now and what comes after, joined by a line, so that
 * the operations of CasaZen read as one road and not as a pile of notices. It is how CasaZen guides without banners: nothing in
 * it is tinted, the step to do now is told by its marker, its weight and its button, and a deadline that has passed by the words
 * and the color of its note.
 *
 * An ordered list: each step says its state to a screen reader («fatto», «passo attuale», «da fare») and the current one is
 * `aria-current="step"`. It renders nothing without steps. Like the other calm blocks it shows only the words it is given, the
 * three states apart (the `calm.path` namespace).
 *
 *     <GuidePath label="I tuoi prossimi passi" steps={[
 *       { id: 'a', title: 'Ricevuta da recuperare', detail: 'Villa del Lago', note: 'Scaduta: 23 set', noteTone: 'danger',
 *         kicker: 'Adesso', state: 'current', action: { label: 'Fallo ora', href: '/app/…' } },
 *       { id: 'b', title: 'Check-in di Mario Rossi', state: 'upcoming', action: { label: 'Apri', href: '/app/…' } },
 *     ]} />
 */
export function GuidePath({ label, steps, density = 'regular', className, ...props }: GuidePathProps) {
  const { t } = useTranslation();
  if (steps.length === 0) return null;
  const compact = density === 'compact';

  return (
    <ol {...props} aria-label={label} className={cn('min-w-0', className)}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const current = step.state === 'current';
        const stateText =
          step.state === 'done' ? t('calm.path.done') : current ? t('calm.path.current') : t('calm.path.upcoming');

        return (
          <li
            key={step.id}
            aria-current={current ? 'step' : undefined}
            data-state={step.state}
            className={cn('relative flex min-w-0 gap-3 sm:gap-4', last ? null : compact ? 'pb-4' : 'pb-6')}
          >
            {/* The line to the next step: the accent once this step is behind, a hairline otherwise. */}
            {last ? null : (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute bottom-0 w-0.5 rounded-full',
                  compact ? 'left-[11px] top-7' : 'left-[15px] top-9',
                  step.state === 'done' ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative grid shrink-0 place-items-center rounded-full font-bold',
                compact ? 'size-6 text-[11px]' : 'size-8 text-xs',
                MARKER[step.state],
              )}
            >
              {step.state === 'done' ? (
                <Check className={compact ? 'size-3.5' : 'size-4'} />
              ) : current ? (
                <span className={cn('rounded-full bg-primary', compact ? 'size-2' : 'size-2.5')} />
              ) : (
                index + 1
              )}
            </span>

            <div
              className={cn(
                'flex min-w-0 flex-1 flex-col gap-2',
                // Beside the text from `sm`: the button of every step at the same place, so the eye runs down the path.
                compact ? null : 'sm:flex-row sm:items-start sm:justify-between sm:gap-4',
              )}
            >
              <div className={cn('min-w-0', compact ? null : 'pt-1')}>
                {step.kicker ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-text">{step.kicker}</p>
                ) : null}
                <p
                  className={cn(
                    'break-words leading-snug',
                    current ? (compact ? 'text-sm font-semibold' : 'text-base font-semibold') : 'text-sm font-medium',
                    step.state === 'done' && 'text-foreground/70',
                  )}
                >
                  {step.title}
                  <span className="sr-only">{` (${stateText})`}</span>
                </p>
                {step.detail ? <p className="mt-0.5 break-words text-sm text-foreground/70">{step.detail}</p> : null}
                {step.note ? (
                  <p className={cn('mt-1 flex items-start gap-1.5 text-sm', NOTE_TONE[step.noteTone ?? 'neutral'])}>
                    <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0 break-words">{step.note}</span>
                  </p>
                ) : null}
              </div>
              {step.action ? (
                <CalmActionButton
                  action={step.action}
                  size="sm"
                  variant={current ? 'default' : 'outline'}
                  className={cn('w-full shrink-0 sm:w-auto', compact ? 'self-start' : null)}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
