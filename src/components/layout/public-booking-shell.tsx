import { Outlet, useParams, NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { usePublicOrg } from '@/queries/use-public-org';
import { CookieConsentBanner } from '@/components/shared/cookie-consent-banner';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { Loader2, Home, Clipboard } from 'lucide-react';

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
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-4 py-4">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.displayName} className="h-10 w-auto object-contain" />
            ) : null}
            <div>
              <h1 className="text-xl font-semibold">{org.displayName}</h1>
              <p className="text-sm text-muted-foreground">Prenotazione diretta</p>
            </div>
          </div>
          <nav className="flex gap-8 border-t">
            <NavLink
              to={`/book/${orgSlug}`}
              className={({ isActive }) =>
                `flex items-center gap-2 py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <Home className="h-4 w-4" />
              Strutture
            </NavLink>
            <NavLink
              to={`/book/${orgSlug}/my-bookings`}
              className={({ isActive }) =>
                `flex items-center gap-2 py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <Clipboard className="h-4 w-4" />
              Le mie prenotazioni
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet context={{ org }} />
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <div className="flex justify-center gap-4">
          <a
            href="https://casazen.app/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-sm text-muted-foreground hover:text-primary"
          >
            Privacy Policy
          </a>
          <a
            href="https://casazen.app/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-sm text-muted-foreground hover:text-primary"
          >
            Termini di servizio
          </a>
        </div>
        <p className="mt-2">© {new Date().getFullYear()} {org.displayName}</p>
      </footer>

      <CookieConsentBanner />
    </div>
  );
}
