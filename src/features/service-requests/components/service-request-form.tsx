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
import { Wrench } from 'lucide-react';
import { useCreateServiceRequest } from '@/queries/use-service-requests';
import type { ServiceRequestUrgency } from '@/types/service-request';

const CATEGORIES = ['cleaning', 'maintenance', 'plumbing', 'laundry'] as const;

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface ServiceRequestFormProps {
  propertyId: string;
  supplierOrgId: string;
  preselectedCategory?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

/**
 * Manual service request to a supplier the host has already chosen (marketplace). The AI supplier match and the
 * external "nearby businesses" suggestions were removed (FD-21, D11: AI supplier discovery off): the form never calls
 * `match-supplier` and the host's notes only go to the chosen supplier.
 */
export function ServiceRequestForm({
  propertyId,
  supplierOrgId,
  preselectedCategory,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: ServiceRequestFormProps) {
  const { t } = useTranslation();
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

  const [category, setCategory] = useState<string>(preselectedCategory ?? 'cleaning');
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>('Normal');
  const [notes, setNotes] = useState('');

  const createMutation = useCreateServiceRequest();

  const handleSubmit = () => {
    if (!supplierOrgId) return;
    createMutation.mutate(
      {
        propertyId,
        supplierOrgId,
        category,
        urgency,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setNotes('');
        },
      },
    );
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
          <DialogDescription>{t('serviceRequest.propertyScopedDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sr-category">{t('serviceRequest.category')}</Label>
            <select
              id="sr-category"
              className={selectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`serviceRequest.categories.${c}`)}
                </option>
              ))}
            </select>
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
