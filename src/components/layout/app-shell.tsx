import { useAppShell } from './app-shell-context';
import { AppShellLayout } from './app-shell-layout';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Wrapper that pages still put around their content. Since UI-03 the shell belongs to the route (`ContextLayout` mounts
 * `AppShellLayout`), so inside it this renders just the children: a page never gets a second shell and the pages that
 * wrap themselves keep working unchanged. Outside any shell (a render that is not under a context layout) it gives the
 * short-rent shell, as it always did.
 *
 * Transitional: the pages will drop the wrapper in a follow-up (codemod by folder), then this file goes away.
 */
export function AppShell({ children }: AppShellProps) {
  const shell = useAppShell();
  if (shell) return <>{children}</>;

  return <AppShellLayout contextKey="short-rent">{children}</AppShellLayout>;
}
