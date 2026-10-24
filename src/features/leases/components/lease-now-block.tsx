import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusBlock } from '@/components/shared/calm';
import type { LeaseStepView } from '../lib/lease-next-step';

/**
 * «Cosa devi fare ora» (LR-03b): the step the server says the lease waits for, at the top of its sheet. It is the one colored block
 * of the page: what to do, whose turn it is, by when, and the one button that does it (the tab of the sheet where it is done, the
 * wizard of the draft, the rent register). The words, the tone and the destination are the shared description of the step
 * (`describeLeaseStep`, LR-05); this only lays them out.
 *
 * A step whose only place is the sheet itself (all is well, the lease is over, the partner prepares the contract, a code this version
 * does not know) has no button to give, because a button to the page you are on does nothing: it is a quiet line, not a block.
 */
export function LeaseNowBlock({ step }: { step: LeaseStepView }) {
  const { t } = useTranslation();
  const titleId = useId();

  if (step.to === step.leaseTo) {
    return (
      <section aria-labelledby={titleId} data-testid="lease-now-quiet" className="min-w-0 space-y-1 border-s-2 border-border ps-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{t('leaseSheet.now.kicker')}</p>
        <h2 id={titleId} className="break-words text-base font-medium">
          {step.title}
        </h2>
        {step.detail ? <p className="break-words text-sm text-foreground/70">{step.detail}</p> : null}
      </section>
    );
  }

  return (
    <FocusBlock
      tone={step.tone}
      kicker={t('leaseSheet.now.kicker')}
      title={step.title}
      body={step.detail ?? undefined}
      who={step.who || undefined}
      when={step.when ?? undefined}
      primary={{ label: step.action, href: step.to, testId: 'lease-now-action' }}
      data-testid="lease-now"
    />
  );
}
