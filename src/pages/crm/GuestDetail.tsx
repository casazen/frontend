import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, MessageCircle, Tag } from 'lucide-react';
import { useGuestCrmProfile } from '@/queries/crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';

/**
 * CRM guest detail page (NF-23, ADR-021): profile detail with stays, spend,
 * consent status, and tags.
 */
export default function GuestDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: profile, isLoading, isError, error } = useGuestCrmProfile(id);

  if (isLoading) {
    return <LoadingScreen message={t('crm.loadingProfile')} />;
  }

  if (isError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('crm.profileError')}</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : t('crm.profileErrorDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate('/app/crm/guests')}>
              <ArrowLeft className="mr-2 size-4" />
              {t('crm.backToList')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/crm/guests')}>
          <ArrowLeft className="mr-2 size-4" />
          {t('crm.backToList')}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{profile.confirmedMarketingEmail}</h1>
        <p className="text-sm text-foreground/70">
          {t('crm.guestSince', {
            date: new Date(profile.firstStayAt).toLocaleDateString(),
          })}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('crm.profileInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-foreground/70">{t('crm.email')}</dt>
              <dd className="mt-1 text-sm">{profile.confirmedMarketingEmail}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground/70">{t('crm.country')}</dt>
              <dd className="mt-1 text-sm">{profile.country || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground/70">{t('crm.language')}</dt>
              <dd className="mt-1 text-sm">{profile.language || '-'}</dd>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('crm.marketingConsent')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-foreground/70" />
              <span className="text-sm">
                {profile.marketingConsentEmail ? (
                  <span className="font-medium text-green-700">{t('crm.consentGrantedEmail')}</span>
                ) : (
                  <span className="text-foreground/70">{t('crm.consentNotGrantedEmail')}</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-foreground/70" />
              <span className="text-sm">
                {profile.marketingConsentWhatsApp ? (
                  <span className="font-medium text-green-700">{t('crm.consentGrantedWhatsApp')}</span>
                ) : (
                  <span className="text-foreground/70">{t('crm.consentNotGrantedWhatsApp')}</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('crm.stayHistory')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-foreground/70">{t('crm.totalStays')}</dt>
              <dd className="mt-1 text-2xl font-semibold">{profile.totalStays}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground/70">{t('crm.totalSpend')}</dt>
              <dd className="mt-1 text-2xl font-semibold">€ {profile.totalSpend.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground/70">{t('crm.firstStay')}</dt>
              <dd className="mt-1 text-sm">
                {new Date(profile.firstStayAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-foreground/70">{t('crm.lastStay')}</dt>
              <dd className="mt-1 text-sm">
                {new Date(profile.lastStayAt).toLocaleDateString()}
              </dd>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('crm.tags')}</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-sm"
                  >
                    <Tag className="size-3" />
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground/70">{t('crm.noTags')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
