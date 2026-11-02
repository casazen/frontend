import { useOnlineStatus } from '@/hooks/use-online-status';

/**
 * Whether the guest has a connection (DB-02b). The pages of the booking site read it to switch off what needs the network
 * (checking the dates, booking, writing to the host) and the band under the header (`OfflineBar`) says why, once, for the whole
 * site. It is the hint of the browser, not a proof: an action that is sent keeps its own error and its retry.
 */
export function useOnline(): boolean {
  return useOnlineStatus();
}
