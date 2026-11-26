import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ComplianceDrawerButton } from '@/features/compliance/compliance-drawer/compliance-drawer-button';
import { Ross1000Panel } from '@/features/compliance/components/ross1000-panel';
import { IstatCredentialsCard } from '@/features/compliance/components/istat-credentials-card';
import { senderWizardPath } from '@/features/compliance/lib/connection-health-model';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import type { PropertyDetailDto } from '@/types';
import { DirectPortalActivation, useDirectRoutes } from './direct-portal-activation';
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
  const panelClass = 'min-w-0 space-y-4 rounded-lg border p-4 sm:p-6';

  return (
    <section aria-label={t('institutionalPortals.title')} className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t('institutionalPortals.title')}</h2>
        {!migrated && senderPath && <Button asChild variant="outline"><Link to={senderPath}>{t('institutionalPortals.sender')}</Link></Button>}
      </header>
      {routes.isError && <p role="alert">{t('institutionalPortals.routeError')} <Button variant="ghost" onClick={() => void routes.refetch()}>{t('questuraCredentials.retry')}</Button></p>}
      <div className={panelClass}>
        <QuesturaCredentialsCard propertyId={property.id} canEdit={canWrite} />
        {direct && <DirectPortalActivation propertyId={property.id} service="alloggiati" routes={direct} canWrite={canWrite} />}
        {!migrated && <ComplianceDrawerButton target={{ topic: 'Alloggiati', propertyId: property.id }} subject="Alloggiati Web" />}
      </div>
      {(flags.octorateOnboarding || direct?.istatSupported || direct?.effectiveFrom.istat) && (
        <div className={panelClass}>
          {property.regionCode === 'LOM' && <p className="text-sm font-medium">{t('institutionalPortals.ross1000')}</p>}
          <IstatCredentialsCard propertyId={property.id} canEdit={canWrite} />
          {direct && <DirectPortalActivation propertyId={property.id} service="istat" routes={direct} canWrite={canWrite} />}
          {!migrated && <ComplianceDrawerButton target={{ topic: 'Istat', propertyId: property.id }} subject="ISTAT" />}
        </div>
      )}
      {property.comuneIstatCode?.startsWith('013') && (
        <Ross1000Panel propertyId={property.id} canWrite={canWrite} canSend={Boolean(direct?.istatAvailable && direct?.effectiveFrom.istat)} />
      )}
      <div className={panelClass}>
        <h3 className="text-lg font-semibold">{t('institutionalPortals.tax')}</h3>
        <p className="text-sm text-muted-foreground">{t(isComo ? 'institutionalPortals.como' : 'institutionalPortals.municipality')}</p>
        <div className="flex flex-wrap gap-3">
          {canReadReport && (
            <Button asChild variant="outline"><Link to="/app/short-rent/reports/tourist-tax">{t('institutionalPortals.report')}</Link></Button>
          )}
          {isComo && (
            <Button asChild variant="outline">
              <a href="https://imposta-soggiorno.org/como/index_op.php" target="_blank" rel="noopener noreferrer">{t('institutionalPortals.openComo')}</a>
            </Button>
          )}
        </div>
        {isComo && canReadReport && <ComoStayTourReport propertyId={property.id} propertyName={property.name} />}
      </div>
    </section>
  );
}
