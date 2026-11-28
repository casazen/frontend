import { Building2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { LONG_RENT_PROPERTY_CREATE_PATH } from '@/features/properties/long-rent/paths';
import { getProblemMessage } from '@/lib/api-errors';
import { useProperties } from '@/queries/use-properties';
import type { ServiceRequest } from '@/types/service-request';
import { ServiceRequestForm } from '../components/service-request-form';

interface NewLongRentRequestProps {
  onClose: () => void;
  onCreated?: (request: ServiceRequest) => void;
}

export function NewLongRentRequest({ onClose, onCreated }: NewLongRentRequestProps) {
  const { t } = useTranslation();
  const properties = useProperties({ mode: 'long' });
  const [selected, setSelected] = useState('');
  const [chosen, setChosen] = useState('');

  const list = Array.isArray(properties.data) ? properties.data : null;
  const propertyId = list && list.length === 1 ? list[0].id : list?.some((property) => property.id === chosen) ? chosen : '';

  if (propertyId) {
    return (
      <ServiceRequestForm
        propertyId={propertyId}
        context="long-rent"
        open
        onOpenChange={(open) => !open && onClose()}
        onCreated={onCreated}
        hideTrigger
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="long-rent-request-property-dialog">
        <DialogHeader>
          <DialogTitle>{t('longRentRequests.new.title')}</DialogTitle>
          <DialogDescription>{t('longRentRequests.new.description')}</DialogDescription>
        </DialogHeader>

        {properties.isLoading ? (
          <p role="status" className="text-sm text-foreground/70">
            {t('longRentRequests.new.loading')}
          </p>
        ) : list === null ? (
          <div role="alert" className="space-y-2" data-testid="long-rent-request-property-error">
            <p className="text-sm text-destructive">{getProblemMessage(properties.error, t) ?? t('longRentRequests.new.loadError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void properties.refetch()}>
              {t('longRentRequests.retry')}
            </Button>
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-foreground/70" data-testid="long-rent-request-no-property">
            {t('longRentRequests.new.noProperty')}
          </p>
        ) : (
          <div className="space-y-2 rounded-xl border border-border bg-muted/50 p-4">
            <Building2 aria-hidden="true" className="size-5 text-primary-text" />
            <Label htmlFor="long-rent-request-property">{t('longRentRequests.new.property')}</Label>
            <Select id="long-rent-request-property" value={selected} onChange={(event) => setSelected(event.target.value)}>
              <option value="">{t('longRentRequests.new.choose')}</option>
              {list.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('longRentRequests.new.cancel')}
          </Button>
          {list !== null && list.length === 0 ? (
            <Button asChild>
              <Link to={LONG_RENT_PROPERTY_CREATE_PATH}>{t('longRentRequests.new.addProperty')}</Link>
            </Button>
          ) : (
            <Button type="button" disabled={selected === ''} onClick={() => setChosen(selected)} data-testid="long-rent-request-property-next">
              {t('longRentRequests.new.next')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
