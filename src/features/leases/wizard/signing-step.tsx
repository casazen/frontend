import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, FileText, Upload } from 'lucide-react';
import { leasesApi } from '@/api/leases.api';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs, withJsonErrorBody } from '@/lib/file-download';
import { toastUndo } from '@/lib/toast-undo';
import { useForgetLeaseReads } from '@/queries/use-lease-draft';
import { useLeaseSigning } from '@/queries/use-leases';
import type { LeaseDraftFlow } from '@/types';
import { SignedContractDialog } from '../components/signed-contract-dialog';
import { WIZARD_BUTTON } from './lease-wizard-frame';
import { AFTER_STEP, SIGN_STEP, flowStep, leaseEditPath } from './wizard-model';

type Working = 'download' | 'preview' | 'revoke' | null;

interface SigningStepProps {
  leaseId: string;
  flow: LeaseDraftFlow;
  getVersion: () => number;
  onServerFlow: (version: number, flow: LeaseDraftFlow) => void;
  stopOn: (error: unknown) => boolean;
  flush: () => Promise<boolean>;
}

function problemCodeOf(error: unknown): string | undefined {
  return isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
}

/**
 * Step ⑦ «Invio e firma» of a contract made in CasaZen (LR-06b), on paper only: three lines of what to do, «Scarica da firmare»
 * (the server records the download, then the PDF comes), and the signed copy with the window that already exists. Nothing is sent to
 * the tenant: no code, no link, no e-mail. The download can be taken back, and the screen says it (a toast right after, and a button
 * while the contract is waiting to be signed). While the model of the contract is a draft the server refuses the download
 * (`contract_template_not_approved`): the button is off and the step says so, with the preview (marked BOZZA) still there to read.
 * When the model lacks a datum of the contract (`contract_data_missing`, which the review should have caught: a guard) the step says so
 * too, in a fixed notice and not only in a toast, and points at the preview, where the missing data are marked.
 */
export function SigningStep({ leaseId, flow, getVersion, onServerFlow, stopOn, flush }: SigningStepProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const forgetReads = useForgetLeaseReads(leaseId);
  const signing = useLeaseSigning(leaseId);
  const [working, setWorking] = useState<Working>(null);
  const [refused, setRefused] = useState<'template' | 'data' | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const sent = flowStep(flow, SIGN_STEP)?.needs.some((need) => need.code === 'signed_copy_missing') ?? false;
  const templateInApproval = refused === 'template' || signing.data?.contractUnavailableCode === 'contract_template_not_approved';
  const dataMissing = refused === 'data' || signing.data?.contractUnavailableCode === 'contract_data_missing';

  const revoke = async () => {
    const revoked = await leasesApi.revokeSent(leaseId, getVersion());
    onServerFlow(revoked.version, revoked.flow);
  };

  const download = async () => {
    if (working) return;
    setWorking('download');
    try {
      if (!sent) {
        if (!(await flush())) return;
        const marked = await leasesApi.markSent(leaseId, getVersion());
        onServerFlow(marked.version, marked.flow);
        saveBlobAs(await leasesApi.downloadContract(leaseId), `contratto-${leaseId}.pdf`);
        toastUndo(t('leaseWizard.sign.sentToast'), { undo: revoke });
        return;
      }
      saveBlobAs(await leasesApi.downloadContract(leaseId), `contratto-${leaseId}.pdf`);
    } catch (error) {
      const readable = await withJsonErrorBody(error);
      if (stopOn(readable)) return;
      const code = problemCodeOf(readable);
      if (code === 'contract_template_not_approved' || code === 'contract_data_missing') {
        setRefused(code === 'contract_data_missing' ? 'data' : 'template');
        return;
      }
      toast.error(getProblemMessage(readable, t) ?? t('leases.signature.downloadFailed'));
    } finally {
      setWorking(null);
    }
  };

  const preview = async () => {
    if (working) return;
    setWorking('preview');
    try {
      saveBlobAs(await leasesApi.downloadContractPreview(leaseId), `bozza-contratto-${leaseId}.pdf`);
    } catch (error) {
      toast.error(getProblemMessage(await withJsonErrorBody(error), t) ?? t('leases.signature.downloadFailed'));
    } finally {
      setWorking(null);
    }
  };

  const cancelDownload = async () => {
    if (working) return;
    setWorking('revoke');
    try {
      await revoke();
      toast.success(t('leaseWizard.sign.revokedToast'));
    } catch (error) {
      if (!stopOn(error)) toast.error(getProblemMessage(error, t) ?? t('leaseWizard.sign.revokeFailed'));
    } finally {
      setWorking(null);
    }
  };

  const signed = () => {
    forgetReads();
    navigate(leaseEditPath(leaseId, AFTER_STEP), { replace: true });
  };

  return (
    <div className="space-y-6" data-testid="lease-signing-step">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>{t('leaseWizard.sign.lines.print')}</li>
        <li>{t('leaseWizard.sign.lines.sign')}</li>
        <li>{t('leaseWizard.sign.lines.upload')}</li>
      </ol>

      {sent ? (
        <div className="space-y-4" data-testid="lease-sign-sent">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t('leaseWizard.sign.sentBadge')}</Badge>
            <p className="min-w-0 text-sm">{t('leaseWizard.sign.sentText')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button type="button" className={WIZARD_BUTTON} onClick={() => setUploadOpen(true)} data-testid="lease-sign-upload">
              <Upload aria-hidden="true" className="size-4 shrink-0" />
              {t('leaseWizard.sign.upload')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={WIZARD_BUTTON}
              loading={working === 'download'}
              onClick={() => void download()}
              data-testid="lease-sign-download-again"
            >
              <Download aria-hidden="true" className="size-4 shrink-0" />
              {t('leaseWizard.sign.downloadAgain')}
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            className={WIZARD_BUTTON}
            loading={working === 'revoke'}
            onClick={() => void cancelDownload()}
            data-testid="lease-sign-revoke"
          >
            {t('leaseWizard.sign.revoke')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {templateInApproval ? (
            <Alert variant="warning" data-testid="lease-sign-template">
              {t('leaseWizard.sign.templateInApproval')}
            </Alert>
          ) : dataMissing ? (
            <Alert variant="warning" data-testid="lease-sign-data-missing">
              {t('leaseWizard.sign.dataMissing')}
            </Alert>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className={WIZARD_BUTTON}
              disabled={templateInApproval}
              loading={working === 'download'}
              onClick={() => void download()}
              data-testid="lease-sign-download"
            >
              <Download aria-hidden="true" className="size-4 shrink-0" />
              {t('leaseWizard.sign.download')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={WIZARD_BUTTON}
              loading={working === 'preview'}
              onClick={() => void preview()}
              data-testid="lease-sign-preview"
            >
              <FileText aria-hidden="true" className="size-4 shrink-0" />
              {t('leaseWizard.sign.preview')}
            </Button>
          </div>
        </div>
      )}

      <SignedContractDialog leaseId={leaseId} open={uploadOpen} onOpenChange={setUploadOpen} onSigned={signed} />
    </div>
  );
}
