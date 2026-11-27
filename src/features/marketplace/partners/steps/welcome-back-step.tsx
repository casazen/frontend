import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ListChecks } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { todayInRome } from '@/lib/stay-dates';
import type { MarketplacePartnerActivation } from '@/types';
import { MARKETPLACE_MINE_PATH, marketplaceHref } from '../../lib/marketplace-paths';
import { dayText, declarationLabel, type PartnerContext, type PartnerWizardValues } from '../partner-wizard-model';
import { BriefProblem } from './prepare-step';

interface WelcomeBackStepProps {
  context: PartnerContext;
}

/**
 * Step «Bentornato» (E09/F02/US04/T04, Q-006): the step the wizard opens on when the person comes back from the partner's site. It asks one question, «Hai completato
 * l'attivazione?», with the day it was done: today unless the person says another (the field is a date that cannot be in the future). The main button of the wizard
 * («Sì, l'ho completata») records the declaration (`POST /api/marketplace/partners/{code}/declare`); the other answer, «Non ancora», is the way out that keeps the
 * point where the person is (the wizard's own «Salva ed esci»). CasaZen cannot see what happened on the partner's site: the activation is what the person says.
 */
export function WelcomeBackStep({ context }: WelcomeBackStepProps) {
  const { t } = useTranslation();
  const { register, formState } = useFormContext<PartnerWizardValues>();
  const { brief } = context;

  if (context.briefStatus === 'error') return <BriefProblem context={context} />;
  const name = brief?.name ?? t('marketplace.partnerFlow.thisPartner');

  return (
    <div className="flex flex-col gap-4" data-testid="partner-welcome-back-step">
      <p className="text-base font-medium">{t('marketplace.partnerFlow.welcomeBack.question', { name })}</p>
      <Field
        label={t('marketplace.partnerFlow.welcomeBack.dayLabel')}
        hint={t('marketplace.partnerFlow.welcomeBack.dayHint')}
        error={formState.errors.declaredOn}
        className="max-w-xs"
      >
        <Input type="date" max={todayInRome()} data-testid="partner-declared-on" {...register('declaredOn')} />
      </Field>
      <p className="text-sm text-muted-foreground" data-testid="partner-not-yet-note">
        {t('marketplace.partnerFlow.welcomeBack.notYetNote')}
      </p>
    </div>
  );
}

interface PartnerResultStepProps {
  context: PartnerContext;
  /** The activation the declaration made; `undefined` when the screen is opened again (a reload): the wizard is over and there is nothing to report but where to look. */
  activation: MarketplacePartnerActivation | undefined;
  /** Where the closing button leads: the page the wizard was opened from, else the Marketplace. */
  exitPath: string;
  language: string;
}

/**
 * The result of the declaration (E09/F02/US04/T04, Q-006): the partner is Active and the label says «dichiarato da te il <giorno>». It says «verificato» only when the
 * backend recorded a verification (a connection showed it active): the client never says it on its own. One next step is suggested, and the closing button goes back where
 * the wizard was opened from.
 */
export function PartnerResultStep({ context, activation, exitPath, language }: PartnerResultStepProps) {
  const { t } = useTranslation();
  const name = context.brief?.name ?? t('marketplace.partnerFlow.thisPartner');
  const label = activation ? declarationLabel(activation) : null;
  const day = label ? dayText(label.day, language) : '';

  return (
    <div data-testid="partner-result">
      <WizardDone
        title={activation ? t('marketplace.partnerFlow.result.title', { name }) : t('marketplace.partnerFlow.result.over')}
        description={
          label === null
            ? undefined
            : label.kind === 'verified'
              ? t('marketplace.partnerFlow.result.verified', { date: day })
              : t('marketplace.partnerFlow.result.declared', { date: day })
        }
        lead={activation ? undefined : t('marketplace.partnerFlow.result.overText', { name })}
        whatNext={[
          { text: t('marketplace.partnerFlow.result.whatNext.theirSite', { name }), icon: CheckCircle2 },
          { text: t('marketplace.partnerFlow.result.whatNext.turnOff', { name }), icon: ListChecks },
        ]}
        primary={{ label: t('marketplace.partnerFlow.result.close'), to: exitPath }}
        secondary={{ label: t('marketplace.partnerFlow.result.seeActive'), to: marketplaceHref(MARKETPLACE_MINE_PATH, activation?.propertyId ?? context.propertyId) }}
      >
        {activation ? (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border p-4" data-testid="partner-result-status">
            <span className="min-w-0 break-words font-medium">{name}</span>
            <Badge variant="success" data-testid="partner-result-badge" data-declared={label?.kind === 'declared'}>
              {t('marketplace.status.Active')}
            </Badge>
          </div>
        ) : (
          <Alert variant="info">{t('marketplace.partnerFlow.result.overHint')}</Alert>
        )}
      </WizardDone>
    </div>
  );
}
