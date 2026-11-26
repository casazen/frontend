import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { GuestPortalLinkPanel } from './guest-portal-link-panel';
import { GuestStayChangePanel } from './guest-stay-change-panel';
import { HostExtrasEditor } from './host-extras-editor';

export function BookingGuestPortalPanel({ bookingId, propertyId, canManage, canConfigure, onStayChanged }: {
  bookingId: string;
  propertyId: string;
  canManage: boolean;
  canConfigure: boolean;
  onStayChanged: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl space-y-4">
      <GuestPortalLinkPanel bookingId={bookingId} />
      <GuestStayChangePanel bookingId={bookingId} onApproved={onStayChanged} />
      {canManage && <HostExtrasEditor bookingId={bookingId} propertyId={propertyId} />}
      {canConfigure && <Button asChild variant="outline">
        <Link to={`/app/short-rent/settings/guest-portal?propertyId=${encodeURIComponent(propertyId)}`}>{t('guestPortal.setup.title')}</Link>
      </Button>}
    </div>
  );
}
