import { CalendarSync, CreditCard, type LucideIcon } from 'lucide-react';
import { reachableEntry } from '@/features/account/account-home-model';
import { useWorkspace } from '@/hooks/use-workspace';
import { useConnectStatus } from '@/queries/use-connect';
import { useCalendarOverview } from '@/queries/use-property-ical';
import { resolveConnectUiStatus } from '@/types/connect.types';

const CHANNELS_PATH = '/app/short-rent/channels';
const PAYMENTS_PATH = '/app/short-rent/settings/payments';

export type IntegrationId = 'calendars' | 'payments';

export type IntegrationStatus = 'loading' | 'active' | 'pending' | 'inactive' | 'unknown';

export interface Integration {
  id: IntegrationId;
  icon: LucideIcon;
  href: string;
  status: IntegrationStatus;
  count?: number;
  /** Reads its state again: what a page offers when the state is `unknown` (the read failed), so that it is never told as «nothing is on». */
  reload?: () => void;
}

export function useIntegrations(): Integration[] {
  const { contexts, hasPermission } = useWorkspace();
  const reach = { contexts, hasPermission };
  const canCalendars = reachableEntry([CHANNELS_PATH], reach) !== undefined;
  const canPayments = reachableEntry([PAYMENTS_PATH], reach) !== undefined;
  const calendars = useCalendarOverview(canCalendars);
  const payments = useConnectStatus(false, canPayments);

  const integrations: Integration[] = [];

  if (canCalendars) {
    const properties = Array.isArray(calendars.data?.properties) ? calendars.data.properties : null;
    const linked = properties?.reduce((total, property) => total + (Array.isArray(property.feeds) ? property.feeds.length : 0), 0) ?? 0;
    integrations.push({
      id: 'calendars',
      icon: CalendarSync,
      href: CHANNELS_PATH,
      status: properties ? (linked > 0 ? 'active' : 'inactive') : calendars.isPending ? 'loading' : 'unknown',
      count: linked,
      reload: () => void calendars.refetch(),
    });
  }

  if (canPayments) {
    const connect = payments.data && typeof payments.data === 'object' ? resolveConnectUiStatus(payments.data) : undefined;
    integrations.push({
      id: 'payments',
      icon: CreditCard,
      href: PAYMENTS_PATH,
      status: connect === 'active' ? 'active' : connect === 'pending' ? 'pending' : connect ? 'inactive' : payments.isPending ? 'loading' : 'unknown',
      reload: () => void payments.refetch(),
    });
  }

  return integrations;
}
