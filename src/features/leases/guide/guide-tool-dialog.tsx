import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CedolareAdvisoryInput, LeaseDetail } from '@/types';
import { AttestationGuidancePanel } from '../components/attestation-guidance-panel';
import { CedolareDecisionPanel } from '../components/cedolare-decision-panel';
import { ImuNotificationExportButton } from '../components/imu-notification-export-button';
import type { GuideTool } from './advice-catalogue';
import { ConcordatoRangeCheck } from './concordato-range-check';

interface GuideToolDialogProps {
  /** The tool to show; `null` keeps the window closed. */
  tool: GuideTool | null;
  lease: LeaseDetail;
  /** What the landlord answered in «Affina la stima»: held by the guide, so that its summary line and the window say the same. */
  advisoryInput: CedolareAdvisoryInput | undefined;
  onAdvisoryInputChange: (input: CedolareAdvisoryInput | undefined) => void;
  onClose: () => void;
}

/**
 * The window in which a tool of the guide opens (LR-GUIDE-1): the comparison of the two tax regimes, the check of the rent against the
 * agreement, the organizations that attest the contract, the IMU communication. Each one is the panel the lease sheet has always had,
 * moved off the tab «Dati» and given a title and a sentence that say what it is for. On a phone the window is a sheet from the bottom.
 */
export function GuideToolDialog({ tool, lease, advisoryInput, onAdvisoryInputChange, onClose }: GuideToolDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={tool !== null} onOpenChange={(next) => !next && onClose()}>
      {tool !== null ? (
        <DialogContent className="sm:max-h-[90dvh] sm:max-w-2xl sm:overflow-y-auto" data-testid="guide-tool-dialog" data-tool={tool}>
          <DialogHeader>
            <DialogTitle>{t(`leaseGuide.tool.${tool}.title`)}</DialogTitle>
            <DialogDescription>{t(`leaseGuide.tool.${tool}.description`)}</DialogDescription>
          </DialogHeader>
          {tool === 'regime' && <CedolareDecisionPanel leaseId={lease.id} input={advisoryInput} onInputChange={onAdvisoryInputChange} />}
          {tool === 'rent' && <ConcordatoRangeCheck lease={lease} />}
          {tool === 'attestation' && <AttestationGuidancePanel propertyId={lease.propertyId} />}
          {tool === 'imu' && <ImuNotificationExportButton leaseId={lease.id} />}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
