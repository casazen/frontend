import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useWorkspace } from '@/hooks/use-workspace';
import { flowNameKey, flowReasonKey, reasonOf, normalizeFlowState } from '@/lib/onboarding-flows';
import { launchTargetForAction, resolveLaunchTarget } from '@/lib/onboarding-part-launch';
import { panelStepPath } from '@/lib/onboarding-panel';
import { useFlowProperties } from '@/queries/use-onboarding-flows';
import type { OnboardingFlowKey, OnboardingLaunchTarget } from '@/types/onboarding.types';
import { FlowStateBadge } from './flow-state-badge';

const PAGE_SIZE = 20;

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface PartPropertyTableProps {
  flow: OnboardingFlowKey;
  /** What the part itself launches: the page a row opens when the server names no action for it. */
  target: OnboardingLaunchTarget;
  /** The compliance part: each property also has the guided steps of the police and ISTAT connections. */
  panelSteps?: boolean;
  /** Police and ISTAT default to «Fallo per me»: the host who has new properties has CasaZen support do them (PO-19). */
  assistFirst?: boolean;
}

/**
 * The properties a part is about, with where each one stands (E10/F03/US02/T02, NF-104, NF-106): a page of them at a time, found by name, each with its
 * state (an icon and a word), the unmet prerequisite in plain words and «Fai ora», which opens the page that does it for THAT property (the launch
 * registry resolves the action the server names, or the part's own page, against the manifest: no page, no button). The compliance part adds the
 * guided steps of the police and ISTAT for each property. 250 properties never load at once.
 */
export function PartPropertyTable({ flow, target, panelSteps = false, assistFirst = false }: PartPropertyTableProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 300);
  const query = useFlowProperties(flow, { page, pageSize: PAGE_SIZE, search: term || undefined });

  const total = query.data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  let body;
  if (query.isPending) {
    body = (
      <div role="status" aria-busy="true" className="space-y-2" data-testid="part-properties-loading">
        <span className="sr-only">{t('onboardingPlan.launch.properties.loading')}</span>
        <Skeleton className="h-14 w-full rounded-md motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-14 w-full rounded-md motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (query.isError && !query.data) {
    body = (
      <ErrorState
        testId="part-properties-error"
        title={t('onboardingPlan.launch.properties.loadError')}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (query.data && query.data.items.length === 0) {
    body = (
      <p className="text-sm text-foreground/70" data-testid="part-properties-empty">
        {t(term ? 'onboardingPlan.launch.properties.noMatch' : 'onboardingPlan.launch.properties.empty')}
      </p>
    );
  } else if (query.data) {
    body = (
      <ul className="space-y-2" role="list" data-testid="part-properties-list">
        {query.data.items.map((row) => {
          const action = launchTargetForAction(row.action);
          const launch = resolveLaunchTarget(action?.target ?? target, action?.focus, row.propertyId, hasPermission);
          const state = normalizeFlowState(row.state);
          const reason = reasonOf(row);
          return (
            <li key={row.propertyId} className="min-w-0 space-y-2 rounded-md border p-3" data-testid={`part-property-${row.propertyId}`} data-state={state}>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-medium">{row.name}</p>
                  {row.city ? <p className="break-words text-sm text-foreground/70">{row.city}</p> : null}
                </div>
                <FlowStateBadge state={state} />
              </div>
              {reason ? (
                <p className="break-words text-sm" data-testid={`part-property-${row.propertyId}-reason`}>
                  {t(flowReasonKey(reason))}
                </p>
              ) : null}
              {state !== 'active' && state !== 'notAvailable' ? (
                <div className="flex flex-wrap gap-2">
                  {launch ? (
                    <Button asChild size="sm" className={TOUCH_TARGET}>
                      <Link to={launch.to} aria-label={`${t('onboardingPlan.actions.doNow')}: ${row.name}`} data-testid={`part-property-${row.propertyId}-do`}>
                        {t('onboardingPlan.actions.doNow')}
                      </Link>
                    </Button>
                  ) : (
                    <span className="text-sm text-foreground/70" data-testid={`part-property-${row.propertyId}-unavailable`}>
                      {t('onboardingPlan.launch.unavailable.title')}
                    </span>
                  )}
                  {panelSteps ? (
                    <>
                      <Button asChild size="sm" variant="outline" className={TOUCH_TARGET}>
                        <Link to={panelStepPath({ kind: 'policeConnection', propertyId: row.propertyId, assist: assistFirst })} data-testid={`part-property-${row.propertyId}-police`}>
                          {t('onboardingPlan.launch.properties.police')}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className={TOUCH_TARGET}>
                        <Link to={panelStepPath({ kind: 'istatConnection', propertyId: row.propertyId, assist: assistFirst })} data-testid={`part-property-${row.propertyId}-istat`}>
                          {t('onboardingPlan.launch.properties.istat')}
                        </Link>
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section className="min-w-0 space-y-3" aria-label={t('onboardingPlan.launch.properties.title', { flow: t(flowNameKey(flow)) })} data-testid="part-property-table">
      <h2 className="text-lg font-semibold">{t('onboardingPlan.launch.properties.title', { flow: t(flowNameKey(flow)) })}</h2>
      <Input
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        aria-label={t('onboardingPlan.launch.properties.search')}
        placeholder={t('onboardingPlan.launch.properties.search')}
        data-testid="part-properties-search"
      />
      {body}
      {query.data && total > PAGE_SIZE ? (
        <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={t('onboardingPlan.launch.properties.pages')} data-testid="part-properties-pages">
          <Button type="button" variant="outline" size="sm" className={TOUCH_TARGET} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} data-testid="part-properties-prev">
            {t('onboardingPlan.launch.properties.previous')}
          </Button>
          <span className="text-sm text-foreground/70" aria-live="polite">
            {t('onboardingPlan.launch.properties.page', { page, pages, total })}
          </span>
          <Button type="button" variant="outline" size="sm" className={TOUCH_TARGET} disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))} data-testid="part-properties-next">
            {t('onboardingPlan.launch.properties.next')}
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
