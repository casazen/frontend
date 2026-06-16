import { Link, Outlet, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { usePublicOrg } from '@/queries/use-public-org';
import { CookieConsentBanner } from '@/components/shared/cookie-consent-banner';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { Loader2 } from 'lucide-react';

export function PublicBookingShell() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: org, isLoading, isError } = usePublicOrg(orgSlug);

  useEffect(() => {
    if (!org) return;
    const root = document.documentElement;
    if (org.themeColor) {
      root.style.setProperty('--primary', org.themeColor);
      root.style.setProperty('--ring', org.themeColor);
    }
    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
    };
  }, [org]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !org) {
    return <PublicOrgNotFoundPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" data-testid="public-booking-shell">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.displayName} className="h-10 w-auto object-contain" />
          ) : null}
          <div>
            <h1 className="text-xl font-semibold">{org.displayName}</h1>
            <p className="text-sm text-muted-foreground">Prenotazione diretta</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet context={{ org }} />
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <div className="flex justify-center gap-4">
          <Link to="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:underline">
            Termini di servizio
          </Link>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} {org.displayName}</p>
      </footer>

      <CookieConsentBanner />
    </div>
  );
}
