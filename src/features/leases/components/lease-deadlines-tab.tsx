import { useState } from 'react';
import type { LeaseDetail } from '@/types';
import { useRliChecklist, useTriggerRegistration } from '@/queries/use-leases';
import { DelegaCaptureDialog } from './delega-capture-dialog';
import { QuesturaCommunicationPanel } from './questura-communication-panel';
import { RegistrationStatusPanel } from './registration-status-panel';
import { RliChecklist } from './rli-checklist';

/**
 * What the lease has to do with the authorities and by when: the checklist of the registration (RLI) with its countdown, the
 * Questura communication for an extra-EU tenant and the registration itself. The panels are the ones the page always had;
 * only their place changed.
 */
export function LeaseDeadlinesTab({ lease, showQuestura }: { lease: LeaseDetail; showQuestura: boolean }) {
  const { data: checklist } = useRliChecklist(lease.id);
  const triggerRegistration = useTriggerRegistration();
  const [delegaOpen, setDelegaOpen] = useState(false);

  // The provider path exists only when the API says so (flag on and configured provider, LT-01); otherwise manual.
  const providerFilingAvailable = checklist?.providerFilingAvailable === true;

  // The mutation reports its own errors (toast with the server's reason): only swallow the rejection.
  const handleDelegaConfirm = async (payload: { tosVersion: string; attestationAccepted: boolean }) => {
    try {
      await triggerRegistration.mutateAsync({
        id: lease.id,
        tosVersion: payload.tosVersion,
        attestationAccepted: payload.attestationAccepted,
      });
    } catch {
      // Reported by useTriggerRegistration.onError (the lease is reloaded with the recorded failure).
    }
    setDelegaOpen(false);
  };

  return (
    <div className="space-y-8">
      <RliChecklist leaseId={lease.id} />
      {/* LT-07: extra-EU tenant, the 48-hour Questura communication is declared by the landlord. */}
      {showQuestura && <QuesturaCommunicationPanel leaseId={lease.id} leaseEndDate={lease.endDate} />}
      <RegistrationStatusPanel
        leaseId={lease.id}
        leaseStatus={lease.status}
        registration={lease.registration}
        registrationDeadline={lease.registrationDeadline}
        providerFilingAvailable={providerFilingAvailable}
        onSubmitToProvider={() => setDelegaOpen(true)}
        isSubmittingToProvider={triggerRegistration.isPending}
      />
      {providerFilingAvailable && checklist && (
        <DelegaCaptureDialog
          open={delegaOpen}
          onOpenChange={setDelegaOpen}
          tosVersion={checklist.tosVersion}
          attestationText={checklist.attestationText}
          isSubmitting={triggerRegistration.isPending}
          onConfirm={handleDelegaConfirm}
        />
      )}
    </div>
  );
}
