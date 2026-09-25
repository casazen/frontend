import { Trans, useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CODE_CLASS = 'rounded bg-muted px-1';

/**
 * Auth0 SPA requires a secure origin (https or localhost).
 * Shown when the host console is opened via http://LAN-IP.
 */
export function InsecureOriginPage() {
  const { t } = useTranslation();
  const httpsUrl = `https://${window.location.host}${window.location.pathname}${window.location.search}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t('insecureOrigin.title')}</CardTitle>
          <CardDescription>{t('insecureOrigin.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <Trans
              i18nKey="insecureOrigin.currentOrigin"
              values={{ origin: window.location.origin }}
              components={{ code: <code className={CODE_CLASS} /> }}
            />
          </p>
          <p>
            {t('insecureOrigin.lanHint')}{' '}
            <a className="font-medium text-primary underline" href={httpsUrl}>
              {httpsUrl}
            </a>
          </p>
          <p>
            <Trans
              i18nKey="insecureOrigin.publicSites"
              values={{ path: '/book/...' }}
              components={{ code: <code className={CODE_CLASS} /> }}
            />
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
