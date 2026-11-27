import { useCallback, useEffect, useRef, useState } from 'react';
import { clearInquiryDraft, startingInquiryDraft, writeInquiryDraft } from '@/lib/supplier-site/inquiry-draft';
import type { InquiryDraft } from '@/lib/supplier-site/inquiry-flow';

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
