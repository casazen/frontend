import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDetailDrawer } from '@/components/shared/detail-drawer/use-detail-drawer';
import { SWISS_LAYER_KIND, swissLayerPath } from '@/features/compliance/swiss/swiss-layer-address';
import { WorkspaceContext } from '@/contexts/workspace-context';
import type { GuestRegistrationDuty, GuestRegistrationRegime } from '@/types/guest-registration.types';
import { GUEST_REGISTER_LAYER_KIND, guestRegisterLayerPath } from '../lib/guest-register-address';

interface GuestRegistrationLayersProps {
  propertyId: string;
  regime: GuestRegistrationRegime;
  effectiveDuty: GuestRegistrationDuty;
}

const LINK = 'inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline';

/**
 * What CasaZen opens for the host from the card of the regime (E31/F02/US02/T01 and T02, casazen/backend#979): the guest register of a property in Switzerland, whatever its canton, and, where
 * the canton asks for an electronic notification and CasaZen prepares it, the assisted notification. Both are layers of the app (the detail drawer): they open over the page of the
 * property, never send the host out of the process. Nothing for a property that is not in Switzerland, and nothing for who may not read the guests (`guest.read` and `booking.read`: what the
 * layers ask) or where there is no workspace to say it: a link that only says «you may not» is not offered.
 */
export function GuestRegistrationLayers({ propertyId, regime, effectiveDuty }: GuestRegistrationLayersProps) {
  const { t } = useTranslation();
  const drawer = useDetailDrawer();
  const workspace = useContext(WorkspaceContext);
  const mayReadGuests = workspace ? workspace.hasPermission('short-rent', 'guest.read') && workspace.hasPermission('short-rent', 'booking.read') : false;

  if (regime.countryCode !== 'CH' || !mayReadGuests) return null;
  const assisted = regime.casaZenSupport === 'AssistedNotification' && effectiveDuty !== 'NotRequired';

  return (
    <div className="flex flex-wrap items-center gap-x-5" data-testid="guest-registration-layers">
      <Link
        to={guestRegisterLayerPath(propertyId)}
        onClick={(event) => {
          if (drawer.open(GUEST_REGISTER_LAYER_KIND, propertyId, { opener: event.currentTarget })) event.preventDefault();
        }}
        className={LINK}
        data-testid="guest-register-link"
      >
        {t('guestRegister.card.open')}
      </Link>
      {assisted ? (
        <Link
          to={swissLayerPath(propertyId)}
          onClick={(event) => {
            if (drawer.open(SWISS_LAYER_KIND, propertyId, { opener: event.currentTarget })) event.preventDefault();
          }}
          className={LINK}
          data-testid="swiss-notification-link"
        >
          {t('swissNotification.card.open')}
        </Link>
      ) : null}
    </div>
  );
}
