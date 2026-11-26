import { ChevronDown, Clock, DoorOpen, House, KeyRound, LogIn, LogOut, MapPin, Phone, SquareParking, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { guideFields, type HouseGuide } from './house-guide-fields';

const icons = { arrival: LogIn, checkInHours: Clock, house: House, departure: LogOut, checkOutHours: DoorOpen, parking: SquareParking, contacts: Phone, localTips: MapPin, access: KeyRound, wifi: Wifi };

export function HouseGuideSections({ guide }: { guide: HouseGuide }) {
  const { t } = useTranslation();
  return guideFields.map((field) => {
    const value = guide[field]?.trim();
    if (!value) return null;
    const Icon = icons[field];
    return (
      <details key={field} open={field === 'arrival'} className="group border-t">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-md py-3 text-start font-semibold focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          <span>{t(`guestPortal.guide.${field}`)}</span>
          <ChevronDown aria-hidden="true" className="ms-auto size-4 shrink-0 group-open:rotate-180" />
        </summary>
        <p className="max-w-prose whitespace-pre-wrap break-words pb-4 ps-8">{value}</p>
      </details>
    );
  });
}
