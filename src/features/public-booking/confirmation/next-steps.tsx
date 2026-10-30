import type { CSSProperties } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Check, CreditCard, Home, LogOut, Mail, Hourglass, CircleCheck } from 'lucide-react';
import type { NextStep, NextStepId, StepState } from '@/features/public-booking/confirmation/confirmation-model';
import { useSiteMoney } from '@/features/public-site/hooks/use-site-money';
import { formatDayLong, formatDayMonthShort } from '@/features/public-site/stay/stay-format';
import { siteLocale } from '@/lib/site-language';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { CheckoutOutcome } from '@/types';
import './confirmation.css';

const ICONS: Record<NextStepId, typeof Home> = {
  confirmed: CircleCheck,
  charge: CreditCard,
  email: Mail,
  host: Hourglass,
  ifAccepted: CircleCheck,
  arrival: Home,
  departure: LogOut,
};

interface StepContext {
  t: TFunction;
  language: string;
  locale: string;
  money: (amount: number, currency?: string) => string;
  outcome: CheckoutOutcome;
  /** How the host is named on the site, or an empty string. */
  hostLabel: string;
  /** The address the guest booked with, only when the checkout handed it over (never read from the address bar). */
  guestEmail?: string;
  arrivalFrom: string;
  departureBy: string;
}

/** The title and the sentence of a step, from the data of the booking and nothing else. */
function describe(step: NextStep, context: StepContext): { title: string; text: string } {
  const { t, language, locale, money, outcome, hostLabel, guestEmail, arrivalFrom, departureBy } = context;
  const deadline = outcome.expiresAt ? formatRomeDateTime(outcome.expiresAt, language) : '';
  // The name of the host starts a sentence or a title here: «l'host» (the fallback) takes its capital.
  const hostName = hostLabel || t('siteConfirm.hostFallback');
  const host = hostName.charAt(0).toLocaleUpperCase(language) + hostName.slice(1);

  switch (step.id) {
    case 'confirmed': {
      const text =
        outcome.paymentOption === 'OnSite'
          ? t('siteConfirm.steps.confirmed.onSite')
          : outcome.paymentOption === 'OnCancellationDeadline'
            ? t('siteConfirm.steps.confirmed.later')
            : t('siteConfirm.steps.confirmed.paid');
      return { title: t('siteConfirm.steps.confirmed.title'), text };
    }
    case 'charge':
      return {
        title: t('siteConfirm.steps.charge.title', { total: money(outcome.totalPrice, outcome.currency) }),
        text: t('siteConfirm.steps.charge.text'),
      };
    case 'email': {
      const done = step.state === 'done';
      if (done) return { title: t('siteConfirm.steps.email.doneTitle'), text: t('siteConfirm.steps.email.doneText', { host }) };
      const text = guestEmail
        ? deadline
          ? t('publicBooking.onSiteRequest.stepConfirmEmail', { email: guestEmail, time: deadline })
          : t('publicBooking.onSiteRequest.stepConfirmEmailNoTime', { email: guestEmail })
        : deadline
          ? t('publicBooking.outcome.stepConfirmEmailAnyAddress', { time: deadline })
          : t('publicBooking.outcome.stepConfirmEmailAnyAddressNoTime');
      return { title: t('siteConfirm.steps.email.title'), text };
    }
    case 'host':
      return { title: t('siteConfirm.steps.host.title', { host }), text: t('publicBooking.onSiteRequest.stepHostAnswers') };
    case 'ifAccepted':
      return { title: t('siteConfirm.steps.ifAccepted.title'), text: t('publicBooking.onSiteRequest.stepPayOnSite') };
    case 'arrival': {
      const day = formatDayLong(outcome.checkInDate, locale);
      return {
        title: t('siteConfirm.steps.arrival.title'),
        text: arrivalFrom ? t('siteConfirm.steps.arrival.text', { day, time: arrivalFrom }) : day,
      };
    }
    case 'departure': {
      const day = formatDayLong(outcome.checkOutDate, locale);
      return {
        title: t('siteConfirm.steps.departure.title'),
        text: departureBy ? t('siteConfirm.steps.departure.text', { day, time: departureBy }) : day,
      };
    }
  }
}

function whenLabel(t: TFunction, step: NextStep, locale: string): string {
  if (step.state === 'done') return t('siteConfirm.steps.when.done');
  if (step.date) return formatDayMonthShort(step.date, locale);
  return step.state === 'current' ? t('siteConfirm.steps.when.now') : t('siteConfirm.steps.when.later');
}

function stateWord(t: TFunction, state: StepState): string {
  if (state === 'done') return t('siteConfirm.steps.state.done');
  return state === 'current' ? t('siteConfirm.steps.state.current') : t('siteConfirm.steps.state.todo');
}

interface NextStepsProps {
  steps: NextStep[];
  outcome: CheckoutOutcome;
  hostLabel: string;
  guestEmail?: string;
  arrivalFrom: string;
  departureBy: string;
}

/**
 * «Cosa succede ora» (DB-06b): what comes after this page, as steps with their real days, the one that is happening marked (by
 * its word as well as by its color). A step the backend gives no day for shows «Adesso» or «Poi», not a made-up time (D24).
 */
export function NextSteps({ steps, outcome, hostLabel, guestEmail, arrivalFrom, departureBy }: NextStepsProps) {
  const { t, i18n } = useTranslation();
  const money = useSiteMoney();
  const locale = siteLocale(i18n.language);
  if (steps.length === 0) return null;

  const context: StepContext = { t, language: i18n.language, locale, money, outcome, hostLabel, guestEmail, arrivalFrom, departureBy };

  return (
    <section className="bc-sec" aria-labelledby="bc-steps-title" data-testid="checkout-outcome-steps">
      <div className="bc-wrap">
        <header className="bc-head">
          <p className="bc-eyebrow">{t('siteConfirm.steps.eyebrow')}</p>
          <h2 id="bc-steps-title" className="public-display">
            {t('siteConfirm.steps.title')}
          </h2>
        </header>
        <ol className="bc-steps" style={{ '--bc-n': steps.length } as CSSProperties}>
          {steps.map((step) => {
            const { title, text } = describe(step, context);
            const Icon = step.state === 'done' ? Check : ICONS[step.id];
            return (
              <li key={step.id} className={cn('bc-step', `is-${step.state}`)} aria-current={step.state === 'current' ? 'step' : undefined} data-step={step.id}>
                <span className="bc-step__dot" aria-hidden="true">
                  <Icon />
                </span>
                <div className="bc-step__txt">
                  <p className="bc-step__when">
                    {whenLabel(t, step, locale)}
                    <span className="sr-only"> · {stateWord(t, step.state)}</span>
                  </p>
                  <h3 className="bc-step__t">{title}</h3>
                  <p className="bc-step__x">{text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
