import { useTranslation } from 'react-i18next';
import { STATUS_ICONS } from '@/components/shared/status/status-icons';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { cn } from '@/lib/utils';
import type { FiscalDocumentEntry } from '@/types';
import { documentStatesOf, type DocumentState } from './document-model';

/** The code at the end of the key of a state (`fiscalDocuments.list.state.toSend` is `toSend`): what the tests and the page read it by. */
function codeOf(state: DocumentState): string {
  return state.key.slice(state.key.lastIndexOf('.') + 1);
}

/** One state: an icon and a word on a soft background. The icon is always there, so the state is never told by color alone. */
export function StatePill({ state, testId }: { state: DocumentState; testId: string }) {
  const { t } = useTranslation();
  const Icon = STATUS_ICONS[state.icon];

  return (
    <span
      data-testid={testId}
      data-state={codeOf(state)}
      data-tone={state.tone}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES[state.tone])}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{t(state.key, { code: state.detail ?? '' })}</span>
    </span>
  );
}

/**
 * The state of a document in simple words, with a color and an icon (UX-09, NF-84): never a generic «error». The state of the document (a draft, issued and to send to the
 * SDI, sent, delivered, refused by the SDI, managed by the channel manager) and, when it matters, whether it was collected (to collect, paid) are two separate lines. «Scartata
 * dallo SDI» is red and says the code the SDI gave; «Da incassare» is amber; only a document the SDI delivered is «Consegnata». `showPayment` is `false` where the collection is told in a
 * place of its own (the detail of a document).
 */
export function DocumentStateBadge({ document, showPayment = true }: { document: FiscalDocumentEntry; showPayment?: boolean }) {
  const { t } = useTranslation();
  const { main, payment } = documentStatesOf(document);

  return (
    <div className="flex min-w-0 flex-col items-start gap-1" data-testid="fiscal-document-states">
      <StatePill state={main} testId="fiscal-document-state" />
      {main.key.endsWith('.rejected') && main.detail ? (
        <span className="text-xs text-foreground/70" data-testid="fiscal-document-sdi-code">
          {t('fiscalDocuments.list.state.sdiCode', { code: main.detail })}
        </span>
      ) : null}
      {showPayment && payment ? <StatePill state={payment} testId="fiscal-document-payment" /> : null}
    </div>
  );
}
