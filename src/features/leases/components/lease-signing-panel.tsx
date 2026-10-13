import { useState } from 'react';
import { AlertCircle, AlertTriangle, CalendarCheck, Download, ExternalLink, FileText, Loader2, PenLine, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { leasesApi } from '@/api/leases.api';
import { useInitiateSigning, useLeaseSigning } from '@/queries/use-leases';
import { formatDate, formatDateTime } from '@/lib/utils';
import { getLeasePartyRoleLabel } from '@/lib/i18n-labels';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs, withJsonErrorBody } from '@/lib/file-download';
import { isBeforeFullSignature } from '@/lib/lease-signing';
import { SignedContractDialog } from './signed-contract-dialog';
import { StipulaDeclarationDialog } from './stipula-declaration-dialog';
import type { LeaseDetail, LeaseSigner } from '@/types';

type DownloadKind = 'contract' | 'preview' | 'signed';

interface LeaseSigningPanelProps {
  lease: Pick<LeaseDetail, 'id' | 'status' | 'stipulaDate' | 'hasSignedPdf'>;
}

/** Why the final contract cannot be downloaded, as an i18n key; the BOZZA preview is always available. */
function contractUnavailableKey(code: string | null): string {
  switch (code) {
    case 'contract_template_not_approved':
      return 'leases.signature.contractUnavailable.templateNotApproved';
    case 'contract_data_missing':
      return 'leases.signature.contractUnavailable.dataMissing';
    default:
      return 'leases.signature.contractUnavailable.other';
  }
}

function ButtonIcon({ busy, icon: Icon }: { busy: boolean; icon: typeof Download }) {
  return busy ? (
    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
  ) : (
    <Icon className="mr-2 h-4 w-4" aria-hidden />
  );
}

function SignerRow({ signer }: { signer: LeaseSigner }) {
  const { t } = useTranslation();
  const signed = signer.status === 'Signed';
  const link = !signed && signer.method === 'Provider' ? signer.signingUrl : null;

  return (
    <li
      data-testid="lease-signer"
      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {signer.firstName} {signer.lastName}
          </span>
          <Badge variant="outline">{getLeasePartyRoleLabel(signer.role, t)}</Badge>
          <Badge variant={signed ? 'success' : 'secondary'} data-testid="lease-signer-status">
            {signed ? t('leases.signature.signerSigned') : t('leases.signature.signerPending')}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(signer.method === 'Provider' ? 'leases.signature.methodProvider' : 'leases.signature.methodOffline')}
        </p>
        {signed && signer.signedAt && (
          <p className="text-sm text-muted-foreground">
            {t('leases.signature.signedOn', { date: formatDate(signer.signedAt) })}
          </p>
        )}
        {link && signer.signingUrlExpiresAt && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {t('leases.signature.linkExpires', { date: formatDateTime(signer.signingUrlExpiresAt) })}
            {signer.signingUrlExpired && (
              <Badge variant="destructive" data-testid="lease-signer-link-expired">
                {t('leases.signature.linkExpired')}
              </Badge>
            )}
          </p>
        )}
      </div>
      {link && (
        <Button asChild variant="outline" size="sm">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
            {t('leases.signature.openLink')}
          </a>
        </Button>
      )}
    </li>
  );
}

/**
 * Signature of the lease contract (LT-02: A7-02, A7-16; decision D15). Offline by default: download the final contract
 * (approved template only, otherwise only the BOZZA preview), have every party sign it on paper or with their own
 * digital signature, upload the signed PDF with the stipula date. Nothing is shown as signed before the API records it.
 * The e-signature provider is offered only when the API says it is available; its links are persisted and survive a
 * refresh. For a lease signed without a recorded stipula date, the date can be declared once.
 */
export function LeaseSigningPanel({ lease }: LeaseSigningPanelProps) {
  const { t } = useTranslation();
  const signing = useLeaseSigning(lease.id);
  const initiate = useInitiateSigning();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [stipulaOpen, setStipulaOpen] = useState(false);
  const [downloading, setDownloading] = useState<DownloadKind | null>(null);

  const beforeSignature = isBeforeFullSignature(lease.status);
  const state = signing.data;
  const providerInProgress =
    beforeSignature && !!state?.signers.some((s) => s.method === 'Provider' && s.status === 'Pending');
  const statusKey = beforeSignature
    ? providerInProgress
      ? 'leases.signature.state.inProgress'
      : 'leases.signature.state.toSign'
    : 'leases.signature.state.signed';

  const handleDownload = async (kind: DownloadKind) => {
    setDownloading(kind);
    try {
      if (kind === 'contract') saveBlobAs(await leasesApi.downloadContract(lease.id), `contratto-${lease.id}.pdf`);
      else if (kind === 'preview')
        saveBlobAs(await leasesApi.downloadContractPreview(lease.id), `bozza-contratto-${lease.id}.pdf`);
      else saveBlobAs(await leasesApi.downloadSignedContract(lease.id), `contratto-firmato-${lease.id}.pdf`);
    } catch (error) {
      toast.error(getProblemMessage(await withJsonErrorBody(error), t) ?? t('leases.signature.downloadFailed'));
    } finally {
      setDownloading(null);
    }
  };

  const handleInitiateProvider = () => {
    initiate.mutate(lease.id);
  };

  return (
    <Card data-testid="lease-signing-panel">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t('leases.signature.title')}</CardTitle>
            <CardDescription>{t('leases.signature.description')}</CardDescription>
          </div>
          <Badge variant={beforeSignature ? 'outline' : 'success'} data-testid="lease-signing-state">
            {t(statusKey)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {signing.isLoading && (
          <p className="flex items-center gap-2 text-muted-foreground" data-testid="lease-signing-loading">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('leases.signature.loading')}
          </p>
        )}

        {signing.isError && (
          <div
            role="alert"
            data-testid="lease-signing-error"
            className="space-y-2 rounded-md border border-destructive/50 bg-destructive/10 p-3"
          >
            <p className="flex items-start gap-2 font-medium text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('leases.signature.loadError')}
            </p>
            {getProblemMessage(signing.error, t) && <p>{getProblemMessage(signing.error, t)}</p>}
            <Button variant="outline" size="sm" onClick={() => void signing.refetch()} disabled={signing.isFetching}>
              {t('leases.retry')}
            </Button>
          </div>
        )}

        {state && (
          <>
            {state.signers.length === 0 ? (
              <p className="text-muted-foreground">{t('leases.signature.noSigners')}</p>
            ) : (
              <ul className="space-y-3" aria-label={t('leases.signature.signersTitle')}>
                {state.signers.map((signer) => (
                  <SignerRow key={signer.partyId} signer={signer} />
                ))}
              </ul>
            )}

            {beforeSignature && (
              <>
                {providerInProgress && (
                  <p className="rounded-md border p-3" data-testid="lease-signing-provider-note">
                    {t('leases.signature.providerInProgress')}
                  </p>
                )}

                <div className="space-y-3 rounded-md border p-3" data-testid="lease-signing-offline">
                  <p className="font-medium">
                    {t(providerInProgress ? 'leases.signature.offlineAlternativeTitle' : 'leases.signature.offlineTitle')}
                  </p>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>{t('leases.signature.offlineSteps.step1')}</li>
                    <li>{t('leases.signature.offlineSteps.step2')}</li>
                    <li>{t('leases.signature.offlineSteps.step3')}</li>
                  </ol>
                  <p className="text-xs text-muted-foreground">{t('leases.signature.offlineNotVerified')}</p>

                  {!state.contractAvailable && (
                    <p
                      role="status"
                      data-testid="lease-contract-unavailable"
                      className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      {t(contractUnavailableKey(state.contractUnavailableCode))}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => void handleDownload('contract')}
                      disabled={!state.contractAvailable || downloading !== null}
                    >
                      <ButtonIcon busy={downloading === 'contract'} icon={Download} />
                      {t('leases.signature.downloadContract')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleDownload('preview')}
                      disabled={downloading !== null}
                    >
                      <ButtonIcon busy={downloading === 'preview'} icon={FileText} />
                      {t('leases.signature.downloadPreview')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setUploadOpen(true)}
                      disabled={!state.contractAvailable}
                    >
                      <Upload className="mr-2 h-4 w-4" aria-hidden />
                      {t('leases.signature.uploadSigned')}
                    </Button>
                  </div>
                </div>

                {state.providerSigningAvailable && lease.status === 'Draft' && (
                  <div className="space-y-2 rounded-md border p-3" data-testid="lease-signing-provider">
                    <p className="font-medium">{t('leases.signature.providerTitle')}</p>
                    <p className="text-muted-foreground">{t('leases.signature.providerDescription')}</p>
                    <Button
                      variant="outline"
                      onClick={handleInitiateProvider}
                      disabled={initiate.isPending || !state.contractAvailable}
                    >
                      <ButtonIcon busy={initiate.isPending} icon={PenLine} />
                      {t('leases.signature.providerStart')}
                    </Button>
                  </div>
                )}
              </>
            )}

            {!beforeSignature && (
              <div className="space-y-3" data-testid="lease-signing-done">
                {lease.stipulaDate ? (
                  <p className="flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                    {t('leases.signature.stipulaRecorded', { date: formatDate(lease.stipulaDate) })}
                  </p>
                ) : (
                  <div
                    role="status"
                    data-testid="lease-stipula-missing"
                    className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
                  >
                    <p className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      {t('leases.signature.stipulaMissing')}
                    </p>
                    <Button size="sm" onClick={() => setStipulaOpen(true)}>
                      <CalendarCheck className="mr-2 h-4 w-4" aria-hidden />
                      {t('leases.signature.declareStipula')}
                    </Button>
                  </div>
                )}
                {lease.hasSignedPdf ? (
                  <Button
                    variant="outline"
                    onClick={() => void handleDownload('signed')}
                    disabled={downloading !== null}
                  >
                    <ButtonIcon busy={downloading === 'signed'} icon={Download} />
                    {t('leases.signature.downloadSigned')}
                  </Button>
                ) : (
                  <p className="text-muted-foreground">{t('leases.signature.signedPdfNotAvailable')}</p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      {beforeSignature && (
        <SignedContractDialog leaseId={lease.id} open={uploadOpen} onOpenChange={setUploadOpen} />
      )}
      {!beforeSignature && !lease.stipulaDate && (
        <StipulaDeclarationDialog leaseId={lease.id} open={stipulaOpen} onOpenChange={setStipulaOpen} />
      )}
    </Card>
  );
}
