import { useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUser } from '@/queries/use-users';
import { useProperties } from '@/queries/use-properties';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { VetrinaPreviewPanel } from './components/vetrina-preview-panel';
import { VetrinaUrlCopy } from './components/vetrina-url-copy';
import { VetrinaPropertyList } from './components/vetrina-property-list';
import { buildPropertyBookingPath, buildOrgBookingPath } from '@/lib/booking-url';
import { orgSiteUrl } from '@/lib/booking-link';
import { SitePublicationBanner } from '@/features/onboarding/components/site-publication-banner';
import { useOrgBookingSite } from './domain/use-org-domain';

export function VetrinaPage() {
  const { t } = useTranslation();
  const { org } = useCurrentUser();
  const { data: properties = [], isLoading: propertiesLoading } = useProperties({ mode: 'short' });
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [orgUrlCollapsed, setOrgUrlCollapsed] = useState(true);

  const orgSlug = org?.slug ?? null;
  const orgBookingPath = orgSlug ? buildOrgBookingPath(orgSlug) : null;
  // Where the site really is (its own domain or subdomain, else the platform): the links the host copies are on it, not on the address of the page they sit on (NF-123).
  const bookingSite = useOrgBookingSite(org?.id, orgSlug);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) ?? null;
  const previewPath = orgSlug
    ? selectedProperty
      ? buildPropertyBookingPath(orgSlug, selectedProperty)
      : orgBookingPath
    : null;

  const handlePropertySelect = (id: string) => {
    setSelectedPropertyId((prev) => (prev === id ? null : id));
  };

  return (
    <AppShell>
      {orgBookingPath && bookingSite ? (
        <div className="flex min-w-0 flex-col gap-4 lg:h-[calc(100dvh-var(--header-height)-3rem)] lg:min-h-0">
          {/* The tabs of the section (the head draws them) sit tight on the preview: the room under them is the padding of this band. */}
          <div className="shrink-0 [&_nav>div]:mb-0">
            <PageHeader title={t('directBooking.title')} description={t('directBooking.description')} />
            <div className="mt-3 empty:hidden">
              <SitePublicationBanner />
            </div>
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row">
            <div className="flex min-w-0 shrink-0 flex-col rounded-xl border bg-card lg:w-72 lg:overflow-hidden">
              <div className="max-h-64 flex-1 overflow-y-auto px-3 py-3 lg:max-h-none">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('directBooking.propertiesLabel')}
                </p>
                <VetrinaPropertyList
                  properties={properties}
                  isLoading={propertiesLoading}
                  bookingSite={bookingSite}
                  selectedId={selectedPropertyId}
                  onSelect={handlePropertySelect}
                />
              </div>

              <div className="border-t">
                <button
                  type="button"
                  aria-expanded={!orgUrlCollapsed}
                  onClick={() => setOrgUrlCollapsed((v) => !v)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
                >
                  {t('directBooking.orgUrlSectionTitle')}
                  {orgUrlCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
                {!orgUrlCollapsed && (
                  <div className="px-3 pb-3">
                    <VetrinaUrlCopy url={orgSiteUrl(bookingSite.site)} status={bookingSite.status} variant="inline" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex h-[65svh] min-h-80 min-w-0 flex-col overflow-hidden rounded-xl border bg-card lg:h-auto lg:min-h-0 lg:flex-1">
              {previewPath ? (
                <VetrinaPreviewPanel bookingSitePath={previewPath} />
              ) : (
                <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
                  <p className="text-sm">{t('directBooking.selectPropertyHint')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <PageHeader title={t('directBooking.title')} description={t('directBooking.description')} />
          <Card className="mt-6">
            <CardContent className="py-12 text-center">
              <Globe className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('directBooking.noOrg')}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
