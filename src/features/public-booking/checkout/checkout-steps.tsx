import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { CheckoutStep } from '@/features/public-booking/checkout/checkout-model';
import '@/features/public-booking/checkout/checkout.css';

const STEPS: readonly CheckoutStep[] = [1, 2, 3];

type StepState = 'done' | 'now' | 'todo';

function stateOf(number: CheckoutStep, step: CheckoutStep): StepState {
  if (number < step) return 'done';
  if (number === step) return 'now';
  return 'todo';
}

interface CheckoutStepsProps {
  step: CheckoutStep;
  /** The steps the guest can go back to (a step already done); none once the booking is made, when the stay and the data are fixed. */
  canGoBack: boolean;
  onGo: (step: CheckoutStep) => void;
}

/**
 * «Il soggiorno · I tuoi dati · Pagamento» (DB-05): where the guest is in the three steps. On a tablet and a desktop a row with the
 * done steps as buttons to go back to; on a phone «Passo 2 di 3» with a bar. The step in progress is `aria-current`.
 */
export function CheckoutSteps({ step, canGoBack, onGo }: CheckoutStepsProps) {
  const { t } = useTranslation();

  return (
    <nav className="co-steps" aria-label={t('publicCheckout.steps.label')} data-testid="checkout-steps">
      <ol className="co-steps__list">
        {STEPS.map((number) => {
          const state = stateOf(number, step);
          const label = t(`publicCheckout.steps.step${number}`);
          const inner = (
            <>
              <span className="co-steps__n" aria-hidden="true">
                {state === 'done' ? <Check /> : number}
              </span>
              <span className="co-steps__label">{label}</span>
              {state === 'done' ? <span className="sr-only"> ({t('publicCheckout.steps.done')})</span> : null}
            </>
          );
          return (
            <li key={number} className={`co-steps__item is-${state}`}>
              {state === 'done' && canGoBack ? (
                <button type="button" className="co-steps__a" onClick={() => onGo(number)} data-testid={`checkout-step-${number}`}>
                  {inner}
                </button>
              ) : (
                <span className="co-steps__a" aria-current={state === 'now' ? 'step' : undefined} data-testid={`checkout-step-${number}`}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div className="co-steps__phone">
        <p>
          <strong>{t('publicCheckout.steps.phone', { step })}</strong> · {t(`publicCheckout.steps.step${step}`)}
        </p>
        <span className="co-steps__bar" aria-hidden="true">
          <i style={{ ['--co-progress' as string]: `${Math.round((step / 3) * 100)}%` }} />
        </span>
      </div>
    </nav>
  );
}
