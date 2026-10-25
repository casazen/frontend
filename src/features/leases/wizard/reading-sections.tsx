import { useTranslation } from 'react-i18next';
import { FileStack } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import type { LeaseReading } from '@/types';
import { readContractDocument, recognizedParts, warningText } from '../lib/document-sections';

/**
 * What the reading recognized in the contract file (CF-DOCS-REAL) and what it found worth a second look: «Nel file abbiamo riconosciuto:
 * contratto (pp. 1–6), attestazione (pp. 7–10), scheda di calcolo (pp. 11–14)», and the warnings of the check of coherence in plain words.
 * A file with no attestation and no sheet is one contract: that is said as it is, nothing is wrong with it. A warning never blocks anything,
 * and the codes the server sends are the only thing the screen depends on: it holds no value of the contract.
 */
export function ReadingSections({ reading }: { reading: LeaseReading }) {
  const { t } = useTranslation();
  const document = readContractDocument(reading);
  const sections = document?.sections ?? [];
  const warnings = document?.warnings ?? [];
  if (sections.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="lease-reading-sections">
      {sections.length > 0 ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground" data-testid="lease-reading-recognized">
          <FileStack aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{t('leaseDocs.recognized', { parts: recognizedParts(t, sections) })}</span>
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <Alert variant="warning" title={t('leaseDocs.warnings.title')} data-testid="lease-reading-warnings">
          <ul className="list-disc space-y-1 ps-5">
            {warnings.map((warning) => (
              <li key={warning.code} className="break-words" data-testid={`lease-reading-warning-${warning.code}`}>
                {warningText(t, warning)}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
}
