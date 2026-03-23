import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { OtaList } from './components/ota-list';
import { SyncAllDialog } from './components/sync-all-dialog';
import { PricingUpdateDialog } from './components/pricing-update-dialog';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import {
  useOtaIntegrations,
  useDeleteOtaIntegration,
  useSyncAllOta,
  useSyncOtaPlatform,
  useUpdateOtaPricing,
  useValidateOta,
} from '@/queries/use-ota';
import { Plus, RefreshCw, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import type { OtaIntegration, OtaPricingUpdate } from '@/types';

export function OtaPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useOtaIntegrations();
  const deleteIntegration = useDeleteOtaIntegration();
  const syncAll = useSyncAllOta();
  const syncPlatform = useSyncOtaPlatform();
  const updatePricing = useUpdateOtaPricing();
  const validateOta = useValidateOta();

  const [integrationToDelete, setIntegrationToDelete] = useState<OtaIntegration | null>(null);
  const [showSyncAllDialog, setShowSyncAllDialog] = useState(false);
  const [showPricingDialog, setShowPricingDialog] = useState(false);

  const handleEdit = (integration: OtaIntegration) => {
    navigate(`/ota/${integration.id}/edit`);
  };

  const handleDelete = async () => {
    if (integrationToDelete) {
      await deleteIntegration.mutateAsync(integrationToDelete.id);
      setIntegrationToDelete(null);
    }
  };

  const handleSync = async (integration: OtaIntegration) => {
    await syncPlatform.mutateAsync(integration.platform);
  };

  const handleSyncAll = async () => {
    await syncAll.mutateAsync();
  };

  const handlePricingUpdate = async (data: OtaPricingUpdate) => {
    await updatePricing.mutateAsync(data);
  };

  const handleValidate = async (integration: OtaIntegration) => {
    try {
      const result = await validateOta.mutateAsync(integration.id);
      if (result.isValid) {
        toast.success(`${integration.platform} credentials validated successfully`);
      } else {
        toast.error(`Validation failed: ${result.errors?.join(', ')}`);
      }
    } catch (error) {
      // Error toast is already shown by the mutation
    }
  };

  const activeIntegrations = data?.data.filter((i) => i.isActive) || [];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="OTA Integrations"
          description="Manage connections to online travel agencies"
          action={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPricingDialog(true)}
                disabled={activeIntegrations.length === 0}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Update Pricing
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSyncAllDialog(true)}
                disabled={activeIntegrations.length === 0}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync All
              </Button>
              <Button onClick={() => navigate('/ota/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Integration
              </Button>
            </div>
          }
        />

        <OtaList
          integrations={data?.data || []}
          isLoading={isLoading}
          onSync={handleSync}
          onEdit={handleEdit}
          onDelete={setIntegrationToDelete}
          onValidate={handleValidate}
          onAdd={() => navigate('/ota/create')}
        />

        <ConfirmationDialog
          open={!!integrationToDelete}
          onOpenChange={(open) => !open && setIntegrationToDelete(null)}
          title="Delete OTA Integration"
          description={`Are you sure you want to delete the ${integrationToDelete?.platform} integration? This will stop syncing bookings from this platform.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={deleteIntegration.isPending}
        />

        <SyncAllDialog
          open={showSyncAllDialog}
          onOpenChange={setShowSyncAllDialog}
          onConfirm={handleSyncAll}
          isLoading={syncAll.isPending}
          platformCount={activeIntegrations.length}
        />

        <PricingUpdateDialog
          open={showPricingDialog}
          onOpenChange={setShowPricingDialog}
          onConfirm={handlePricingUpdate}
          isLoading={updatePricing.isPending}
        />
      </div>
    </AppShell>
  );
}
