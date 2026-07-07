import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Store, Phone, Mail } from 'lucide-react';
import { useServiceRequests, useSuppliersByProperty } from '@/queries/use-service-requests';
import { useProperties } from '@/queries/use-properties';
import { ServiceRequestForm } from '@/features/service-requests/components/service-request-form';
import type { SupplierPicker } from '@/types/service-request';

const CATEGORIES = ['cleaning', 'maintenance', 'plumbing', 'laundry'] as const;

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function MarketplacePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierPicker | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: properties } = useProperties();
  const propertyIdParam = searchParams.get('propertyId') ?? '';
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyIdParam);

  const { data: suppliers, isLoading: suppliersLoading } = useSuppliersByProperty(
    selectedPropertyId || undefined,
    categoryFilter || undefined,
  );
  const { data: requests, isLoading: requestsLoading } = useServiceRequests(
    selectedPropertyId ? { propertyId: selectedPropertyId } : { listAll: true, page: 1, pageSize: 50 },
  );

  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedPropertyId(id);
    setSelectedSupplier(null);
    if (id) {
      setSearchParams({ propertyId: id });
    } else {
      setSearchParams({});
    }
  };

  const handleSupplierClick = (supplier: SupplierPicker) => {
    setSelectedSupplier(supplier);
  };

  const handleRequestService = () => {
    setFormOpen(true);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('marketplace.title')}
          description={t('marketplace.description')}
        />

        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <select
              className={selectClass}
              value={selectedPropertyId}
              onChange={handlePropertyChange}
              data-testid="marketplace-property-select"
            >
              <option value="">{t('marketplace.selectProperty')}</option>
              {(properties ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <select
              className={selectClass}
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSelectedSupplier(null);
              }}
              data-testid="marketplace-category-filter"
            >
              <option value="">{t('marketplace.allCategories')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`serviceRequest.categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">{t('marketplace.suppliersTitle')}</h2>
            {!selectedPropertyId && (
              <p className="text-sm text-muted-foreground">{t('marketplace.selectPropertyHint')}</p>
            )}
            {selectedPropertyId && suppliersLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {selectedPropertyId && !suppliersLoading && (suppliers?.items?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground py-4">{t('marketplace.noSuppliers')}</p>
            )}
            <div
              className="grid gap-3 sm:grid-cols-2"
              data-testid="marketplace-supplier-grid"
            >
              {(suppliers?.items ?? []).map((supplier) => (
                <Card
                  key={supplier.orgId}
                  className={`cursor-pointer transition-colors hover:border-primary ${
                    selectedSupplier?.orgId === supplier.orgId ? 'border-primary ring-1 ring-primary' : ''
                  }`}
                  onClick={() => handleSupplierClick(supplier)}
                  data-testid={`marketplace-supplier-${supplier.orgId}`}
                >
                  <CardContent className="py-4 space-y-1">
                    <div className="font-medium">{supplier.legalName}</div>
                    <div className="flex flex-wrap gap-1">
                      {supplier.categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {t(`serviceRequest.categories.${cat}`, { defaultValue: cat })}
                        </Badge>
                      ))}
                    </div>
                    {supplier.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{supplier.bio}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            {selectedSupplier ? (
              <Card data-testid="marketplace-supplier-detail">
                <CardHeader>
                  <CardTitle className="text-base">{selectedSupplier.legalName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedSupplier.bio && (
                    <p className="text-sm text-muted-foreground">{selectedSupplier.bio}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={`tel:${selectedSupplier.phone}`} className="hover:underline">
                        {selectedSupplier.phone}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a href={`mailto:${selectedSupplier.email}`} className="hover:underline">
                        {selectedSupplier.email}
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedSupplier.categories.map((cat) => (
                      <Badge key={cat} variant="outline" className="text-xs">
                        {t(`serviceRequest.categories.${cat}`, { defaultValue: cat })}
                      </Badge>
                    ))}
                  </div>
                  {selectedPropertyId && (
                    <>
                      <Button
                        className="w-full mt-2"
                        onClick={handleRequestService}
                        data-testid="marketplace-request-service-btn"
                      >
                        {t('serviceRequest.requestSupplier')}
                      </Button>
                      <ServiceRequestForm
                        propertyId={selectedPropertyId}
                        preselectedSupplierOrgId={selectedSupplier.orgId}
                        preselectedCategory={categoryFilter || selectedSupplier.categories[0]}
                        open={formOpen}
                        onOpenChange={setFormOpen}
                        hideTrigger
                        skipAiMatch
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t('marketplace.selectSupplierHint')}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {t('marketplace.requestsTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requestsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!requestsLoading && (requests?.items?.length ?? 0) === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-muted-foreground">{t('marketplace.noRequests')}</p>
                <p className="text-sm text-muted-foreground">{t('marketplace.noRequestsHint')}</p>
              </div>
            )}
            {!requestsLoading && (requests?.items?.length ?? 0) > 0 && (
              <div className="space-y-3" data-testid="marketplace-requests-list">
                {requests!.items.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">
                        {req.propertyName ?? req.propertyId.slice(0, 8)}
                        {' · '}
                        {t(`serviceRequest.categories.${req.category}`, { defaultValue: req.category })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {req.supplierName ?? '—'}
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {t(`serviceRequest.status.${req.status}`, { defaultValue: req.status })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
