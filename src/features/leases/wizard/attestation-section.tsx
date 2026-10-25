import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { useLeaseDocuments } from '@/queries/use-lease-documents';
import { LeaseDocumentUploadDialog } from '../components/lease-document-upload-dialog';
import { newestDocument } from '../lib/lease-benefits';
import { WIZARD_BUTTON } from './lease-wizard-frame';

/**
 * The attestation of a canone concordato, asked in the last step of «Crea contratto» (CF-END): it shows that the rent respects the
 * territorial agreement and is what the benefits of the contract are claimed with. The section says whether the lease has one among its
 * documents («Attestazione: caricata», with the file) or not («Attestazione: ancora da caricare»), and has the one button that uploads
 * it, or a new file when there is one already. It never stops the step: the registration is declared and the wizard is finished with or
 * without it, and what is missing is told again where the lease is shown once it is registered. Only for a canone concordato; a libero
 * or transitorio contract has no attestation and is not asked for one.
 *
 * Unlike the receipt of the registration, which the declaration refers to, nothing here has to be chosen or kept: the attestation is a
 * document of the lease, so the file already uploaded is the one in use and «Carica un nuovo file» adds the one that replaces it.
 */
export function AttestationSection({ leaseId }: { leaseId: string }) {
  const { t } = useTranslation();
  const documents = useLeaseDocuments(leaseId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const attestation = documents.data ? newestDocument(documents.data, 'Attestation') : undefined;
  const name = t('leaseRound.document.attestation.name');

  return (
    <PlainSection title={t('leaseRound.attestation.title')} data-testid="lease-after-attestation">
      <p className="text-sm text-foreground/70">{t('leaseRound.attestation.why')}</p>
      <div className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5" data-testid="lease-after-attestation-status">
          {documents.isPending ? (
            <p role="status" className="text-sm text-foreground/70">
              {t('leaseRound.benefits.loading')}
            </p>
          ) : documents.isError ? (
            <p className="break-words text-sm">{t('cfDocuments.documentsError')}</p>
          ) : attestation ? (
            <>
              <p className="break-words font-medium">{t('leaseRound.attestation.present')}</p>
              <p className="break-all text-sm text-foreground/70">{attestation.fileName}</p>
            </>
          ) : (
            <p className="break-words font-medium">{t('leaseRound.benefits.missingLine', { name })}</p>
          )}
        </div>
        {documents.isError ? (
          <Button type="button" variant="outline" className={`${WIZARD_BUTTON} sm:shrink-0`} onClick={() => void documents.refetch()}>
            {t('leases.retry')}
          </Button>
        ) : documents.isSuccess ? (
          <Button
            type="button"
            variant="outline"
            className={`${WIZARD_BUTTON} sm:shrink-0`}
            onClick={() => setUploadOpen(true)}
            data-testid="lease-after-attestation-upload"
          >
            {attestation ? t('leaseRound.attestation.another') : t('leaseRound.document.attestation.upload')}
          </Button>
        ) : null}
      </div>

      {/* Always mounted, not inside the branches above: a window that lives in a branch is lost when the branch changes. */}
      <LeaseDocumentUploadDialog
        leaseId={leaseId}
        kind="Attestation"
        title={t('leaseRound.document.attestation.upload')}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </PlainSection>
  );
}
