import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/queries/use-users';
import {
  useInvalidateBillingOnCheckoutSuccess,
  useOpenPortal,
  useSubscription,
} from '@/queries/use-billing';
import { SubscriptionBadge } from './components/subscription-badge';

export function BillingSettingsPage() {
  const { org } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';

  const { data: subscription, isLoading } = useSubscription();
  const openPortal = useOpenPortal();
  const invalidateOnSuccess = useInvalidateBillingOnCheckoutSuccess();

  useEffect(() => {
    if (!checkoutSuccess) return;
    invalidateOnSuccess();
    setSearchParams({}, { replace: true });
  }, [checkoutSuccess, invalidateOnSuccess, setSearchParams]);

  const periodEndLabel =
    subscription?.currentPeriodEnd != null
      ? format(new Date(subscription.currentPeriodEnd), 'd MMMM yyyy', { locale: it })
      : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Fatturazione"
          description="Gestisci l'abbonamento SaaS della tua organizzazione."
          action={
            <Button variant="outline" asChild>
              <Link to="/settings/billing/plans">Cambia piano</Link>
            </Button>
          }
        />

        <div className="rounded-lg border bg-card p-6 space-y-4" data-testid="billing-subscription-panel">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Organizzazione</p>
                  <p className="font-medium">{org?.name ?? '—'}</p>
                </div>
                {subscription && <SubscriptionBadge status={subscription.status} />}
              </div>

              {subscription && subscription.status !== 'none' && (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Piano</dt>
                    <dd className="font-medium">{subscription.planTier}</dd>
                  </div>
                  {periodEndLabel && (
                    <div>
                      <dt className="text-muted-foreground">Prossimo rinnovo</dt>
                      <dd className="font-medium">{periodEndLabel}</dd>
                    </div>
                  )}
                  {subscription.billingCountry && (
                    <div>
                      <dt className="text-muted-foreground">Paese</dt>
                      <dd className="font-medium">{subscription.billingCountry}</dd>
                    </div>
                  )}
                  {subscription.vatId && (
                    <div>
                      <dt className="text-muted-foreground">Partita IVA</dt>
                      <dd className="font-medium">{subscription.vatId}</dd>
                    </div>
                  )}
                </dl>
              )}

              {subscription?.status === 'none' && (
                <p className="text-sm text-muted-foreground">
                  Nessun abbonamento attivo.{' '}
                  <Link to="/settings/billing/plans" className="underline text-primary">
                    Scegli un piano
                  </Link>
                  .
                </p>
              )}

              {subscription && subscription.status !== 'none' && subscription.stripeCustomerId && (
                <Button
                  type="button"
                  data-testid="billing-portal-cta"
                  disabled={openPortal.isPending}
                  onClick={() => void openPortal.mutateAsync()}
                >
                  {openPortal.isPending ? 'Apertura portale...' : 'Gestisci abbonamento'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
