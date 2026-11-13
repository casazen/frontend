import { useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction, type CalmTone } from '@/components/shared/calm';
import { Skeleton } from '@/components/ui/skeleton';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { knownBlockers, stepTitle } from '@/features/compliance/activation-wizard-model';
import { ComplianceLines } from '@/features/compliance/components/compliance-lines';
import { deadlineNote } from '@/features/compliance/lib/cockpit-model';
import { periodName, reasonText } from '@/features/compliance/lib/compliance-light';
import { hasLinesToShow, propertyLinesOf, viewOfLines } from '@/features/compliance/lib/compliance-lines';
import { ComplianceUnavailable } from '@/features/compliance/components/compliance-unavailable';
import { lightsCouldNotBeRead, lightsOf, useComplianceActivation, useComplianceLights } from '@/features/compliance/use-compliance';
import { useWorkspace } from '@/hooks/use-workspace';
import { COMPLIANCE_ACTION_TARGETS, complianceActionRoute, isCurrentAddress } from '@/lib/compliance-routes';
import { displayableMediaUrls } from '@/lib/media-url';
import { formatStayDate, romeDateOf, todayInRome } from '@/lib/stay-dates';
import type { PropertyStatus } from '@/lib/status-dictionary';
import type { PropertyDetailDto } from '@/types';
import { complianceLineOf, isActivationStep, mayGiveWayToCompliance, nextStepOf, type PropertyNextStepKind } from '../lib/property-sheet';
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
  // The tone of a compliance item is its light's: red (the deadline red once it has passed), blue while it is in hand.
  compliance: 'warning',
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
  const { hasPermission } = useWorkspace();
  const location = useLocation();
  // The lights of the property's compliance items (the police send, the tourist tax, ISTAT: NF-52, AC-NF52-9) come from the summary of the adempimenti:
  // only for a property that works (the others are about their activation), and only for whoever may read the bookings (the API asks that: a bare 403
  // on a GET takes the user to «nessun accesso»).
  const wantsLights = canReadBookings && (status === 'Active' || status === 'Paused');
  const lights = useComplianceLights(wantsLights);
  const summary = lightsOf(lights);
  const lightsFailed = wantsLights && lightsCouldNotBeRead(lights);
  const lines = useMemo(() => (summary ? propertyLinesOf(summary, property.id) : []), [summary, property.id]);
  const facts = { status, cinStatus: property.cinStatus, photoCount: displayableMediaUrls(property.photoUrls).length, canWrite };
  const kind = nextStepOf({ ...facts, compliance: lines });

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

  // The lights can take back a step that says «tutto in ordine» or asks for a photo: until they are read, that is not said.
  if (wantsLights && lights.isLoading && mayGiveWayToCompliance(nextStepOf(facts))) {
    return (
      <div role="status" aria-busy="true" data-testid="property-next-step-loading">
        <span className="sr-only">{t('shared.loading.srOnly')}</span>
        <Skeleton aria-hidden="true" className="h-36 w-full rounded-xl motion-reduce:animate-none" />
      </div>
    );
  }

  // A read of the lights that failed (not a 404, which is the traffic light off) never lets the block say «tutto in ordine»: it says it does not know,
  // and offers to try again. A step that asks something (a photo, the CIN, a compliance item) is said as it is.
  if (lightsFailed && kind === 'allInOrder') {
    return <ComplianceUnavailable kicker={t('property.next.heading')} testId="property-next-step" onRetry={() => void lights.refetch()} retrying={lights.isFetching} />;
  }

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
      case 'compliance': {
        // The worst compliance item of the property (NF-52): red is the host's to do, yellow is in hand.
        const line = complianceLineOf(lines);
        if (!line) return { title: t('property.next.compliance.waiting.title'), primary: toProperties };
        const route = complianceActionRoute(line.item, hasPermission);
        const mayAct = hasPermission('short-rent', COMPLIANCE_ACTION_TARGETS[line.action].write);
        // The tourist tax rate leads to the page of the property, which is the page this card is on (above every tab) and has no field for it yet: a
        // button that opens the page you are on does nothing, so there is none. The block still says what is wrong and why, and leads back to the
        // list; it is not the host's turn here until the page where it is done exists. The police send opens the wizard that activates it (E03/F01/US02/T02),
        // another page; for who may only read the property it opens the section of its connection health on this same page (`?section=connection-health`,
        // E03/F03/US02/T01), which is not the address the person is on until they have opened it.
        const opens = route !== null && !isCurrentAddress(route, location);
        const action: CalmAction =
          route && opens
            ? { label: mayAct ? t(`dashboard.todo.${line.action}.cta`) : t('dashboard.todo.open'), href: route, testId: 'property-next-compliance' }
            : toProperties;
        const reason = reasonText(line.reason, line.state, { t, exists: (key) => i18n.exists(key) });
        const when = deadlineNote(line.dueAt, { t, locale: language })?.text;
        return line.state === 'red'
          ? {
              title: t(`dashboard.todo.${line.action}.title`, { label: property.name, period: periodName(line.period, language) || t('compliance.item.noPeriod') }),
              body: reason,
              when,
              hostTurn: mayAct && opens,
              primary: action,
            }
          : { title: t('property.next.compliance.waiting.title'), body: reason, when, primary: action };
      }
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
  const line = kind === 'compliance' ? complianceLineOf(lines) : undefined;
  // A compliance step has the light of its item: the deadline red once it has passed, the blue of «in hand» for what the host has not to do.
  const overdue = line !== undefined && romeDateOf(line.dueAt) !== '' && romeDateOf(line.dueAt) < todayInRome();
  const tone: CalmTone = kind === 'compliance' && line ? (line.state === 'red' ? (overdue ? 'danger' : 'warning') : 'info') : TONES[kind];

  // The lights of the other items of the property, under what the block says: the same `ComplianceLight` and words as the page of the adempimenti.
  const lineView = viewOfLines(lines, { skip: line?.id });
  const body = hasLinesToShow(lineView) ? (
    <>
      {view.body}
      <ComplianceLines lines={lines} label={t('compliance.lines.ofProperty')} hasPermission={hasPermission} skip={line?.id} greens="count" />
    </>
  ) : (
    view.body
  );

  return (
    <FocusBlock
      data-testid="property-next-step"
      data-next-step={kind}
      tone={tone}
      kicker={t('property.next.heading')}
      who={hostTurn ? t('property.next.whoHost') : undefined}
      {...view}
      body={body}
    />
  );
}
