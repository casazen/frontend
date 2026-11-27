import type { ReactNode } from 'react';
import { Archive, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ManualHint } from '@/components/shared/manual-hint';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SkeletonLine } from '@/components/ui/skeleton';
import { AssistRequestButton } from '@/features/onboarding/components/assist-request-button';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { COMPLIANCE_ACTION_TARGETS, complianceActionRoute } from '@/lib/compliance-routes';
import { panelStepPath } from '@/lib/onboarding-panel';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { todayInRome } from '@/lib/stay-dates';
import { useIstatCoverage } from '@/queries/use-istat-regions';
import { formatPeriod, listedMonths } from '../lib/archive-model';
import { deadlineShown, isVerified, noticeActionOf, noticeShown, portalAddress, regionShown } from '../lib/istat-coverage-model';

/** The permission of the guided step of the panel and of the wizard that leads to it: whoever may not write the property is not offered the link (the step is also the organization administrator's). */
const PANEL_STEP_PERMISSION = 'property.write';

/** The words of the button of the request to support: «Chiedi al supporto» (a code of the button, not a text). */
const SUPPORT_LABEL = 'askSupport';

interface IstatCoverageNoticeProps {
  propertyId: string;
  /** The property page also offers the upload of the proof of the month; the wizard, which activates the sending, does not. */
  showProof?: boolean;
  /**
   * Drawn inside a wizard. A wizard never takes the person out of the process, and what was typed in it (the credentials are in its state only) is lost when the page is left: so the next
   * step is told in words and no link leaves the wizard. The request to support and the guide of the regional portal (another tab) stay.
   */
  inWizard?: boolean;
  /**
   * The first step of the wizard, where the sender is still to be chosen: the notice tells what the channel manager does in the region, whoever sends the ISTAT today. Everywhere else it
   * accounts for who sends it: a property whose ISTAT is sent by the host or by CasaZen is never told «lo invia il tuo channel manager».
   */
  senderOpen?: boolean;
  compact?: boolean;
}

/**
 * The ISTAT coverage notice of a property (E21/F01/US02/T01, NF-44, NF-52, CHK-05 point 3): «La tua regione (Lombardia) usa Ross1000. Il channel manager: lo invia / non lo invia / da
 * verificare», the deadline in plain words and one action for the next step (the guided step of the panel, the guide of the regional portal with the address the staff configured, or the request
 * to support). It reads the table the staff keeps (`GET /properties/{id}/istat-coverage`) and says «da verificare» for anything the table does not state as verified: a region is never shown as
 * covered on a guess, an old answer or a failed read. It is drawn before any data is asked (the first step of the sender wizard, the ISTAT part of its credentials step) and on the property page,
 * where it also leads to the upload of the proof of the month. It never names the channel manager. Behind the flag `octorateOnboarding`, like the endpoint: with the flag off nothing is
 * drawn and nothing is asked.
 */
export function IstatCoverageNotice({ propertyId, showProof = false, inWizard = false, senderOpen = false, compact = false }: IstatCoverageNoticeProps) {
  const { flags } = useFeatureFlags();

  return flags.octorateOnboarding && propertyId !== '' ? (
    <Notice propertyId={propertyId} showProof={showProof} inWizard={inWizard} senderOpen={senderOpen} compact={compact} />
  ) : null;
}

function Notice({ propertyId, showProof, inWizard, senderOpen, compact }: Required<IstatCoverageNoticeProps>) {
  const { t, i18n } = useTranslation();
  const { contexts, hasPermission } = useWorkspace();
  const coverage = useIstatCoverage(propertyId);

  // The read failed: the answer the query still holds is an older one and is not what is true now, so nothing is said from it (a 404 is «not found» whatever the cache holds).
  if (coverage.isError) {
    const status = getHttpStatus(coverage.error);
    // A property the caller does not reach, or another org's, is told by the screen that holds the notice.
    if (status === 404 || status === 403) return null;
    return (
      <Alert
        variant="warning"
        data-testid="istat-coverage-error"
        title={t('istatCoverage.title.toVerify')}
        action={
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => void coverage.refetch()} disabled={coverage.isFetching}>
            {t('istatCoverage.retry')}
          </Button>
        }
      >
        {t('istatCoverage.loadError')}
      </Alert>
    );
  }

  if (!coverage.data) {
    return (
      <div data-testid="istat-coverage-loading">
        <SkeletonLine lines={2} label={t('istatCoverage.loading')} />
      </div>
    );
  }

  const data = coverage.data;
  // A property outside Italy has no regional flow: the screen that holds the notice says so.
  if (!data.applies) return null;

  const shown = noticeShown(data, senderOpen);
  const region = regionShown(data);
  const deadline = deadlineShown(data);
  const action = noticeActionOf(shown, data);
  const portal = portalAddress(data);
  const canWrite = hasPermission('short-rent', PANEL_STEP_PERMISSION);

  let step: ReactNode = null;
  if (action === 'panelStep') {
    if (inWizard) {
      // A wizard never leaves the process: here the step is told in words (it is done from the property page once the wizard is over), and no link takes the person away from what they typed.
      step = (
        <p className="text-sm" data-testid="istat-coverage-panel-step-later">
          {t('istatCoverage.action.panelStepInWizard')}
        </p>
      );
    } else if (canWrite && isOrgBillingAdmin(contexts)) {
      step = (
        <Button asChild size="sm" className="min-h-11">
          <Link to={panelStepPath({ kind: 'istatConnection', propertyId })} data-testid="istat-coverage-panel-step">
            {t('istatCoverage.action.panelStep')}
          </Link>
        </Button>
      );
    } else if (canWrite) {
      // The guided step of the panel is the organization administrator's (the page of the step says so to anyone else): here the person is told who does it, not led to a page with nothing to press.
      step = (
        <p className="text-sm" data-testid="istat-coverage-panel-step-admin-only">
          {t('onboardingPlan.panel.adminOnly')}
        </p>
      );
    }
  } else if (action === 'portalGuide' && portal !== null) {
    step = (
      <Button asChild size="sm" variant="outline" className="min-h-11">
        <a href={portal} target="_blank" rel="noopener noreferrer" data-testid="istat-coverage-portal">
          {t('istatCoverage.action.portalGuide')}
          <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only">{t('istatCoverage.action.newTab')}</span>
        </a>
      </Button>
    );
  } else if (action === 'support') {
    // The request to support is the organization administrator's (the server asks it): anyone else is told who can make it.
    step = isOrgBillingAdmin(contexts) ? (
      <AssistRequestButton part="compliance" context="panelIstat" propertyId={propertyId} label={SUPPORT_LABEL} />
    ) : (
      <p className="text-sm" data-testid="istat-coverage-support-admin-only">
        {t('istatCoverage.action.supportAdminOnly')}
      </p>
    );
  }

  // The proof of the month that is over: the existing upload of the archive, opened on the ISTAT proof of this property and that month.
  const period = listedMonths(todayInRome())[1];
  const proofRoute = showProof ? complianceActionRoute({ action: 'UploadIstatProof', propertyId, bookingId: null, period }, hasPermission) : null;
  // The archive opens for whoever may read the bookings, but only who may submit the Alloggiati can upload to it: the others are told «Apri», as the cockpit does, never asked to upload.
  const canUploadProof = hasPermission('short-rent', COMPLIANCE_ACTION_TARGETS.UploadIstatProof.write);

  if (compact) {
    const title = t(`istatCoverage.title.${shown}`);
    const explanation = [
      t(`istatCoverage.detail.${shown}`),
      region.kind !== 'unknown' && !isVerified(data) ? t('istatCoverage.unverified') : null,
      action === 'support' && shown === 'notCovered' ? t('istatCoverage.portalMissing') : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="min-w-0 space-y-2" data-testid="istat-coverage-notice" data-coverage={shown}>
        <Alert variant={shown === 'covered' || shown === 'otherSender' ? 'info' : 'warning'} title={title} action={step}>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <p data-testid="istat-coverage-region">
              {region.kind === 'named'
                ? t('istatCoverage.region.named', { region: region.region, system: region.system })
                : region.kind === 'noSystem'
                  ? t('istatCoverage.region.noSystem', { region: region.region })
                  : t('istatCoverage.region.unknown')}
            </p>
            <ManualHint page="alloggiati-istat" anchor="comunicare-l-istat-della-tua-regione" title={title}>
              {explanation}
            </ManualHint>
          </div>
          <p className="mt-1" data-testid="istat-coverage-deadline">
            {deadline.kind === 'monthly' ? t('istatCoverage.deadline.monthly', { day: deadline.day }) : t(`istatCoverage.deadline.${deadline.kind}`)}
          </p>
        </Alert>
        {proofRoute ? (
          <p className="flex items-center gap-2 text-sm" data-testid="istat-coverage-proof">
            <Archive aria-hidden="true" className="size-4 shrink-0 text-foreground/70" />
            <Link to={proofRoute} className="inline-block min-h-11 py-2.5 font-medium text-primary-text underline underline-offset-4" data-testid="istat-coverage-proof-link">
              {t(canUploadProof ? 'istatCoverage.proof.action' : 'istatCoverage.proof.open', { month: formatPeriod(period, i18n.language) })}
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2" data-testid="istat-coverage-notice" data-coverage={shown}>
      <Alert variant={shown === 'covered' || shown === 'otherSender' ? 'info' : 'warning'} title={t(`istatCoverage.title.${shown}`)} action={step}>
        <p data-testid="istat-coverage-region">
          {region.kind === 'named'
            ? t('istatCoverage.region.named', { region: region.region, system: region.system })
            : region.kind === 'noSystem'
              ? t('istatCoverage.region.noSystem', { region: region.region })
              : t('istatCoverage.region.unknown')}
        </p>
        <p className="mt-1" data-testid="istat-coverage-detail">
          {t(`istatCoverage.detail.${shown}`)}
        </p>
        <p className="mt-1" data-testid="istat-coverage-deadline">
          {deadline.kind === 'monthly' ? t('istatCoverage.deadline.monthly', { day: deadline.day }) : t(`istatCoverage.deadline.${deadline.kind}`)}
        </p>
        {region.kind !== 'unknown' && !isVerified(data) ? (
          <p className="mt-1" data-testid="istat-coverage-unverified">
            {t('istatCoverage.unverified')}
          </p>
        ) : null}
        {action === 'support' && shown === 'notCovered' ? (
          <p className="mt-1" data-testid="istat-coverage-portal-missing">
            {t('istatCoverage.portalMissing')}
          </p>
        ) : null}
      </Alert>
      {proofRoute ? (
        <p className="text-sm" data-testid="istat-coverage-proof">
          {t('istatCoverage.proof.lead')}{' '}
          <Link to={proofRoute} className="inline-block min-h-11 py-2.5 font-medium text-primary-text underline underline-offset-4" data-testid="istat-coverage-proof-link">
            {t(canUploadProof ? 'istatCoverage.proof.action' : 'istatCoverage.proof.open', { month: formatPeriod(period, i18n.language) })}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
