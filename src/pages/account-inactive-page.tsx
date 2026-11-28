import { useTranslation } from 'react-i18next';
import { PublicAccessFrame } from './public-access-frame';
import { UserRoundX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supportConfig } from '@/config/support.config';
import { useAuth } from '@/hooks/use-auth';

export function AccountInactivePage() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const supportEmail = supportConfig.email;

  return (
    <PublicAccessFrame icon={UserRoundX} title={t('shared.accountInactive.title')} description={t('shared.accountInactive.description')}>
      <p className="text-sm text-muted-foreground">
        {supportEmail ? (
          <>
            {t('shared.accountInactive.supportWithEmail')}{' '}
            <a className="font-medium text-foreground underline" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          </>
        ) : (
          t('shared.accountInactive.supportGeneric')
        )}
      </p>
      <Button onClick={() => logout()}>{t('shared.accountInactive.logout')}</Button>
    </PublicAccessFrame>
  );
}
