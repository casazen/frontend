import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProperties,
  usePauseProperty,
  useActivateProperty,
  useCreateProperty,
} from '@/queries/use-properties';
import { useCinCompliance } from '@/queries/use-cin';
import { CinDeadlineBanner } from '@/features/cin';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { PropertyForm } from './components/property-form';
import { isPlanLimitError, getPlanLimitMessage } from '@/lib/entitlement-error';
import { getAmenityLabel } from '@/lib/i18n-labels';
import { formatCurrency } from '@/lib/utils';
import type { CreatePropertyDto, Property } from '@/types';
import { formatPropertyLocation } from './property-location';

/** "At a glance" filter over the already-fetched list (A2-05): who is paused is never a second request. */
type StatusFilter = 'all' | 'active' | 'paused';
const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'active', 'paused'];

export function PropertiesPage() {
  const { t } = useTranslation();
  const { data: properties, isLoading, error } = useProperties();
  const { data: cinCompliance } = useCinCompliance();
  const pauseProperty = usePauseProperty();
  const activateProperty = useActivateProperty();
  const createProperty = useCreateProperty();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Pausing/activating is a dedicated action (A2-05): never the generic PUT, so it can never fail on an
  // unrelated required field, and never sets `isActive` (soft delete's own flag, PC-05).
  const togglePause = async (property: Property) => {
    try {
      if (property.isPaused) {
        await activateProperty.mutateAsync(property.id);
      } else {
        await pauseProperty.mutateAsync(property.id);
      }
    } catch {
      // Error toast already handled by the mutation
    }
  };

  const handleCreateProperty = async (data: CreatePropertyDto) => {
    try {
      await createProperty.mutateAsync(data);
      setIsDialogOpen(false);
    } catch (error) {
      // Plan-limit (403/409) is suppressed by the mutation's onError; surface the Italian
      // message here so the dialog still informs the owner (#202, AC12).
      if (isPlanLimitError(error)) {
        toast.error(getPlanLimitMessage());
        return;
      }
      // Other errors already surfaced by the mutation's onError toast.
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-destructive">{t('property.page.errorLoad')}</p>
            <p className="text-sm text-muted-foreground">{t('property.page.errorHint')}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const propertyList = properties ?? [];
  const pausedCount = propertyList.filter((p) => p.isPaused).length;
  const filteredList = propertyList.filter((p) => {
    if (statusFilter === 'active') return !p.isPaused;
    if (statusFilter === 'paused') return p.isPaused;
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {cinCompliance?.summary && <CinDeadlineBanner summary={cinCompliance.summary} />}

        <div className="flex items-center justify-between">
          <PageHeader title={t('property.page.title')} description={t('property.page.description')} />
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('property.page.addButton')}
          </Button>
        </div>

        {propertyList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('property.page.filterLabel')}>
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter}
                type="button"
                variant={statusFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(filter)}
                aria-pressed={statusFilter === filter}
                data-testid={`property-filter-${filter}`}
              >
                {filter === 'all' && t('property.page.filterAll', { count: propertyList.length })}
                {filter === 'active' && t('property.page.filterActive', { count: propertyList.length - pausedCount })}
                {filter === 'paused' && t('property.page.filterPaused', { count: pausedCount })}
              </Button>
            ))}
          </div>
        )}

        {propertyList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg font-semibold mb-2">{t('property.page.emptyTitle')}</p>
              <p className="text-sm text-muted-foreground mb-6">
                {t('property.page.emptyDescription')}
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('property.page.emptyCta')}
              </Button>
            </CardContent>
          </Card>
        ) : filteredList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">{t('property.page.filterEmpty')}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      {[
                        t('property.table.property'),
                        t('property.table.location'),
                        t('property.table.rooms'),
                        t('property.table.guests'),
                        t('property.table.priceNight'),
                        t('property.table.amenities'),
                        t('property.table.status'),
                        t('property.table.actions'),
                      ].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/properties/${p.id}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatPropertyLocation(p)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {t('property.table.bedroomsCount', { count: p.bedrooms })}
                          {' · '}
                          {t('property.table.bathroomsCount', { count: p.bathrooms })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.maxGuests}</td>
                        <td className="px-4 py-3 font-medium">
                          {/* Amounts are in euros (the API has no currency per property); 0 = no short-stay rate. */}
                          {p.nightlyRate > 0 ? formatCurrency(p.nightlyRate) : t('property.table.noRate')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(p.amenities || []).slice(0, 3).map((a) => (
                              <Badge key={a} variant="secondary" className="text-xs">{getAmenityLabel(a, t)}</Badge>
                            ))}
                            {(p.amenities || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">+{p.amenities.length - 3}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.isPaused ? 'secondary' : 'default'}>
                            {p.isPaused ? t('property.table.paused') : t('property.table.active')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePause(p)}
                              disabled={pauseProperty.isPending || activateProperty.isPending}
                              className="text-xs"
                            >
                              {p.isPaused ? t('property.table.activate') : t('property.table.pause')}
                            </Button>
                            <Button asChild variant="ghost" size="icon">
                              <Link
                                to={`/app/short-rent/properties/${p.id}/edit`}
                                aria-label={t('property.table.editAria', { name: p.name })}
                                title={t('property.table.edit')}
                              >
                                <Pencil className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('property.page.addDialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('property.page.addDialogDescription')}
              </DialogDescription>
            </DialogHeader>
            <PropertyForm
              onSubmit={handleCreateProperty}
              onCancel={() => setIsDialogOpen(false)}
              isLoading={createProperty.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
