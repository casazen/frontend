import { SupplierInviteIdentityFields } from '@/features/supplier/supplier-invite-identity-fields';
import { readSupplierInviteIdentity } from '@/features/supplier/read-supplier-invite-identity';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  useTrustedSuppliers,
  useInviteSupplier,
  useRemoveSupplier,
} from '@/queries/trustedSuppliers';
import { useProperties } from '@/queries/use-properties';

export function TrustedSuppliersPage() {
  const { t } = useTranslation();
  const { data: suppliers, isLoading, isError, error, refetch } = useTrustedSuppliers();
  const inviteSupplier = useInviteSupplier();
  const removeSupplier = useRemoveSupplier();
  // The host picks the properties by name (bug #977: the dialog asked for their ids); none picked = all of them.
  const properties = useProperties();
  const propertyList = properties.data ?? [];
  const propertyNames = new Map(propertyList.map((property) => [property.id, property.name]));

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePropertyIds, setInvitePropertyIds] = useState<string[]>([]);

  const toggleInviteProperty = (id: string, checked: boolean) =>
    setInvitePropertyIds((current) => (checked ? [...current, id] : current.filter((value) => value !== id)));

  const handleInvite = (form: HTMLFormElement) => {
    const email = inviteEmail.trim();
    if (!email || !properties.isSuccess || inviteSupplier.isPending) return;

    inviteSupplier.mutate(
      { email, propertyIds: invitePropertyIds, ...readSupplierInviteIdentity(form) },
      {
        onSuccess: () => {
          setInviteDialogOpen(false);
          setInviteEmail('');
          setInvitePropertyIds([]);
        },
      }
    );
  };

  const handleRemove = (id: string) => {
    if (confirm(t('supplier.trusted.removeConfirm'))) {
      removeSupplier.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" data-testid="trusted-suppliers-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <span className="sr-only">{t('supplier.trusted.loading')}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        testId="trusted-suppliers-error"
        title={t('supplier.trusted.loadError')}
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('supplier.trusted.title')}
        description={t('supplier.trusted.description')}
        action={
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="invite-supplier-button">{t('supplier.trusted.invite')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('supplier.trusted.inviteTitle')}</DialogTitle>
                <DialogDescription>{t('supplier.trusted.inviteHint')}</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); handleInvite(event.currentTarget); }}>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">{t('supplier.trusted.inviteEmail')}</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t('supplier.trusted.inviteEmailPlaceholder')}
                    data-testid="invite-email-input"
                  />
                </div>
                <SupplierInviteIdentityFields />
                {properties.isPending && <p role="status">{t('supplier.trusted.loadingProperties')}</p>}
                {properties.isError && <div className="space-y-2">
                  <p role="alert">{t('supplier.trusted.propertiesError')}</p>
                  <Button type="button" variant="outline" onClick={() => void properties.refetch()}>{t('shared.errorState.retry')}</Button>
                </div>}
                {properties.isSuccess && propertyList.length === 0 && <p>{t('supplier.trusted.allProperties')}</p>}
                {properties.isSuccess && propertyList.length > 0 && (
                  <fieldset className="space-y-2" data-testid="invite-properties">
                    <legend className="text-sm font-medium">{t('supplier.trusted.properties')}</legend>
                    <p className="text-xs text-muted-foreground">{t('supplier.trusted.propertiesHint')}</p>
                    {propertyList.map((property) => (
                      <div key={property.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`invite-property-${property.id}`}
                          checked={invitePropertyIds.includes(property.id)}
                          onCheckedChange={(checked) => toggleInviteProperty(property.id, checked === true)}
                        />
                        <Label htmlFor={`invite-property-${property.id}`} className="font-normal">
                          {property.name}
                        </Label>
                      </div>
                    ))}
                  </fieldset>
                )}
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    disabled={!inviteEmail.trim() || !properties.isSuccess || inviteSupplier.isPending}
                    data-testid="invite-submit-button"
                  >
                    {inviteSupplier.isPending ? t('common.sending') : t('supplier.trusted.inviteSend')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Button variant="outline" asChild>
        <a href="/app/short-rent/marketplace/search">{t('supplier.trusted.browseMarketplace')}</a>
      </Button>

      {!suppliers || suppliers.length === 0 ? (
        <Card data-testid="trusted-suppliers-empty">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">{t('supplier.trusted.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} data-testid={`supplier-card-${supplier.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {supplier.supplierName || t('supplier.trusted.supplierLabel', { id: supplier.supplierOrgId })}
                    </CardTitle>
                    <CardDescription>
                      {supplier.hostOrigin !== undefined && <>{t(supplier.hostOrigin ? 'supplier.trusted.hostOrigin' : 'supplier.trusted.marketplaceOrigin')} · </>}
                      {supplier.assignedPropertyIds.length === 0 ? t('supplier.trusted.allProperties') : t('supplier.trusted.propertiesCount', { count: supplier.assignedPropertyIds.length })}
                    </CardDescription>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(supplier.id)}
                    disabled={removeSupplier.isPending}
                    data-testid={`remove-supplier-${supplier.id}`}
                  >
                    {t('supplier.trusted.remove')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {supplier.assignedPropertyIds.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t('supplier.trusted.assignedProperties')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {supplier.assignedPropertyIds.map((propertyId) => (
                        <span
                          key={propertyId}
                          className="rounded-md bg-muted px-2 py-1 text-xs"
                          data-testid={`property-${propertyId}`}
                        >
                          {propertyNames.get(propertyId) ?? propertyId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
