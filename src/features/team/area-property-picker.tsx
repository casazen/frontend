import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Shield, Sun, type LucideIcon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { SkeletonLine } from '@/components/ui/skeleton';
import type { OrgPropertyScope } from '@/types/org-team.types';
import { areaName } from './team-labels';
import { RENTAL_AREAS, type PickerProperty, type RentalArea } from './team-properties';

const AREA_ICONS: Record<RentalArea, LucideIcon> = { 'short-rent': Sun, 'long-rent': Home };

export interface AreaPropertyPickerProps {
  /** The role sees every area and every property (the owner and the administrators): there is nothing to choose, and it is said. */
  fullAccess: boolean;
  /** The role can be limited to some properties («Solo alcuni»): the collaborator only (AM-D16). */
  scopeSupported: boolean;
  areas: readonly string[];
  onAreasChange: (areas: string[]) => void;
  scope: OrgPropertyScope;
  onScopeChange: (scope: OrgPropertyScope) => void;
  propertyIds: readonly string[];
  onPropertyIdsChange: (ids: string[]) => void;
  /** `undefined` while they are read. */
  properties: readonly PickerProperty[] | undefined;
  propertiesFailed: boolean;
  onRetryProperties: () => void;
  /** Nothing can be changed while the choice is being saved. */
  disabled?: boolean;
}

/** The property lines of one area: a box and the name with its city, 44 px high for a finger. */
function PropertyChecks({
  area,
  properties,
  selected,
  onToggle,
  disabled,
}: {
  area: RentalArea;
  properties: readonly PickerProperty[];
  selected: ReadonlySet<string>;
  onToggle: (id: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId} className="min-w-0 space-y-1">
      <p id={headingId} className="text-sm font-medium">
        {areaName(area, t)}
      </p>
      <ul role="list" className="space-y-0.5">
        {properties.map((property) => {
          const inputId = `${headingId}-${property.id}`;
          return (
            <li key={property.id}>
              <label htmlFor={inputId} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md px-1 text-sm hover:bg-muted/50">
                <Checkbox
                  id={inputId}
                  checked={selected.has(property.id)}
                  disabled={disabled}
                  onCheckedChange={(value) => onToggle(property.id, value === true)}
                />
                <span className="min-w-0 break-words">
                  {property.name}
                  {property.city ? <span className="text-foreground/70"> · {property.city}</span> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * «Dove potrà lavorare»: the areas of a person (Affitti brevi, Affitti lunghi: at least one) and, for the collaborator alone, all the
 * properties of those areas or only some of them. The role decides what is offered: an administrator sees everything, so it only
 * says so; a role that cannot be limited has no «Solo alcuni». The area Amministrazione is not chosen here: the role gives it.
 *
 * It holds nothing of its own: the wizard of the invitation feeds it from its form, the dialog of a member from its state.
 */
export function AreaPropertyPicker({
  fullAccess,
  scopeSupported,
  areas,
  onAreasChange,
  scope,
  onScopeChange,
  propertyIds,
  onPropertyIdsChange,
  properties,
  propertiesFailed,
  onRetryProperties,
  disabled,
}: AreaPropertyPickerProps) {
  const { t } = useTranslation();
  const scopeName = useId();

  const chosenAreas = fullAccess ? [...RENTAL_AREAS] : areas;
  const selected = new Set(propertyIds);
  const visible = (properties ?? []).filter((property) => chosenAreas.includes(property.area));

  const toggleArea = (area: RentalArea, checked: boolean) => {
    const next = checked ? [...new Set([...areas, area])] : areas.filter((candidate) => candidate !== area);
    // Keep the areas in the order of the area switcher, whatever the order they were ticked in.
    onAreasChange(RENTAL_AREAS.filter((candidate) => next.includes(candidate)));
  };
  const toggleProperty = (id: string, checked: boolean) =>
    onPropertyIdsChange(checked ? [...new Set([...propertyIds, id])] : propertyIds.filter((candidate) => candidate !== id));

  return (
    <div className="space-y-6" data-testid="area-property-picker">
      {fullAccess ? (
        <Alert variant="info" icon={Shield} title={t('team.picker.fullAccessTitle')}>
          {t('team.picker.fullAccessText')}
        </Alert>
      ) : (
        <ChoiceGroup legend={t('team.picker.areasLegend')} legendVisible minCardWidth={14}>
          {RENTAL_AREAS.map((area) => (
            <ChoiceCard
              key={area}
              type="checkbox"
              name="areas"
              value={area}
              icon={AREA_ICONS[area]}
              title={areaName(area, t)}
              description={t(area === 'short-rent' ? 'team.picker.shortRentHint' : 'team.picker.longRentHint')}
              checked={areas.includes(area)}
              disabled={disabled}
              onChange={(event) => toggleArea(area, event.target.checked)}
            />
          ))}
        </ChoiceGroup>
      )}

      {!fullAccess && scopeSupported ? (
        <ChoiceGroup legend={t('team.picker.scopeLegend')} legendVisible minCardWidth={14}>
          <ChoiceCard
            name={scopeName}
            value="All"
            title={t('team.picker.scopeAll')}
            description={t('team.picker.scopeAllHint')}
            checked={scope === 'All'}
            disabled={disabled}
            onChange={() => onScopeChange('All')}
          />
          <ChoiceCard
            name={scopeName}
            value="Selected"
            title={t('team.picker.scopeSome')}
            description={t('team.picker.scopeSomeHint')}
            checked={scope === 'Selected'}
            disabled={disabled}
            onChange={() => onScopeChange('Selected')}
          />
        </ChoiceGroup>
      ) : null}

      {!fullAccess && scopeSupported && scope === 'Selected' ? (
        <div className="space-y-3" data-testid="picker-properties">
          <p className="text-sm font-medium">{t('team.picker.propertiesLegend')}</p>
          {propertiesFailed ? (
            <Alert
              variant="danger"
              action={
                <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRetryProperties}>
                  {t('team.retry')}
                </Button>
              }
            >
              {t('team.picker.propertiesError')}
            </Alert>
          ) : properties === undefined ? (
            <SkeletonLine lines={3} />
          ) : visible.length === 0 ? (
            <p className="text-sm text-foreground/70">{t(chosenAreas.length === 0 ? 'team.picker.noAreaChosen' : 'team.picker.noProperties')}</p>
          ) : (
            <>
              {RENTAL_AREAS.filter((area) => chosenAreas.includes(area) && visible.some((property) => property.area === area)).map((area) => (
                <PropertyChecks
                  key={area}
                  area={area}
                  properties={visible.filter((property) => property.area === area)}
                  selected={selected}
                  onToggle={toggleProperty}
                  disabled={disabled}
                />
              ))}
              <p className="text-sm text-foreground/70">{t('team.picker.chosenCount', { count: visible.filter((property) => selected.has(property.id)).length })}</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
