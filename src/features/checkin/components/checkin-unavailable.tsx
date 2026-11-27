import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

export function CheckInUnavailable({ invalidLink, isFetching, refetch }: { invalidLink: boolean; isFetching: boolean; refetch: () => unknown }) {
  const { t } = useTranslation();
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(invalidLink ? 'checkin.invalidLink' : 'checkin.reopen.loadTitle')}
        </h1>
        <CardDescription>{t(invalidLink ? 'checkin.invalidLinkDescription' : 'checkin.reopen.loadHint')}</CardDescription>
      </CardHeader>
      {!invalidLink && (
        <CardContent>
          <Button type="button" onClick={() => void refetch()} disabled={isFetching}>{t('checkin.reopen.retry')}</Button>
        </CardContent>
      )}
    </Card>
  );
}
