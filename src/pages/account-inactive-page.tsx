import { useTranslation } from 'react-i18next';
import { PublicAccessFrame } from './public-access-frame';
import { UserRoundX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supportConfig } from '@/config/support.config';
import { useAuth } from '@/hooks/use-auth';

/**
 * Shown when the backend refuses the account with 403 `account_inactive` (PL-03): an admin deactivated it, so every
 * request of this account is refused. The page calls no API; it points to support (the configured address, or a
 * generic text when none is configured) and offers the logout.
 */
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
