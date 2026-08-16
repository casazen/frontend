import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAttestationGuidance } from '@/queries/use-canone-concordato';

interface Props {
  propertyId: string;
}

export function AttestationGuidancePanel({ propertyId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useAttestationGuidance(propertyId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.canoneConcordato.guidanceTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{t('leases.canoneConcordato.guidanceIntro')}</p>
        {isLoading && <p>{t('leases.canoneConcordato.guidanceLoading')}</p>}
        {isError && <p className="text-destructive">{t('leases.canoneConcordato.error')}</p>}
        {data && data.organizations.length === 0 && (
          <p>{t('leases.canoneConcordato.guidanceEmpty')}</p>
        )}
        {data?.organizations.map((org) => (
          <div key={`${org.name}-${org.contact}`} className="rounded-lg border p-3">
            <p className="font-medium">{org.name}</p>
            <p className="text-muted-foreground">
              {org.role === 'Inquilini'
                ? t('leases.canoneConcordato.roleTenants')
                : t('leases.canoneConcordato.roleOwners')}
            </p>
            <p>{org.contact}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
