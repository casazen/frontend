import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { type PartnerContext } from '../partner-wizard-model';
import { BriefProblem } from './prepare-step';

/** What is going to happen, in the order it happens. */
const HANDOFF_STEPS = [
  { id: 'go', text: 'marketplace.partnerFlow.handoff.steps.go' },
  { id: 'activate', text: 'marketplace.partnerFlow.handoff.steps.activate' },
  { id: 'comeBack', text: 'marketplace.partnerFlow.handoff.steps.comeBack' },
] as const;

interface HandoffStepProps {
  context: PartnerContext;
}

/**
 * Step «Il sito del partner» (E09/F02/US04/T04, UX-02 point 3, S18): what is going to happen, in simple words: the person goes to the partner's site in this tab, does the
 * activation there and comes back. The button that goes there is the main button of the wizard (the page gives it its label and its action: it saves the draft, replaces
 * this history entry with the address of the next step and opens the partner's address as it is). CasaZen sends nothing to the partner, and the step says so.
 */
export function HandoffStep({ context }: HandoffStepProps) {
  const { t } = useTranslation();
  const { brief } = context;

  if (context.briefStatus === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4 text-sm" role="status" data-testid="partner-handoff-loading">
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        {t('marketplace.partnerFlow.prepare.loading')}
      </div>
    );
  }
  if (context.briefStatus === 'error' || !brief) return <BriefProblem context={context} />;

  return (
    <div className="flex flex-col gap-4" data-testid="partner-handoff-step">
      <ol className="space-y-3 text-sm" data-testid="partner-handoff-steps">
        {HANDOFF_STEPS.map(({ id, text }, index) => (
          <li key={id} className="flex min-w-0 items-start gap-3">
            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
              {index + 1}
            </span>
            <span className="min-w-0 break-words" data-testid={`partner-handoff-${id}`}>
              {t(text, { name: brief.name })}
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-2 rounded-lg bg-muted p-4 text-sm" data-testid="partner-handoff-nothing-sent">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 break-words">{t('marketplace.partnerFlow.handoff.nothingSent', { name: brief.name })}</span>
      </p>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ExternalLink aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 break-words">{t('marketplace.partnerFlow.handoff.sameTab')}</span>
      </p>
    </div>
  );
}
