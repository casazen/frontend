import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CirclePlus, Globe, Link2, type LucideIcon } from 'lucide-react';
import { FormFieldError } from '@/components/shared/form-field-error';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { routeForScenario, type ConnectWizardValues, type InventoryScenario } from './inventory-scenario';

interface ScenarioCard {
  scenario: InventoryScenario;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  /** What the card says while its path cannot be taken yet (the import of the listings that exist). */
  soonKey?: string;
}

/**
 * The three answers, with the words of the question. "Octorate" is named here and nowhere else in the wizard (PO-01): this is the
 * place where the host has to recognize the tool. The keys are written out so that the i18n test finds a missing translation.
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
    soonKey: 'octorate.connect.scenario.onOtas.soon',
  },
  {
    scenario: 'newInventory',
    icon: CirclePlus,
    titleKey: 'octorate.connect.scenario.newInventory.title',
    descriptionKey: 'octorate.connect.scenario.newInventory.description',
  },
];

/**
 * Step 1, "Dove si trovano oggi i tuoi annunci?": one question, three answers that exclude each other (D6). An answer whose path cannot
 * be taken yet is shown and blocked, never hidden, and never sends the host down another path in its place: "not on the channel
 * manager" does not mean "new".
 */
export function InventoryScenarioStep() {
  const { t } = useTranslation();
  const { control, setValue, formState } = useFormContext<ConnectWizardValues>();
  const chosen = useWatch({ control, name: 'scenario' });

  // A flex column with a gap, not `space-y-*`: the group is a `fieldset` with its own margin, which the spacing of the siblings would not move.
  return (
    <div className="flex flex-col gap-3" data-testid="octorate-scenario-step">
      <ChoiceGroup legend={t('octorate.connect.scenario.legend')} minCardWidth={14}>
        {CARDS.map(({ scenario, icon, titleKey, descriptionKey, soonKey }) => {
          const blocked = !routeForScenario(scenario).available;
          return (
            <ChoiceCard
              key={scenario}
              name="octorate-scenario"
              value={scenario}
              checked={chosen === scenario}
              disabled={blocked}
              onChange={() => setValue('scenario', scenario, { shouldDirty: true })}
              icon={icon}
              title={t(titleKey)}
              description={t(blocked && soonKey ? soonKey : descriptionKey)}
              data-testid={`octorate-scenario-${scenario}`}
            />
          );
        })}
      </ChoiceGroup>
      <FormFieldError error={formState.errors.scenario} />
    </div>
  );
}
