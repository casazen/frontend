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
import { Loader2, Wrench } from 'lucide-react';
import {
  useCreateLongRentServiceRequest,
  useCreateServiceRequest,
  useLongRentSuppliers,
  useSuppliersByProperty,
} from '@/queries/use-service-requests';
import { usePropertyBookings } from '@/queries/use-bookings';
import { useServiceCategories } from '@/queries/use-service-categories';
import { getProblemMessage } from '@/lib/api-errors';
import type { ServiceRequestContextKey, ServiceRequestUrgency } from '@/types/service-request';
import { ServiceCategorySelect } from './service-category-picker';
import { orderStaysForRequest, stayOptionLabel } from '../lib/stays';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface ServiceRequestFormProps {
  propertyId: string;
  /**
   * Rental context the request is opened in (decision D2): `short-rent` → for one stay of the property (`bookingId`
   * required by the API); `long-rent` → for the property, never a booking.
   */
  context?: ServiceRequestContextKey;
  /** Short-rent: the stay (booking detail). Without it the form asks which stay of the property. */
  bookingId?: string;
  /** Supplier already chosen (marketplace). Without it the form lists the property's suppliers for the category. */
  supplierOrgId?: string;
  preselectedCategory?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

/**
 * Manual service request to a supplier. The AI supplier match and the external "nearby businesses" suggestions were
 * removed (FD-21, D11: AI supplier discovery off): the form never calls `match-supplier` and the host's notes only go
 * to the chosen supplier. Short-rent requests are tied to a stay and long-rent ones to the property (D2, SU-07), so web
 * and app find them in the same place.
 */
export function ServiceRequestForm({
  propertyId,
  context = 'short-rent',
  bookingId,
  supplierOrgId,
  preselectedCategory,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: ServiceRequestFormProps) {
  const { t, i18n } = useTranslation();
  const [openInternal, setOpenInternal] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openInternal;

  const setOpen = (v: boolean) => {
    if (isControlled) {
      onOpenChange?.(v);
    } else {
      setOpenInternal(v);
    }
  };

  // Codes come from the backend catalog (SU-03): a preselection that is not a code (e.g. an old
  // supplier label) falls back to the first category instead of being sent and rejected.
  const { data: categoryCodes } = useServiceCategories();
  const [category, setCategory] = useState<string>(preselectedCategory ?? '');
  const selectedCategory = categoryCodes?.includes(category) ? category : (categoryCodes?.[0] ?? '');
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>('Normal');
  const [notes, setNotes] = useState('');
  const [pickedStay, setPickedStay] = useState('');
  const [pickedSupplier, setPickedSupplier] = useState('');

  const isShortRent = context === 'short-rent';
  const asksStay = isShortRent && !bookingId;
  const asksSupplier = !supplierOrgId;

  // Queried only while the dialog is open and the form needs them.
  const stays = usePropertyBookings(open && asksStay ? propertyId : undefined);
  const stayOptions = orderStaysForRequest(stays.data ?? []);
  const supplierCategory = selectedCategory || undefined;
  const shortRentSuppliers = useSuppliersByProperty(
    open && asksSupplier && isShortRent && supplierCategory ? propertyId : undefined,
    supplierCategory,
  );
  const longRentSuppliers = useLongRentSuppliers(
    open && asksSupplier && !isShortRent && supplierCategory ? propertyId : undefined,
    supplierCategory,
  );
  const suppliers = isShortRent ? shortRentSuppliers : longRentSuppliers;
  const supplierOptions = suppliers.data?.items ?? [];

  const effectiveStay = bookingId ?? (stayOptions.some((b) => b.id === pickedStay) ? pickedStay : '');
  const effectiveSupplier =
    supplierOrgId ?? (supplierOptions.some((s) => s.orgId === pickedSupplier) ? pickedSupplier : '');

  const createStayRequest = useCreateServiceRequest();
  const createLongRentRequest = useCreateLongRentServiceRequest();
  const isPending = createStayRequest.isPending || createLongRentRequest.isPending;
  const canSubmit = !!effectiveSupplier && !!selectedCategory && (!isShortRent || !!effectiveStay) && !isPending;

  const onCreated = {
    onSuccess: () => {
      setOpen(false);
      setNotes('');
    },
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const common = {
      propertyId,
      supplierOrgId: effectiveSupplier,
      category: selectedCategory,
      urgency,
      notes: notes || undefined,
    };
    if (isShortRent) {
      createStayRequest.mutate({ ...common, bookingId: effectiveStay }, onCreated);
    } else {
      createLongRentRequest.mutate(common, onCreated);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" data-testid="request-supplier-btn">
            <Wrench className="mr-2 h-4 w-4" />
            {t('serviceRequest.requestSupplier')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto" data-testid="service-request-dialog">
        <DialogHeader>
          <DialogTitle>{t('serviceRequest.requestSupplier')}</DialogTitle>
          <DialogDescription>
            {t(isShortRent ? 'serviceRequest.stayScopedDescription' : 'serviceRequest.longRentScopedDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {asksStay && (
            <div className="space-y-2">
              <Label htmlFor="sr-stay">{t('serviceRequest.stay')}</Label>
              {stays.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="service-request-stays-loading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('serviceRequest.staysLoading')}
                </p>
              ) : stays.isError ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert" data-testid="service-request-stays-error">
                  <span>{getProblemMessage(stays.error, t) ?? t('serviceRequest.staysLoadError')}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void stays.refetch()}>
                    {t('serviceRequest.retry')}
                  </Button>
                </div>
              ) : stayOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="service-request-no-stays">
                  {t('serviceRequest.noStays')}
                </p>
              ) : (
                <select
                  id="sr-stay"
                  className={selectClass}
                  value={effectiveStay}
                  onChange={(e) => setPickedStay(e.target.value)}
                  data-testid="service-request-stay"
                >
                  <option value="">{t('serviceRequest.staySelectPlaceholder')}</option>
                  {stayOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {stayOptionLabel(b, t, i18n.language)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sr-category">{t('serviceRequest.category')}</Label>
            <ServiceCategorySelect id="sr-category" value={selectedCategory} onChange={setCategory} />
          </div>

          {asksSupplier && (
            <div className="space-y-2">
              <Label htmlFor="sr-supplier">{t('serviceRequest.supplier')}</Label>
              {!selectedCategory ? null : suppliers.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="service-request-suppliers-loading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('serviceRequest.suppliersLoading')}
                </p>
              ) : suppliers.isError ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert" data-testid="service-request-suppliers-error">
                  <span>{getProblemMessage(suppliers.error, t) ?? t('serviceRequest.suppliersLoadError')}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void suppliers.refetch()}>
                    {t('serviceRequest.retry')}
                  </Button>
                </div>
              ) : supplierOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="service-request-no-suppliers">
                  {t('serviceRequest.noSuppliers')}
                </p>
              ) : (
                <select
                  id="sr-supplier"
                  className={selectClass}
                  value={effectiveSupplier}
                  onChange={(e) => setPickedSupplier(e.target.value)}
                  data-testid="service-request-supplier"
                >
                  <option value="">{t('serviceRequest.selectSupplier')}</option>
                  {supplierOptions.map((s) => (
                    <option key={s.orgId} value={s.orgId}>
                      {s.legalName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('booking.form.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} data-testid="submit-service-request">
            {t('serviceRequest.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
