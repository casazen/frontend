import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlanSelectionGrid } from '@/components/org/plan-selection-grid';
import { useAdminUpdateOrgPlan } from '@/queries/use-admin-orgs';
import type { PlanTier, UserSummary } from '@/types';

interface ChangeOrgPlanDialogProps {
  user: UserSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeOrgPlanDialog({ user, open, onOpenChange }: ChangeOrgPlanDialogProps) {
  const updatePlan = useAdminUpdateOrgPlan();
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);

  const handleSelect = async (tier: PlanTier) => {
    if (!user?.orgId) return;
    setSelectedTier(tier);
    await updatePlan.mutateAsync({ orgId: user.orgId, planTier: tier });
    onOpenChange(false);
    setSelectedTier(null);
  };

  if (!user?.orgId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Piano organizzazione</DialogTitle>
            <DialogDescription>
              L&apos;utente non ha ancora un&apos;organizzazione associata.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cambia piano — {user.orgName ?? user.email}</DialogTitle>
          <DialogDescription>
            Piano attuale: <strong>{user.planTier ?? 'Starter'}</strong>
          </DialogDescription>
        </DialogHeader>
        <PlanSelectionGrid
          selectedTier={selectedTier}
          currentTier={(user.planTier as PlanTier | null) ?? 'Starter'}
          onSelect={(tier) => void handleSelect(tier)}
          isLoading={updatePlan.isPending}
          actionLabel="Imposta piano"
        />
      </DialogContent>
    </Dialog>
  );
}
