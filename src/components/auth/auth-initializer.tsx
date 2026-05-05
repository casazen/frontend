import { useAuth } from '@/hooks/use-auth';

/**
 * Component that initializes authentication token handling
 * Must be rendered inside Auth0Provider
 */
export function AuthInitializer({ children }: { children: React.ReactNode }) {
  // This will set up the token getter as soon as Auth0 is ready
  useAuth();
  
  return <>{children}</>;
}
