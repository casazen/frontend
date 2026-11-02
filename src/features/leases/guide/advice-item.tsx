import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { leasesApi } from '@/api/leases.api';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs, withJsonErrorBody } from '@/lib/file-download';
import type { LeaseDetail } from '@/types';
import { RegisteredBenefits } from '../components/registered-benefits';
import { leaseSheetPath, operationPath } from '../lib/lease-next-step';
import { LEASE_ACTION_PARAM } from '../lifecycle/lifecycle-actions';
import { SOURCES, type AdviceAction, type AdviceEntry, type GuideTool } from './advice-catalogue';
import { Disclosure } from './disclosure';
import { GuideButton } from './guide-button';

interface AdviceItemProps {
  entry: AdviceEntry;
  lease: LeaseDetail;
  /** The numbers the texts take (`guideValues`). */
  values: Record<string, string | number>;
  onOpenTool: (tool: GuideTool) => void;
}

/** The address of the sheet of the lease with a window of the lifecycle open on it (`?azione=disdetta`). */
function lifecyclePath(leaseId: string, action: string): string {
  return `${leaseSheetPath(leaseId)}?${LEASE_ACTION_PARAM}=${action}`;
}

/** An official page: it opens in a new tab and says so to a screen reader. */
function OfficialLink({ href, label }: { href: string; label: string }) {
  const { t } = useTranslation();
  return (
    <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal py-2 text-center leading-tight" iconRight={<ExternalLink />}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <span className="sr-only"> {t('leaseGuide.opensNewTab')}</span>
      </a>
    </Button>
  );
}

/** The receipt of the registration, saved as a file: the advice that asks to keep it. */
function ReceiptButton({ leaseId, label }: { leaseId: string; label: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      saveBlobAs(await leasesApi.downloadReceipt(leaseId), `ricevuta-rli-${leaseId}.pdf`);
    } catch (error) {
      toast.error(getProblemMessage(await withJsonErrorBody(error), t) ?? t('cfDocuments.downloadError'));
    } finally {
      setBusy(false);
    }
  }

  return <GuideButton label={label} onClick={() => void download()} loading={busy} testId="lease-advice-receipt" />;
}

function ActionOf({ action, label, leaseId, onOpenTool }: { action: AdviceAction; label: string; leaseId: string; onOpenTool: (tool: GuideTool) => void }) {
  switch (action.kind) {
    case 'tab':
      return <GuideButton label={label} href={leaseSheetPath(leaseId, action.tab)} testId="lease-advice-action" />;
    case 'lifecycle':
      return <GuideButton label={label} href={lifecyclePath(leaseId, action.action)} testId="lease-advice-action" />;
    case 'operation':
      return <GuideButton label={label} href={operationPath(leaseId, action.operation)} testId="lease-advice-action" />;
    case 'tool':
      return <GuideButton label={label} onClick={() => onOpenTool(action.tool)} testId="lease-advice-action" />;
    case 'official': {
      const url = SOURCES[action.source].url;
      return url ? <OfficialLink href={url} label={label} /> : null;
    }
    case 'receipt':
      return <ReceiptButton leaseId={leaseId} label={label} />;
  }
}

/**
 * One piece of advice of the guide: a short title (often a question), a sentence or two in plain words, the one gesture that does
 * something about it and, closed, «Perché?» with the reason and the sources. The follow-up of a registered canone concordato is the
 * one that brings its own block (the documents to bring to the accountant and to the comune, each with its button).
 */
export function AdviceItem({ entry, lease, values, onOpenTool }: AdviceItemProps) {
  const { t } = useTranslation();
  const base = `leaseGuide.advice.${entry.id}`;

  if (entry.render === 'benefits') {
    return (
      <li className="py-4" data-testid="lease-advice" data-advice={entry.id}>
        <RegisteredBenefits lease={lease} plain />
      </li>
    );
  }

  return (
    <li className="min-w-0 space-y-2 py-4" data-testid="lease-advice" data-advice={entry.id}>
      <h3 className="break-words text-base font-semibold leading-snug">{t(`${base}.title`, values)}</h3>
      <p className="break-words text-sm text-foreground/80">{t(`${base}.body`, values)}</p>
      {entry.action ? (
        <div>
          <ActionOf action={entry.action} label={t(`${base}.action`, values)} leaseId={lease.id} onOpenTool={onOpenTool} />
        </div>
      ) : null}
      <Disclosure summary={t('leaseGuide.why')} testId={`lease-advice-why-${entry.id}`}>
        <p className="break-words">{t(`${base}.why`, values)}</p>
        {entry.sources.length > 0 ? (
          <div className="space-y-1 text-foreground/70">
            <p className="font-medium">{t('leaseGuide.sources')}</p>
            <ul className="list-disc space-y-1 break-words pl-5">
              {entry.sources.map((id) => {
                const source = SOURCES[id];
                const label = t(`leaseGuide.source.${id}`);
                return (
                  <li key={id}>
                    {source.url ? (
                      <a className="text-primary-text underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer">
                        {label}
                        <span className="sr-only"> {t('leaseGuide.opensNewTab')}</span>
                      </a>
                    ) : (
                      label
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </Disclosure>
    </li>
  );
}
