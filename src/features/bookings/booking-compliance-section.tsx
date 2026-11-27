import { useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { isAlloggiatiNotDue } from '@/features/alloggiati/alloggiati-status.utils';
import { ComplianceDrawerButton } from '@/features/compliance/compliance-drawer/compliance-drawer-button';
import { useComplianceDrawerAvailable } from '@/features/compliance/compliance-drawer/use-compliance-drawer';
import { ProofUploadDialog } from '@/features/compliance/components/proof-upload-dialog';
import { useWorkspace } from '@/hooks/use-workspace';
import { todayInRome } from '@/lib/stay-dates';
import { useComplianceEvidence } from '@/queries/compliance-archive';
import { useAlloggiatiStatus } from '@/queries/use-alloggiati';
import { useProperties } from '@/queries/use-properties';
import type { Booking, ComplianceProofKind, Property } from '@/types';
import { BookingComplianceRecords } from './components/booking-compliance-records';
import { stayDateOf } from './lib/booking-price';

/** The page of a stay files the receipt of the Alloggiati communication and nothing else: the tax and ISTAT proofs are filed from the archive. */
const RECEIPT_ONLY: readonly ComplianceProofKind[] = ['AlloggiatiReceipt'];
const NO_PROPERTIES: Property[] = [];

interface BookingComplianceSectionProps {
  booking: Pick<Booking, 'id' | 'propertyId'> & Partial<Pick<Booking, 'checkInDate' | 'propertyName'>>;
}

/**
 * «Cassetto Compliance» of a booking (CHK-15, E03/F05/US02, E20/F01/US02, E20/F02/US02): under the Alloggiati Web of the stay, what CasaZen holds for it (the proofs of its arrival
 * day, with their download, and the log of what was sent, newest first: `BookingComplianceRecords`), the action that takes the host to the connected area to read the outcome of its
 * communication, with the guide of what to check there, and «Carica la ricevuta»: the receipt of the arrival day filed from this page, in a layer over it, with the day already chosen
 * (`ProofUploadDialog`: the flats it covers, how many stays it puts in order, the guide to get it). It says nothing about the outcome at the police and offers no way to record one: the
 * result stays in the connected area. Not on the page when the connector is off or the user cannot read bookings.
 *
 * Whether the stay owes a communication is what the Alloggiati panel above it says, from the same status (the same query, so one request for both):
 * a no-show (`NotDue`: the guests never came) has none to check, so the section is not offered for it, as for no one else's reader of that state.
 * Until the status is known the section waits, so it does not appear and go.
 *
 * The receipt is offered to who may send the guests' data (`alloggiati.submit`, the permission of the endpoint), from the arrival day on (a receipt of a day that has not come cannot
 * exist) and until the server says an archived receipt covers the stay: then the stay needs none.
 */
export function BookingComplianceSection({ booking }: BookingComplianceSectionProps) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const available = useComplianceDrawerAvailable();
  const { data: status, isLoading } = useAlloggiatiStatus(booking.id, available);
  const [uploading, setUploading] = useState(false);
  const owed = status === undefined || !isAlloggiatiNotDue(status.status);
  if (!available || isLoading || !owed) return null;

  const arrivalDay = booking.checkInDate ? stayDateOf(booking.checkInDate) : undefined;
  const receiptArchived = status?.channelManager?.receiptCoverage?.archived === true;
  const canUploadReceipt = arrivalDay !== undefined && arrivalDay <= todayInRome() && !receiptArchived && hasPermission('short-rent', 'alloggiati.submit');

  return (
    <PlainSection title={t('compliance.drawer.section.title')} data-testid="booking-compliance-section">
      <p className="text-sm text-foreground/70">{t('compliance.drawer.section.body')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <ComplianceDrawerButton target={{ topic: 'Alloggiati', propertyId: booking.propertyId, bookingId: booking.id }} testId="booking-compliance-drawer-trigger" />
        {canUploadReceipt ? (
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setUploading(true)} data-testid="booking-receipt-upload-open">
            <Upload className="size-4" aria-hidden="true" />
            {t('compliance.drawer.section.uploadReceipt')}
          </Button>
        ) : null}
      </div>
      <div className="pt-4">
        <BookingComplianceRecords bookingId={booking.id} enabled={available && owed} />
      </div>
      {uploading && arrivalDay !== undefined ? (
        <BookingReceiptUpload propertyId={booking.propertyId} propertyName={booking.propertyName} day={arrivalDay} onClose={() => setUploading(false)} />
      ) : null}
    </PlainSection>
  );
}

interface BookingReceiptUploadProps {
  propertyId: string;
  propertyName?: string;
  day: string;
  onClose: () => void;
}

/**
 * The layer that files the receipt of a stay, mounted only while it is open (so nothing of it is read before the host asks). It opens at once with the flat of the stay and the day of its
 * arrival chosen, and the properties of the organization come in as they arrive: they are the flats the receipt may cover besides this one, read again every time the layer opens (a
 * flat is added on another page). The address of the portal of Alloggiati Web is the one the configuration of the API gives with the archive (one proof of this flat is enough to read it):
 * the client never writes it, and without it the guide still tells where to go and offers no link.
 */
function BookingReceiptUpload({ propertyId, propertyName, day, onClose }: BookingReceiptUploadProps) {
  const { t } = useTranslation();
  // The flats of the short-rent area only: the Alloggiati communication is for short stays, and a flat let long-term is never one a receipt covers.
  const properties = useProperties({ mode: 'short' }, { fresh: true });
  const archive = useComplianceEvidence({ propertyId, pageSize: 1 });
  const known = Array.isArray(properties.data) ? properties.data : NO_PROPERTIES;
  const flats = known.some((flat) => flat.id === propertyId) ? known : [{ id: propertyId, name: propertyName ?? t('compliance.drawer.section.thisProperty') }, ...known];

  return (
    <ProofUploadDialog
      open
      onClose={onClose}
      properties={flats}
      kinds={RECEIPT_ONLY}
      prefill={{ propertyId, kind: 'AlloggiatiReceipt', day }}
      alloggiatiPortalUrl={archive.data?.alloggiatiPortalUrl}
    />
  );
}
