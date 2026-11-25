import { Handshake, MailPlus, MapPin } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { useRef, useState } from 'react';
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

  const [removing, setRemoving] = useState<{ id: string; supplierOrgId: string } | null>(null);
  const inviteButton = useRef<HTMLButtonElement>(null);
  const removalOpener = useRef<HTMLButtonElement>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePropertyIds, setInvitePropertyIds] = useState<string[]>([]);

  const toggleInviteProperty = (id: string, checked: boolean) =>
    setInvitePropertyIds((current) => (checked ? [...current, id] : current.filter((value) => value !== id)));

  const handleInvite = () => {
    const email = inviteEmail.trim();
    if (!email || !properties.isSuccess || inviteSupplier.isPending) return;

    inviteSupplier.mutate(
      { email, propertyIds: invitePropertyIds },
      {
        onSuccess: () => {
          setInviteDialogOpen(false);
          setInviteEmail('');
          setInvitePropertyIds([]);
        },
      }
    );
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
              <Button ref={inviteButton} data-testid="invite-supplier-button"><MailPlus aria-hidden="true" className="size-4" />{t('supplier.trusted.invite')}</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('supplier.trusted.inviteTitle')}</DialogTitle>
                <DialogDescription>{t('supplier.trusted.inviteHint')}</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={event => {
                event.preventDefault();
                if (!inviteSupplier.isPending) handleInvite();
              }}>
                <div className="space-y-2">
                  <Label htmlFor="invite-email">{t('supplier.trusted.inviteEmail')}</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t('supplier.trusted.inviteEmailPlaceholder')}
                    data-testid="invite-email-input"
                  />
                </div>
                {properties.isPending && <p role="status">{t('supplier.trusted.loadingProperties')}</p>}
                {properties.isError && <div className="space-y-2">
                  <p role="alert">{t('supplier.trusted.propertiesError')}</p>
                  <Button type="button" variant="outline" onClick={() => void properties.refetch()}>{t('shared.errorState.retry')}</Button>
                </div>}
                {properties.isSuccess && propertyList.length === 0 && <p>{t('supplier.trusted.allProperties')}</p>}
                {properties.isSuccess && propertyList.length > 0 && (
                  <fieldset className="space-y-2 rounded-xl border border-border p-3" data-testid="invite-properties">
                    <legend className="text-sm font-medium">{t('supplier.trusted.properties')}</legend>
                    <p className="text-xs text-muted-foreground">{t('supplier.trusted.propertiesHint')}</p>
                    {propertyList.map((property) => (
                      <div key={property.id} className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-muted">
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
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {suppliers.map((supplier) => (
            <Card key={supplier.id} data-testid={`supplier-card-${supplier.id}`}>
              <CardHeader>
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Handshake aria-hidden="true" className="mb-2 size-9 rounded-xl bg-primary-soft p-2 text-primary-text" />
                    <CardTitle className="break-words text-lg">
                      {supplier.supplierName || t('supplier.trusted.supplierLabel', { id: supplier.supplierOrgId })}
                    </CardTitle>
                    <CardDescription>
                      {supplier.hostOrigin !== undefined && <>{t(supplier.hostOrigin ? 'supplier.trusted.hostOrigin' : 'supplier.trusted.marketplaceOrigin')} · </>}
                      {supplier.assignedPropertyIds.length === 0 ? t('supplier.trusted.allProperties') : t('supplier.trusted.propertiesCount', { count: supplier.assignedPropertyIds.length })}
                    </CardDescription>
                  </div>
                  <Button
                    variant="danger-outline"
                    size="sm"
                    onClick={event => {
                      removalOpener.current = event.currentTarget;
                      setRemoving(supplier);
                    }}
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
                          className="inline-flex max-w-full items-center gap-1 break-all rounded-md bg-muted px-2 py-1 text-xs"
                          data-testid={`property-${propertyId}`}
                        >
                          <MapPin aria-hidden="true" className="size-3 shrink-0" />
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
      <ConfirmationDialog
        open={removing !== null}
        title={t('supplier.trusted.removeConfirm')}
        description={removing ? t('supplier.trusted.supplierLabel', { id: removing.supplierOrgId }) : ''}
        confirmLabel={t('supplier.trusted.remove')}
        variant="destructive"
        isLoading={removeSupplier.isPending}
        onOpenChange={open => { if (!open && !removeSupplier.isPending) setRemoving(null); }}
        onConfirm={async () => {
          if (!removing) return;
          await removeSupplier.mutateAsync(removing.id);
          removalOpener.current = null;
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          (removalOpener.current?.isConnected ? removalOpener.current : inviteButton.current)?.focus();
        }}
      />
    </div>
  );
}
