import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/queries/use-users';
import { CONNECT_STATUS_KEY, useConnectStatus, useStartConnectOnboarding } from '@/queries/use-connect';
import { resolveConnectUiStatus } from '@/types/connect.types';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const STATUS_LABEL: Record<ReturnType<typeof resolveConnectUiStatus>, string> = {
  disconnected: 'Non collegato',
  pending: 'In verifica',
  active: 'Attivo',
};

const STATUS_VARIANT: Record<ReturnType<typeof resolveConnectUiStatus>, 'secondary' | 'outline' | 'default'> = {
  disconnected: 'secondary',
  pending: 'outline',
  active: 'default',
};

export function ConnectPaymentsPage() {
  const { org } = useCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stripeReturn = searchParams.get('stripe_return') === '1' || searchParams.get('stripe_refresh') === '1';

  const { data: status, isLoading, isError } = useConnectStatus(stripeReturn);
  const startOnboarding = useStartConnectOnboarding();

  useEffect(() => {
    if (!stripeReturn)
      return;

    void queryClient.invalidateQueries({ queryKey: CONNECT_STATUS_KEY });
    setSearchParams({}, { replace: true });
  }, [stripeReturn, queryClient, setSearchParams]);

  const uiStatus = resolveConnectUiStatus(status);
  const hasRequirements = (status?.requirementsDue?.length ?? 0) > 0;
  const bookingSiteUrl = org?.slug ? `/book/${org.slug}` : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Pagamenti / Payouts"
          description="Collega il tuo account Stripe per ricevere i pagamenti degli ospiti direttamente sul tuo conto."
        />

        {bookingSiteUrl && (
          <div className="rounded-lg border bg-card p-6 space-y-3">
            <div>
              <p className="text-sm font-medium">Il tuo sito di prenotazioni</p>
              <p className="text-sm text-muted-foreground mt-1">
                Accedi al sito pubblico per visualizzare come lo vedono i tuoi ospiti.
              </p>
            </div>
            <Link
              to={bookingSiteUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Visita {org?.name ?? 'il sito'}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!status?.chargesEnabled && (
          <div
            role="alert"
            data-testid="connect-checkout-gate-banner"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm space-y-1"
          >
            <p className="font-medium text-destructive">Sito prenotazioni non ancora attivo</p>
            <p className="text-muted-foreground">
              Completa la verifica Stripe per abilitare il checkout sul sito prenotazioni. Gli ospiti non potranno pagare finché l&apos;account non è attivo.
            </p>
          </div>
        )}

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Stato connessione Stripe</p>
              <div className="mt-1 flex items-center gap-2">
                {uiStatus === 'active' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />
                ) : uiStatus === 'pending' ? (
                  <Clock className="h-5 w-5 text-amber-600" aria-hidden />
                ) : (
                  <AlertCircle className="h-5 w-5 text-muted-foreground" aria-hidden />
                )}
                <Badge variant={STATUS_VARIANT[uiStatus]} data-testid="connect-status-badge">
                  {STATUS_LABEL[uiStatus]}
                </Badge>
              </div>
            </div>

            {uiStatus !== 'active' && (
              <Button
                onClick={() => void startOnboarding.mutateAsync()}
                disabled={startOnboarding.isPending || isLoading}
                data-testid="connect-stripe-cta"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {uiStatus === 'disconnected' ? 'Collega Stripe' : 'Completa la verifica'}
              </Button>
            )}
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Caricamento stato pagamenti…</p>}
          {isError && (
            <p className="text-sm text-destructive">Impossibile caricare lo stato Stripe. Riprova tra poco.</p>
          )}

          {status?.connectedAccountId && (
            <p className="text-xs text-muted-foreground">
              Account Stripe: <code>{status.connectedAccountId}</code>
            </p>
          )}

          {hasRequirements && uiStatus !== 'active' && (
            <div
              role="alert"
              data-testid="connect-requirements-alert"
              className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm space-y-1"
            >
              <p className="font-medium">Verifica incompleta</p>
              <p className="text-muted-foreground">
                Stripe richiede documenti aggiuntivi. Clicca &quot;Completa la verifica&quot; per continuare
                l&apos;onboarding.
              </p>
            </div>
          )}

          {uiStatus === 'active' && (
            <p className="text-sm text-muted-foreground">
              Il tuo account può accettare pagamenti. I fondi vengono accreditati direttamente sul tuo conto Stripe
              — CasaZen non trattiene i tuoi incassi.
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Gestisci il piano SaaS in{' '}
          <Link to="/app/short-rent/settings/plan" className="underline">
            Impostazioni piano
          </Link>
          .
        </p>
      </div>
    </AppShell>
  );
}
