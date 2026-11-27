import { ChevronDown, Clock, DoorOpen, House, KeyRound, LogIn, LogOut, MapPin, Phone, SquareParking, Wifi, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { guideSteps } from './guide-steps';
import type { guideFields, HouseGuide } from './house-guide-fields';

type GuideField = (typeof guideFields)[number];

const icons: Record<GuideField, LucideIcon> = { arrival: LogIn, checkInHours: Clock, house: House, departure: LogOut, checkOutHours: DoorOpen, parking: SquareParking, contacts: Phone, localTips: MapPin, access: KeyRound, wifi: Wifi };

/**
 * The order of a guest, not the order of the form of the host (`guideFields`): on the day of arrival they look for how to get
 * there, how to get in, the Wi-Fi and where to park; the house, the departure and the tips come after.
 */
const GUEST_ORDER: readonly GuideField[] = ['arrival', 'access', 'wifi', 'parking', 'checkInHours', 'house', 'departure', 'checkOutHours', 'contacts', 'localTips'];

/** Open from the start: the three that answer «how do I get in and get online». */
const OPEN_FIRST: ReadonlySet<GuideField> = new Set<GuideField>(['arrival', 'access', 'wifi']);

/** The fields that are a way to follow, and so may become numbered steps. */
const STEP_FIELDS: ReadonlySet<GuideField> = new Set<GuideField>(['arrival', 'access']);

interface HouseGuideSectionsProps {
  /** What the host wrote. A stay whose host wrote nothing may come without it: then there are no sections (never a crash of the page). */
  guide: HouseGuide | null | undefined;
  /**
   * The names of the sections in the language of the page. The guest portal speaks five languages of its own (not the language
   * of the app), so it hands them in; without them the names are the app's.
   */
  labels?: Partial<Record<GuideField, string>>;
  /** «Passo 2 di 6» in the language of the page; without it, the app's. */
  stepLabel?: (step: number, total: number) => string;
}

/** The guide of the house for the guest: one section per thing the host wrote, the way in first, the way to follow as numbered steps. */
export function HouseGuideSections({ guide, labels, stepLabel }: HouseGuideSectionsProps) {
  const { t } = useTranslation();
  const title = (field: GuideField) => labels?.[field] ?? t(`guestPortal.guide.${field}`);
  const stepOf = stepLabel ?? ((step: number, total: number) => t('guestPortal.guide.stepOf', { step, total }));

  return GUEST_ORDER.map((field) => {
    const value = guide?.[field]?.trim();
    if (!value) return null;
    const Icon = icons[field];
    const steps = STEP_FIELDS.has(field) ? guideSteps(value) : [];
    return (
      <details key={field} open={OPEN_FIRST.has(field)} className="group border-t" data-guide-field={field}>
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-md py-3 text-start font-semibold focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          <span>{title(field)}</span>
          <ChevronDown aria-hidden="true" className="ms-auto size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        {steps.length > 0 ? (
          <ol className="grid max-w-prose gap-3 pb-4 ps-8" data-testid={`guide-steps-${field}`}>
            {steps.map((step, index) => (
              <li key={index} className="rounded-xl border bg-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">{stepOf(index + 1, steps.length)}</p>
                <p className="mt-1 whitespace-pre-wrap break-words">{step}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="max-w-prose whitespace-pre-wrap break-words pb-4 ps-8">{value}</p>
        )}
      </details>
    );
  });
}
