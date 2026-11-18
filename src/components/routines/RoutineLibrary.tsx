import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookCheck, MessageSquare, Star, FileWarning, type LucideIcon } from 'lucide-react';
import { actionLabelKey, unavailableActionTypes, type ActionAvailability } from '@/lib/routine-model';
import { routineTrigger } from '@/lib/routine-trigger';
import type { RoutineLibraryTemplate } from '@/types';

interface RoutineLibraryProps {
  /** What the catalog says of each action: a template that holds an action that cannot run yet cannot be switched on, only created in test mode. */
  availability?: ActionAvailability;
  onConfigure: (template: RoutineLibraryTemplate) => void;
  /**
   * Opens the layer that says who cleans for many properties at once. The ready cleaning routine acts on every property that has a cleaner (a property with none is left as it is), so its card
   * offers it: with it the agency can set the cleaner of its properties. Not offered when it is not given.
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

export function RoutineLibrary({ availability, onConfigure, onSetupCleaners }: RoutineLibraryProps) {
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
                  <dl className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm">
                    <div><dt className="text-xs text-muted-foreground">{t('routines.flow.when')}</dt><dd className="font-medium">{routineTrigger(t, template.eventType, template.eventConfig)}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{t('routines.flow.what')}</dt><dd>{template.actions.map(action => t(actionLabelKey(action.type) ?? 'routines.log.unknownAction')).join(', ')}</dd></div>
                  </dl>

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
                      data-testid={`setup-cleaners-${index}`}
                    >
                      {t('routines.library.setupCleaners')}
                    </Button>
                  ) : null}

                  {(cannotRun || needsTemplate) && <div className="space-y-1" data-testid={`template-unavailable-${index}`}>
                    <Badge variant="outline">{t(cannotRun ? 'routines.action.unavailable' : 'routines.messageTemplate')}</Badge>
                    <p className="text-sm text-muted-foreground">{t(cannotRun ? 'routines.library.unavailableNote' : 'routines.library.needsTemplate')}</p>
                  </div>}
                  <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => onConfigure(template)} data-testid={`configure-template-${index}`}>
                    {t('routines.flow.configure')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
