import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useCompleteOnboarding } from '@/queries/use-users';
import type { RentalType } from '@/types';
import { getHomeRouteForRentalType, getHomeRouteForUser } from '@/lib/onboarding';
import { getUserRoles } from '@/lib/auth-roles';
import { isDemoMode } from '@/config/demo.config';
import { applyDemoOnboardingProfile } from '@/lib/demo-onboarding';
import { RentalTypeCard } from './components/rental-type-card';

const RENTAL_TYPES: RentalType[] = ['ShortTerm', 'LongTerm', 'Both'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshAccessToken } = useAuth();
  const completeOnboarding = useCompleteOnboarding();
  const [selectedType, setSelectedType] = useState<RentalType | null>(null);
  const [failedType, setFailedType] = useState<RentalType | null>(null);

  useEffect(() => {
    if (getUserRoles(user).length > 0) {
      navigate(getHomeRouteForUser(user), { replace: true });
    }
  }, [navigate, user]);

  const handleSelect = async (rentalType: RentalType) => {
    setSelectedType(rentalType);
    setFailedType(null);

    try {
      if (isDemoMode) {
        applyDemoOnboardingProfile(rentalType);
        window.location.assign(getHomeRouteForRentalType(rentalType));
        return;
      }

      await completeOnboarding.mutateAsync(rentalType);
      await refreshAccessToken();
      window.location.assign(getHomeRouteForRentalType(rentalType));
    } catch {
      setFailedType(rentalType);
      toast.error('Errore durante la configurazione del profilo. Riprova.');
      setSelectedType(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-10 text-center">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">CasaZen</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Come vuoi usare CasaZen?
          </h1>
          <p className="text-muted-foreground">
            Scegli il tipo di operatore per personalizzare la tua esperienza.
          </p>
        </div>

        <div className="grid gap-6 text-left md:grid-cols-3">
          {RENTAL_TYPES.map((rentalType) => (
            <RentalTypeCard
              key={rentalType}
              rentalType={rentalType}
              onSelect={handleSelect}
              isLoading={completeOnboarding.isPending}
              selectedType={selectedType}
            />
          ))}
        </div>

        {failedType && (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => void handleSelect(failedType)}
          >
            Riprova
          </button>
        )}
      </div>
    </div>
  );
}
