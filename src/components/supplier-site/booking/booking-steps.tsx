import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { BookingStep } from '@/lib/supplier-site/booking-flow';

interface BookingStepsProps {
  steps: BookingStep[];
  current: BookingStep;
  /** A step already done can be gone back to; the ones ahead cannot be jumped to. */
  onGo: (step: BookingStep) => void;
  /** False once the hold is made: the steps done are only read, no longer links back. */
  interactive?: boolean;
}

/** Where the person is in the booking: the steps in a row on a wide screen, "Passo 2 di 5" with a bar on a phone. */
export function BookingSteps({ steps, current, onGo, interactive = true }: BookingStepsProps) {
  const { t } = useTranslation();
  const index = steps.indexOf(current);
  return (
    <nav className="vb-steps" aria-label={t('supplierSite.booking.steps.label')}>
      <ol>
        {steps.map((step, position) => {
          const done = position < index;
          const label = t(`supplierSite.booking.steps.${step}`);
          const body = (
            <>
              <span className="vb-steps__n" aria-hidden="true">
                {done ? <Check /> : position + 1}
              </span>
              <span className="vb-steps__l">{label}</span>
            </>
          );
          return (
            <li key={step} className={done ? 'is-done' : position === index ? 'is-cur' : undefined}>
              {done && interactive ? (
                <button type="button" onClick={() => onGo(step)} aria-label={t('supplierSite.booking.steps.back', { step: label })}>
                  {body}
                </button>
              ) : (
                <span aria-current={position === index ? 'step' : undefined} className={done ? 'is-locked' : undefined}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="vb-steps__m" aria-hidden="true">
        <strong>{t('supplierSite.booking.steps.progress', { current: index + 1, total: steps.length })}</strong>
        <span>{t(`supplierSite.booking.steps.${current}`)}</span>
        <i style={{ '--p': `${((index + 1) / steps.length) * 100}%` } as CSSProperties} />
      </div>
    </nav>
  );
}
