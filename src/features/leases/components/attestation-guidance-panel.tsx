import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { useAttestationGuidance } from '@/queries/use-canone-concordato';

interface Props {
  propertyId: string;
}

export function AttestationGuidancePanel({ propertyId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useAttestationGuidance(propertyId);

  return (
    <PlainSection title={t('leases.canoneConcordato.guidanceTitle')} className="space-y-3 text-sm">
      <p className="text-foreground/70">{t('leases.canoneConcordato.guidanceIntro')}</p>
      {isLoading && <p>{t('leases.canoneConcordato.guidanceLoading')}</p>}
      {isError && <p className="text-destructive">{t('leases.canoneConcordato.error')}</p>}
      {data && data.organizations.length === 0 && (
        <p>{t('leases.canoneConcordato.guidanceEmpty')}</p>
      )}
      {data && data.organizations.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {data.organizations.map((org) => (
            <li key={`${org.name}-${org.contact}`} className="py-3">
              <p className="font-medium">{org.name}</p>
              <p className="text-foreground/70">
                {org.role === 'Inquilini'
                  ? t('leases.canoneConcordato.roleTenants')
                  : t('leases.canoneConcordato.roleOwners')}
              </p>
              <p className="break-words">{org.contact}</p>
            </li>
          ))}
        </ul>
      )}
    </PlainSection>
  );
}
