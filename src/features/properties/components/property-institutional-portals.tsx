import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChartColumn, Landmark, ShieldCheck } from 'lucide-react';
import { InfoCard } from '@/components/shared/calm';
import { ManualHint } from '@/components/shared/manual-hint';
import { Button } from '@/components/ui/button';
import { ComplianceDrawerButton } from '@/features/compliance/compliance-drawer/compliance-drawer-button';
import { Ross1000Panel } from '@/features/compliance/components/ross1000-panel';
import { IstatCredentialsCard } from '@/features/compliance/components/istat-credentials-card';
import { senderWizardPath } from '@/features/compliance/lib/connection-health-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import type { PropertyDetailDto } from '@/types';
import { useDirectRoutes } from '@/queries/use-direct-routes';
import { DirectPortalActivation } from './direct-portal-activation';
import { ComoStayTourReport } from '@/features/reports/tourist-tax/como-staytour-report';
import { QuesturaCredentialsCard } from './questura-credentials-card';

export function PropertyInstitutionalPortals({ property, canWrite }: { property: PropertyDetailDto; canWrite: boolean }) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const { hasPermission } = useWorkspace();
  const routes = useDirectRoutes(property.id);
  const direct = routes.isSuccess ? routes.data : undefined;
  const migrated = Boolean(direct?.effectiveFrom.alloggiati || direct?.effectiveFrom.istat);
  const senderPath = canWrite ? senderWizardPath(property.id, hasPermission) : null;
  const canReadReport = hasPermission('short-rent', 'payment.read');
  const isComo = property.comuneIstatCode
    ? property.comuneIstatCode === '013075'
    : property.city?.trim().toLowerCase() === 'como';

  return (
    <>
      {routes.isError && (
        <p role="alert" className="text-sm @3xl:col-span-2">
          {t('institutionalPortals.routeError')} <Button variant="ghost" onClick={() => void routes.refetch()}>{t('questuraCredentials.retry')}</Button>
        </p>
      )}
      <InfoCard
        icon={ShieldCheck}
        title={t('connectionHealth.topic.Alloggiati')}
        hint={
          <ManualHint page="alloggiati-istat" anchor="cosa-ti-serve-per-inviare-le-credenziali-di-alloggiati-web" title={t('connectionHealth.topic.Alloggiati')}>
            {t('questuraCredentials.description')}
          </ManualHint>
        }
        action={!migrated && senderPath ? { label: t('institutionalPortals.sender'), href: senderPath } : undefined}
        data-testid="institutional-portal-alloggiati"
      >
        <QuesturaCredentialsCard propertyId={property.id} canEdit={canWrite} embedded />
        {direct && <DirectPortalActivation propertyId={property.id} service="alloggiati" routes={direct} canWrite={canWrite} />}
        {!migrated && <ComplianceDrawerButton target={{ topic: 'Alloggiati', propertyId: property.id }} subject="Alloggiati Web" />}
      </InfoCard>
      {(flags.octorateOnboarding || direct?.istatSupported || direct?.effectiveFrom.istat) && (
        <InfoCard
          icon={ChartColumn}
          title={t('connectionHealth.topic.Istat')}
          hint={
            <ManualHint page="alloggiati-istat" anchor="comunicare-l-istat-della-tua-regione" title={t('connectionHealth.topic.Istat')}>
              {t('istatCredentials.description')} {t('istatCredentials.hints.structureCode')}
            </ManualHint>
          }
          data-testid="institutional-portal-istat"
        >
          {property.regionCode === 'LOM' && <p className="text-sm font-medium">{t('institutionalPortals.ross1000')}</p>}
          <IstatCredentialsCard propertyId={property.id} canEdit={canWrite} embedded />
          {direct && <DirectPortalActivation propertyId={property.id} service="istat" routes={direct} canWrite={canWrite} />}
          {!migrated && <ComplianceDrawerButton target={{ topic: 'Istat', propertyId: property.id }} subject="ISTAT" />}
        </InfoCard>
      )}
      {property.comuneIstatCode?.startsWith('013') && (
        <Ross1000Panel propertyId={property.id} canWrite={canWrite} canSend={Boolean(direct?.istatAvailable && direct?.effectiveFrom.istat)} />
      )}
      <InfoCard
        icon={Landmark}
        title={t('institutionalPortals.tax')}
        hint={
          <ManualHint
            page="imposta-soggiorno-documenti"
            anchor={isComo ? 'come-viene-rendicontata' : 'come-casazen-calcola-l-imposta-di-soggiorno'}
            title={t('institutionalPortals.tax')}
          >
            {t(isComo ? 'institutionalPortals.como' : 'institutionalPortals.municipality')}
          </ManualHint>
        }
        data-testid="institutional-portal-tax"
      >
        <div className="flex flex-wrap gap-2">
          {canReadReport && (
            <Button asChild variant="outline" size="sm"><Link to="/app/short-rent/reports/tourist-tax">{t('institutionalPortals.report')}</Link></Button>
          )}
          {isComo && (
            <Button asChild variant="outline" size="sm">
              <a href="https://imposta-soggiorno.org/como/index_op.php" target="_blank" rel="noopener noreferrer">{t('institutionalPortals.openComo')}</a>
            </Button>
          )}
        </div>
        {isComo && canReadReport && <ComoStayTourReport propertyId={property.id} propertyName={property.name} />}
      </InfoCard>
    </>
  );
}
