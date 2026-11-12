import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useWorkspace } from '@/hooks/use-workspace';
import { flowNameKey, flowReasonKey, normalizeFlowState, reasonOf } from '@/lib/onboarding-flows';
import { launchTargetForAction, resolveLaunchTarget } from '@/lib/onboarding-part-launch';
import { cn } from '@/lib/utils';
import { useFlowMatrix, useFlowProperties, useFlowSummaries } from '@/queries/use-onboarding-flows';
import {
  ONBOARDING_FLOW_KEYS,
  ONBOARDING_FLOW_STATES,
  type FlowPropertyStatus,
  type OnboardingFlowKey,
  type OnboardingFlowState,
} from '@/types/onboarding.types';
import { FlowStateBadge } from './flow-state-badge';

const PAGE_SIZE = 20;

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

interface FlowCellProps {
  status: FlowPropertyStatus | undefined;
  flow: OnboardingFlowKey;
}

/**
 * One flow on one property: the state with a tint, an icon and words (UX-09), the reason in plain words when it is not active, and, when something the
 * host does fixes it, «Fai ora»: the action code of the status becomes a launch target resolved against the manifest with the property (a page that is
 * not registered shows «Non ancora disponibile», never a dead link). «Non disponibile» says why (for example the content is managed on the channel).
 */
function FlowCell({ status, flow }: FlowCellProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  if (!status) return <span className="text-sm text-foreground/70">{t('onboardingPlan.summary.table.noData')}</span>;

  const state = normalizeFlowState(status.state);
  const reason = reasonOf(status);
  const action = state === 'toComplete' ? launchTargetForAction(status.action) : null;
  const launch = action ? resolveLaunchTarget(action.target, action.focus, status.propertyId, hasPermission) : null;

  return (
    <div className="min-w-0 space-y-1.5" data-testid={`flow-cell-${status.propertyId}-${flow}`} data-state={state}>
      <FlowStateBadge state={state} />
      {reason ? <p className="break-words text-sm">{t(flowReasonKey(reason))}</p> : null}
      {action ? (
        launch ? (
          <Button asChild size="sm" className={TOUCH_TARGET}>
            <Link to={launch.to} aria-label={`${t('onboardingPlan.actions.doNow')}: ${status.name} · ${t(flowNameKey(flow))}`} data-testid={`flow-cell-${status.propertyId}-${flow}-do`}>
              {t('onboardingPlan.actions.doNow')}
            </Link>
          </Button>
        ) : (
          <span className="block text-sm text-foreground/70" data-testid={`flow-cell-${status.propertyId}-${flow}-unavailable`}>
            {t('onboardingPlan.launch.unavailable.title')}
          </span>
        )
      ) : null}
    </div>
  );
}

interface FlowStatusTableProps {
  /** A flow to start on (the target of the «Da fare» of a flow): the table opens on that flow's properties that are still to complete. */
  initialFlow?: OnboardingFlowKey | null;
}

/**
 * The traffic light of the activation (E10/F03/US02/T03, NF-104 part 11, NF-106, UX-09): a strip with the counts of each flow, and a table with the
 * properties as rows and the six flows as columns, a page of them at a time and found by name, so 250 properties never load at once. Each cell says
 * where the flow stands on the property in colour, icon and words. The strip and two filters (a flow, and a state of that flow) narrow it down to the
 * properties of one flow, which is what the «Da fare» of a flow opens on. Everyone who can read the properties reads it.
 */
export function FlowStatusTable({ initialFlow = null }: FlowStatusTableProps) {
  const { t } = useTranslation();
  const [flow, setFlow] = useState<OnboardingFlowKey | 'all'>(initialFlow ?? 'all');
  const [state, setState] = useState<OnboardingFlowState | 'all'>(initialFlow ? 'toComplete' : 'all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebouncedValue(search.trim(), 300);
  const summaries = useFlowSummaries();

  // One flow (and, if asked, one of its states): that flow's own list. All the flows: the same page of each, side by side.
  const single = flow !== 'all';
  const params = { page, pageSize: PAGE_SIZE, search: term || undefined };
  const matrix = useFlowMatrix(params, { enabled: !single });
  const one = useFlowProperties(single ? flow : undefined, { ...params, state: state === 'all' ? undefined : state });

  const base = single ? one : matrix[0];
  const total = base?.data?.totalCount ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const shown: readonly OnboardingFlowKey[] = single ? [flow] : ONBOARDING_FLOW_KEYS;
  const lists: Partial<Record<OnboardingFlowKey, FlowPropertyStatus[]>> = {};
  if (single) lists[flow] = one.data?.items;
  else ONBOARDING_FLOW_KEYS.forEach((key, index) => (lists[key] = matrix[index]?.data?.items));
  const rows = base?.data?.items ?? [];
  const statusOf = (key: OnboardingFlowKey, propertyId: string) => lists[key]?.find((candidate) => candidate.propertyId === propertyId);

  const choose = (next: OnboardingFlowKey | 'all') => {
    setFlow(next);
    setState('all');
    setPage(1);
  };

  let body;
  if (!base || base.isPending) {
    body = (
      <div role="status" aria-busy="true" className="space-y-2" data-testid="flow-table-loading">
        <span className="sr-only">{t('onboardingPlan.summary.table.loading')}</span>
        <Skeleton className="h-16 w-full rounded-md motion-reduce:animate-none" aria-hidden="true" />
        <Skeleton className="h-16 w-full rounded-md motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (base.isError && !base.data) {
    body = <ErrorState testId="flow-table-error" title={t('onboardingPlan.summary.table.loadError')} error={base.error} onRetry={() => void base.refetch()} />;
  } else if (rows.length === 0) {
    body = (
      <p className="text-sm text-foreground/70" data-testid="flow-table-empty">
        {t(term || state !== 'all' ? 'onboardingPlan.summary.table.noMatch' : 'onboardingPlan.summary.table.empty')}
      </p>
    );
  } else {
    body = (
      <div className="min-w-0 overflow-x-auto rounded-md border" data-testid="flow-table-scroll">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm" data-testid="flow-table">
          <caption className="sr-only">{t('onboardingPlan.summary.table.caption')}</caption>
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                {t('onboardingPlan.summary.table.property')}
              </th>
              {shown.map((key) => (
                <th key={key} scope="col" className="px-3 py-2 font-semibold" data-testid={`flow-column-${key}`}>
                  {t(flowNameKey(key))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.propertyId} className="border-t align-top" data-testid={`flow-row-${row.propertyId}`}>
                <th scope="row" className="min-w-40 px-3 py-3 font-medium">
                  <span className="block break-words">{row.name}</span>
                  {row.city ? <span className="block break-words text-sm font-normal text-foreground/70">{row.city}</span> : null}
                </th>
                {shown.map((key) => (
                  <td key={key} className="min-w-44 px-3 py-3">
                    <FlowCell status={statusOf(key, row.propertyId)} flow={key} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-4" aria-label={t('onboardingPlan.summary.table.title')} data-testid="flow-status-table">
      <h2 className="text-lg font-semibold">{t('onboardingPlan.summary.table.title')}</h2>

      {/* The counts of each flow: a button each, which narrows the table to that flow. */}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label={t('onboardingPlan.summary.strip.label')} data-testid="flow-strip">
        {ONBOARDING_FLOW_KEYS.map((key) => {
          const counts = summaries.data?.find((candidate) => candidate.flow === key);
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={flow === key}
                onClick={() => choose(flow === key ? 'all' : key)}
                className={cn(
                  'flex min-h-11 w-full min-w-0 flex-col items-start gap-0.5 rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  flow === key && 'border-primary/40 bg-primary/5',
                )}
                data-testid={`flow-strip-${key}`}
              >
                <span className="break-words font-semibold">{t(flowNameKey(key))}</span>
                <span className="break-words text-foreground/70" data-testid={`flow-strip-${key}-counts`}>
                  {counts
                    ? t('onboardingPlan.summary.strip.counts', { active: counts.active, toComplete: counts.toComplete, notAvailable: counts.notAvailable })
                    : t('onboardingPlan.summary.strip.noCounts')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 space-y-1 text-sm font-medium">
          <span>{t('onboardingPlan.summary.filters.search')}</span>
          <Input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            data-testid="flow-search"
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>{t('onboardingPlan.summary.filters.flow')}</span>
          <select
            className="block h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={flow}
            onChange={(event) => choose(event.target.value as OnboardingFlowKey | 'all')}
            data-testid="flow-filter-flow"
          >
            <option value="all">{t('onboardingPlan.summary.filters.allFlows')}</option>
            {ONBOARDING_FLOW_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(flowNameKey(key))}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>{t('onboardingPlan.summary.filters.state')}</span>
          <select
            className="block h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
            value={state}
            disabled={!single}
            onChange={(event) => {
              setState(event.target.value as OnboardingFlowState | 'all');
              setPage(1);
            }}
            data-testid="flow-filter-state"
          >
            <option value="all">{t('onboardingPlan.summary.filters.allStates')}</option>
            {ONBOARDING_FLOW_STATES.map((key) => (
              <option key={key} value={key}>
                {t(`onboardingPlan.flows.states.${key}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {body}

      {base?.data && total > PAGE_SIZE ? (
        <nav className="flex flex-wrap items-center justify-between gap-2" aria-label={t('onboardingPlan.launch.properties.pages')} data-testid="flow-table-pages">
          <Button type="button" variant="outline" size="sm" className={TOUCH_TARGET} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} data-testid="flow-table-prev">
            {t('onboardingPlan.launch.properties.previous')}
          </Button>
          <span className="text-sm text-foreground/70" aria-live="polite">
            {t('onboardingPlan.launch.properties.page', { page, pages, total })}
          </span>
          <Button type="button" variant="outline" size="sm" className={TOUCH_TARGET} disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))} data-testid="flow-table-next">
            {t('onboardingPlan.launch.properties.next')}
          </Button>
        </nav>
      ) : null}
    </section>
  );
}
