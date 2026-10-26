import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { ActivityCard } from '@/components/activities/ActivityCard';
import { useMyActivities } from '@/queries/internalActivities';

export function StaffActivitiesPage() {
  const { t } = useTranslation();
  const { data: activities, isLoading, isError, error, refetch } = useMyActivities();

  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const uniqueProperties = useMemo(() => {
    if (!activities) return [];
    const propertyIds = [...new Set(activities.map((a) => a.propertyId))];
    return propertyIds.sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];

    return activities.filter((activity) => {
      const matchesProperty = propertyFilter === 'all' || activity.propertyId === propertyFilter;
      const matchesStatus = statusFilter === 'all' || activity.status === statusFilter;
      return matchesProperty && matchesStatus;
    });
  }, [activities, propertyFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" data-testid="staff-activities-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <span className="sr-only">{t('activity.staff.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        testId="staff-activities-error"
        title={t('activity.staff.loadError')}
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('activity.staff.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('activity.staff.description')}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="property-filter">{t('activity.filter.property')}</Label>
              <Select
                id="property-filter"
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                data-testid="property-filter-select"
              >
                <option value="all">{t('activity.filter.allProperties')}</option>
                {uniqueProperties.map((propertyId) => (
                  <option key={propertyId} value={propertyId}>
                    {propertyId}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">{t('activity.filter.status')}</Label>
              <Select
                id="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                data-testid="status-filter-select"
              >
                <option value="all">{t('activity.filter.allStatuses')}</option>
                <option value="Pending">{t('activity.status.pending')}</option>
                <option value="InProgress">{t('activity.status.in_progress')}</option>
                <option value="Completed">{t('activity.status.completed')}</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!filteredActivities || filteredActivities.length === 0 ? (
        <Card data-testid="staff-activities-empty">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'all' && propertyFilter === 'all'
                ? t('activity.staff.empty')
                : t('activity.staff.emptyFiltered')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="staff-activities-list">
          {filteredActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
    </div>
  );
}
