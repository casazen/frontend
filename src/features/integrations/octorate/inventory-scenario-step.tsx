import { useEffect, useId } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CirclePlus, Globe, Layers, Link2, type LucideIcon } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { MIXED_SCENARIO, type ConnectWizardValues, type InventoryScenario, type WizardScenario } from './inventory-scenario';

interface ScenarioCard {
  scenario: InventoryScenario;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
}

/**
 * The three answers, with the words of the question. "Octorate" is named here (PO-01): this is the place where the host has to recognize the
 * tool. The keys are written out so that the i18n test finds a missing translation.
 */
const CARDS: readonly ScenarioCard[] = [
  {
    scenario: 'onOctorate',
    icon: Link2,
    titleKey: 'octorate.connect.scenario.onOctorate.title',
    descriptionKey: 'octorate.connect.scenario.onOctorate.description',
  },
  {
    scenario: 'onOtas',
    icon: Globe,
    titleKey: 'octorate.connect.scenario.onOtas.title',
    descriptionKey: 'octorate.connect.scenario.onOtas.description',
  },
  {
    scenario: 'newInventory',
    icon: CirclePlus,
    titleKey: 'octorate.connect.scenario.newInventory.title',
    descriptionKey: 'octorate.connect.scenario.newInventory.description',
  },
];

/** What CasaZen will do with the answer, in one sentence: the confirmation of the choice, shown as soon as it is made. */
const CONFIRM_KEYS: Readonly<Record<WizardScenario, string>> = {
  onOctorate: 'octorate.connect.scenario.confirm.onOctorate',
  onOtas: 'octorate.connect.scenario.confirm.onOtas',
  newInventory: 'octorate.connect.scenario.confirm.newInventory',
  mixed: 'octorate.connect.scenario.confirm.mixed',
};

interface InventoryScenarioStepProps {
  /** Listings were already matched to properties: with an import started they make a change of the answer to «new» impossible (the server refuses it too). */
  mappingExists: boolean;
}

/**
 * Step 1, "Dove si trovano oggi i tuoi annunci?" (E02/F01/US03/T02): one question, three answers that exclude each other (D6) and «Ho una
 * situazione mista». One of them is never turned into another: "not on the channel manager" does not mean "new", and «new» is chosen on purpose
 * and says out loud that CasaZen will create listings, while «on the OTAs» says it imports and keeps the existing ones and publishes nothing.
 *
 * Changing an answer that already led somewhere to «new» asks for a warning to be read, and is refused once an import has started or listings
 * were matched: it is never a way to recover from an import.
 */
export function InventoryScenarioStep({ mappingExists }: InventoryScenarioStepProps) {
  const { t } = useTranslation();
  const noteId = useId();
  const { control, setValue, getValues, formState } = useFormContext<ConnectWizardValues>();
  const chosen = useWatch({ control, name: 'scenario' });
  const committed = useWatch({ control, name: 'committedScenario' });
  const acknowledged = useWatch({ control, name: 'acknowledgeNew' });
  const batchId = useWatch({ control, name: 'batchId' });
  const importExists = mappingExists || Boolean(batchId);

  // Leaving the step is what makes an answer count as left: a change to «new» afterwards is a change of an answer that already led somewhere.
  useEffect(
    () => () => {
      const answer = getValues('scenario');
      if (answer) setValue('committedScenario', answer);
    },
    [getValues, setValue],
  );

  const changingToNew = chosen === 'newInventory' && committed !== null && committed !== undefined && committed !== 'newInventory';
  const refused = changingToNew && importExists;
  const choose = (scenario: WizardScenario) => {
    setValue('scenario', scenario, { shouldDirty: true });
    setValue('acknowledgeNew', false);
  };

  // A flex column with a gap, not `space-y-*`: the group is a `fieldset` with its own margin, which the spacing of the siblings would not move.
  return (
    <div className="flex flex-col gap-3" data-testid="octorate-scenario-step">
      <ChoiceGroup legend={t('octorate.connect.scenario.legend')} minCardWidth={14}>
        {CARDS.map(({ scenario, icon, titleKey, descriptionKey }) => (
          <ChoiceCard
            key={scenario}
            name="octorate-scenario"
            value={scenario}
            checked={chosen === scenario}
            onChange={() => choose(scenario)}
            icon={icon}
            title={t(titleKey)}
            description={t(descriptionKey)}
            data-testid={`octorate-scenario-${scenario}`}
          />
        ))}
      </ChoiceGroup>

      <div>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 whitespace-normal py-2 text-left leading-tight"
          aria-pressed={chosen === MIXED_SCENARIO}
          onClick={() => choose(MIXED_SCENARIO)}
          data-testid="octorate-scenario-mixed"
        >
          <Layers aria-hidden="true" className="size-4 shrink-0" />
          {t('octorate.connect.scenario.mixed.title')}
        </Button>
      </div>

      {chosen ? (
        <p
          id={noteId}
          role="status"
          className="rounded-md bg-muted p-3 text-sm"
          data-testid="octorate-scenario-confirm"
          data-scenario={chosen}
        >
          {t(CONFIRM_KEYS[chosen])}
        </p>
      ) : null}

      {changingToNew && !refused ? (
        <Alert variant="warning" title={t('octorate.connect.scenario.change.title')} data-testid="octorate-scenario-change-warning">
          <p>{t('octorate.connect.scenario.change.text')}</p>
          <label className="mt-2 flex min-h-11 cursor-pointer items-start gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="mt-0.5 size-5 shrink-0"
              checked={acknowledged === true}
              onChange={(event) => setValue('acknowledgeNew', event.target.checked, { shouldDirty: true })}
              data-testid="octorate-scenario-change-ack"
            />
            {t('octorate.connect.scenario.change.ack')}
          </label>
        </Alert>
      ) : null}
      {refused ? (
        <Alert variant="danger" title={t('octorate.connect.scenario.change.refusedTitle')} data-testid="octorate-scenario-change-refused">
          {t('octorate.connect.scenario.change.refused')}
        </Alert>
      ) : null}

      <FormFieldError error={formState.errors.scenario} />
      <FormFieldError error={formState.errors.acknowledgeNew} />
    </div>
  );
}
