import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookCheck, MessageSquare, Star, FileWarning, type LucideIcon } from 'lucide-react';
import { eventLabelKey, unavailableActionTypes, type ActionAvailability } from '@/lib/routine-model';
import type { RoutineLibraryTemplate } from '@/types';

interface RoutineLibraryProps {
  /** What the catalog says of each action: a template that holds an action that cannot run yet cannot be switched on, only created in test mode. */
  availability?: ActionAvailability;
  /** Creates the routine of a template: on (`testMode` false) or as a simulation (`testMode` true). */
  onCreate: (template: RoutineLibraryTemplate, options: { testMode: boolean }) => void;
  /** A routine is being created: every button of the library waits for it. */
  isCreating?: boolean;
  /**
   * Opens the layer that says who cleans for many properties at once. The ready cleaning routine acts on every property that has a cleaner (a property with none is left as it is), so its card
   * offers it: with it the agency sets the cleaner of its properties and switches the routine on in one go. Not offered when it is not given.
   */
  onSetupCleaners?: () => void;
}

interface LibraryEntry {
  template: RoutineLibraryTemplate;
  icon: LucideIcon;
  /** What the card says besides its description, when the template needs the host to set something first. */
  noteKey?: string;
  /** The card offers «Imposta chi pulisce» (the cleaner of the properties, for many at once). */
  setsCleaners?: boolean;
}

/**
 * The ready routines (AC-NF26-12, AC-NF26-13). Each one is a valid routine of the API as it stands: the configuration of every action is the one its type takes
 * (`RoutineActionRules`) and the condition, when it has one, is on a field a routine reads. The cleaning is the action `CreateCleaningRequest` (E24/F01/US01/T02): at the time of the check-out it makes the
 * cleaning for whoever cleans the property (a supplier at the agreed price, or a member of the staff), once for each stay; a property with no cleaner is left as it is. The review is the action
 * `RequestReview` (E26/F01/US01/T01): a day after the check-out, once for each direct booking. The message routines start in test mode so the host can first choose a template.
 */
function buildTemplates(t: TFunction): LibraryEntry[] {
  return [
    {
      icon: BookCheck,
      noteKey: 'routines.library.cleaningNote',
      setsCleaners: true,
      template: {
        name: t('routines.library.cleaningTitle'),
        agentObjective: t('aiSettings.cleaningGoal'),
        description: t('routines.library.cleaningDescription'),
        eventType: 'AfterCheckout',
        // No delay: the cleaning is made at the time of the check-out of the property, as the server expects the ready routine (`{ hours: 0 }`).
        eventConfig: { days: 0, hours: 0 },
        actions: [{ type: 'CreateCleaningRequest', config: {} }],
      },
    },
    {
      icon: MessageSquare,
      template: {
        name: t('routines.library.instructionsTitle'),
        agentObjective: t('aiSettings.instructionsGoal'),
        description: t('routines.library.instructionsDescription'),
        eventType: 'BeforeCheckin',
        eventConfig: { days: 2, hours: 0 },
        actions: [{ type: 'MessageToGuest', config: { channel: 'email' } }],
      },
    },
    {
      icon: Star,
      template: {
        name: t('routines.library.reviewTitle'),
        agentObjective: t('aiSettings.reviewGoal'),
        description: t('routines.library.reviewDescription'),
        eventType: 'AfterCheckout',
        eventConfig: { days: 1, hours: 0 },
        actions: [{ type: 'RequestReview', config: {} }],
      },
    },
    {
      // No condition: a routine does not read whether the documents were uploaded (the fields it reads are the property, the channel and the counts of the booking), so
      // the reminder goes to every guest, and the description says so.
      icon: FileWarning,
      template: {
        name: t('routines.library.documentReminderTitle'),
        agentObjective: t('aiSettings.documentReminderGoal'),
        description: t('routines.library.documentReminderDescription'),
        eventType: 'BeforeCheckin',
        eventConfig: { days: 3, hours: 0 },
        actions: [{ type: 'MessageToGuest', config: { channel: 'email' } }],
      },
    },
  ];
}

/** The delay of a time event in words: «1 giorno», «2 ore», or «all'ora dell'evento» when there is none. */
function offsetText(t: TFunction, days: number, hours: number): string {
  const parts = [
    ...(days > 0 ? [t('routines.library.daysCount', { count: days })] : []),
    ...(hours > 0 ? [t('routines.library.hoursCount', { count: hours })] : []),
  ];
  return parts.length > 0 ? parts.join(' ') : t('routines.library.atTheTime');
}

export function RoutineLibrary({ availability, onCreate, isCreating, onSetupCleaners }: RoutineLibraryProps) {
  const { t } = useTranslation();
  const templates = buildTemplates(t);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map(({ template, icon: Icon, noteKey, setsCleaners }, index) => {
          const cannotRun = unavailableActionTypes(availability, template.actions).length > 0;
          const needsTemplate = template.actions.some(action => action.type === 'MessageToGuest' && !action.config?.templateId);
          return (
            <Card key={template.name} data-testid={`library-template-${index}`}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="mt-1">{template.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">{t('routines.eventType')}:</span> {t(eventLabelKey(template.eventType))}
                    </p>
                    {template.eventConfig && (
                      <p>
                        <span className="font-medium">{t('routines.timing')}:</span> {offsetText(t, template.eventConfig.days ?? 0, template.eventConfig.hours ?? 0)}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">{t('routines.actions')}:</span> {template.actions.length}
                    </p>
                  </div>

                  {noteKey ? (
                    <p className="text-xs text-muted-foreground" data-testid={`template-note-${index}`}>
                      {t(noteKey)}
                    </p>
                  ) : null}

                  {setsCleaners && onSetupCleaners ? (
                    <Button
                      variant="soft"
                      size="sm"
                      className="w-full"
                      onClick={onSetupCleaners}
                      disabled={isCreating}
                      data-testid={`setup-cleaners-${index}`}
                    >
                      {t('routines.library.setupCleaners')}
                    </Button>
                  ) : null}

                  {cannotRun || needsTemplate ? (
                    <>
                      <div className="space-y-1" data-testid={`template-unavailable-${index}`}>
                        <Badge variant="outline">{t(cannotRun ? 'routines.action.unavailable' : 'routines.messageTemplate')}</Badge>
                        <p className="text-xs text-muted-foreground">{t(cannotRun ? 'routines.library.unavailableNote' : 'routines.library.needsTemplate')}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => onCreate(template, { testMode: true })}
                        disabled={isCreating}
                        data-testid={`test-template-${index}`}
                      >
                        {isCreating ? t('routines.library.activating') : t('routines.library.createInTestMode')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => onCreate(template, { testMode: false })}
                      disabled={isCreating}
                      data-testid={`activate-template-${index}`}
                    >
                      {isCreating ? t('routines.library.activating') : t('routines.library.activate')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
