import { useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Clock, FlaskConical, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_COLUMNS } from '@/components/layout/page-columns';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { RoutineEditor } from '@/components/routines/RoutineEditor';
import { RoutineSimulation } from '@/components/routines/RoutineSimulation';
import { RoutineLibrary } from '@/components/routines/RoutineLibrary';
import { BulkCleaningDialog } from '@/features/properties/components/bulk-cleaning-dialog';
import { getHttpStatus } from '@/lib/api-errors';
import { routineTrigger } from '@/lib/routine-trigger';
import { describeRoutineError } from '@/lib/routine-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import {
  ACTION_OUTCOME_KEYS,
  actionLabelKey,
  actionReasonKey,
  executionCodeKey,
  executionHeadline,
  parseActions,
  parseExecutionResult,
  parseEventConfig,
  toAvailability,
  unavailableActionTypes,
  utcInstant,
  type ActionAvailability,
} from '@/lib/routine-model';
import {
  useCreateRoutine,
  useDeleteRoutine,
  useRoutineActions,
  useRoutineExecutions,
  useRoutineIdsBeingWritten,
  useRoutines,
  useSetRoutineActive,
  useSetRoutineTestMode,
  useUpdateRoutine,
} from '@/queries/routines';
import type { CreateRoutineDto, Routine, RoutineAction, RoutineExecution, RoutineLibraryTemplate, UpdateRoutineDto } from '@/types';

interface LiveConfirmation {
  name: string;
  trigger: string;
  objective?: string | null;
  actions: RoutineAction[];
  commit: () => Promise<unknown>;
}

type RoutineFilter = 'all' | 'active' | 'test' | 'inactive';

/** The log of a routine shows at most this many lines: the newest 50, which is what the server sends on a page (`RoutineLimits.DefaultExecutionsPageSize`). */
const EXECUTIONS_PAGE_SIZE = 50;

export function RoutinesPage() {
  const { t } = useTranslation();
  const { data: routines, isLoading, isError, error, refetch } = useRoutines();
  const catalog = useRoutineActions();
  const availability = useMemo(() => toAvailability(catalog.data), [catalog.data]);
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const setActive = useSetRoutineActive();
  const setTestMode = useSetRoutineTestMode();

  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const view = params.get('view');
  const libraryOpen = view === 'library';
  const [editorOpen, setEditorOpen] = useState(view === 'create');
  const [entry, setEntry] = useState({ key: location.key, view });
  const [template, setTemplate] = useState<RoutineLibraryTemplate>();
  const [simulation, setSimulation] = useState<Routine>();
  const setLibraryOpen = (open: boolean) => setParams(current => {
    const next = new URLSearchParams(current);
    if (open) next.set('view', 'library');
    else next.delete('view');
    return next;
  }, { replace: true });
  // The layer that says who cleans for many properties at once (the ready cleaning routine acts on the properties that have a cleaner), over the library.
  const [cleanersOpen, setCleanersOpen] = useState(false);
  const [logRoutineId, setLogRoutineId] = useState<string | undefined>();
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | undefined>();
  const [routineToDelete, setRoutineToDelete] = useState<Routine | undefined>();
  const [liveChange, setLiveChange] = useState<LiveConfirmation>();
  const [liveError, setLiveError] = useState<string>();
  const [livePending, setLivePending] = useState(false);
  const liveRequest = useRef<Promise<void> | null>(null);
  const [filter, setFilter] = useState<RoutineFilter>('all');
  const objective = (location.state as { agentObjective?: unknown } | null)?.agentObjective;
  if (entry.key !== location.key) {
    setEntry({ key: location.key, view });
    if (view === 'create' || view === 'library' || entry.view === 'create') {
      setEditorOpen(view === 'create');
      setSelectedRoutine(undefined);
      setTemplate(undefined);
    }
  }

  // A card waits while ANY write on its routine is on its way, whichever write and however many are in flight on other cards at the same time (the hooks above follow only
  // their last call, so the ids come from the mutation cache): a second click on another button of the same card would answer for a routine that is about to change.
  const busyIds = useRoutineIdsBeingWritten();

  const handleCreate = () => {
    createRoutine.reset();
    setTemplate(undefined);
    setSelectedRoutine(undefined);
    setEditorOpen(true);
  };

  const handleEdit = (routine: Routine) => {
    updateRoutine.reset();
    setTemplate(undefined);
    setSelectedRoutine(routine);
    setEditorOpen(true);
  };

  function reviewLive(change: LiveConfirmation) {
    setLiveError(undefined);
    setLiveChange(change);
  }

  function confirmLive() {
    if (!liveChange) return Promise.resolve();
    if (liveRequest.current) return liveRequest.current;
    setLivePending(true);
    setLiveError(undefined);
    const request = liveChange.commit().then(() => undefined).catch(error => {
      setLiveError(describeRoutineError(error, t) ?? t('routines.updateError'));
      throw error;
    }).finally(() => {
      liveRequest.current = null;
      setLivePending(false);
    });
    liveRequest.current = request;
    return request;
  }

  async function saveRoutine(dto: CreateRoutineDto | UpdateRoutineDto) {
    if (selectedRoutine) {
      await updateRoutine.mutateAsync({ id: selectedRoutine.id, dto });
    } else {
      const saved = await createRoutine.mutateAsync(dto as CreateRoutineDto);
      setFilter(saved.active ? (saved.testMode ? 'test' : 'active') : 'inactive');
    }
    setEditorOpen(false);
  }

  function handleSave(dto: CreateRoutineDto | UpdateRoutineDto) {
    if (dto.active && !dto.testMode && !(selectedRoutine?.active && !selectedRoutine.testMode) && dto.eventType) {
      reviewLive({
        name: dto.name ?? selectedRoutine?.name ?? '',
        trigger: routineTrigger(t, dto.eventType, dto.eventConfig),
        objective: dto.agentObjective,
        actions: dto.actions ?? [],
        commit: () => saveRoutine(dto),
      });
    } else void saveRoutine(dto).catch(() => undefined);
  }

  const handleConfirmDelete = async () => {
    if (routineToDelete) await deleteRoutine.mutateAsync(routineToDelete.id);
  };

  function changeMode(routine: Routine, field: 'active' | 'testMode') {
    const active = field === 'active' ? !routine.active : routine.active;
    const testMode = field === 'testMode' ? !routine.testMode : routine.testMode;
    const commit = () => field === 'active'
      ? setActive.mutateAsync({ id: routine.id, active })
      : setTestMode.mutateAsync({ id: routine.id, testMode });
    if (active && !testMode) {
      reviewLive({
        name: routine.name,
        objective: routine.agentObjective,
        trigger: routineTrigger(t, routine.eventType, parseEventConfig(routine.eventConfig)),
        actions: parseActions(routine.actionsJson),
        commit,
      });
    } else void commit().catch(() => undefined);
  }

  function configureTemplate(value: RoutineLibraryTemplate) {
    createRoutine.reset();
    setSelectedRoutine(undefined);
    setTemplate(value);
    setLibraryOpen(false);
    setEditorOpen(true);
  }

  const notAvailable = isError && getHttpStatus(error) === 404;
  // The routines the page shows: only a list that was read without failing. A refetch that fails keeps the old data in the query, and the page must not show it as if it were current.
  const list = isLoading || isError ? undefined : routines;

  const activeRoutines = list?.filter((r) => r.active && !r.testMode) ?? [];
  const testRoutines = list?.filter((r) => r.active && r.testMode) ?? [];
  const inactiveRoutines = list?.filter((r) => !r.active) ?? [];
  const shown = filter === 'all' ? list ?? [] : filter === 'active' ? activeRoutines : filter === 'test' ? testRoutines : inactiveRoutines;
  const emptyKey = filter === 'active' ? 'routines.noActiveRoutines' : filter === 'test' ? 'routines.noTestRoutines' : 'routines.noInactiveRoutines';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('routines.title')}
        description={t('routines.description')}
        crumbs="auto"
        primary={list ? { label: t('routines.flow.models'), icon: BookOpen, onClick: () => setLibraryOpen(true), testId: 'open-library-button' } : undefined}
        action={list && <Button variant="outline" onClick={handleCreate} data-testid="create-routine-button"><Plus aria-hidden="true" />{t('routines.create')}</Button>}
      />

      {isLoading && (
        <div className="space-y-4" role="status" data-testid="routines-loading">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <span className="sr-only">{t('routines.loading')}</span>
        </div>
      )}

      {/* The server answers 404 to every endpoint while its flag is off: that is not a failure of the person, so it is a calm note and not an error. */}
      {notAvailable && (
        <Alert variant="info" title={t('routines.unavailable.title')} data-testid="routines-unavailable">
          {t('routines.unavailable.description')}
        </Alert>
      )}

      {isError && !notAvailable && (
        <ErrorState testId="routines-error" title={t('routines.loadError')} error={error} onRetry={() => void refetch()} />
      )}

      {list && list.length === 0 && (
        <div data-testid="routines-empty">
          <EmptyState
            icon={Repeat}
            title={t('routines.empty.title')}
            description={`${t('routines.empty.description')} ${t('routines.flow.scope')}`}
          />
        </div>
      )}

      {list && list.length > 0 && (
        <div className="space-y-4">
          <Segmented<RoutineFilter>
            label={t('routines.filterLabel')}
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: 'all', label: `${t('routines.flow.all')} (${list.length})`, testId: 'all-tab' },
              { value: 'active', label: `${t('routines.activeTab')} (${activeRoutines.length})`, testId: 'active-tab' },
              { value: 'test', label: `${t('routines.testTab')} (${testRoutines.length})`, testId: 'test-tab' },
              { value: 'inactive', label: `${t('routines.inactiveTab')} (${inactiveRoutines.length})`, testId: 'inactive-tab' },
            ]}
          />

          {shown.length === 0 ? (
            <Card data-testid={`${filter}-empty`}>
              <CardContent className="space-y-3 pt-6 text-center">
                <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
                {filter === 'active' && (inactiveRoutines.length > 0 || testRoutines.length > 0) && <Button type="button" variant="outline" onClick={() => setFilter(inactiveRoutines.length > 0 ? 'inactive' : 'test')}>{t('routines.flow.resume')}</Button>}
              </CardContent>
            </Card>
          ) : (
            <div className={PAGE_COLUMNS}>
              {shown.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  availability={availability}
                  busy={busyIds.has(routine.id)}
                  onEdit={handleEdit}
                  onSimulate={setSimulation}
                  onDelete={setRoutineToDelete}
                  onToggleActive={routine => changeMode(routine, 'active')}
                  onToggleTestMode={routine => changeMode(routine, 'testMode')}
                  onShowLog={(target) => setLogRoutineId(target.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRoutine ? t('routines.editTitle') : template ? t('routines.flow.configure') : t('routines.createTitle')}</DialogTitle>
            <DialogDescription>{t(template ? 'routines.flow.savedPaused' : 'routines.editorDescription')}</DialogDescription>
          </DialogHeader>
          {(selectedRoutine ? updateRoutine.isError : createRoutine.isError) && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
            {describeRoutineError(selectedRoutine ? updateRoutine.error : createRoutine.error, t) ?? t('routines.createError')}
          </p>}
          <RoutineEditor
            routine={selectedRoutine}
            template={template}
            initialObjective={view === 'create' && typeof objective === 'string' ? objective.slice(0, 500) : undefined}
            availability={availability}
            onSave={handleSave}
            onCancel={() => setEditorOpen(false)}
            isSaving={createRoutine.isPending || updateRoutine.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Library Dialog */}
      <Dialog open={Boolean(list) && libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('routines.library.title')}</DialogTitle>
            <DialogDescription>{t('routines.library.description')}</DialogDescription>
          </DialogHeader>
          <RoutineLibrary
            suggested={params.get('preset')}
            availability={availability}
            onConfigure={configureTemplate}
            onSetupCleaners={() => setCleanersOpen(true)}
          />
        </DialogContent>
      </Dialog>

      {/* Who cleans, for many properties: the same layer as the list of the properties, opened from the ready cleaning routine; it does not send the host away. */}
      <BulkCleaningDialog open={cleanersOpen} onOpenChange={setCleanersOpen} routineLink={false} />

      <Dialog open={Boolean(simulation)} onOpenChange={open => { if (!open) setSimulation(undefined); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('routines.flow.simulateName', { name: simulation?.name })}</DialogTitle>
            <DialogDescription>{t('routines.flow.simulateHint')}</DialogDescription>
          </DialogHeader>
          {simulation && <RoutineSimulation key={simulation.id} routineId={simulation.id} />}
        </DialogContent>
      </Dialog>

      {/* Execution Log Dialog */}
      <Dialog open={logRoutineId !== undefined} onOpenChange={(open) => !open && setLogRoutineId(undefined)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('routines.executionLog')}</DialogTitle>
            <DialogDescription className="sr-only">{t('routines.log.description')}</DialogDescription>
          </DialogHeader>
          <ExecutionLog routineId={logRoutineId} />
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={Boolean(liveChange)}
        onOpenChange={open => { if (!open && !liveRequest.current) setLiveChange(undefined); }}
        title={t('routines.flow.confirmTitle')}
        description={t('routines.flow.confirmDescription', { name: liveChange?.name })}
        confirmLabel={t('routines.flow.confirmLive')}
        isLoading={livePending}
        onConfirm={confirmLive}
      >
        {liveChange && <div className="space-y-3 rounded-lg bg-muted/60 p-3 text-sm">
          <div><p className="text-muted-foreground">{t('routines.flow.when')}</p><p>{liveChange.trigger}</p></div>
          {liveChange.objective && <div><p className="text-muted-foreground">{t('aiSettings.objective')}</p><p className="break-words">{liveChange.objective}</p></div>}
          <div><p className="text-muted-foreground">{t('routines.flow.what')}</p>
            <ol className="list-inside list-decimal space-y-1">
              {liveChange.actions.map((action, index) => <li key={index}>{t(actionLabelKey(action.type) ?? 'routines.log.unknownAction')}
                {[action.config?.text, action.config?.tag, action.config?.aiCondition].filter(value => typeof value === 'string' && value).map((value, position) => <span key={position} className="ml-1 break-words text-muted-foreground">· {String(value)}</span>)}
              </li>)}
            </ol>
          </div>
          {liveError && <p role="alert" className="text-destructive">{liveError}</p>}
        </div>}
      </ConfirmationDialog>

      <ConfirmationDialog
        open={routineToDelete !== undefined}
        onOpenChange={(open) => !open && setRoutineToDelete(undefined)}
        title={t('routines.deleteTitle')}
        description={t('routines.deleteConfirm', { name: routineToDelete?.name ?? '' })}
        confirmLabel={t('routines.delete')}
        variant="destructive"
        consequences={[t('routines.deleteLogGoes')]}
        isLoading={deleteRoutine.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

interface RoutineCardProps {
  routine: Routine;
  availability: ActionAvailability | undefined;
  /** A write on this routine is on its way: nothing of the card can be pressed. */
  busy: boolean;
  onEdit: (routine: Routine) => void;
  onSimulate: (routine: Routine) => void;
  onDelete: (routine: Routine) => void;
  onToggleActive: (routine: Routine) => void;
  onToggleTestMode: (routine: Routine) => void;
  onShowLog: (routine: Routine) => void;
}

function RoutineCard({ routine, availability, busy, onEdit, onSimulate, onDelete, onToggleActive, onToggleTestMode, onShowLog }: RoutineCardProps) {
  const { t } = useTranslation();

  const timing = parseEventConfig(routine.eventConfig);
  const actions = parseActions(routine.actionsJson);
  const cannotRun = unavailableActionTypes(availability, actions);
  const actionNames = actions.map((action) => {
    const key = actionLabelKey(action.type);
    return key ? t(key) : t('routines.log.unknownAction');
  });

  return (
    <Card data-testid={`routine-card-${routine.id}`}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-40 flex-1 space-y-2">
            {/* A level under the title of the page: the card title of the kit is an h3, which would skip one. */}
            <h2 className="break-words text-lg font-semibold leading-none tracking-tight">{routine.name}</h2>
            {routine.agentObjective && <CardDescription>{routine.agentObjective}</CardDescription>}
            <Badge variant={routine.active && !routine.testMode ? 'success' : 'secondary'} data-testid={!routine.active ? 'paused-badge' : routine.testMode ? 'test-mode-badge' : 'active-badge'}>
              {t(!routine.active ? 'routines.flow.paused' : routine.testMode ? 'routines.flow.testing' : 'routines.flow.live')}
            </Badge>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('routines.card.edit', { name: routine.name })}
              onClick={() => onEdit(routine)}
              disabled={busy}
              data-testid={`edit-routine-${routine.id}`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('routines.card.log', { name: routine.name })}
              onClick={() => onShowLog(routine)}
              data-testid={`show-log-${routine.id}`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('routines.card.delete', { name: routine.name })}
              onClick={() => onDelete(routine)}
              disabled={busy}
              data-testid={`delete-routine-${routine.id}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <dl className="grid gap-3 rounded-lg bg-muted/50 p-3">
              <div><dt className="text-xs">{t('routines.flow.when')}</dt><dd className="font-medium text-foreground">{routineTrigger(t, routine.eventType, timing)}</dd></div>
              <div><dt className="text-xs">{t('routines.flow.what')}</dt><dd className="text-foreground">{actionNames.length > 0 ? actionNames.join(', ') : t('routines.noActions')}</dd></div>
            </dl>
            <Button type="button" variant="outline" onClick={() => onSimulate(routine)} disabled={busy} data-testid={`simulate-${routine.id}`}><FlaskConical aria-hidden="true" />{t('routines.flow.simulate')}</Button>
            {cannotRun.length > 0 && (
              <p data-testid={`routine-unavailable-${routine.id}`}>
                {t('routines.card.unavailableNote', {
                  actions: cannotRun.map((type) => t(actionLabelKey(type) ?? 'routines.log.unknownAction')).join(', '),
                })}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm" id={`active-label-${routine.id}`}>
                {t('routines.active')}
              </span>
            </div>
            {/* The switch shows what the server holds: when the server refuses to switch the routine on (422), nothing changes here and the toast says why. */}
            <Switch
              checked={routine.active}
              disabled={busy}
              aria-labelledby={`active-label-${routine.id}`}
              onCheckedChange={() => onToggleActive(routine)}
              data-testid={`toggle-active-${routine.id}`}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm" id={`test-mode-label-${routine.id}`}>
              {t('routines.testMode')}
            </span>
            <Switch
              checked={routine.testMode}
              disabled={busy}
              aria-labelledby={`test-mode-label-${routine.id}`}
              onCheckedChange={() => onToggleTestMode(routine)}
              data-testid={`toggle-test-mode-${routine.id}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** The log of one routine, the newest first: how each run ended and what each of its actions did, told as what it was (a simulated action is not a done one). */
function ExecutionLog({ routineId }: { routineId: string | undefined }) {
  const { t, i18n } = useTranslation();
  const { data: executions, isLoading, isError } = useRoutineExecutions(routineId);

  if (isLoading) {
    return (
      <div className="space-y-2" role="status">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <span className="sr-only">{t('routines.loading')}</span>
      </div>
    );
  }
  if (isError) {
    return <p className="py-4 text-center text-sm text-destructive">{t('routines.log.loadError')}</p>;
  }
  if (!executions || executions.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{t('routines.noExecutions')}</p>;
  }

  const when = (instant: string) =>
    formatRomeDateTime(utcInstant(instant), i18n.language, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-2">
      {executions.length >= EXECUTIONS_PAGE_SIZE && <p className="text-xs text-muted-foreground">{t('routines.log.latest', { max: EXECUTIONS_PAGE_SIZE })}</p>}
      {executions.map((execution) => (
        <ExecutionRow key={execution.id} execution={execution} when={when} />
      ))}
    </div>
  );
}

function ExecutionRow({ execution, when }: { execution: RoutineExecution; when: (instant: string) => string }) {
  const { t } = useTranslation();
  const result = parseExecutionResult(execution.resultJson);
  const headline = executionHeadline(execution.outcome, result.actions);
  const codeKey = executionCodeKey(result.code);

  return (
    <Card data-testid={`execution-${execution.id}`}>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{when(execution.startedAt)}</p>
            {execution.completedAt && (
              <p className="text-xs text-muted-foreground">
                {t('routines.completed')}: {when(execution.completedAt)}
              </p>
            )}
            {execution.outcome === 'Waiting' && execution.resumeAt && (
              <p className="text-xs text-muted-foreground">{t('routines.log.resumesAt', { when: when(execution.resumeAt) })}</p>
            )}
          </div>
          <Badge
            variant={headline.tone === 'success' ? 'success' : headline.tone === 'danger' ? 'destructive' : 'secondary'}
            data-testid={`execution-outcome-${execution.id}`}
            data-tone={headline.tone}
          >
            {t(headline.labelKey)}
          </Badge>
        </div>

        {result.actions.length > 0 && (
          <ul className="space-y-1 text-sm" data-testid={`execution-actions-${execution.id}`}>
            {result.actions.map((action) => {
              const reasonKey = actionReasonKey(action);
              const nameKey = actionLabelKey(action.type);
              return (
                <li key={action.index} className="text-muted-foreground">
                  <span className="text-foreground">{nameKey ? t(nameKey) : t('routines.log.unknownAction')}</span>
                  {': '}
                  {t(ACTION_OUTCOME_KEYS[action.outcome])}
                  {reasonKey ? ` - ${t(reasonKey)}` : ''}
                </li>
              );
            })}
          </ul>
        )}

        {codeKey && <p className="text-sm text-muted-foreground">{t(codeKey)}</p>}
      </CardContent>
    </Card>
  );
}
