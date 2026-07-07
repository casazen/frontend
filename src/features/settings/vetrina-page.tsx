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

export function VetrinaPage() {
  const { t } = useTranslation();
  const { org } = useCurrentUser();
  const { data: properties = [], isLoading: propertiesLoading } = useProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [orgUrlCollapsed, setOrgUrlCollapsed] = useState(false);

  const orgSlug = org?.slug ?? null;
  const orgBookingPath = orgSlug ? buildOrgBookingPath(orgSlug) : null;

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
      {orgBookingPath ? (
        <div className="-m-4 flex min-h-0 flex-1 flex-col overflow-hidden md:-m-6">
          <div className="shrink-0 border-b bg-background px-4 py-4 md:px-6">
            <PageHeader
              title={t('directBooking.title')}
              description={t('directBooking.description')}
            />
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex w-72 shrink-0 flex-col overflow-hidden border-r">
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('directBooking.propertiesLabel')}
                </p>
                <VetrinaPropertyList
                  properties={properties}
                  isLoading={propertiesLoading}
                  orgSlug={orgSlug!}
                  selectedId={selectedPropertyId}
                  onSelect={handlePropertySelect}
                />
              </div>

              <div className="border-t">
                <button
                  type="button"
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
                    <VetrinaUrlCopy bookingSitePath={orgBookingPath} variant="inline" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
        <div className="mx-auto max-w-3xl">
          <PageHeader
            title={t('directBooking.title')}
            description={t('directBooking.description')}
          />
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
