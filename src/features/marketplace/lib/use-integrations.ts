import { CalendarSync, CreditCard, type LucideIcon } from 'lucide-react';
import { reachableEntry } from '@/features/account/account-home-model';
import { useWorkspace } from '@/hooks/use-workspace';
import { useConnectStatus } from '@/queries/use-connect';
import { useCalendarOverview } from '@/queries/use-property-ical';
import { resolveConnectUiStatus } from '@/types/connect.types';

/** The pages where the integrations are set up and managed: the marketplace only leads to them and says whether they are on. */
const CHANNELS_PATH = '/app/short-rent/channels';
const PAYMENTS_PATH = '/app/short-rent/settings/payments';

export type IntegrationId = 'calendars' | 'payments';

/**
 * Where an integration stands. `pending` is a payments account that is not verified yet; `unknown` is a state that could not be read
 * (the card is then shown without one, never as «Da attivare»).
 */
export type IntegrationStatus = 'loading' | 'active' | 'pending' | 'inactive' | 'unknown';

export interface Integration {
  id: IntegrationId;
  icon: LucideIcon;
  /** The page where it is managed. */
  href: string;
  status: IntegrationStatus;
  /** How many calendars are linked (calendars only). */
  count?: number;
  /** Reads its state again: what a page offers when the state is `unknown` (the read failed), so that it is never told as «nothing is on». */
  reload?: () => void;
}

/**
 * «Altre integrazioni» of the marketplace: what CasaZen already connects to outside, and whether the host has it on. Nothing is
 * invented: the calendars of Airbnb and Booking.com (iCal) and the card payments (Stripe), each read from its own endpoint and only
 * for the people who may open its page (a read they may not make would send them to the page of no access).
 */
export function useIntegrations(): Integration[] {
  const { contexts, hasPermission } = useWorkspace();
  const reach = { contexts, hasPermission };
  const canCalendars = reachableEntry([CHANNELS_PATH], reach) !== undefined;
  const canPayments = reachableEntry([PAYMENTS_PATH], reach) !== undefined;
  const calendars = useCalendarOverview(canCalendars);
  const payments = useConnectStatus(false, canPayments);

  const integrations: Integration[] = [];

  if (canCalendars) {
    // An answer that is not a list of properties is as good as no answer: the card says nothing of its state, it does not break the page.
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
