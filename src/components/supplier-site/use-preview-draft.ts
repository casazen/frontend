import { useEffect, useState } from 'react';
import type { PublicShowcaseContent } from '@/api/public-supplier.api';
import { buildPreviewReady, readPreviewMessage } from '@/lib/supplier-site/preview-channel';

/**
 * True when the page is the preview of the editor: asked for (`?anteprima=1&frame=1`) and really inside a frame. A page opened
 * on its own with those parameters is the page as everybody sees it: there is no editor to send a draft to it.
 */
export function isFramedPreview(search: URLSearchParams): boolean {
  return search.get('anteprima') === '1' && search.get('frame') === '1' && typeof window !== 'undefined' && window.parent !== window;
}

/**
 * The draft the editor sends to the frame, or null before the first one. It listens only while `enabled` (the framed preview), tells
 * the parent it is ready, and believes only a message of its own origin from the window that frames it, in the contract's shape.
 */
export function usePreviewDraft(enabled: boolean): PublicShowcaseContent | null {
  const [draft, setDraft] = useState<PublicShowcaseContent | null>(null);

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
