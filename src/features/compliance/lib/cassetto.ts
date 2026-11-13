import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';

/**
 * Whether the host can be taken to the Cassetto Compliance from here: the passage is behind the connector flag (the API answers 404 while it is
 * off) and asks `booking.read` (its policy). Without either the screens say where the outcome is and give no button: a button that can only fail is
 * not offered.
 */
export function useCassettoAvailable(): boolean {
  const { octorateConnector } = useFeatureFlags().flags;
  const { hasPermission } = useWorkspace();
  return octorateConnector && hasPermission('short-rent', 'booking.read');
}

/** The address a handoff opens: https, on no credentials. The server allowlists it; the page still refuses anything else instead of leaving CasaZen for it. */
export function isSafeDestination(address: string): boolean {
  try {
    const url = new URL(address);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** The way out of CasaZen, always in the same tab. It is a seam: a test sees where the host goes (jsdom cannot navigate), and nothing else opens a window. */
export const sameTabNavigation = {
  to: (address: string): void => window.location.assign(address),
};
