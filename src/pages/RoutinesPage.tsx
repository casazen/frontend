import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
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
import { RoutineLibrary } from '@/components/routines/RoutineLibrary';
import { BulkCleaningDialog } from '@/features/properties/components/bulk-cleaning-dialog';
import { getHttpStatus } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import {
  ACTION_OUTCOME_KEYS,
  actionLabelKey,
  actionReasonKey,
  eventLabelKey,
  executionCodeKey,
  executionHeadline,
  parseActions,
  parseExecutionResult,
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
import type { CreateRoutineDto, Routine, RoutineExecution, RoutineLibraryTemplate, UpdateRoutineDto } from '@/types';

type RoutineFilter = 'active' | 'test' | 'inactive';

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

  const [editorOpen, setEditorOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // The layer that says who cleans for many properties at once (the ready cleaning routine acts on the properties that have a cleaner), over the library.
  const [cleanersOpen, setCleanersOpen] = useState(false);
  const [logRoutineId, setLogRoutineId] = useState<string | undefined>();
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | undefined>();
  const [routineToDelete, setRoutineToDelete] = useState<Routine | undefined>();
  const [filter, setFilter] = useState<RoutineFilter>('active');

  // A card waits while ANY write on its routine is on its way, whichever write and however many are in flight on other cards at the same time (the hooks above follow only
  // their last call, so the ids come from the mutation cache): a second click on another button of the same card would answer for a routine that is about to change.
  const busyIds = useRoutineIdsBeingWritten();

  const handleCreate = () => {
    setSelectedRoutine(undefined);
    setEditorOpen(true);
  };

  const handleEdit = (routine: Routine) => {
    setSelectedRoutine(routine);
    setEditorOpen(true);
  };

  const handleSave = (dto: CreateRoutineDto | UpdateRoutineDto) => {
    if (selectedRoutine) {
      updateRoutine.mutate({ id: selectedRoutine.id, dto: dto as UpdateRoutineDto }, { onSuccess: () => setEditorOpen(false) });
    } else {
      createRoutine.mutate(dto as CreateRoutineDto, { onSuccess: () => setEditorOpen(false) });
    }
  };

  // The dialog waits for the answer and stays open when the server refuses (the hook says why).
  const handleConfirmDelete = async () => {
    if (routineToDelete) await deleteRoutine.mutateAsync(routineToDelete.id);
  };

  const handleToggleActive = (routine: Routine) => {
    setActive.mutate({ id: routine.id, active: !routine.active });
  };

  const handleToggleTestMode = (routine: Routine) => {
    setTestMode.mutate({ id: routine.id, testMode: !routine.testMode });
  };

  const handleCreateFromTemplate = (template: RoutineLibraryTemplate, { testMode }: { testMode: boolean }) => {
    const dto: CreateRoutineDto = {
      name: template.name,
      agentObjective: template.agentObjective,
      eventType: template.eventType,
      ...(template.eventConfig ? { eventConfig: template.eventConfig } : {}),
      ...(template.condition ? { condition: template.condition } : {}),
      actions: template.actions,
      testMode,
      active: true,
    };

    createRoutine.mutate(dto, {
      onSuccess: () => {
        setLibraryOpen(false);
        // A routine in test mode is in the tab of the tests: the person finds what was just made.
        setFilter(testMode ? 'test' : 'active');
      },
    });
  };

  const notAvailable = isError && getHttpStatus(error) === 404;
  // The routines the page shows: only a list that was read without failing. A refetch that fails keeps the old data in the query, and the page must not show it as if it were current.
  const list = isLoading || isError ? undefined : routines;

  const activeRoutines = list?.filter((r) => r.active && !r.testMode) ?? [];
  const testRoutines = list?.filter((r) => r.testMode) ?? [];
  const inactiveRoutines = list?.filter((r) => !r.active && !r.testMode) ?? [];
  const shown = filter === 'active' ? activeRoutines : filter === 'test' ? testRoutines : inactiveRoutines;
  const emptyKey = filter === 'active' ? 'routines.noActiveRoutines' : filter === 'test' ? 'routines.noTestRoutines' : 'routines.noInactiveRoutines';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('routines.title')}
        description={t('routines.description')}
        crumbs="auto"
        primary={list ? { label: t('routines.create'), icon: Plus, onClick: handleCreate, testId: 'create-routine-button' } : undefined}
        action={
          list && list.length > 0 ? (
            <Button variant="outline" onClick={() => setLibraryOpen(true)} data-testid="open-library-button">
              {t('routines.library.title')}
            </Button>
          ) : undefined
        }
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
            description={t('routines.empty.description')}
            action={{ label: t('routines.library.open'), onClick: () => setLibraryOpen(true) }}
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
              { value: 'active', label: `${t('routines.activeTab')} (${activeRoutines.length})`, testId: 'active-tab' },
              { value: 'test', label: `${t('routines.testTab')} (${testRoutines.length})`, testId: 'test-tab' },
              { value: 'inactive', label: `${t('routines.inactiveTab')} (${inactiveRoutines.length})`, testId: 'inactive-tab' },
            ]}
          />

          {shown.length === 0 ? (
            <Card data-testid={`${filter}-empty`}>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
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
                  onDelete={setRoutineToDelete}
                  onToggleActive={handleToggleActive}
                  onToggleTestMode={handleToggleTestMode}
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
            <DialogTitle>{selectedRoutine ? t('routines.editTitle') : t('routines.createTitle')}</DialogTitle>
            <DialogDescription>{t('routines.editorDescription')}</DialogDescription>
          </DialogHeader>
          <RoutineEditor
            routine={selectedRoutine}
            availability={availability}
            onSave={handleSave}
            onCancel={() => setEditorOpen(false)}
            isSaving={createRoutine.isPending || updateRoutine.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Library Dialog */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('routines.library.title')}</DialogTitle>
            <DialogDescription>{t('routines.library.description')}</DialogDescription>
          </DialogHeader>
          <RoutineLibrary
            availability={availability}
            onCreate={handleCreateFromTemplate}
            isCreating={createRoutine.isPending}
            onSetupCleaners={() => setCleanersOpen(true)}
          />
        </DialogContent>
      </Dialog>

      {/* Who cleans, for many properties: the same layer as the list of the properties, opened from the ready cleaning routine; it does not send the host away. */}
      <BulkCleaningDialog open={cleanersOpen} onOpenChange={setCleanersOpen} routineLink={false} />

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
  onDelete: (routine: Routine) => void;
  onToggleActive: (routine: Routine) => void;
  onToggleTestMode: (routine: Routine) => void;
  onShowLog: (routine: Routine) => void;
}

function RoutineCard({ routine, availability, busy, onEdit, onDelete, onToggleActive, onToggleTestMode, onShowLog }: RoutineCardProps) {
  const { t } = useTranslation();

  const actions = parseActions(routine.actionsJson);
  const cannotRun = unavailableActionTypes(availability, actions);
  const actionNames = actions.map((action) => {
    const key = actionLabelKey(action.type);
    return key ? t(key) : t('routines.log.unknownAction');
  });

  return (
    <Card data-testid={`routine-card-${routine.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            {/* A level under the title of the page: the card title of the kit is an h3, which would skip one. */}
            <h2 className="break-words text-lg font-semibold leading-none tracking-tight">{routine.name}</h2>
            <CardDescription>{t(eventLabelKey(routine.eventType))}</CardDescription>
            <div className="mt-2 flex gap-2">
              {routine.testMode && (
                <Badge variant="outline" data-testid="test-mode-badge">
                  {t('routines.testModeBadge')}
                </Badge>
              )}
              {routine.active && (
                <Badge variant="default" data-testid="active-badge">
                  {t('routines.activeBadge')}
                </Badge>
              )}
            </div>
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
            <p>
              <span className="font-medium">{t('routines.actions')}:</span> {actionNames.length > 0 ? actionNames.join(', ') : '-'}
            </p>
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
