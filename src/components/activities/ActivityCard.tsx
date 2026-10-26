import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { useUpdateActivityStatus } from '@/queries/internalActivities';
import type { InternalActivity } from '@/api/internal-activities.api';

interface ActivityCardProps {
  activity: InternalActivity;
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const { t } = useTranslation();
  const updateStatus = useUpdateActivityStatus();

  const [selectedStatus, setSelectedStatus] = useState(activity.status);
  const [notes, setNotes] = useState(activity.notes || '');

  const handleUpdateStatus = () => {
    if (selectedStatus === activity.status && notes === (activity.notes || '')) {
      return;
    }

    updateStatus.mutate({
      id: activity.id,
      status: selectedStatus,
      notes: notes || undefined,
    });
  };

  const isUpdating = updateStatus.isPending;
  const hasChanges = selectedStatus !== activity.status || notes !== (activity.notes || '');

  const getStatusKey = (status: string): string => {
    const statusMap: Record<string, string> = {
      'Pending': 'pending',
      'InProgress': 'in_progress',
      'Completed': 'completed',
    };
    return statusMap[status] || status.toLowerCase();
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'secondary';
      case 'InProgress':
        return 'default';
      case 'Completed':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Card data-testid={`activity-card-${activity.id}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">
              {t(`activity.type.${activity.activityType.toLowerCase()}`)}
            </CardTitle>
            <CardDescription>
              {t('activity.scheduledAt', {
                date: new Date(activity.scheduledAt).toLocaleString(),
              })}
            </CardDescription>
          </div>
          <Badge variant={getStatusVariant(activity.status)} data-testid="activity-status-badge">
            {t(`activity.status.${getStatusKey(activity.status)}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('activity.propertyId')}</Label>
            <p className="text-sm" data-testid="activity-property-id">
              {activity.propertyId}
            </p>
          </div>
          {activity.bookingId && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('activity.bookingId')}</Label>
              <p className="text-sm" data-testid="activity-booking-id">
                {activity.bookingId}
              </p>
            </div>
          )}
          {activity.internalRate !== null && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('activity.internalRate')}</Label>
              <p className="text-sm" data-testid="activity-internal-rate">
                €{activity.internalRate.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor={`status-${activity.id}`}>{t('activity.updateStatus')}</Label>
          <Select
            id={`status-${activity.id}`}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            data-testid="activity-status-select"
          >
            <option value="Pending">{t('activity.status.pending')}</option>
            <option value="InProgress">{t('activity.status.in_progress')}</option>
            <option value="Completed">{t('activity.status.completed')}</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`notes-${activity.id}`}>{t('activity.notes')}</Label>
          <Textarea
            id={`notes-${activity.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('activity.notesPlaceholder')}
            rows={3}
            data-testid="activity-notes-textarea"
          />
        </div>

        {hasChanges && (
          <Button
            onClick={handleUpdateStatus}
            disabled={isUpdating}
            className="w-full"
            data-testid="activity-save-button"
          >
            {isUpdating ? t('common.saving') : t('common.save')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
