import { useState } from 'react';
import { BookOpen, ClipboardList, Gift, Link2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { GuestSupplierOperations } from '@/features/guest-portal/guest-supplier-operations';
import { GuestHouseGuideEditor } from './guest-house-guide-editor';
import { GuestPortalLinkPanel } from './guest-portal-link-panel';
import { GuestStayChangePanel } from './guest-stay-change-panel';
import { HostExtrasEditor } from './host-extras-editor';

export function BookingGuestPortalPanel({ bookingId, propertyId, canManage, supplierServices, onStayChanged }: {
  bookingId: string;
  propertyId: string;
  canManage: boolean;
  supplierServices: boolean;
  onStayChanged: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<'access' | 'guide' | 'extras' | 'orders'>('access');
  const sections = ([
    { id: 'access', icon: Link2, label: t('guestPortal.host.accessSection'), visible: true },
    { id: 'guide', icon: BookOpen, label: t('guestPortal.guide.title'), visible: canManage },
    { id: 'extras', icon: Gift, label: t('guestPortal.setup.extras'), visible: canManage },
    { id: 'orders', icon: ClipboardList, label: t('guestPortal.host.ordersSection'), visible: canManage && supplierServices },
  ] as const).filter(({ visible }) => visible);
  const section = sections.some(({ id }) => id === selected) ? selected : 'access';

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <nav aria-label={t('guestPortal.host.title')} className="grid gap-1 rounded-xl border bg-card p-2 min-[400px]:grid-cols-2 lg:grid-cols-1">
        {sections.map(({ id, icon: Icon, label }) => (
          <Button key={id} type="button" variant={section === id ? 'soft' : 'ghost'}
            aria-current={section === id ? 'true' : undefined} onClick={() => setSelected(id)}
            className="min-h-11 justify-start gap-3 px-3 text-sm">
            <Icon aria-hidden="true" className="size-4 shrink-0" />{label}
          </Button>
        ))}
      </nav>
      <div className="min-w-0">
        <div hidden={section !== 'access'} className="space-y-4">
          <GuestPortalLinkPanel bookingId={bookingId} />
          <GuestStayChangePanel bookingId={bookingId} onApproved={onStayChanged} />
        </div>
        {canManage && (
          <>
            <div hidden={section !== 'guide'}>
              <GuestHouseGuideEditor propertyId={propertyId} withAi />
            </div>
            <div hidden={section !== 'extras'}>
              <HostExtrasEditor bookingId={bookingId} propertyId={propertyId} />
            </div>
            {supplierServices && (
              <div hidden={section !== 'orders'}>
                <GuestSupplierOperations scope={{ role: 'host', propertyId }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
