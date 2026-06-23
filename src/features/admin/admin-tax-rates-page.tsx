import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { TaxRateForm } from './components/tax-rate-form';
import { touristTaxApi } from '@/api/tourist-tax.api';
import { formatDate } from '@/lib/utils';
import { Plus, Pencil, Trash2, Loader2, RefreshCw, Coins } from 'lucide-react';
import type { TouristTaxRate, CreateTouristTaxRateDto, UpdateTouristTaxRateDto } from '@/types';

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
      toast.success('Aliquota creata con successo');
    },
    onError: () => {
      toast.error('Impossibile creare l\'aliquota');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTouristTaxRateDto }) =>
      touristTaxApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourist-tax-rates'] });
      toast.success('Aliquota aggiornata con successo');
    },
    onError: () => {
      toast.error('Impossibile aggiornare l\'aliquota');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => touristTaxApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tourist-tax-rates'] });
      toast.success('Aliquota eliminata con successo');
    },
    onError: () => {
      toast.error('Impossibile eliminare l\'aliquota');
    },
  });

  const handleSubmit = async (data: CreateTouristTaxRateDto | UpdateTouristTaxRateDto) => {
    if (editingRate) {
      await updateMutation.mutateAsync({ id: editingRate.id, data: data as UpdateTouristTaxRateDto });
    } else {
      await createMutation.mutateAsync(data as CreateTouristTaxRateDto);
    }
  };

  const items = rates ?? [];
  const isFormLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('taxRates.title')}
          description="Gestisci le aliquote della tassa di soggiorno per tutti i comuni"
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
          <CardContent className="pt-4">
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
                <p className="text-destructive mb-4">Failed to load tax rates.</p>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                  Retry
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
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Azioni
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
                          {formatDate(rate.effectiveFrom)}
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
                              title="Modifica"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingRate(rate)}
                              title="Elimina"
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
        description={`Confermi l'eliminazione dell'aliquota per ${deletingRate?.city ?? ''}? Questa azione è reversibile (soft delete).`}
        confirmLabel="Elimina"
        variant="destructive"
        onConfirm={async () => {
          if (deletingRate) {
            await deleteMutation.mutateAsync(deletingRate.id);
            setDeletingRate(null);
          }
        }}
        isLoading={deleteMutation.isPending}
      />
    </AppShell>
  );
}
