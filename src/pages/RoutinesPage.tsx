import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState } from '@/components/shared/error-state';
import { RoutineEditor } from '@/components/routines/RoutineEditor';
import { RoutineLibrary } from '@/components/routines/RoutineLibrary';
import {
  useRoutines,
  useRoutineExecutions,
  useCreateRoutine,
  useUpdateRoutine,
  useDeleteRoutine,
  useSetRoutineActive,
  useSetRoutineTestMode,
} from '@/queries/routines';
import { Plus, Play, Trash2, Edit, Clock } from 'lucide-react';
import type { Routine, CreateRoutineDto, UpdateRoutineDto, RoutineLibraryTemplate } from '@/types';

export function RoutinesPage() {
  const { t } = useTranslation();
  const { data: routines, isLoading, isError, error, refetch } = useRoutines();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const setActive = useSetRoutineActive();
  const setTestMode = useSetRoutineTestMode();

  const [editorOpen, setEditorOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [executionLogOpen, setExecutionLogOpen] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | undefined>();
  const [selectedRoutineForLog, setSelectedRoutineForLog] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'active' | 'test' | 'inactive'>('active');

  const { data: executions } = useRoutineExecutions(selectedRoutineForLog);

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
      updateRoutine.mutate(
        { id: selectedRoutine.id, dto: dto as UpdateRoutineDto },
        {
          onSuccess: () => setEditorOpen(false),
        }
      );
    } else {
      createRoutine.mutate(dto as CreateRoutineDto, {
        onSuccess: () => setEditorOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm(t('routines.deleteConfirm'))) {
      deleteRoutine.mutate(id);
    }
  };

  const handleToggleActive = (id: string, active: boolean) => {
    setActive.mutate({ id, active: !active });
  };

  const handleToggleTestMode = (id: string, testMode: boolean) => {
    setTestMode.mutate({ id, testMode: !testMode });
  };

  const handleActivateTemplate = (template: RoutineLibraryTemplate) => {
    const dto: CreateRoutineDto = {
      name: template.name,
      eventType: template.eventType,
      eventConfig: template.eventConfig,
      condition: template.condition,
      actions: template.actions,
      testMode: false,
      active: true,
    };

    createRoutine.mutate(dto, {
      onSuccess: () => setLibraryOpen(false),
    });
  };

  const handleShowExecutionLog = (routineId: string) => {
    setSelectedRoutineForLog(routineId);
    setExecutionLogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" data-testid="routines-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <span className="sr-only">{t('routines.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        testId="routines-error"
        title={t('routines.loadError')}
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  const activeRoutines = routines?.filter((r) => r.active && !r.testMode) || [];
  const testRoutines = routines?.filter((r) => r.testMode) || [];
  const inactiveRoutines = routines?.filter((r) => !r.active && !r.testMode) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('routines.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('routines.description')}</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLibraryOpen(true)} data-testid="open-library-button">
            {t('routines.library.title')}
          </Button>
          <Button onClick={handleCreate} data-testid="create-routine-button">
            <Plus className="h-4 w-4 mr-2" />
            {t('routines.create')}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === 'active' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('active')}
            data-testid="active-tab"
            className="rounded-b-none"
          >
            {t('routines.activeTab')} ({activeRoutines.length})
          </Button>
          <Button
            variant={activeTab === 'test' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('test')}
            data-testid="test-tab"
            className="rounded-b-none"
          >
            {t('routines.testTab')} ({testRoutines.length})
          </Button>
          <Button
            variant={activeTab === 'inactive' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('inactive')}
            data-testid="inactive-tab"
            className="rounded-b-none"
          >
            {t('routines.inactiveTab')} ({inactiveRoutines.length})
          </Button>
        </div>

        <div className="space-y-4">
          {activeTab === 'active' && (
            <>
              {activeRoutines.length === 0 ? (
                <Card data-testid="active-empty">
                  <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground">{t('routines.noActiveRoutines')}</p>
                  </CardContent>
                </Card>
              ) : (
                activeRoutines.map((routine) => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    onToggleTestMode={handleToggleTestMode}
                    onShowLog={handleShowExecutionLog}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'test' && (
            <>
              {testRoutines.length === 0 ? (
                <Card data-testid="test-empty">
                  <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground">{t('routines.noTestRoutines')}</p>
                  </CardContent>
                </Card>
              ) : (
                testRoutines.map((routine) => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    onToggleTestMode={handleToggleTestMode}
                    onShowLog={handleShowExecutionLog}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'inactive' && (
            <>
              {inactiveRoutines.length === 0 ? (
                <Card data-testid="inactive-empty">
                  <CardContent className="pt-6 text-center">
                    <p className="text-sm text-muted-foreground">{t('routines.noInactiveRoutines')}</p>
                  </CardContent>
                </Card>
              ) : (
                inactiveRoutines.map((routine) => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    onToggleTestMode={handleToggleTestMode}
                    onShowLog={handleShowExecutionLog}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRoutine ? t('routines.editTitle') : t('routines.createTitle')}</DialogTitle>
          </DialogHeader>
          <RoutineEditor
            routine={selectedRoutine}
            onSave={handleSave}
            onCancel={() => setEditorOpen(false)}
            isSaving={createRoutine.isPending || updateRoutine.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Library Dialog */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('routines.library.title')}</DialogTitle>
          </DialogHeader>
          <RoutineLibrary onActivate={handleActivateTemplate} isActivating={createRoutine.isPending} />
        </DialogContent>
      </Dialog>

      {/* Execution Log Dialog */}
      <Dialog open={executionLogOpen} onOpenChange={setExecutionLogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('routines.executionLog')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {executions && executions.length > 0 ? (
              executions.map((execution) => (
                <Card key={execution.id} data-testid={`execution-${execution.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{execution.outcome}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(execution.startedAt).toLocaleString()}
                        </p>
                        {execution.completedAt && (
                          <p className="text-xs text-muted-foreground">
                            {t('routines.completed')}: {new Date(execution.completedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Badge variant={execution.outcome === 'Success' ? 'default' : 'destructive'}>
                        {execution.outcome}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">{t('routines.noExecutions')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface RoutineCardProps {
  routine: Routine;
  onEdit: (routine: Routine) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onToggleTestMode: (id: string, testMode: boolean) => void;
  onShowLog: (id: string) => void;
}

function RoutineCard({ routine, onEdit, onDelete, onToggleActive, onToggleTestMode, onShowLog }: RoutineCardProps) {
  const { t } = useTranslation();

  let actions;
  try {
    actions = JSON.parse(routine.actionsJson);
  } catch {
    actions = [];
  }

  return (
    <Card data-testid={`routine-card-${routine.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{routine.name}</CardTitle>
            <CardDescription>
              {t(`routines.events.${routine.eventType.charAt(0).toLowerCase() + routine.eventType.slice(1)}`)}
            </CardDescription>
            <div className="flex gap-2 mt-2">
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
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(routine)}
              data-testid={`edit-routine-${routine.id}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onShowLog(routine.id)}
              data-testid={`show-log-${routine.id}`}
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(routine.id)}
              data-testid={`delete-routine-${routine.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>
              <span className="font-medium">{t('routines.actions')}:</span> {Array.isArray(actions) ? actions.length : 0}
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{t('routines.active')}</span>
            </div>
            <Switch
              checked={routine.active}
              onCheckedChange={() => onToggleActive(routine.id, routine.active)}
              data-testid={`toggle-active-${routine.id}`}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">{t('routines.testMode')}</span>
            </div>
            <Switch
              checked={routine.testMode}
              onCheckedChange={() => onToggleTestMode(routine.id, routine.testMode)}
              data-testid={`toggle-test-mode-${routine.id}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
