import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { buildEmbedMountOptions, buildEmbedSnippet, type EmbedSnippetInput } from './embed-snippet';
import { EmbedPreview } from './embed-preview';

export type SnippetPlan = { state: 'ready'; input: EmbedSnippetInput } | { state: 'waiting'; message: string };

const COPIED_MS = 2000;

export function EmbedSnippetPanel({ plan }: { plan: SnippetPlan }) {
  const { t } = useTranslation();
  const snippetTitleId = useId();
  const previewTitleId = useId();
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const snippet = plan.state === 'ready' ? buildEmbedSnippet(plan.input) : null;
  const copied = snippet !== null && copiedText === snippet;

  useEffect(() => {
    if (copiedText === null) return;
    const timer = setTimeout(() => setCopiedText(null), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copiedText]);

  const copy = async () => {
    if (snippet === null) return;
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      toast.error(t('embed.settings.snippet.copyFailed'));
      return;
    }
    setCopiedText(snippet);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start" data-testid="embed-snippet-panel" data-state={plan.state}>
      <section className="min-w-0 space-y-3" aria-labelledby={snippetTitleId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={snippetTitleId} className="text-sm font-semibold">
            {t('embed.settings.snippet.title')}
          </h3>
          <Button type="button" variant="outline" size="sm" disabled={snippet === null} onClick={() => void copy()} data-testid="embed-snippet-copy">
            {copied ? <Check aria-hidden="true" className="mr-2 h-4 w-4" /> : <Copy aria-hidden="true" className="mr-2 h-4 w-4" />}
            {copied ? t('embed.settings.snippet.copied') : t('embed.settings.snippet.copy')}
          </Button>
        </div>
        {snippet !== null ? (
          <>
            <pre
              tabIndex={0}
              aria-labelledby={snippetTitleId}
              className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed"
              data-testid="embed-snippet"
            >
              <code>{snippet}</code>
            </pre>
            <p className="text-sm text-muted-foreground">{t('embed.settings.snippet.hint')}</p>
          </>
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground" role="status" data-testid="embed-snippet-waiting">
            {plan.state === 'waiting' ? plan.message : null}
          </p>
        )}
      </section>

      <section className="min-w-0 space-y-3" aria-labelledby={previewTitleId}>
        <h3 id={previewTitleId} className="text-sm font-semibold">
          {t('embed.settings.preview.title')}
        </h3>
        {plan.state === 'ready' ? (
          <>
            <EmbedPreview base={plan.input.base} options={buildEmbedMountOptions(plan.input)} />
            <p className="text-sm text-muted-foreground">{plan.input.widget === 'search' ? t('embed.settings.preview.hintSearch') : t('embed.settings.preview.hint')}</p>
          </>
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{t('embed.settings.preview.waiting')}</p>
        )}
      </section>
    </div>
  );
}
