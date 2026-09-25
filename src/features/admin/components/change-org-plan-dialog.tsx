import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PlanSelectionGrid } from '@/components/org/plan-selection-grid';
import { useTranslation } from 'react-i18next';
import { useAdminUpdateOrgPlan } from '@/queries/use-admin-orgs';
import type { PlanTier, UserSummary } from '@/types';
import { getPlanTierLabel } from '@/lib/i18n-labels';

interface ChangeOrgPlanDialogProps {
  user: UserSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeOrgPlanDialog({ user, open, onOpenChange }: ChangeOrgPlanDialogProps) {
  const { t } = useTranslation();
  const updatePlan = useAdminUpdateOrgPlan();
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);

  // A refused change (409 managed_by_stripe or subscription_required, FD-18) is reported by the hook's onError with
  // getProblemMessage; the dialog stays open on the current plan. mutate: no promise left unhandled.
  const handleSelect = (tier: PlanTier) => {
    if (!user?.orgId) return;
    setSelectedTier(tier);
    updatePlan.mutate(
      { orgId: user.orgId, planTier: tier },
      {
        onSuccess: () => onOpenChange(false),
        onSettled: () => setSelectedTier(null),
      },
    );
  };

  if (!user?.orgId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.planDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('admin.users.planDialog.description')}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const currentTier: PlanTier = (user.planTier as PlanTier | null) ?? 'Starter';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('admin.users.planDialog.changeTitle', { name: user.orgName ?? user.email })}</DialogTitle>
          <DialogDescription>
            {t('admin.users.planDialog.changeDescription')} <strong>{getPlanTierLabel(currentTier, t)}</strong>
          </DialogDescription>
        </DialogHeader>
        <PlanSelectionGrid
          selectedTier={selectedTier}
          currentTier={currentTier}
          onSelect={handleSelect}
          isLoading={updatePlan.isPending}
          actionLabel={t('admin.users.planDialog.actionLabel')}
        />
      </DialogContent>
    </Dialog>
  );
}
