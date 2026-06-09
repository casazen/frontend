import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useOrgPublicProperty } from '@/queries/use-public-org';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import type { PublicOrgDto } from '@/types';

interface PublicBookingContext {
  org: PublicOrgDto;
}

/**
 * Checkout shell — payment flow owned by spec-direct-checkout (US-002).
 */
export function CheckoutPlaceholderPage() {
  const { orgSlug, propertyId } = useParams<{ orgSlug: string; propertyId: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const [searchParams] = useSearchParams();
  const checkIn = searchParams.get('checkIn') ?? '';
  const checkOut = searchParams.get('checkOut') ?? '';
  const { data: property, isLoading } = useOrgPublicProperty(orgSlug, propertyId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="checkout-placeholder">
      <Button asChild variant="ghost" className="px-0">
        <Link to={`/book/${orgSlug}/property/${propertyId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Torna alla struttura
        </Link>
      </Button>

      <h2 className="text-2xl font-bold">Checkout — {property?.name ?? 'Struttura'}</h2>

      {checkIn && checkOut && (
        <p className="text-muted-foreground">
          Date selezionate: {checkIn} → {checkOut}
        </p>
      )}

      <div className="rounded-lg border bg-muted/40 p-6 space-y-3">
        <p className="font-medium">Pagamento in arrivo</p>
        <p className="text-sm text-muted-foreground">
          Il pagamento sicuro per {org.displayName} sarà disponibile dopo l&apos;attivazione di Stripe
          Connect da parte dell&apos;operatore. Questa pagina accoglierà il flusso di checkout diretto
          (spec-direct-checkout).
        </p>
      </div>
    </div>
  );
}
