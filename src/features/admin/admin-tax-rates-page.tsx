import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { TaxRateForm } from './components/tax-rate-form';
import { touristTaxApi } from '@/api/tourist-tax.api';
import { formatDate } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Coins, ExternalLink } from 'lucide-react';
import type {
  TouristTaxRate,
  CreateTouristTaxRateDto,
  UpdateTouristTaxRateDto,
  TouristTaxRateVerification,
} from '@/types';

const VERIFICATION_BADGE: Record<TouristTaxRateVerification, string> = {
  Official: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200',
  Deduced: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  ThirdParty: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
};

/** Host name of the source, as link text (the full URL is in the title and the href). */
function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function AdminTaxRatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<TouristTaxRate | null>(null);
  const [deletingRate, setDeletingRate] = useState<TouristTaxRate | null>(null);

  const {
    data: rates,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['tourist-tax-rates'],
    queryFn: () => touristTaxApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTouristTaxRateDto) => touristTaxApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourist-tax-rates'] });
      toast.success(t('taxRates.toast.created'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, t) ?? t('taxRates.toast.createFailed'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTouristTaxRateDto }) =>
      touristTaxApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourist-tax-rates'] });
      toast.success(t('taxRates.toast.updated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, t) ?? t('taxRates.toast.updateFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => touristTaxApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourist-tax-rates'] });
      toast.success(t('taxRates.toast.deleted'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, t) ?? t('taxRates.toast.deleteFailed'));
    },
  });

  // Rejects on API errors (already shown by onError) so the form stays open.
  const handleSubmit = async (data: CreateTouristTaxRateDto) => {
    if (editingRate) {
      await updateMutation.mutateAsync({ id: editingRate.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const items = rates ?? [];
  const isFormLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
    <div className="space-y-6">
        <PageHeader
          title={t('taxRates.title')}
          description={t('taxRates.pageDescription')}
          action={
            <Button
              onClick={() => {
                setEditingRate(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t('taxRates.create')}
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('taxRates.listTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('shared.loading.defaultMessage')}</span>
              </div>
            )}

            {/* Error State */}
            {isError && !isLoading && (
              <div className="py-12 text-center">
                <p className="text-destructive mb-4">{t('taxRates.loadError')}</p>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                  {t('taxRates.retry')}
                </Button>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !isError && items.length === 0 && (
              <EmptyState
                icon={Coins}
                title={t('taxRates.title')}
                description={t('taxRates.empty')}
                action={{
                  label: t('taxRates.create'),
                  onClick: () => {
                    setEditingRate(null);
                    setFormOpen(true);
                  },
                }}
              />
            )}

            {/* Table */}
            {!isLoading && !isError && items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('taxRates.city')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('taxRates.region')}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t('taxRates.ratePerNight')}
                      </th>
                      <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                        {t('taxRates.maxNights')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('taxRates.effectiveFrom')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('taxRates.source')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('taxRates.verification')}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t('taxRates.actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((rate) => (
                      <tr
                        key={rate.id}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium">{rate.city}</td>
                        <td className="px-4 py-3 text-muted-foreground">{rate.regionCode}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          &euro;{rate.ratePerPersonPerNight.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {rate.maxNights ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(String(rate.effectiveFrom).slice(0, 10))}
                        </td>
                        <td className="px-4 py-3" data-testid={`tax-rate-source-${rate.id}`}>
                          {rate.sourceUrl ? (
                            <a
                              href={rate.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={rate.sourceUrl}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              {sourceLabel(rate.sourceUrl)}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{t('taxRates.noSource')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3" data-testid={`tax-rate-verification-${rate.id}`}>
                          {rate.verificationLevel ? (
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${VERIFICATION_BADGE[rate.verificationLevel]}`}
                              title={t(`taxRates.verificationHints.${rate.verificationLevel}`)}
                            >
                              {t(`taxRates.verificationLevels.${rate.verificationLevel}`)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{t('taxRates.verificationLevels.none')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingRate(rate);
                                setFormOpen(true);
                              }}
                              title={t('taxRates.editAction')}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingRate(rate)}
                              title={t('taxRates.deleteAction')}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Form Dialog */}
      <TaxRateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        isLoading={isFormLoading}
        existing={editingRate}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={deletingRate !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingRate(null);
        }}
        title={t('taxRates.delete')}
        description={t('taxRates.deleteDescription', { city: deletingRate?.city ?? '' })}
        confirmLabel={t('taxRates.deleteAction')}
        variant="destructive"
        onConfirm={async () => {
          if (!deletingRate) return;
          try {
            await deleteMutation.mutateAsync(deletingRate.id);
          } catch {
            // Already shown by onError (getProblemMessage); the dialog closes either way.
          }
          setDeletingRate(null);
        }}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
