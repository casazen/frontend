import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CirclePlus, Globe, Layers, Link2, type LucideIcon } from 'lucide-react';
import { SaveIndicator } from '@/components/shared/save-indicator';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Spinner } from '@/components/ui/spinner';
import { useWizardDraft } from '@/hooks/use-wizard-draft';
import { CONNECT_WIZARD_DEFAULTS, MIXED_SCENARIO, isWizardScenario, type WizardScenario } from '@/features/integrations/octorate/inventory-scenario';
import { OCTORATE_CONNECT_PATH } from '@/features/integrations/octorate/octorate-callback';

/** The draft of the connect wizard of E02: the answer to its first question is the same draft, so the person resumes where they left (UX-03). */
const CONNECT_WIZARD_DRAFT_ID = 'octorate-connect';

interface Choice {
  scenario: WizardScenario;
  icon: LucideIcon;
}

const CHOICES: readonly Choice[] = [
  { scenario: 'onOctorate', icon: Link2 },
  { scenario: 'onOtas', icon: Globe },
  { scenario: 'newInventory', icon: CirclePlus },
];

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/**
 * «Dove si trovano oggi i tuoi annunci?» (E10/F03/US02/T02, PO-01, D6): the first thing the part «Collega Octorate» asks, and the same question as the
 * first step of the connect wizard of E02 (the name of the channel manager may be said here). Every choice, and «Ho una situazione mista», opens the
 * SAME connect route of E02 with the answer: `onOctorate` goes on to the consent, `onOtas` to the choice of the channels and the import, `newInventory`
 * alone to the listing wizard, and the mixed answer to the assignment of the groups. This page never opens the listing wizard by itself.
 *
 * The answer is kept in the draft of the wizard on the server (`OnboardingActivation`) as the host chooses, with «Salvato alle HH:MM», so that on
 * any device the host finds the same answer and the same step.
 */
export function PartEntryQuestion() {
  const { t } = useTranslation();
  const draft = useWizardDraft(CONNECT_WIZARD_DRAFT_ID, { server: { type: 'OnboardingActivation' } });
  const [picked, setPicked] = useState<WizardScenario | null>(null);

  if (!draft.ready) {
    return (
      <div className="flex min-w-0 justify-center py-6" role="status" aria-busy="true" data-testid="part-entry-loading">
        <Spinner size="md" />
        <span className="sr-only">{t('onboardingPlan.launch.entry.loading')}</span>
      </div>
    );
  }

  const saved = draft.restored?.values.scenario;
  const chosen: WizardScenario | null = picked ?? (isWizardScenario(saved) ? saved : null);

  const choose = (scenario: WizardScenario) => {
    setPicked(scenario);
    // Over what the wizard already holds (the channels, the import, the decisions): only the answer changes.
    draft.save({ step: 'scenario', values: { ...CONNECT_WIZARD_DEFAULTS, ...draft.restored?.values, scenario } });
    draft.flush();
  };

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="part-entry-title" data-testid="part-entry-question">
      <h2 id="part-entry-title" className="text-lg font-semibold">
        {t('octorate.connect.scenario.legend')}
      </h2>
      <ChoiceGroup legend={t('octorate.connect.scenario.legend')} minCardWidth={14}>
        {CHOICES.map(({ scenario, icon }) => (
          <ChoiceCard
            key={scenario}
            name="part-entry-scenario"
            value={scenario}
            checked={chosen === scenario}
            onChange={() => choose(scenario)}
            icon={icon}
            title={t(`octorate.connect.scenario.${scenario}.title`)}
            description={t(`octorate.connect.scenario.${scenario}.description`)}
            data-testid={`part-entry-${scenario}`}
          />
        ))}
      </ChoiceGroup>
      <div>
        <Button
          type="button"
          variant="outline"
          className={TOUCH_TARGET}
          aria-pressed={chosen === MIXED_SCENARIO}
          onClick={() => choose(MIXED_SCENARIO)}
          data-testid={`part-entry-${MIXED_SCENARIO}`}
        >
          <Layers aria-hidden="true" className="size-4 shrink-0" />
          {t('octorate.connect.scenario.mixed.title')}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {chosen ? (
          <Button asChild className={TOUCH_TARGET} iconRight={<ArrowRight />}>
            <Link to={`${OCTORATE_CONNECT_PATH}?scenario=${encodeURIComponent(chosen)}`} data-testid="part-entry-continue">
              {t('onboardingPlan.launch.entry.continue')}
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-foreground/70" data-testid="part-entry-hint">
            {t('onboardingPlan.launch.entry.hint')}
          </p>
        )}
        <SaveIndicator status={draft.status} savedAt={draft.serverSavedAt} onRetry={draft.retry} data-testid="part-entry-saved" />
      </div>
    </section>
  );
}
