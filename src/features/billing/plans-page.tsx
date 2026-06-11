import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/queries/use-users';
import { useBillingPlans, useStartCheckout } from '@/queries/use-billing';
import type { PlanTier } from '@/types';
import { BillingPlanCard } from './components/plan-card';
import {
  BillingProfileForm,
  type BillingProfileFormValues,
} from './components/billing-profile-form';

const MVP_PLAN_SETTINGS_PATH = '/app/short-rent/settings/plan';

export function PlansPage() {
  const { org, planTier } = useCurrentUser();
  const { data: plans, isLoading } = useBillingPlans();
  const startCheckout = useStartCheckout();

  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null);
  const [profile, setProfile] = useState<BillingProfileFormValues>({
    billingCountry: 'IT',
    vatId: '',
  });

  const handleChoose = (tier: PlanTier) => {
    setCheckoutTier(tier);
  };

  const handleCheckout = async () => {
    if (!checkoutTier) return;

    const origin = window.location.origin;
    await startCheckout.mutateAsync({
      planTier: checkoutTier,
      billingCountry: profile.billingCountry,
      vatId: profile.vatId.trim() || undefined,
      successUrl: `${origin}/settings/billing?checkout=success`,
      cancelUrl: `${origin}/settings/billing/plans?checkout=cancel`,
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          title="Fatturazione"
          description={
            org
              ? `Scegli il piano per ${org.name}. Il pagamento è gestito in modo sicuro da Stripe.`
              : 'Scegli il piano più adatto alla tua organizzazione.'
          }
        />

        <div
          className="rounded-md border bg-muted/40 px-4 py-3 text-sm"
          data-testid="mvp-plan-fallback-banner"
        >
          <p>
            Preferisci cambiare piano senza pagamento? Usa la{' '}
            <Link to={MVP_PLAN_SETTINGS_PATH} className="underline text-primary">
              gestione piano MVP
            </Link>
            .
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-64 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3" data-testid="billing-plans-grid">
            {(plans ?? []).map((plan) => (
              <BillingPlanCard
                key={plan.tier}
                plan={plan}
                currentTier={planTier}
                onChoose={handleChoose}
                isLoading={startCheckout.isPending}
                loadingTier={checkoutTier}
              />
            ))}
          </div>
        )}

        <Dialog open={checkoutTier !== null} onOpenChange={(open) => !open && setCheckoutTier(null)}>
          <DialogContent data-testid="billing-checkout-dialog">
            <DialogHeader>
              <DialogTitle>Dati di fatturazione</DialogTitle>
              <DialogDescription>
                Inserisci paese e Partita IVA prima di procedere al checkout Stripe.
              </DialogDescription>
            </DialogHeader>
            <BillingProfileForm
              values={profile}
              onChange={setProfile}
              onSubmit={() => void handleCheckout()}
              isSubmitting={startCheckout.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
