import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { resolveLaunchTarget } from '@/lib/onboarding-part-launch';
import { missingReasonKey } from '@/lib/onboarding-parts';
import { useProperties } from '@/queries/use-properties';
import type { OnboardingLaunchTarget, OnboardingPartMissing } from '@/types/onboarding.types';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface PartMissingListProps {
  target: OnboardingLaunchTarget;
  items: readonly OnboardingPartMissing[];
  totalMissing: number;
}

/**
 * The properties a part still lacks something on, each with what it lacks in plain words and «Fai ora», which reopens the activation wizard of THAT property on its step
 * «Notifica degli ospiti» (E29/F02/US02/T01, NF-129): the launch registry resolves the page against the manifest and the permissions of the person, so a person who may not open
 * it is told so instead of meeting a dead link. The plan sends ids and codes only: the name of each property is read from the list of the properties (a name that is not there
 * reads as «unnamed property», never as an id).
 */
export function PartMissingList({ target, items, totalMissing }: PartMissingListProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const properties = useProperties({ mode: 'short' }, { fresh: true });
  const names = useMemo(
    () => new Map((properties.isError ? [] : (properties.data ?? [])).map((property) => [property.id, { name: property.name, city: property.city }] as const)),
    [properties.data, properties.isError],
  );
  const more = Math.max(0, totalMissing - items.length);

  return (
    <section className="min-w-0 space-y-3" aria-labelledby="part-missing-title" data-testid="part-missing">
      <h2 id="part-missing-title" className="text-lg font-semibold">
        {t('onboardingPlan.part.missing.title')}
      </h2>
      <ul className="space-y-2" role="list" data-testid="part-missing-list">
        {items.map((item) => {
          const known = names.get(item.propertyId);
          const name = known?.name || t('onboardingPlan.part.missing.unnamed');
          const launch = resolveLaunchTarget(target, null, item.propertyId, hasPermission, undefined, flags);
          return (
            <li key={item.propertyId} className="min-w-0 space-y-2 rounded-md border p-3" data-testid={`part-missing-${item.propertyId}`} data-reason={item.reason}>
              <div className="min-w-0">
                <p className="break-words font-medium">{name}</p>
                {known?.city ? <p className="break-words text-sm text-foreground/70">{known.city}</p> : null}
              </div>
              <p className="break-words text-sm" data-testid={`part-missing-${item.propertyId}-reason`}>
                {t(missingReasonKey(item.reason))}
              </p>
              {launch ? (
                <Button asChild size="sm" className={TOUCH_TARGET}>
                  <Link to={launch.to} aria-label={`${t('onboardingPlan.actions.doNow')}: ${name}`} data-testid={`part-missing-${item.propertyId}-do`}>
                    {t('onboardingPlan.actions.doNow')}
                  </Link>
                </Button>
              ) : (
                <span className="text-sm text-foreground/70" data-testid={`part-missing-${item.propertyId}-unavailable`}>
                  {t('onboardingPlan.launch.unavailable.title')}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {more > 0 ? (
        <p className="text-sm text-foreground/70" data-testid="part-missing-more">
          {t('onboardingPlan.part.missing.more', { count: more })}
        </p>
      ) : null}
    </section>
  );
}
