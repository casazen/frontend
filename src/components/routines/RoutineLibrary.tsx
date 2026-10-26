import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookCheck, MessageSquare, Star, FileWarning } from 'lucide-react';
import type { RoutineLibraryTemplate, RoutineEventType, RoutineActionType } from '@/types';

interface RoutineLibraryProps {
  onActivate: (template: RoutineLibraryTemplate) => void;
  isActivating?: boolean;
}

export function RoutineLibrary({ onActivate, isActivating }: RoutineLibraryProps) {
  const { t } = useTranslation();

  // Pre-built routine templates (AC-NF26-12, AC-NF26-13)
  const templates: RoutineLibraryTemplate[] = [
    {
      name: t('routines.library.cleaningTitle'),
      description: t('routines.library.cleaningDescription'),
      eventType: 'CheckoutOccurred' as RoutineEventType,
      actions: [
        {
          type: 'CreateActivity' as RoutineActionType,
          config: {
            activityType: 'Cleaning',
          },
        },
      ],
    },
    {
      name: t('routines.library.instructionsTitle'),
      description: t('routines.library.instructionsDescription'),
      eventType: 'BeforeCheckin' as RoutineEventType,
      eventConfig: {
        days: 2,
        hours: 0,
      },
      actions: [
        {
          type: 'MessageToGuest' as RoutineActionType,
          config: {
            channel: 'email',
          },
        },
      ],
    },
    {
      name: t('routines.library.reviewTitle'),
      description: t('routines.library.reviewDescription'),
      eventType: 'AfterCheckout' as RoutineEventType,
      eventConfig: {
        days: 1,
        hours: 0,
      },
      actions: [
        {
          type: 'MessageToGuest' as RoutineActionType,
          config: {
            channel: 'email',
          },
        },
      ],
    },
    {
      name: t('routines.library.documentReminderTitle'),
      description: t('routines.library.documentReminderDescription'),
      eventType: 'BeforeCheckin' as RoutineEventType,
      eventConfig: {
        days: 3,
        hours: 0,
      },
      condition: {
        operator: 'not',
        rules: [
          {
            field: 'idVerificationCompleted',
            operator: 'equals',
            value: true,
          },
        ],
      },
      actions: [
        {
          type: 'MessageToGuest' as RoutineActionType,
          config: {
            channel: 'email',
          },
        },
      ],
    },
  ];

  const getIcon = (index: number) => {
    switch (index) {
      case 0:
        return <BookCheck className="h-6 w-6" />;
      case 1:
        return <MessageSquare className="h-6 w-6" />;
      case 2:
        return <Star className="h-6 w-6" />;
      case 3:
        return <FileWarning className="h-6 w-6" />;
      default:
        return <MessageSquare className="h-6 w-6" />;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{t('routines.library.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('routines.library.description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template, index) => (
          <Card key={index} data-testid={`library-template-${index}`}>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">{getIcon(index)}</div>
                <div className="flex-1">
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="mt-1">{template.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium">{t('routines.eventType')}:</span>{' '}
                    {t(`routines.events.${template.eventType.charAt(0).toLowerCase() + template.eventType.slice(1)}`)}
                  </p>
                  {template.eventConfig && (
                    <p>
                      <span className="font-medium">{t('routines.timing')}:</span>{' '}
                      {template.eventConfig.days} {t('routines.days')}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">{t('routines.actions')}:</span> {template.actions.length}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onActivate(template)}
                  disabled={isActivating}
                  data-testid={`activate-template-${index}`}
                >
                  {isActivating ? t('routines.library.activating') : t('routines.library.activate')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
