import { useEffect, useState } from 'react';
import { buildPreviewReady, readPreviewMessage } from '@/lib/supplier-site/preview-channel';
import type { ShowcaseDocument } from '@/types/supplier-showcase';

export function isFramedPreview(search: URLSearchParams): boolean {
  return search.get('anteprima') === '1' && search.get('frame') === '1' && typeof window !== 'undefined' && window.parent !== window;
}

export function usePreviewDraft(enabled: boolean): ShowcaseDocument | null {
  const [draft, setDraft] = useState<ShowcaseDocument | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const self = { origin: window.location.origin, parent: window.parent };
    const onMessage = (event: MessageEvent) => {
      const content = readPreviewMessage(event, self);
      if (content) setDraft(content);
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage(buildPreviewReady(), self.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [enabled]);

  return enabled ? draft : null;
}
