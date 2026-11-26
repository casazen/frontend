import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EMBED_LOADER_PATH } from './embed-snippet';

/** The part of `window.CasaZenEmbed` (the object the loader puts on the page) that the preview uses. */
interface EmbedLoader {
  mount: (element: HTMLElement, options: Record<string, unknown>) => void;
}

/** The mark on the script this preview put in the page while it is still on its way: whoever comes next waits for it instead of putting a second one. */
const LOADER_SCRIPT_MARK = 'data-casazen-preview-loader';

function readLoader(): EmbedLoader | null {
  const loader = (window as Window & { CasaZenEmbed?: Partial<EmbedLoader> }).CasaZenEmbed;
  return loader && typeof loader.mount === 'function' ? (loader as EmbedLoader) : null;
}

/**
 * The loader of the widgets, the real one (`<base>/embed/v1/embed.js`, the file the pasted code loads from the same address): already on the page when something put it there,
 * else its script is added once and waited for. A file that does not come (the address does not answer, it is not the loader) rejects; the script that failed is taken out of
 * the page, so that asking again puts a new one. The loader keeps no global state of its own besides `window.CasaZenEmbed`, and a second copy of the file does nothing.
 */
function loadEmbedLoader(base: string): Promise<EmbedLoader> {
  const present = readLoader();
  if (present) return Promise.resolve(present);

  return new Promise<EmbedLoader>((resolve, reject) => {
    const src = `${base}${EMBED_LOADER_PATH}`;
    let tag = document.querySelector<HTMLScriptElement>(`script[${LOADER_SCRIPT_MARK}]`);
    // One that waits for another address (the domain changed meanwhile) is not the one that is wanted.
    if (tag && tag.src !== src) {
      tag.remove();
      tag = null;
    }
    if (!tag) {
      tag = document.createElement('script');
      tag.async = true;
      tag.src = src;
      tag.setAttribute(LOADER_SCRIPT_MARK, '');
      document.head.appendChild(tag);
    }

    const script = tag;
    const settle = (event: Event) => {
      script.removeAttribute(LOADER_SCRIPT_MARK);
      const loader = event.type === 'load' ? readLoader() : null;
      if (loader) {
        resolve(loader);
        return;
      }
      script.remove();
      reject(new Error('embed-loader-unavailable'));
    };
    script.addEventListener('load', settle, { once: true });
    script.addEventListener('error', settle, { once: true });
  });
}

interface EmbedPreviewProps {
  /** The origin the widget comes from: the same one as the code that is shown (`resolveEmbedBase`). */
  base: string;
  /** The options of `CasaZenEmbed.mount`: the same values as the attributes of the code (`buildEmbedMountOptions`). */
  options: Record<string, string | boolean>;
}

/**
 * The widget as the agency's visitors will see it (E41/F03/US01, NF-147): mounted by the real loader, from the address the code names and with the options the code implies, so
 * that what the host sees is what a pasted snippet produces. When the choice or the address changes, the widget is mounted again in a new element (the loader mounts an element
 * only once) and the old one leaves the page with its frame. The search bar is mounted as a preview and never leaves the console; a widget in a frame is the real one, so «Prenota» takes
 * the whole page to the checkout, as it does on the page of the agency. When the loader does not come, the preview says so and offers to try again: it is never an empty box.
 */
export function EmbedPreview({ base, options }: EmbedPreviewProps) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<{ signature: string; ok: boolean } | null>(null);

  // What is shown, as one text: the effect depends on it alone, so a parent that draws again with the same choice leaves the widget as it is. A new attempt is a new text.
  const signature = JSON.stringify([base, options, attempt]);
  const state = outcome?.signature !== signature ? 'loading' : outcome.ok ? 'ready' : 'failed';

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const [wantedBase, wantedOptions] = JSON.parse(signature) as [string, Record<string, unknown>, number];
    let current = true;
    const slot = document.createElement('div');
    host.appendChild(slot);

    loadEmbedLoader(wantedBase).then(
      (loader) => {
        if (!current) return;
        try {
          loader.mount(slot, wantedOptions);
          setOutcome({ signature, ok: true });
        } catch {
          setOutcome({ signature, ok: false });
        }
      },
      () => {
        if (current) setOutcome({ signature, ok: false });
      },
    );

    return () => {
      current = false;
      slot.remove();
    };
  }, [signature]);

  let host = base;
  try {
    host = new URL(base).host;
  } catch {
    // `base` is an origin the page built itself; whatever it is, it is shown as it is.
  }

  return (
    <div className="space-y-3" data-testid="embed-preview" data-state={state}>
      <div ref={hostRef} role="region" aria-label={t('embed.settings.preview.region')} className="min-h-24 min-w-0" data-testid="embed-preview-host" />
      {state === 'loading' ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('embed.settings.preview.loading')}
        </p>
      ) : null}
      {state === 'failed' ? (
        <Alert
          variant="danger"
          data-testid="embed-preview-failed"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((count) => count + 1)} data-testid="embed-preview-retry">
              {t('embed.settings.preview.retry')}
            </Button>
          }
        >
          {t('embed.settings.preview.failed', { address: host })}
        </Alert>
      ) : null}
    </div>
  );
}
