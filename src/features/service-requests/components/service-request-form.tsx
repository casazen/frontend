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
import { Input } from '@/components/ui/input';
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
import { formatStayDate, romeWallTimeToUtc } from '@/lib/stay-dates';
import { formatWorkDuration } from '@/lib/work-duration';
import type { ServiceRequest, ServiceRequestContextKey, ServiceRequestUrgency } from '@/types/service-request';
import { ServiceCategorySelect } from './service-category-picker';
import { orderStaysForRequest, stayOptionLabel } from '../lib/stays';
import { stayDateOf } from '@/features/bookings/lib/booking-price';

const DURATIONS = [30, 60, 90, 120, 180, 240, 360];

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * A service of the supplier's catalog the request is for (the page of a supplier in the marketplace, MKT): the request keeps it, so the
 * supplier sees which service was asked and its price. The category is the service's own, and its duration is where the form starts.
 */
export interface RequestedService {
  id: string;
  name: string;
  category: string;
  durationMinutes: number | null;
}

interface ServiceRequestFormProps {
  propertyId: string;
  /** Long-rent only: the lease contract the request is made for (LR-03c, the sheet of a contract); the server checks it is a lease of the property. */
  leaseId?: string;
  /**
   * Rental context the request is opened in (decision D2): `short-rent` → for one stay of the property (`bookingId`
   * required by the API); `long-rent` → for the property, never a booking.
   */
  context?: ServiceRequestContextKey;
  /** Short-rent: the stay (booking detail). Without it the form asks which stay of the property. */
  bookingId?: string;
  /**
   * Europe/Rome day of the job (`YYYY-MM-DD`). Short-rent booking detail passes the check-out; otherwise the form
   * uses the check-out of the stay it asks for. Long-rent asks the host for the day.
   */
  jobDate?: string;
  /** Supplier already chosen (marketplace). Without it the form lists the property's suppliers for the category. */
  supplierOrgId?: string;
  preselectedCategory?: string;
  /** Short-rent only: the service of the supplier the request is for. It fixes the category, so the form does not ask for it. */
  service?: RequestedService;
  /** Notes the form starts with (re-requesting after a rejection starts from the notes of the rejected request). */
  initialNotes?: string;
  /**
   * Suppliers left out of the list: the ones that already rejected this job (SU-09). The API does not forbid asking
   * them again, the host just does not get them offered by default.
   */
  excludeSupplierOrgIds?: string[];
  /** `otherSupplier`: the request replaces one a supplier rejected (title and hint say so). */
  mode?: 'new' | 'otherSupplier';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  /** The request was made and the window is closed: the page that wants to show the new request takes it from here (LR-08b). */
  onCreated?: (request: ServiceRequest) => void;
}

/**
 * Manual service request to a supplier. The AI supplier match and the external "nearby businesses" suggestions were
 * removed (FD-21, D11: AI supplier discovery off): the form never calls `match-supplier` and the host's notes only go
 * to the chosen supplier. Short-rent requests are tied to a stay and long-rent ones to the property (D2, SU-07), so web
 * and app find them in the same place.
 */
export function ServiceRequestForm({
  propertyId,
  leaseId,
  context = 'short-rent',
  bookingId,
  jobDate,
  supplierOrgId,
  preselectedCategory,
  service,
  initialNotes,
  excludeSupplierOrgIds,
  mode = 'new',
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  onCreated,
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
  const [category, setCategory] = useState<string>(service?.category ?? preselectedCategory ?? '');
  const selectedCategory = categoryCodes?.includes(category) ? category : (categoryCodes?.[0] ?? '');
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>('Normal');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [pickedStay, setPickedStay] = useState('');
  const [pickedSupplier, setPickedSupplier] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(service?.durationMinutes ? String(service.durationMinutes) : '');
  const [pickedDate, setPickedDate] = useState('');

  const isShortRent = context === 'short-rent';
  const asksStay = isShortRent && !bookingId;
  const asksSupplier = !supplierOrgId;

  // The check-out of the stay is the day of the job. Loaded when the form asks which stay, or when a known stay was
  // not given its day by the caller.
  const stays = usePropertyBookings(open && isShortRent && (asksStay || !jobDate) ? propertyId : undefined);
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
  const excluded = excludeSupplierOrgIds ?? [];
  const allSuppliers = suppliers.data?.items ?? [];
  const supplierOptions = allSuppliers.filter((s) => !excluded.includes(s.orgId));
  // Only the suppliers that already rejected this job were left: say so, instead of "no supplier for this category".
  const onlyExcludedLeft = supplierOptions.length === 0 && allSuppliers.length > 0;

  const effectiveStay = bookingId ?? (stayOptions.some((b) => b.id === pickedStay) ? pickedStay : '');
  const effectiveSupplier =
    supplierOrgId ?? (supplierOptions.some((s) => s.orgId === pickedSupplier) ? pickedSupplier : '');
  const stayForDay = stayOptions.find((b) => b.id === effectiveStay);
  const day = isShortRent ? jobDate || (stayForDay ? stayDateOf(stayForDay.checkOutDate) : '') : pickedDate;
  const duration = Number(durationMinutes);
  // The duration of the service asked for is one of the choices even when it is not one of the usual ones (45 minutes, 2 hours and a half).
  const serviceMinutes = service?.durationMinutes ?? null;
  const durations = serviceMinutes && !DURATIONS.includes(serviceMinutes) ? [...DURATIONS, serviceMinutes].sort((a, b) => a - b) : DURATIONS;
  const scheduleReady = !!day && /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) && durations.includes(duration);

  const createStayRequest = useCreateServiceRequest();
  const createLongRentRequest = useCreateLongRentServiceRequest();
  const isPending = createStayRequest.isPending || createLongRentRequest.isPending;
  const canSubmit =
    !!effectiveSupplier && !!selectedCategory && (!isShortRent || !!effectiveStay) && scheduleReady && !isPending;

  const afterCreate = {
    onSuccess: (created: ServiceRequest) => {
      setOpen(false);
      setNotes(initialNotes ?? '');
      onCreated?.(created);
    },
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const scheduledStartUtc = romeWallTimeToUtc(day, startTime);
    if (!scheduledStartUtc) return;
    const common = {
      propertyId,
      supplierOrgId: effectiveSupplier,
      category: selectedCategory,
      urgency,
      notes: notes || undefined,
      scheduledStartUtc,
      durationMinutes: duration,
    };
    if (isShortRent) {
      createStayRequest.mutate({ ...common, bookingId: effectiveStay, serviceListingId: service?.id }, afterCreate);
    } else {
      createLongRentRequest.mutate({ ...common, leaseId }, afterCreate);
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
          <DialogTitle>{t(mode === 'otherSupplier' ? 'serviceRequest.requestOtherSupplier' : 'serviceRequest.requestSupplier')}</DialogTitle>
          <DialogDescription>
            {t(isShortRent ? 'serviceRequest.stayScopedDescription' : 'serviceRequest.longRentScopedDescription')}
            {mode === 'otherSupplier' && ` ${t('serviceRequest.otherSupplierHint')}`}
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

          {service ? (
            // The service fixes the category: the supplier is asked for this very service.
            <p className="text-sm" data-testid="service-request-service">
              <span className="text-muted-foreground">{t('serviceRequest.forService')} </span>
              <span className="break-words font-medium">{service.name}</span>
            </p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="sr-category">{t('serviceRequest.category')}</Label>
              <ServiceCategorySelect id="sr-category" value={selectedCategory} onChange={setCategory} />
            </div>
          )}

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
                  {t(onlyExcludedLeft ? 'serviceRequest.noOtherSuppliers' : 'serviceRequest.noSuppliers')}
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
            {isShortRent ? (
              day && (
                <p className="text-sm text-muted-foreground" data-testid="service-request-job-day">
                  {t('serviceRequest.jobDayValue', { date: formatStayDate(day, i18n.language) })}
                </p>
              )
            ) : (
              <>
                <Label htmlFor="sr-day">{t('serviceRequest.jobDay')}</Label>
                <Input
                  id="sr-day"
                  type="date"
                  value={pickedDate}
                  onChange={(e) => setPickedDate(e.target.value)}
                  data-testid="service-request-job-date"
                />
              </>
            )}
            <Label htmlFor="sr-start">{t('serviceRequest.startTime')}</Label>
            <Input
              id="sr-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              data-testid="service-request-start-time"
            />
            <Label htmlFor="sr-duration">{t('serviceRequest.duration')}</Label>
            <select
              id="sr-duration"
              className={selectClass}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              data-testid="service-request-duration"
            >
              <option value="">{t('serviceRequest.durationPlaceholder')}</option>
              {durations.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatWorkDuration(minutes, t)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t('serviceRequest.durationHint')}</p>
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
