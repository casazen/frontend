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
}

/**
 * The ready routines (AC-NF26-12, AC-NF26-13). Each one is a valid routine of the API as it stands: the configuration of every action is the one its type takes
 * (`RoutineActionRules`) and the condition, when it has one, is on a field a routine reads. The To do of the cleaning is the one the action `CreateActivity` makes; the
 * messages need an action that cannot run yet, so they are created in test mode until it can.
 */
function buildTemplates(t: TFunction): Array<{ template: RoutineLibraryTemplate; icon: LucideIcon }> {
  return [
    {
      icon: BookCheck,
      template: {
        name: t('routines.library.cleaningTitle'),
        description: t('routines.library.cleaningDescription'),
        eventType: 'CheckoutOccurred',
        actions: [{ type: 'CreateActivity', config: { text: t('routines.library.cleaningTaskText') } }],
      },
    },
    {
      icon: MessageSquare,
      template: {
        name: t('routines.library.instructionsTitle'),
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
        description: t('routines.library.reviewDescription'),
        eventType: 'AfterCheckout',
        eventConfig: { days: 1, hours: 0 },
        actions: [{ type: 'MessageToGuest', config: { channel: 'email' } }],
      },
    },
    {
      // No condition: a routine does not read whether the documents were uploaded (the fields it reads are the property, the channel and the counts of the booking), so
      // the reminder goes to every guest, and the description says so.
      icon: FileWarning,
      template: {
        name: t('routines.library.documentReminderTitle'),
        description: t('routines.library.documentReminderDescription'),
        eventType: 'BeforeCheckin',
        eventConfig: { days: 3, hours: 0 },
        actions: [{ type: 'MessageToGuest', config: { channel: 'email' } }],
      },
    },
  ];
}

export function RoutineLibrary({ availability, onCreate, isCreating }: RoutineLibraryProps) {
  const { t } = useTranslation();
  const templates = buildTemplates(t);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map(({ template, icon: Icon }, index) => {
          const cannotRun = unavailableActionTypes(availability, template.actions).length > 0;
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
                        <span className="font-medium">{t('routines.timing')}:</span> {template.eventConfig.days} {t('routines.days')}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">{t('routines.actions')}:</span> {template.actions.length}
                    </p>
                  </div>

                  {cannotRun ? (
                    <>
                      <div className="space-y-1" data-testid={`template-unavailable-${index}`}>
                        <Badge variant="outline">{t('routines.action.unavailable')}</Badge>
                        <p className="text-xs text-muted-foreground">{t('routines.library.unavailableNote')}</p>
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
