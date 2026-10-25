import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LeaseNeed } from '@/types';
import { cn } from '@/lib/utils';
import { guideNeed } from './wizard-messages';

/** Something left to do and the step where it is put right. */
export interface MissingItem {
  step: number;
  need: LeaseNeed;
}

interface MissingNoteProps {
  items: MissingItem[];
  /** The step on screen: a thing of this step is reached by putting the focus on its field, a thing of another one by a link. */
  current: number;
  /** How many times the person pressed the main button with something left: from the first time the note is said aloud, as an alert. */
  pressed?: number;
  onGo: (need: LeaseNeed) => void;
  hrefOfStep: (step: number) => string;
  className?: string;
}

/**
 * What is left to do before going on, in ONE sentence under the fields (LR-WIZ-1): «Manca: il canone mensile.» with «Vai al campo», and
 * «e altre 2 cose» when there are more. Never a list, never red: the main button stays pressable and leads to the first thing, and this
 * line says what that is. The whole line is the button, so a finger on a phone finds it easily. Nothing left: «Tutto compilato».
 */
export function MissingNote({ items, current, pressed = 0, onGo, hrefOfStep, className }: MissingNoteProps) {
  const { t, i18n } = useTranslation();
  const first = items[0];
  if (!first) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)} data-testid="lease-wizard-remaining">
        {t('leaseWizardGuide.missing.none')}
      </p>
    );
  }

  // The first two things are named, the others counted: «Manca: il canone mensile · il deposito e altre 2 cose».
  const named = items.slice(0, 2).map((item) => guideNeed(t, i18n, item.need));
  const more = items.length - named.length;
  const sameStep = first.step === current;
  const body = (
    <>
      <strong className="font-semibold">{t(named[0].lead === 'missing' ? 'leaseWizardGuide.missing.label' : 'leaseWizardGuide.missing.fix')}</strong>{' '}
      {named.map((line) => line.text).join(' · ')}
      {more > 0 ? ` ${t('leaseWizardGuide.missing.more', { count: more })}` : null}.{' '}
      <span className="font-semibold underline underline-offset-2">
        {sameStep ? t('leaseWizardGuide.missing.goTo') : t('leaseWizardGuide.missing.goToStep', { step: t(`leaseWizard.steps.${first.step}.label`) })}
      </span>
    </>
  );
  const box = cn(
    'block min-h-11 w-full min-w-0 break-words rounded-md px-1 py-2 text-left text-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
    pressed > 0 && 'bg-[color:var(--color-warning-soft,#fdf3df)]',
  );

  return (
    // A new element for each press: a screen reader says the sentence again.
    <div key={pressed} role={pressed > 0 ? 'alert' : undefined} className={className} data-testid="lease-wizard-remaining" data-pressed={pressed > 0 ? 'true' : undefined}>
      {sameStep ? (
        <button type="button" className={box} onClick={() => onGo(first.need)}>
          {body}
        </button>
      ) : (
        <Link to={hrefOfStep(first.step)} className={box}>
          {body}
        </Link>
      )}
    </div>
  );
}
