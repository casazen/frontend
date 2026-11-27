import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { useShortRentProperties } from '@/queries/use-octorate-mapping';
import {
  INVENTORY_SCENARIOS,
  assignPortfolio,
  portfolioOf,
  type ConnectWizardValues,
  type InventoryScenario,
  type MixedGroup,
} from './inventory-scenario';
import { StepProblem } from './listing-parts';

interface MixedPortfolioStepProps {
  /** The situations that already have an import or a mapping: their properties cannot be moved to «new» (the server refuses it too). */
  lockedNew?: boolean;
}

/**
 * Step «Situazione mista» (E02/F01/US03/T02): an agency or a host with properties in more than one situation says which is which. There is one
 * group for each of the three situations and a property is in one of them only: it shows counts and conflicts and does not let a property be
 * imported and created at once. Each group then follows the road of its own situation in the same wizard, and the summary puts them together.
 * A situation can have no property of CasaZen: its listings are not in CasaZen yet, and the import finds them. Properties the host does not
 * choose are left as they are.
 */
export function MixedPortfolioStep({ lockedNew = false }: MixedPortfolioStepProps) {
  const { t } = useTranslation();
  const { control, setValue } = useFormContext<ConnectWizardValues>();
  const groups = useWatch({ control, name: 'groups' }) ?? [];
  const properties = useShortRentProperties();

  const setGroups = (next: MixedGroup[]) => setValue('groups', next, { shouldDirty: true });
  const groupOf = (scenario: InventoryScenario) => groups.find((group) => group.scenario === scenario);

  const toggleGroup = (scenario: InventoryScenario) =>
    setGroups(groupOf(scenario) ? groups.filter((group) => group.scenario !== scenario) : [...groups, { scenario, propertyIds: [] }]);

  const toggleProperty = (scenario: InventoryScenario, propertyId: string) =>
    setGroups(
      groups.map((group) =>
        group.scenario !== scenario
          ? group
          : { ...group, propertyIds: group.propertyIds.includes(propertyId) ? group.propertyIds.filter((id) => id !== propertyId) : [...group.propertyIds, propertyId] },
      ),
    );

  const { conflicts } = assignPortfolio(portfolioOf(groups));
  const nameOf = (propertyId: string) => properties.data?.find((property) => property.id === propertyId)?.name ?? propertyId;
  const total = new Set(groups.flatMap((group) => group.propertyIds)).size;

  return (
    <div className="flex flex-col gap-4" data-testid="mixed-portfolio-step">
      <p className="text-sm text-muted-foreground" data-testid="mixed-portfolio-counts">
        {t('octorate.connect.mixed.counts', { groups: groups.length, properties: total })}
      </p>

      {properties.isError ? (
        <StepProblem title={t('octorate.connect.mixed.loadFailed')} error={properties.error} onRetry={() => void properties.refetch()} testId="mixed-portfolio-load-error" />
      ) : null}

      <div className="space-y-4">
        {INVENTORY_SCENARIOS.map((scenario) => {
          const group = groupOf(scenario);
          const disabled = scenario === 'newInventory' && lockedNew;
          return (
            <fieldset key={scenario} className="min-w-0 space-y-3 rounded-lg border p-4" data-testid={`mixed-group-${scenario}`} data-active={group ? 'true' : 'false'}>
              <legend className="px-1 text-sm font-semibold">{t(`octorate.connect.mixed.groups.${scenario}.title`)}</legend>
              <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0"
                  checked={group !== undefined}
                  disabled={disabled}
                  onChange={() => toggleGroup(scenario)}
                  data-testid={`mixed-group-${scenario}-toggle`}
                />
                <span className="min-w-0 break-words">{t(`octorate.connect.mixed.groups.${scenario}.description`)}</span>
              </label>

              {group ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t('octorate.connect.mixed.groupCount', { count: group.propertyIds.length })}
                  </p>
                  {group.propertyIds.length === 0 ? <p className="text-sm text-muted-foreground">{t(`octorate.connect.mixed.groups.${scenario}.none`)}</p> : null}
                  <ul className="max-h-64 space-y-1 overflow-y-auto" role="list">
                    {(properties.data ?? []).map((property) => (
                      <li key={property.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-5 shrink-0"
                            checked={group.propertyIds.includes(property.id)}
                            onChange={() => toggleProperty(scenario, property.id)}
                            data-testid={`mixed-group-${scenario}-property-${property.id}`}
                          />
                          <span className="min-w-0 break-words">
                            {property.name}
                            {property.city ? <span className="text-muted-foreground">{` · ${property.city}`}</span> : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </fieldset>
          );
        })}
      </div>

      {conflicts.length > 0 ? (
        <Alert variant="danger" title={t('octorate.connect.mixed.conflictTitle')} data-testid="mixed-portfolio-conflicts">
          <ul className="list-disc space-y-1 pl-5" role="list">
            {conflicts.map((conflict) => (
              <li key={conflict.member} className="break-words">
                {t('octorate.connect.mixed.conflictLine', { property: nameOf(conflict.member) })}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <p className="text-sm text-muted-foreground">{t('octorate.connect.mixed.rest')}</p>
    </div>
  );
}
