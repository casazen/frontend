import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus } from 'lucide-react';
import type {
  Routine,
  CreateRoutineDto,
  UpdateRoutineDto,
  RoutineEventType,
  RoutineAction,
  RoutineActionType,
  RoutineEventConfig,
} from '@/types';

interface RoutineEditorProps {
  routine?: Routine;
  onSave: (dto: CreateRoutineDto | UpdateRoutineDto) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

const TIME_BASED_EVENTS: RoutineEventType[] = [
  'BeforeCheckin' as RoutineEventType,
  'AfterCheckin' as RoutineEventType,
  'BeforeCheckout' as RoutineEventType,
  'AfterCheckout' as RoutineEventType,
];

export function RoutineEditor({ routine, onSave, onCancel, isSaving }: RoutineEditorProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState<RoutineEventType>('BookingConfirmed' as RoutineEventType);
  const [days, setDays] = useState<number>(0);
  const [hours, setHours] = useState<number>(0);
  const [conditionJson, setConditionJson] = useState('{}');
  const [actions, setActions] = useState<RoutineAction[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (routine) {
      setName(routine.name);
      setEventType(routine.eventType);
      setConditionJson(routine.conditionJson);
      setTestMode(routine.testMode);
      setActive(routine.active);

      try {
        const parsedActions = JSON.parse(routine.actionsJson);
        setActions(Array.isArray(parsedActions) ? parsedActions : []);
      } catch {
        setActions([]);
      }

      try {
        const config: RoutineEventConfig = JSON.parse(routine.eventConfig);
        setDays(config.days || 0);
        setHours(config.hours || 0);
      } catch {
        setDays(0);
        setHours(0);
      }
    }
  }, [routine]);

  const isTimeBasedEvent = TIME_BASED_EVENTS.includes(eventType);

  const handleAddAction = () => {
    setActions([...actions, { type: 'SendMessage' as RoutineActionType, config: {} }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleActionChange = (index: number, field: string, value: string) => {
    const newActions = [...actions];
    if (field === 'type') {
      newActions[index] = { ...newActions[index], type: value as RoutineActionType };
    } else {
      newActions[index] = {
        ...newActions[index],
        config: { ...newActions[index].config, [field]: value },
      };
    }
    setActions(newActions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const eventConfig: RoutineEventConfig = isTimeBasedEvent ? { days, hours } : {};

    let condition;
    try {
      condition = JSON.parse(conditionJson);
    } catch {
      condition = {};
    }

    if (routine) {
      const dto: UpdateRoutineDto = {
        name,
        eventType,
        eventConfig,
        condition,
        actions,
        testMode,
        active,
      };
      onSave(dto);
    } else {
      const dto: CreateRoutineDto = {
        name,
        eventType,
        eventConfig,
        condition,
        actions,
        testMode,
        active,
      };
      onSave(dto);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{routine ? t('routines.editTitle') : t('routines.createTitle')}</CardTitle>
          <CardDescription>{t('routines.editorDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="routine-name">{t('routines.name')}</Label>
            <Input
              id="routine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('routines.namePlaceholder')}
              required
              data-testid="routine-name-input"
            />
          </div>

          {/* Event Type */}
          <div className="space-y-2">
            <Label htmlFor="event-type">{t('routines.eventType')}</Label>
            <Select value={eventType} onValueChange={(value) => setEventType(value as RoutineEventType)}>
              <SelectTrigger id="event-type" data-testid="event-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BookingNew">{t('routines.events.bookingNew')}</SelectItem>
                <SelectItem value="BookingConfirmed">{t('routines.events.bookingConfirmed')}</SelectItem>
                <SelectItem value="BookingCanceled">{t('routines.events.bookingCanceled')}</SelectItem>
                <SelectItem value="BeforeCheckin">{t('routines.events.beforeCheckin')}</SelectItem>
                <SelectItem value="AfterCheckin">{t('routines.events.afterCheckin')}</SelectItem>
                <SelectItem value="BeforeCheckout">{t('routines.events.beforeCheckout')}</SelectItem>
                <SelectItem value="AfterCheckout">{t('routines.events.afterCheckout')}</SelectItem>
                <SelectItem value="CheckinOccurred">{t('routines.events.checkinOccurred')}</SelectItem>
                <SelectItem value="CheckoutOccurred">{t('routines.events.checkoutOccurred')}</SelectItem>
                <SelectItem value="IdVerificationCompleted">
                  {t('routines.events.idVerificationCompleted')}
                </SelectItem>
                <SelectItem value="GuestMessageReceived">{t('routines.events.guestMessageReceived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timing for time-based events */}
          {isTimeBasedEvent && (
            <div className="space-y-2">
              <Label>{t('routines.timing')}</Label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="days" className="text-sm text-muted-foreground">
                    {t('routines.days')}
                  </Label>
                  <Input
                    id="days"
                    type="number"
                    min="0"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value) || 0)}
                    data-testid="timing-days-input"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="hours" className="text-sm text-muted-foreground">
                    {t('routines.hours')}
                  </Label>
                  <Input
                    id="hours"
                    type="number"
                    min="0"
                    max="23"
                    value={hours}
                    onChange={(e) => setHours(parseInt(e.target.value) || 0)}
                    data-testid="timing-hours-input"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Condition Builder (simplified - ADR-014 format) */}
          <div className="space-y-2">
            <Label htmlFor="condition">{t('routines.conditions')}</Label>
            <Textarea
              id="condition"
              value={conditionJson}
              onChange={(e) => setConditionJson(e.target.value)}
              placeholder={t('routines.conditionsPlaceholder')}
              rows={4}
              data-testid="condition-json-input"
            />
            <p className="text-xs text-muted-foreground">{t('routines.conditionsHint')}</p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('routines.actions')}</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddAction} data-testid="add-action-button">
                <Plus className="h-4 w-4 mr-2" />
                {t('routines.addAction')}
              </Button>
            </div>

            <div className="space-y-3">
              {actions.map((action, index) => (
                <Card key={index} data-testid={`action-item-${index}`}>
                  <CardContent className="pt-4">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Select
                          value={action.type}
                          onValueChange={(value) => handleActionChange(index, 'type', value)}
                        >
                          <SelectTrigger data-testid={`action-type-select-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Wait">{t('routines.actionTypes.wait')}</SelectItem>
                            <SelectItem value="SendMessage">{t('routines.actionTypes.sendMessage')}</SelectItem>
                            <SelectItem value="CreateActivity">{t('routines.actionTypes.createActivity')}</SelectItem>
                            <SelectItem value="SendAccessCode">{t('routines.actionTypes.sendAccessCode')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAction(index)}
                        data-testid={`remove-action-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Action-specific configuration */}
                    {action.type === 'Wait' && (
                      <div className="mt-3">
                        <Label htmlFor={`wait-days-${index}`} className="text-sm">
                          {t('routines.waitDays')}
                        </Label>
                        <Input
                          id={`wait-days-${index}`}
                          type="number"
                          min="0"
                          value={action.config?.days || 0}
                          onChange={(e) => handleActionChange(index, 'days', e.target.value)}
                          data-testid={`wait-days-${index}`}
                        />
                      </div>
                    )}

                    {action.type === 'SendMessage' && (
                      <div className="mt-3">
                        <Label htmlFor={`template-${index}`} className="text-sm">
                          {t('routines.messageTemplate')}
                        </Label>
                        <Input
                          id={`template-${index}`}
                          value={action.config?.templateId || ''}
                          onChange={(e) => handleActionChange(index, 'templateId', e.target.value)}
                          placeholder={t('routines.messageTemplatePlaceholder')}
                          data-testid={`template-id-${index}`}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {actions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">{t('routines.noActions')}</p>
              )}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="test-mode">{t('routines.testMode')}</Label>
                <p className="text-sm text-muted-foreground">{t('routines.testModeDescription')}</p>
              </div>
              <Switch
                id="test-mode"
                checked={testMode}
                onCheckedChange={setTestMode}
                data-testid="test-mode-switch"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">{t('routines.active')}</Label>
                <p className="text-sm text-muted-foreground">{t('routines.activeDescription')}</p>
              </div>
              <Switch id="active" checked={active} onCheckedChange={setActive} data-testid="active-switch" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving || !name || actions.length === 0} data-testid="save-routine-button">
              {isSaving ? t('common.saving') : routine ? t('common.save') : t('routines.create')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
