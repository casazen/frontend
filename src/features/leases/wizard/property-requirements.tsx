import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { propertiesApi } from '@/api/properties.api';
import { useApeAutoRead } from '@/queries/use-properties';
import { getProblemMessage } from '@/lib/api-errors';
import { hasApeIdentification, latestApeDocument } from '@/lib/ape-documents';
import { DocumentUploadDialog } from '@/features/properties/components/document-upload-dialog';
import { ApeIdentificationForm } from '@/features/properties/components/ape-identification-form';
import { longRentPropertyDataPath } from '@/features/properties/long-rent/paths';
import { cn } from '@/lib/utils';
import type { LeaseNeed, Property } from '@/types';

function Requirement({ ok, title, children }: { ok: boolean; title: ReactNode; children?: ReactNode }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-start gap-3">
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-5 shrink-0', ok ? 'text-[color:var(--color-success-foreground,#166534)]' : 'text-[color:var(--color-warning-foreground,#8a4b05)]')}
      />
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * «Cosa serve per il contratto» (LR-06a): the address, the cadastral data and the energy certificate (APE) of the property, and how
 * to put right what is missing. The APE is uploaded here, in a window over the page: the draft is saved on the server, nothing typed
 * is lost. For a contract made in CasaZen the draft cannot be confirmed without the APE; for one already signed it is only a notice
 * (`imported`). `needs` are what the server says the property lacks, once the draft exists; before that only the APE is known.
 */
export function PropertyRequirements({ property, needs, imported }: { property: Property; needs?: LeaseNeed[]; imported: boolean }) {
  const { t } = useTranslation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const {
    data: documents,
    isFetching: loadingDocuments,
    isError: documentsFailed,
    error: documentsError,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ['properties', property.id, 'documents'],
    queryFn: () => propertiesApi.getDocuments(property.id),
  });

  const documentsLoaded = !loadingDocuments && !documentsFailed && documents !== undefined;
  // The contract states the code and the energy class of the last APE uploaded (LT-10): the review waits for them.
  const ape = latestApeDocument(documents);
  const apeMissing = documentsLoaded && !ape;
  const apeToIdentify = documentsLoaded && !!ape && !hasApeIdentification(ape);
  // An APE whose code and class are not there yet: the server reads it again, once per document; the fields come only for what is
  // still missing. An APE just uploaded was read by its upload, which puts that answer in the same cache.
  const apeRead = useApeAutoRead(property.id, documentsLoaded ? ape : undefined);
  const readingApe = apeToIdentify && apeRead.isFetching;
  const cadastralMissing = needs?.some((need) => need.code === 'cadastral_missing');
  const notice = imported ? t('leaseWizard.property.importedNotice') : null;

  return (
    <section className="space-y-3" aria-labelledby="lw-requirements-title" data-testid="lease-requirements">
      <h3 id="lw-requirements-title" className="text-sm font-semibold">
        {t('leaseWizard.property.requirementsTitle')}
      </h3>
      <ul className="space-y-3">
        <Requirement ok title={t('leaseWizard.property.address')}>
          <p className="text-muted-foreground">{[property.address, property.city].filter(Boolean).join(', ')}</p>
        </Requirement>

        {cadastralMissing !== undefined ? (
          <Requirement ok={!cadastralMissing} title={t('leaseWizard.property.cadastral')}>
            {cadastralMissing ? (
              <>
                <p id="lw-cadastral" tabIndex={-1} className="text-muted-foreground outline-none">
                  {t('leaseWizardGuide.property.cadastralMissing')}
                </p>
                <p className="text-muted-foreground">{t('leaseWizardGuide.property.cadastralExplain')}</p>
                <Button asChild variant="outline" size="sm" className="max-sm:min-h-11">
                  {/* The tab "Dati" of the property: where the cadastral identification is (LR-07d). */}
                  <Link to={longRentPropertyDataPath(property.id)}>{t('leaseWizard.property.cadastralAdd')}</Link>
                </Button>
              </>
            ) : null}
          </Requirement>
        ) : null}

        <Requirement ok={documentsLoaded && !!ape && !apeToIdentify} title={t('leaseWizard.property.ape')}>
          {documentsFailed ? (
            <div
              role="alert"
              data-testid="lease-documents-error"
              className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive"
            >
              <span className="flex-1">{getProblemMessage(documentsError, t) ?? t('leases.form.documentsLoadError')}</span>
              <Button type="button" variant="outline" size="sm" className="max-sm:min-h-11" onClick={() => void refetchDocuments()}>
                {t('leases.form.retry')}
              </Button>
            </div>
          ) : null}

          {apeMissing ? (
            <div data-testid="lease-ape-missing" className="space-y-2">
              <p>{imported ? t('leaseWizard.property.apeMissingImported') : t('leases.form.apeMissingError')}</p>
              <p className="text-muted-foreground">{t('leaseWizardGuide.property.apeExplain')}</p>
              <Button id="lw-ape" type="button" variant="outline" size="sm" className="max-sm:min-h-11" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('leases.form.uploadApe')}
              </Button>
            </div>
          ) : null}

          {/* `lw-ape-identification`: where the need `ape_identification_missing` points (the reading, then the two fields to type). */}
          {apeToIdentify && ape && readingApe ? (
            <p
              id="lw-ape-identification"
              tabIndex={-1}
              role="status"
              data-testid="lease-ape-reading"
              className="flex items-center gap-2 text-foreground/80 outline-none"
            >
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t('leases.form.apeReadingFromDocument')}
            </p>
          ) : null}

          {apeToIdentify && ape && !readingApe ? (
            <div
              id="lw-ape-identification"
              tabIndex={-1}
              role="status"
              data-testid="lease-ape-identification"
              className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 outline-none"
            >
              <p className="font-medium">{t('leases.form.apeIdentificationRequired')}</p>
              <p className="text-foreground/80">{t('leaseWizardGuide.property.apeIdentificationHelp')}</p>
              <ApeIdentificationForm
                key={`${ape.id}-${ape.apeCode ?? ''}-${ape.apeEnergyClass ?? ''}`}
                propertyId={property.id}
                document={ape}
                initiallyEditing
                required
              />
            </div>
          ) : null}

          {documentsLoaded && ape && hasApeIdentification(ape) ? (
            <p className="text-foreground/80" data-testid="lease-ape-ready">
              {t('leases.form.apeReady', { code: ape.apeCode, energyClass: ape.apeEnergyClass })}
            </p>
          ) : null}
        </Requirement>
      </ul>
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      {/* Outside the list: once the APE is on file the notice goes, the window stays for its code and class. */}
      <DocumentUploadDialog propertyId={property.id} onlyType="Ape" open={uploadOpen} onOpenChange={setUploadOpen} />
    </section>
  );
}
