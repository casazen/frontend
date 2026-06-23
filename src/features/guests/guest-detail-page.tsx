import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { GdprTab } from './components/gdpr-tab';
import { guestsApi } from '@/api/guests.api';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, RefreshCw, User, MapPin, FileText, Shield } from 'lucide-react';

type TabKey = 'anagrafica' | 'prenotazioni' | 'documenti' | 'gdpr';

const TABS: { key: TabKey; labelI18nKey: string; icon: React.ReactNode }[] = [
  { key: 'anagrafica', labelI18nKey: 'guests.anagrafica', icon: <User className="h-4 w-4" /> },
  { key: 'prenotazioni', labelI18nKey: 'guests.bookings', icon: <FileText className="h-4 w-4" /> },
  { key: 'documenti', labelI18nKey: 'guests.documents', icon: <FileText className="h-4 w-4" /> },
  { key: 'gdpr', labelI18nKey: 'guests.gdpr', icon: <Shield className="h-4 w-4" /> },
];

export function GuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('anagrafica');

  const {
    data: guest,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['guests', id],
    queryFn: () => guestsApi.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return <LoadingScreen message={t('shared.loading.defaultMessage')} />;
  }

  if (isError || !guest) {
    return (
      <AppShell>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-2">Guest not found</h2>
          <p className="text-muted-foreground mb-4">
            The guest you are looking for does not exist or could not be loaded.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              Retry
            </Button>
            <Button variant="outline" onClick={() => navigate('/app/short-rent/guests')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to guests
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('guests.detail')}
          description={`${guest.firstName} ${guest.lastName}`}
          action={
            <Button variant="outline" onClick={() => navigate('/app/short-rent/guests')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('guests.title')}
            </Button>
          }
        />

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b pb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              {tab.icon}
              {t(tab.labelI18nKey)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'anagrafica' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t('guests.anagrafica')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{guest.firstName} {guest.lastName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{guest.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Telefono</span>
                  <span className="font-medium">{guest.phoneNumber || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sesso</span>
                  <span className="font-medium">{guest.gender ?? '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Data di nascita</span>
                  <span className="font-medium">
                    {guest.dateOfBirth ? formatDate(guest.dateOfBirth) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Luogo di nascita</span>
                  <span className="font-medium">{guest.placeOfBirth || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nazionalità</span>
                  <span className="font-medium">{guest.nationality || '—'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Indirizzo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Indirizzo</span>
                  <span className="font-medium">{guest.address || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Città</span>
                  <span className="font-medium">{guest.city || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CAP</span>
                  <span className="font-medium">{guest.postalCode || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Paese</span>
                  <span className="font-medium">{guest.country || '—'}</span>
                </div>
              </CardContent>
            </Card>

            {guest.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Note</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{guest.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'prenotazioni' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('guests.bookings')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Prenotazioni collegate a questo ospite. Utilizza la sezione Prenotazioni per maggiori dettagli.
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'documenti' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t('guests.documents')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {guest.documentNumber ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tipo documento</span>
                    <span className="font-medium">{guest.documentType ?? '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Numero documento</span>
                    <span className="font-medium">{guest.documentNumber}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data rilascio</span>
                    <span className="font-medium">
                      {guest.documentIssueDate ? formatDate(guest.documentIssueDate) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data scadenza</span>
                    <span className="font-medium">
                      {guest.documentExpiryDate ? formatDate(guest.documentExpiryDate) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paese rilascio</span>
                    <span className="font-medium">{guest.documentIssuingCountry || '—'}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mb-2" />
                  <p className="text-sm">{t('guests.noDocument')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'gdpr' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {t('guests.gdpr')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <GdprTab guest={guest} />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
