import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useGuestCrmProfiles } from '@/queries/crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';

/**
 * CRM guest list page (NF-23, ADR-021): search and filter guest profiles,
 * scoped to the caller's HostScope (only properties the caller reaches).
 */
export default function GuestList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, isError, error } = useGuestCrmProfiles({
    search: search || undefined,
    page,
    pageSize,
  });

  if (isLoading) {
    return <LoadingScreen message={t('crm.loading')} />;
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('crm.error')}</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : t('crm.errorDescription')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const profiles = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('crm.title')}</h1>
        <p className="text-sm text-foreground/70">{t('crm.description')}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
          <Input
            type="search"
            placeholder={t('crm.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[200px] items-center justify-center p-6">
            <div className="text-center">
              <p className="text-sm text-foreground/70">
                {search ? t('crm.noResults') : t('crm.empty')}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('crm.email')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('crm.country')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">{t('crm.stays')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">{t('crm.spend')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t('crm.consent')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">{t('crm.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {profiles.map((profile) => (
                    <tr
                      key={profile.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/app/crm/guests/${profile.id}`)}
                    >
                      <td className="px-4 py-3 text-sm">{profile.confirmedMarketingEmail}</td>
                      <td className="px-4 py-3 text-sm">{profile.country || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm">{profile.totalStays}</td>
                      <td className="px-4 py-3 text-right text-sm">
                        € {profile.totalSpend.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-1">
                          {profile.marketingConsentEmail && (
                            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                              {t('crm.consentEmail')}
                            </span>
                          )}
                          {profile.marketingConsentWhatsApp && (
                            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                              {t('crm.consentWhatsApp')}
                            </span>
                          )}
                          {!profile.marketingConsentEmail && !profile.marketingConsentWhatsApp && (
                            <span className="text-xs text-foreground/50">{t('crm.noConsent')}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/crm/guests/${profile.id}`);
                          }}
                        >
                          {t('crm.viewDetails')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground/70">
                {t('crm.showing', {
                  start: (page - 1) * pageSize + 1,
                  end: Math.min(page * pageSize, totalCount),
                  total: totalCount,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('crm.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t('crm.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
