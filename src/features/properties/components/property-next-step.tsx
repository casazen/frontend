import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction, type CalmTone } from '@/components/shared/calm';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { knownBlockers, stepTitle } from '@/features/compliance/activation-wizard-model';
import { useComplianceActivation } from '@/features/compliance/use-compliance';
import { displayableMediaUrls } from '@/lib/media-url';
import { formatStayDate, romeDateOf } from '@/lib/stay-dates';
import type { PropertyStatus } from '@/lib/status-dictionary';
import type { PropertyDetailDto } from '@/types';
import { isActivationStep, nextStepOf, type PropertyNextStepKind } from '../lib/property-sheet';
import { PROPERTIES_PATH, propertyWizardPath, propertyCalendarPath, propertyTabPath } from '../properties-paths';

interface PropertyNextStepProps {
  property: PropertyDetailDto;
  /** The state to show (`propertyStatus`): the block is read from it, so it never disagrees with the badge of the header. */
  status: PropertyStatus;
  /** `property.write`: without it the block says what is going on and leads back to the list. */
  canWrite: boolean;
  /** `booking.read`: the calendar is a page of the bookings. */
  canReadBookings: boolean;
  onEditCin: () => void;
  onReactivate: () => void;
  reactivating: boolean;
}

const TONES: Record<PropertyNextStepKind, CalmTone> = {
  suspended: 'danger',
  completeActivation: 'warning',
  reactivate: 'neutral',
  cinMissing: 'warning',
  cinInvalid: 'warning',
  addPhotos: 'neutral',
  allInOrder: 'success',
};

/** What the block says and offers for one step. */
interface StepView {
  title: string;
  body?: ReactNode;
  when?: string;
  /** The step is the host's to take (and the host may): the block says "Tocca a te". */
  hostTurn?: boolean;
  primary: CalmAction;
}

/**
 * "Cosa fare ora" (SR-07d): the one highlighted block of the page of a property. It reads what the property already says (its
 * state, the CIN, the photos) and, while the activation is not over, what the server still misses (the same read as the
 * wizard). It says what to do, whose turn it is, and gives the one button that does it, with the permissions the page always
 * had. A person who may not write is told what is going on and led back to the list.
 */
export function PropertyNextStep({ property, status, canWrite, canReadBookings, onEditCin, onReactivate, reactivating }: PropertyNextStepProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const kind = nextStepOf({ status, cinStatus: property.cinStatus, photoCount: displayableMediaUrls(property.photoUrls).length, canWrite });

  // What the activation still misses, in the words of the wizard: read only while the activation is the step (no request otherwise).
  const activation = useComplianceActivation(isActivationStep(kind) ? property.id : '');
  const steps = activation.data?.steps;
  const missing = steps
    ? [...new Set(knownBlockers(steps).map((blocker) => blocker.step))].map((id) => stepTitle(id, steps, t, (key) => i18n.exists(key)))
    : [];
  const activationBody = (explainKey: string): ReactNode => (
    <>
      {t(explainKey)}
      {missing.length > 0 ? <span className="mt-1 block font-medium">{t('property.next.pending.missing', { steps: missing.join(', ') })}</span> : null}
    </>
  );

  const toProperties: CalmAction = { label: t('property.next.toProperties'), href: PROPERTIES_PATH };
  const activate: CalmAction | null = canWrite
    ? { label: t(kind === 'suspended' ? 'property.next.suspended.action' : 'property.next.pending.action'), href: propertyWizardPath(property.id), testId: 'property-next-activate' }
    : null;

  const viewOfStep = (): StepView => {
    switch (kind) {
      case 'suspended':
        return { title: t('property.next.suspended.title'), body: activationBody('status.property.Suspended.explain'), hostTurn: canWrite, primary: activate ?? toProperties };
      case 'completeActivation':
        return { title: t('property.next.pending.title'), body: activationBody('status.property.Pending.explain'), hostTurn: canWrite, primary: activate ?? toProperties };
      case 'reactivate': {
        const since = formatStayDate(romeDateOf(property.pausedAt), language);
        return {
          title: t('property.next.paused.title'),
          body: t('status.property.Paused.explain'),
          when: since ? t('property.list.pausedSince', { date: since }) : undefined,
          hostTurn: canWrite,
          primary: canWrite ? { label: t('property.list.actions.reactivate'), onClick: onReactivate, loading: reactivating, testId: 'property-next-reactivate' } : toProperties,
        };
      }
      case 'cinMissing':
        return {
          title: t('property.next.cinMissing.title'),
          body: t('property.cin.badge.tooltipMissing'),
          hostTurn: canWrite,
          primary: canWrite ? { label: t('property.next.cinMissing.action'), onClick: onEditCin, testId: 'property-next-cin' } : toProperties,
        };
      case 'cinInvalid':
        return {
          title: t('property.next.cinInvalid.title'),
          body: t('property.cin.badge.tooltipInvalid'),
          hostTurn: canWrite,
          primary: canWrite ? { label: t('property.next.cinInvalid.action'), onClick: onEditCin, testId: 'property-next-cin' } : toProperties,
        };
      case 'addPhotos':
        return {
          title: t('property.next.photos.title'),
          body: t('property.next.photos.body'),
          hostTurn: true,
          primary: { label: t('property.photos.add'), href: propertyTabPath(property.id, 'photos'), testId: 'property-next-photos' },
        };
      case 'allInOrder': {
        const arrival = property.bookingsSummary.nextCheckIn ? formatStayDate(stayDateOf(property.bookingsSummary.nextCheckIn), language) : '';
        return {
          title: t('property.next.allInOrder.title'),
          body: t('status.property.Active.explain'),
          when: arrival ? t('property.next.allInOrder.nextArrival', { date: arrival }) : undefined,
          primary: canReadBookings
            ? { label: t('property.list.actions.calendar'), href: propertyCalendarPath(property.id), testId: 'property-next-calendar' }
            : toProperties,
        };
      }
    }
  };

  const { hostTurn, ...view } = viewOfStep();

  return (
    <FocusBlock
      data-testid="property-next-step"
      data-next-step={kind}
      tone={TONES[kind]}
      kicker={t('property.next.heading')}
      who={hostTurn ? t('property.next.whoHost') : undefined}
      {...view}
    />
  );
}
