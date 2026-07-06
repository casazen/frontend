import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Wrench } from 'lucide-react';
import { useCreateServiceRequest, useSuppliersByComune } from '@/queries/use-service-requests';
import type { ServiceRequestUrgency } from '@/types/service-request';

const CATEGORIES = ['cleaning', 'maintenance', 'plumbing', 'laundry'] as const;

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface ServiceRequestFormProps {
  propertyId: string;
  bookingId?: string;
  propertyCity: string;
}

export function ServiceRequestForm({ propertyId, bookingId, propertyCity }: ServiceRequestFormProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>('cleaning');
  const [supplierOrgId, setSupplierOrgId] = useState('');
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>('Normal');
  const [notes, setNotes] = useState('');
  const [chargeToGuest, setChargeToGuest] = useState(false);

  const { data: suppliers, isLoading: suppliersLoading } = useSuppliersByComune(propertyCity, category);
  const createMutation = useCreateServiceRequest();

  const handleSubmit = () => {
    if (!supplierOrgId) return;
    createMutation.mutate(
      {
        propertyId,
        bookingId,
        supplierOrgId,
        category,
        urgency,
        notes: notes || undefined,
        chargeToGuest,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setNotes('');
          setSupplierOrgId('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="request-supplier-btn">
          <Wrench className="mr-2 h-4 w-4" />
          {t('serviceRequest.requestSupplier')}
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="service-request-dialog">
        <DialogHeader>
          <DialogTitle>{t('serviceRequest.requestSupplier')}</DialogTitle>
          <DialogDescription>{t('serviceRequest.requestDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sr-category">{t('serviceRequest.category')}</Label>
            <select
              id="sr-category"
              className={selectClass}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSupplierOrgId('');
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`serviceRequest.categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-supplier">{t('serviceRequest.supplier')}</Label>
            <select
              id="sr-supplier"
              className={selectClass}
              value={supplierOrgId}
              onChange={(e) => setSupplierOrgId(e.target.value)}
              disabled={suppliersLoading}
              data-testid="supplier-select"
            >
              <option value="">{t('serviceRequest.selectSupplier')}</option>
              {(suppliers?.items ?? []).map((s) => (
                <option key={s.orgId} value={s.orgId}>
                  {s.legalName}
                </option>
              ))}
            </select>
            {!suppliersLoading && (suppliers?.items?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">{t('serviceRequest.noSuppliers')}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-urgency">{t('serviceRequest.urgency')}</Label>
            <select
              id="sr-urgency"
              className={selectClass}
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as ServiceRequestUrgency)}
            >
              <option value="Normal">{t('serviceRequest.urgencyNormal')}</option>
              <option value="High">{t('serviceRequest.urgencyHigh')}</option>
              <option value="Emergency">{t('serviceRequest.urgencyEmergency')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sr-notes">{t('serviceRequest.notes')}</Label>
            <Textarea id="sr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="charge-guest"
              checked={chargeToGuest}
              onCheckedChange={(v) => setChargeToGuest(v === true)}
            />
            <Label htmlFor="charge-guest" className="font-normal">
              {t('serviceRequest.chargeToGuest')}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('booking.form.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!supplierOrgId || createMutation.isPending}
            data-testid="submit-service-request"
          >
            {t('serviceRequest.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
