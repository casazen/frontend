import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  useTrustedSuppliers,
  useInviteSupplier,
  useUpdateVisibility,
  useRemoveSupplier,
} from '@/queries/trustedSuppliers';

export function TrustedSuppliersPage() {
  const { t } = useTranslation();
  const { data: suppliers, isLoading, isError, error, refetch } = useTrustedSuppliers();
  const inviteSupplier = useInviteSupplier();
  const updateVisibility = useUpdateVisibility();
  const removeSupplier = useRemoveSupplier();

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePropertyIds, setInvitePropertyIds] = useState('');

  const handleInvite = () => {
    if (!inviteEmail) return;

    const propertyIds = invitePropertyIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id);

    inviteSupplier.mutate(
      { email: inviteEmail, propertyIds },
      {
        onSuccess: () => {
          setInviteDialogOpen(false);
          setInviteEmail('');
          setInvitePropertyIds('');
        },
      }
    );
  };

  const handleVisibilityToggle = (id: string, currentValue: boolean) => {
    updateVisibility.mutate({ id, visible: !currentValue });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('supplier.trusted.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('supplier.trusted.description')}</p>
        </div>

        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="invite-supplier-button">{t('supplier.trusted.invite')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('supplier.trusted.inviteTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{t('supplier.trusted.inviteEmail')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('supplier.trusted.inviteEmailPlaceholder')}
                  data-testid="invite-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-properties">{t('supplier.trusted.properties')}</Label>
                <Input
                  id="invite-properties"
                  value={invitePropertyIds}
                  onChange={(e) => setInvitePropertyIds(e.target.value)}
                  placeholder={t('supplier.trusted.propertiesPlaceholder')}
                  data-testid="invite-properties-input"
                />
                <p className="text-xs text-muted-foreground">{t('supplier.trusted.propertiesHint')}</p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail || inviteSupplier.isPending}
                  data-testid="invite-submit-button"
                >
                  {inviteSupplier.isPending ? t('common.sending') : t('supplier.trusted.inviteSend')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
                      {t('supplier.trusted.supplierLabel', { id: supplier.supplierOrgId })}
                    </CardTitle>
                    <CardDescription>
                      {t('supplier.trusted.propertiesCount', { count: supplier.assignedPropertyIds.length })}
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
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor={`visibility-${supplier.id}`}>{t('supplier.trusted.visibility')}</Label>
                    <p className="text-xs text-muted-foreground">{t('supplier.trusted.visibilityHint')}</p>
                  </div>
                  <Switch
                    id={`visibility-${supplier.id}`}
                    checked={supplier.visibleInMarketplace}
                    onCheckedChange={() => handleVisibilityToggle(supplier.id, supplier.visibleInMarketplace)}
                    disabled={updateVisibility.isPending}
                    data-testid={`visibility-toggle-${supplier.id}`}
                  />
                </div>
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
                          {propertyId}
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
