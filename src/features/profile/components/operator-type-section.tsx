import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMe } from '@/queries/use-users';
import { getRentalTypeLabel } from '@/lib/i18n-labels';

export function OperatorTypeSection() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useMe();
  const { pathname } = useLocation();

  const label = profile?.rentalType
    ? getRentalTypeLabel(profile.rentalType, t)
    : t('profile.notConfigured');

  return (
    <Card>
      {/* The title alone, like the card of the profile next to this one: a button in the header would make it taller and put the title lower. */}
      <CardHeader>
        <CardTitle>{t('profile.operatorType')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div>
          <p className="text-sm text-muted-foreground">{t('profile.currentType')}</p>
          <p className="font-medium">{isLoading ? t('profile.loading') : label}</p>
        </div>
        {/* "Annulla" of the edit wizard comes back to this profile page. */}
        <Button variant="outline" size="sm" asChild>
          <Link to="/onboarding?mode=edit" state={{ from: pathname }}>{t('profile.editType')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
