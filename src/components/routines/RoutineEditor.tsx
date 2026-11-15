import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RoutineConditionEditor, type ConditionDraft } from '@/components/routines/RoutineConditionEditor';
import { useProperties } from '@/queries/use-properties';
import {
  ACTION_TYPES,
  MAX_ACTIONS,
  MAX_ACTIVITY_DUE_IN_DAYS,
  MAX_ACTIVITY_TEXT_LENGTH,
  MAX_EVENT_OFFSET,
  MAX_WAIT_DAYS,
  TIME_EVENT_TYPES,
  actionProblemKey,
  actionToDraft,
  conditionFromRules,
  defaultActionType,
  draftToAction,
  eventLabelKey,
  eventOptionsFor,
  isActionUnavailable,
  newActionDraft,
  nextKeyOf,
  parseActions,
  parseEventConfig,
  parseWhole,
  readCondition,
  unavailableActionTypes,
  type ActionAvailability,
  type ActionDraft,
} from '@/lib/routine-model';
import type { CreateRoutineDto, Routine, RoutineActionType, RoutineCondition, RoutineEventType, UpdateRoutineDto } from '@/types';

interface RoutineEditorProps {
  routine?: Routine;
  /** What the catalog says of each action (`GET api/routines/actions`): the ones that cannot run yet are disabled, and a routine that holds one is not switched on. */
  availability?: ActionAvailability;
  onSave: (dto: CreateRoutineDto | UpdateRoutineDto) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

/** The time of an event as the editor holds it: hours over a day become days, so that «48 hours» is read as «2 days». */
function offsetOf(eventConfig: string | undefined): { days: string; hours: string } {
  const { days, hours } = parseEventConfig(eventConfig);
  return { days: String(days + Math.floor(hours / 24)), hours: String(hours % 24) };
}

export function RoutineEditor({ routine, availability, onSave, onCancel, isSaving }: RoutineEditorProps) {
  const { t } = useTranslation();

  // The initial values come from the routine once: the editor is mounted again each time its dialog opens, so it starts from the stored routine every time.
  const [initial] = useState(() => {
    const read = readCondition(routine?.conditionJson);
    return {
      name: routine?.name ?? '',
      eventType: routine?.eventType ?? ('BookingConfirmed' as RoutineEventType),
      ...offsetOf(routine?.eventConfig),
      conditionUnsupported: read.kind === 'unsupported',
      condition: read.kind === 'rules' ? { operator: read.operator, rules: read.rules } : { operator: 'AND' as const, rules: [] },
      actions: routine ? parseActions(routine.actionsJson).map((action, index) => actionToDraft(index + 1, action)) : [],
      testMode: routine?.testMode ?? false,
      active: routine?.active ?? true,
    };
  });

  const [name, setName] = useState(initial.name);
  const [eventType, setEventType] = useState<RoutineEventType>(initial.eventType);
  const [days, setDays] = useState(initial.days);
  const [hours, setHours] = useState(initial.hours);
  const [condition, setCondition] = useState<ConditionDraft>(initial.condition);
  const [actions, setActions] = useState<ActionDraft[]>(initial.actions);
  const [testMode, setTestMode] = useState(initial.testMode);
  const [active, setActive] = useState(initial.active);

  const wantsProperties = condition.rules.some((rule) => rule.fieldId === 'propertyId');
  const properties = useProperties({ mode: 'short' }, { enabled: wantsProperties });

  const isTimeBasedEvent = TIME_EVENT_TYPES.includes(eventType);
  const dayCount = parseWhole(days || '0');
  const hourCount = parseWhole(hours || '0');
  const offsetValid = !isTimeBasedEvent || (dayCount !== null && dayCount <= MAX_EVENT_OFFSET && hourCount !== null && hourCount <= 23);

  const builtCondition = conditionFromRules(condition.operator, condition.rules);
  const conditionComplete = builtCondition !== undefined;

  const actionProblems = actions.map(actionProblemKey);
  const unavailable = unavailableActionTypes(availability, actions);
  const anyActionUnavailableInCatalog = ACTION_TYPES.some((action) => isActionUnavailable(availability, action.type));
  // A routine that runs for real holds only actions that can run: it is switched off for the person, who is told why, and can still save it (in test mode it runs as a simulation).
  const activationBlocked = unavailable.length > 0 && !testMode;
  const effectiveActive = active && !activationBlocked;

  const valid =
    name.trim() !== '' && actions.length > 0 && actionProblems.every((problem) => problem === null) && conditionComplete && offsetValid;

  const handleAddAction = () => {
    if (actions.length >= MAX_ACTIONS) return;
    setActions([...actions, newActionDraft(nextKeyOf(actions), defaultActionType(availability))]);
  };

  const handleRemoveAction = (key: number) => setActions(actions.filter((action) => action.key !== key));

  const changeAction = (key: number, change: (draft: ActionDraft) => ActionDraft) =>
    setActions(actions.map((action) => (action.key === key ? change(action) : action)));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;

    // A condition the editor cannot show whole is left out, so the server keeps it as it is; "none" is an empty object.
    const conditionToSend: RoutineCondition | Record<string, never> | undefined = initial.conditionUnsupported ? undefined : (builtCondition ?? {});

    const dto: CreateRoutineDto | UpdateRoutineDto = {
      name: name.trim(),
      eventType,
      eventConfig: isTimeBasedEvent ? { days: dayCount ?? 0, hours: hourCount ?? 0 } : {},
      ...(conditionToSend === undefined ? {} : { condition: conditionToSend }),
      actions: actions.map(draftToAction),
      testMode,
      active: effectiveActive,
    };
    onSave(dto);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="routine-name">{t('routines.name')}</Label>
        <Input
          id="routine-name"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('routines.namePlaceholder')}
          required
          data-testid="routine-name-input"
        />
      </div>

      {/* Event Type */}
      <div className="space-y-2">
        <Label htmlFor="event-type">{t('routines.eventType')}</Label>
        <Select id="event-type" value={eventType} onChange={(e) => setEventType(e.target.value as RoutineEventType)} data-testid="event-type-select">
          {eventOptionsFor(routine?.eventType).map((type) => (
            <option key={type} value={type}>
              {t(eventLabelKey(type))}
            </option>
          ))}
        </Select>
      </div>

      {/* Timing for time-based events */}
      {isTimeBasedEvent && (
        <div className="space-y-2">
          <Label>{t('routines.timing')}</Label>
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="days" className="text-sm text-muted-foreground">
                {t('routines.days')}
              </Label>
              <Input
                id="days"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_EVENT_OFFSET}
                step={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                aria-invalid={!offsetValid || undefined}
                data-testid="timing-days-input"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="hours" className="text-sm text-muted-foreground">
                {t('routines.hours')}
              </Label>
              <Input
                id="hours"
                type="number"
                inputMode="numeric"
                min={0}
                max={23}
                step={1}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                aria-invalid={!offsetValid || undefined}
                data-testid="timing-hours-input"
              />
            </div>
          </div>
          {!offsetValid && (
            <p className="text-sm text-destructive" data-testid="timing-problem">
              {t('routines.problem.timing')}
            </p>
          )}
        </div>
      )}

      {/* Conditions: the five fields a routine reads */}
      <div className="space-y-2">
        <Label>{t('routines.conditions')}</Label>
        {initial.conditionUnsupported ? (
          <p className="text-sm text-muted-foreground" data-testid="condition-unsupported">
            {t('routines.condition.unsupported')}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{t('routines.conditionsHint')}</p>
            <RoutineConditionEditor
              value={condition}
              onChange={setCondition}
              properties={(properties.data ?? []).map((property) => ({ id: property.id, name: property.name }))}
              propertiesStatus={!wantsProperties ? 'idle' : properties.isError ? 'error' : properties.isLoading ? 'loading' : 'ready'}
            />
            {!conditionComplete && (
              <p className="text-sm text-destructive" data-testid="condition-problem">
                {t('routines.problem.condition')}
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('routines.actions')}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddAction}
            disabled={actions.length >= MAX_ACTIONS}
            data-testid="add-action-button"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('routines.addAction')}
          </Button>
        </div>

        <div className="space-y-3">
          {actions.map((action, index) => {
            const problemKey = actionProblems[index];
            const typeUnavailable = isActionUnavailable(availability, action.type);
            return (
              <div key={action.key} className="rounded-md border p-4" data-testid={`action-item-${index}`}>
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Select
                      aria-label={t('routines.actionOf', { position: index + 1 })}
                      value={action.type}
                      // Another type starts from nothing: what was typed for the old one means nothing for the new one.
                      onChange={(e) => changeAction(action.key, (draft) => newActionDraft(draft.key, e.target.value as RoutineActionType))}
                      data-testid={`action-type-select-${index}`}
                    >
                      {ACTION_TYPES.map(({ type, labelKey }) => {
                        const cannotRun = isActionUnavailable(availability, type);
                        return (
                          <option key={type} value={type} disabled={cannotRun}>
                            {cannotRun ? `${t(labelKey)} · ${t('routines.action.unavailable')}` : t(labelKey)}
                          </option>
                        );
                      })}
                    </Select>
                    {typeUnavailable && (
                      <Badge variant="outline" data-testid={`action-unavailable-${index}`}>
                        {t('routines.action.unavailable')}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('routines.removeAction', { position: index + 1 })}
                    onClick={() => handleRemoveAction(action.key)}
                    data-testid={`remove-action-${index}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>

                {/* Action-specific configuration */}
                {action.type === 'Wait' && (
                  <div className="mt-3 space-y-1">
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`wait-days-${index}`} className="text-sm">
                          {t('routines.waitDays')}
                        </Label>
                        <Input
                          id={`wait-days-${index}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={MAX_WAIT_DAYS}
                          step={1}
                          value={action.days}
                          onChange={(e) => changeAction(action.key, (draft) => ({ ...draft, days: e.target.value }))}
                          aria-invalid={problemKey !== null || undefined}
                          data-testid={`wait-days-${index}`}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label htmlFor={`wait-hours-${index}`} className="text-sm">
                          {t('routines.waitHours')}
                        </Label>
                        <Input
                          id={`wait-hours-${index}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={action.hours}
                          onChange={(e) => changeAction(action.key, (draft) => ({ ...draft, hours: e.target.value }))}
                          aria-invalid={problemKey !== null || undefined}
                          data-testid={`wait-hours-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {action.type === 'CreateActivity' && (
                  <div className="mt-3 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor={`activity-text-${index}`} className="text-sm">
                        {t('routines.activityText')}
                      </Label>
                      <Input
                        id={`activity-text-${index}`}
                        value={action.text}
                        maxLength={MAX_ACTIVITY_TEXT_LENGTH}
                        placeholder={t('routines.activityTextPlaceholder')}
                        onChange={(e) => changeAction(action.key, (draft) => ({ ...draft, text: e.target.value }))}
                        aria-invalid={problemKey === 'routines.problem.activityText' || undefined}
                        data-testid={`activity-text-${index}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`activity-due-${index}`} className="text-sm">
                        {t('routines.activityDue')}
                      </Label>
                      <Input
                        id={`activity-due-${index}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_ACTIVITY_DUE_IN_DAYS}
                        step={1}
                        value={action.dueInDays}
                        onChange={(e) => changeAction(action.key, (draft) => ({ ...draft, dueInDays: e.target.value }))}
                        aria-invalid={problemKey === 'routines.problem.activityDue' || undefined}
                        data-testid={`activity-due-${index}`}
                      />
                    </div>
                  </div>
                )}

                {action.type === 'MessageToGuest' && (
                  <div className="mt-3 space-y-1">
                    <Label htmlFor={`template-${index}`} className="text-sm">
                      {t('routines.messageTemplate')}
                    </Label>
                    <Input
                      id={`template-${index}`}
                      value={action.templateId}
                      onChange={(e) => changeAction(action.key, (draft) => ({ ...draft, templateId: e.target.value }))}
                      placeholder={t('routines.messageTemplatePlaceholder')}
                      data-testid={`template-id-${index}`}
                    />
                  </div>
                )}

                {problemKey && (
                  <p className="mt-2 text-sm text-destructive" data-testid={`action-problem-${index}`}>
                    {t(problemKey)}
                  </p>
                )}
              </div>
            );
          })}

          {actions.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t('routines.noActions')}</p>}
        </div>

        {anyActionUnavailableInCatalog && (
          <p className="text-sm text-muted-foreground" data-testid="action-unavailable-hint">
            {t('routines.action.unavailableHint')}
          </p>
        )}
      </div>

      {/* Toggles */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="test-mode">{t('routines.testMode')}</Label>
            <p className="text-sm text-muted-foreground">{t('routines.testModeDescription')}</p>
          </div>
          <Switch id="test-mode" checked={testMode} onCheckedChange={setTestMode} data-testid="test-mode-switch" />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="active">{t('routines.active')}</Label>
            <p className="text-sm text-muted-foreground">{t('routines.activeDescription')}</p>
            {activationBlocked && (
              <p className="text-sm text-muted-foreground" role="status" data-testid="active-blocked">
                {t('routines.action.activeBlocked')}
              </p>
            )}
          </div>
          <Switch id="active" checked={effectiveActive} disabled={activationBlocked} onCheckedChange={setActive} data-testid="active-switch" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isSaving || !valid} data-testid="save-routine-button">
          {isSaving ? t('common.saving') : routine ? t('common.save') : t('routines.create')}
        </Button>
      </div>
    </form>
  );
}
