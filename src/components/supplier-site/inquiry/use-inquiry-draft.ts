import { useCallback, useEffect, useRef, useState } from 'react';
import { clearInquiryDraft, startingInquiryDraft, writeInquiryDraft } from '@/lib/supplier-site/inquiry-draft';
import type { InquiryDraft } from '@/lib/supplier-site/inquiry-flow';

/**
 * The draft of the request on measure in the page: it starts from the address (the service and the comune the site's buttons pass) over
 * what the device remembered of this supplier, writes itself back at every change, and can be dropped for good once the request is sent.
 * Nothing in it is shared with another supplier's site, and the consent is not part of it (see `inquiry-draft.ts`).
 */
export function useInquiryDraft(slug: string, seed: { service?: string; comune?: string }) {
  const [draft, setDraft] = useState<InquiryDraft>(() => startingInquiryDraft(slug, seed));
  const dropped = useRef(false);

  useEffect(() => {
    if (!dropped.current) writeInquiryDraft(slug, draft);
  }, [slug, draft]);

  const update = useCallback((patch: Partial<InquiryDraft>) => setDraft((current) => ({ ...current, ...patch })), []);

  const discard = useCallback(() => {
    dropped.current = true;
    clearInquiryDraft(slug);
  }, [slug]);

  return { draft, update, discard };
}
