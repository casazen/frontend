import { useOrg } from '@/hooks/useOrg';

interface ConsoleLayoutProps {
  children: React.ReactNode;
}

/**
 * Console layout with conditional B2B navigation (ADR-010-R6).
 * B2B menu items (Proprietari, Rendiconti, Fatture, Bonifici, Ritenute,
 * Fornitori fidati, Attivita interne) are shown only when isAgency is true.
 *
 * Note: Actual B2B menu items will be added by subsequent tasks.
 */
export function ConsoleLayout({ children }: ConsoleLayoutProps) {
  const { isAgency } = useOrg();

  return (
    <>
      {isAgency && (
        <>{/* B2B navigation items (Proprietari, Rendiconti, Fatture, Bonifici, Ritenute, Fornitori fidati, Attivita interne) will be added by subsequent tasks */}</>
      )}
      {children}
    </>
  );
}
