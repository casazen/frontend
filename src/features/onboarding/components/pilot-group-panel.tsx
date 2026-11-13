import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { BULK_PAGE_SIZE, pageOf } from '@/lib/onboarding-bulk';
import { flowNameKey, prerequisiteKey } from '@/lib/onboarding-flows';
import { useBulkActivate, usePilotGroup, useSetPilotGroup } from '@/queries/use-onboarding-bulk';
import { SHORT_PROPERTIES_OVERVIEW, useProperties } from '@/queries/use-properties';
import { ONBOARDING_FLOW_KEYS, type BulkActivateResult, type BulkCohort, type OnboardingFlowKey } from '@/types/onboarding.types';
import { ClientPager } from './client-pager';

/** At least 44 px high on every device, and a long label wraps instead of pushing the page sideways. */
const TOUCH_TARGET = 'h-auto min-h-11 whitespace-normal py-2 text-center leading-tight';

/** A property of the host as the picker needs it. */
interface Candidate {
  id: string;
  name: string;
  city: string;
}

/** Lower case and no accents, so that «perugia» finds «Perugia» and «citta» finds «Città». */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** True when both lists hold the same ids (the order does not matter). */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** The flows named in words, for the confirmation («Annunci sui canali, Messaggi»). */
function flowNames(flows: readonly OnboardingFlowKey[], t: TFunction): string {
  return flows.map((flow) => t(flowNameKey(flow))).join(', ');
}

interface ActivationReportProps {
  result: BulkActivateResult;
  nameOf: (propertyId: string) => string;
}

/**
 * What the activation of a cohort did, flow by flow, in counts, and then the properties that were NOT switched on with what each one still lacks (a page of 50 at a
 * time): a cohort of 250 properties is never drawn whole. Told as done only when nothing was left out; a part, or nothing, is told as such, and as a warning.
 */
function ActivationReport({ result, nameOf }: ActivationReportProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const flows = (Array.isArray(result.flows) ? result.flows : []).filter((flow) => ONBOARDING_FLOW_KEYS.includes(flow.flow));
  const outcomes = flows.flatMap((flow) => (Array.isArray(flow.outcomes) ? flow.outcomes : []).map((outcome) => ({ flow: flow.flow, outcome })));
  const activated = outcomes.filter((item) => item.outcome.outcome === 'activated').length;
  const left = outcomes.filter((item) => item.outcome.outcome !== 'activated' && item.outcome.outcome !== 'alreadyActive');
  const complete = activated > 0 && left.length === 0;
  const shown = pageOf(left, page);

  return (
    <div className="space-y-3" aria-live="polite" data-testid="pilot-report">
      <p
        className={complete ? 'font-medium text-success-foreground' : 'font-medium text-warning-foreground'}
        role={complete ? 'status' : 'alert'}
        data-testid="pilot-report-summary"
        data-complete={complete ? 'true' : 'false'}
      >
        {t(complete ? 'onboardingPlan.bulk.pilot.reportAll' : activated > 0 ? 'onboardingPlan.bulk.pilot.reportPartly' : 'onboardingPlan.bulk.pilot.reportNone')}
      </p>
      <ul role="list" className="space-y-0.5 text-sm" data-testid="pilot-report-flows">
        {flows.map((flow) => {
          const list = Array.isArray(flow.outcomes) ? flow.outcomes : [];
          return (
            <li key={flow.flow} className="break-words" data-testid={`pilot-report-flow-${flow.flow}`}>
              <span className="font-medium">{t(flowNameKey(flow.flow))}</span>
              {': '}
              {t('onboardingPlan.bulk.pilot.flowCounts', {
                activated: list.filter((outcome) => outcome.outcome === 'activated').length,
                already: list.filter((outcome) => outcome.outcome === 'alreadyActive').length,
                left: list.filter((outcome) => outcome.outcome !== 'activated' && outcome.outcome !== 'alreadyActive').length,
              })}
            </li>
          );
        })}
      </ul>
      {left.length > 0 ? (
        <div className="space-y-2" data-testid="pilot-report-left">
          <p className="text-sm font-medium">{t('onboardingPlan.bulk.pilot.leftTitle')}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <caption className="sr-only">{t('onboardingPlan.bulk.pilot.leftCaption')}</caption>
              <thead>
                <tr className="border-b text-foreground/70">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    {t('onboardingPlan.bulk.selection.property')}
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    {t('onboardingPlan.bulk.progress.flow')}
                  </th>
                  <th scope="col" className="py-2 pl-2 font-medium">
                    {t('onboardingPlan.bulk.pilot.lacks')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((item) => {
                  const unmet = Array.isArray(item.outcome.unmetPrerequisites) ? item.outcome.unmetPrerequisites : [];
                  return (
                    <tr key={`${item.flow}-${item.outcome.propertyId}`} className="border-b align-top last:border-b-0" data-testid={`pilot-left-${item.flow}-${item.outcome.propertyId}`}>
                      <td className="min-w-0 break-words py-2 pr-3 font-medium">{nameOf(item.outcome.propertyId)}</td>
                      <td className="px-2 py-2">{t(flowNameKey(item.flow))}</td>
                      <td className="min-w-0 break-words py-2 pl-2">
                        {item.outcome.outcome === 'prerequisitesNotMet' && unmet.length > 0
                          ? Array.from(new Set(unmet.map((key) => t(prerequisiteKey(key))))).join(', ')
                          : t(`onboardingPlan.bulk.pilot.outcomes.${item.outcome.outcome === 'notAvailable' || item.outcome.outcome === 'notFound' ? item.outcome.outcome : 'unknown'}`)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ClientPager page={shown.page} pages={shown.pages} total={left.length} onPage={setPage} testId="pilot-left-pager" />
        </div>
      ) : null}
    </div>
  );
}

interface PilotGroupPanelProps {
  /** How many properties the agency has (the progress of the page): to say how many «the others» are. `null` while it is not known. */
  totalProperties: number | null;
  /** Whether the person may read the properties (`property.read`): without it the list to pick from is not asked for (the server would answer 403). */
  canReadProperties: boolean;
}

/**
 * The pilot group (E10/F03/US03/T02, NF-105, decision H10): 5 to 10 properties are activated first, and only when they run are the others (AC-NF105-4). The host
 * picks them from their properties by name (a search and a list of 50 at a time: 250 properties are never drawn whole), «Consigliamo da 5 a 10» is a hint that
 * does not block (the server refuses an empty group and one above the maximum, and says why), and «Salva il gruppo» stores it.
 *
 * Nothing is ticked at the start: the flows to activate are chosen by the person (an empty choice is never «all the flows»). «Attiva il gruppo pilota» activates
 * them on the members of the SAVED group, after a confirmation; «Attiva le altre strutture» stays off, saying «Prima attiva il gruppo pilota», until the pilot is
 * active in every flow chosen, and then reports the properties whose prerequisites are not met. A press sends once, and every button of the card is off while a
 * request of the card is on its way. The server decides (it verifies the prerequisites of each property again and refuses the others while the pilot is not
 * active: 409 `pilot_group_not_active`).
 */
export function PilotGroupPanel({ totalProperties, canReadProperties }: PilotGroupPanelProps) {
  const { t } = useTranslation();
  const ids = useId();
  const inFlight = useRef(false);
  const pilot = usePilotGroup();
  const properties = useProperties(SHORT_PROPERTIES_OVERVIEW, { enabled: canReadProperties });
  const save = useSetPilotGroup();
  const activate = useBulkActivate();
  const [edited, setEdited] = useState<string[] | null>(null);
  const [search, setSearch] = useState('');
  const [flows, setFlows] = useState<OnboardingFlowKey[]>([]);
  const [confirm, setConfirm] = useState<BulkCohort | null>(null);
  const [report, setReport] = useState<BulkActivateResult | null>(null);
  const [uncertain, setUncertain] = useState(false);

  const members = useMemo(() => (Array.isArray(pilot.data?.members) ? pilot.data.members : []), [pilot.data]);
  const savedIds = useMemo(() => members.map((member) => member.propertyId), [members]);
  const chosen = edited ?? savedIds;
  const dirty = edited !== null && !sameSet(edited, savedIds);

  // Every property of the host has a name for the report (the server may name one the picker does not offer); only the active ones are offered.
  const everyProperty = useMemo<Candidate[]>(() => {
    const list = Array.isArray(properties.data) ? properties.data : [];
    return list.map((property) => ({ id: property.id, name: property.name, city: property.city }));
  }, [properties.data]);
  const candidates = useMemo<Candidate[]>(() => {
    const list = Array.isArray(properties.data) ? properties.data : [];
    return list.filter((property) => property.isActive !== false).map((property) => ({ id: property.id, name: property.name, city: property.city }));
  }, [properties.data]);
  const names = useMemo(() => {
    const byId = new Map<string, Candidate>(everyProperty.map((candidate) => [candidate.id, candidate]));
    for (const member of members) if (!byId.has(member.propertyId)) byId.set(member.propertyId, { id: member.propertyId, name: member.name, city: member.city });
    return byId;
  }, [everyProperty, members]);
  const nameOf = (propertyId: string) => names.get(propertyId)?.name ?? propertyId.slice(0, 8);

  const matching = useMemo(() => {
    const needle = fold(search.trim());
    return candidates.filter((candidate) => needle === '' || fold(`${candidate.name} ${candidate.city}`).includes(needle));
  }, [candidates, search]);

  const maxSize = pilot.data?.maxSize ?? 10;
  const recommendedMin = pilot.data?.recommendedMin ?? 5;
  const flowsOfPilot = Array.isArray(pilot.data?.flows) ? pilot.data.flows : [];
  const pilotActive = flows.length > 0 && flows.every((flow) => flowsOfPilot.some((state) => state.flow === flow && state.isActive === true));
  const busy = save.isPending || activate.isPending;
  const others = totalProperties !== null ? Math.max(0, totalProperties - savedIds.length) : null;

  const notFound = pilot.isError && getHttpStatus(pilot.error) === 404;
  const failed = pilot.isError && (!pilot.data || notFound);

  function toggleProperty(id: string) {
    setEdited(chosen.includes(id) ? chosen.filter((candidate) => candidate !== id) : [...chosen, id]);
  }

  function toggleFlow(flow: OnboardingFlowKey) {
    setFlows((previous) => (previous.includes(flow) ? previous.filter((candidate) => candidate !== flow) : [...previous, flow]));
  }

  function savePilot() {
    if (chosen.length === 0) return;
    setReport(null);
    save.mutate(chosen, { onSuccess: () => setEdited(null) });
  }

  async function activateNow() {
    // A press sends once: a second press while the call is on its way (or before the page has drawn that it is) does nothing.
    if (inFlight.current || confirm === null || flows.length === 0) return;
    inFlight.current = true;
    setUncertain(false);
    try {
      setReport(await activate.mutateAsync({ cohort: confirm, flows }));
    } catch (error) {
      // A refusal of the server (the pilot is not active, the group is not set) is said as it is; any other failure may have done a part: say so.
      const status = getHttpStatus(error);
      setReport(null);
      setUncertain(status === undefined || status >= 500);
    } finally {
      inFlight.current = false;
      setConfirm(null);
    }
  }

  let body;
  if (pilot.isLoading) {
    body = (
      <div role="status" aria-busy="true" className="space-y-2" data-testid="pilot-loading">
        <span className="sr-only">{t('onboardingPlan.bulk.pilot.loading')}</span>
        <Skeleton className="h-16 w-full motion-reduce:animate-none" aria-hidden="true" />
      </div>
    );
  } else if (failed || !pilot.data) {
    body = notFound ? (
      <ErrorState testId="pilot-error" title={t('onboardingPlan.bulk.pilot.notFound')} />
    ) : (
      <ErrorState testId="pilot-error" title={t('onboardingPlan.bulk.pilot.loadError')} error={pilot.error} onRetry={() => void pilot.refetch()} showSupport />
    );
  } else {
    const flowChoice = (
      <fieldset className="min-w-0 space-y-1" disabled={busy} data-testid="pilot-flows">
        <legend className="text-sm font-semibold">{t('onboardingPlan.bulk.pilot.flows')}</legend>
        {ONBOARDING_FLOW_KEYS.map((flow) => (
          <label key={flow} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 shrink-0" checked={flows.includes(flow)} onChange={() => toggleFlow(flow)} data-testid={`pilot-flow-${flow}`} />
            {t(flowNameKey(flow))}
          </label>
        ))}
      </fieldset>
    );

    body = (
      <>
        <div className="space-y-2" data-testid="pilot-picker">
          <p className="text-sm font-medium" data-testid="pilot-count">
            {t('onboardingPlan.bulk.pilot.count', { count: chosen.length, max: maxSize })}
          </p>
          {chosen.length < recommendedMin ? (
            <p className="text-sm text-foreground/70" data-testid="pilot-hint">
              {t('onboardingPlan.bulk.pilot.hint', { min: recommendedMin, max: maxSize })}
            </p>
          ) : null}
          {chosen.length > maxSize ? (
            <p role="alert" className="text-sm text-warning-foreground" data-testid="pilot-too-many">
              {t('onboardingPlan.bulk.pilot.tooMany', { max: maxSize })}
            </p>
          ) : null}
          {chosen.length > 0 ? (
            <ul role="list" className="flex flex-wrap gap-2" data-testid="pilot-chosen">
              {chosen.map((id) => (
                <li key={id} className="flex min-w-0 items-center gap-1 rounded-full bg-muted py-0.5 pl-3 pr-1 text-sm">
                  <span className="min-w-0 break-words">{nameOf(id)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto min-h-11 px-2"
                    disabled={busy}
                    aria-label={t('onboardingPlan.bulk.pilot.remove', { name: nameOf(id) })}
                    onClick={() => toggleProperty(id)}
                    data-testid={`pilot-remove-${id}`}
                  >
                    {t('onboardingPlan.bulk.pilot.removeShort')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor={`${ids}-search`}>{t('onboardingPlan.bulk.pilot.search')}</Label>
            <Input id={`${ids}-search`} value={search} disabled={busy} onChange={(event) => setSearch(event.target.value)} data-testid="pilot-search" />
          </div>
          {!canReadProperties ? (
            <p className="text-sm text-foreground/70" data-testid="pilot-needs-read">
              {t('onboardingPlan.bulk.pilot.needsRead')}
            </p>
          ) : properties.isLoading ? (
            <Skeleton className="h-16 w-full motion-reduce:animate-none" aria-hidden="true" />
          ) : properties.isError ? (
            <p role="alert" className="text-sm text-danger-foreground" data-testid="pilot-properties-error">
              {t('onboardingPlan.bulk.pilot.propertiesError')}
            </p>
          ) : matching.length === 0 ? (
            <p className="text-sm text-foreground/70" data-testid="pilot-no-match">
              {t('onboardingPlan.bulk.pilot.noMatch')}
            </p>
          ) : (
            <>
              <ul role="list" className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border p-2" data-testid="pilot-candidates">
                {matching.slice(0, BULK_PAGE_SIZE).map((candidate) => (
                  <li key={candidate.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="size-5 shrink-0" disabled={busy} checked={chosen.includes(candidate.id)} onChange={() => toggleProperty(candidate.id)} data-testid={`pilot-candidate-${candidate.id}`} />
                      <span className="min-w-0 break-words">
                        {candidate.name}
                        {candidate.city ? <span className="text-foreground/70">{` · ${candidate.city}`}</span> : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {matching.length > BULK_PAGE_SIZE ? <p className="text-sm text-foreground/70">{t('onboardingPlan.bulk.pilot.narrow', { count: matching.length - BULK_PAGE_SIZE })}</p> : null}
            </>
          )}
          <Button type="button" className={TOUCH_TARGET} disabled={chosen.length === 0 || !dirty || busy} loading={save.isPending} onClick={savePilot} data-testid="pilot-save">
            {t('onboardingPlan.bulk.pilot.save')}
          </Button>
          {save.isError ? (
            <p role="alert" className="text-sm text-danger-foreground" data-testid="pilot-save-error">
              {getProblemMessage(save.error, t) ?? t('onboardingPlan.bulk.pilot.saveError')}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 border-t pt-4" data-testid="pilot-activation">
          <h3 className="text-base font-semibold">{t('onboardingPlan.bulk.pilot.activationTitle')}</h3>
          {flowChoice}
          {dirty ? (
            <p className="text-sm text-foreground/70" data-testid="pilot-save-first">
              {t('onboardingPlan.bulk.pilot.saveFirst')}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={TOUCH_TARGET}
              disabled={savedIds.length === 0 || flows.length === 0 || dirty || busy}
              loading={activate.isPending && confirm === 'pilot'}
              onClick={() => setConfirm('pilot')}
              data-testid="pilot-activate"
            >
              {t('onboardingPlan.bulk.pilot.activatePilot')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={TOUCH_TARGET}
              disabled={!pilotActive || dirty || busy}
              loading={activate.isPending && confirm === 'rest'}
              aria-describedby={!pilotActive ? `${ids}-rest-note` : undefined}
              onClick={() => setConfirm('rest')}
              data-testid="pilot-activate-rest"
            >
              {t('onboardingPlan.bulk.pilot.activateRest')}
            </Button>
          </div>
          {!pilotActive ? (
            <p id={`${ids}-rest-note`} className="text-sm text-foreground/70" data-testid="pilot-rest-note">
              {t('onboardingPlan.bulk.pilot.restNote')}
            </p>
          ) : null}
          {activate.isError && !uncertain ? (
            <p role="alert" className="text-sm text-danger-foreground" data-testid="pilot-activate-error">
              {getProblemMessage(activate.error, t) ?? t('onboardingPlan.bulk.pilot.activateError')}
            </p>
          ) : null}
          {uncertain ? (
            <p role="alert" className="rounded-md border border-danger-border bg-danger-soft p-3 text-sm text-danger-foreground" data-testid="pilot-uncertain">
              {t('onboardingPlan.bulk.pilot.uncertain')}
            </p>
          ) : null}
          {report ? <ActivationReport result={report} nameOf={nameOf} /> : null}
        </div>
      </>
    );
  }

  return (
    <section aria-labelledby={`${ids}-title`} className="min-w-0 space-y-4 rounded-lg border bg-card p-4" data-testid="pilot-group">
      <div className="space-y-1">
        <h2 id={`${ids}-title`} className="text-lg font-semibold">
          {t('onboardingPlan.bulk.pilot.title')}
        </h2>
        <p className="text-sm text-foreground/70">{t('onboardingPlan.bulk.pilot.description')}</p>
      </div>
      {body}

      <ConfirmationDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          // A press on «Annulla», on the outside or a focus that leaves the dialog while the call is on its way does not drop it (the ref, not the state: the
          // handler may be the one of the render before the call started): the dialog closes when the answer is in.
          if (!open && !inFlight.current) setConfirm(null);
        }}
        title={t(confirm === 'rest' ? 'onboardingPlan.bulk.pilot.confirmRestTitle' : 'onboardingPlan.bulk.pilot.confirmPilotTitle')}
        description={
          confirm === 'rest'
            ? t('onboardingPlan.bulk.pilot.confirmRestDescription', { flows: flowNames(flows, t), count: others ?? 0 })
            : t('onboardingPlan.bulk.pilot.confirmPilotDescription', { flows: flowNames(flows, t), count: savedIds.length })
        }
        confirmLabel={t(confirm === 'rest' ? 'onboardingPlan.bulk.pilot.activateRest' : 'onboardingPlan.bulk.pilot.activatePilot')}
        isLoading={activate.isPending}
        onConfirm={activateNow}
        consequences={[t('onboardingPlan.bulk.pilot.confirmNotReady')]}
      />
    </section>
  );
}
