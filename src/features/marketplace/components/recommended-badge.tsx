import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * «Consigliato» (SP-REL): the best-ranked supplier of the list, strictly ahead of the next one. The server decides it from the load of
 * the supplier and its reliability (replies in time, jobs without disputes) and sends only this word: the score is never shown.
 * A `span` shaped like the `Badge` and not the `Badge` itself (a `div`), because it also goes inside the title of a choice card, which
 * is a label: only inline content can be in it.
 */
export function RecommendedBadge() {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 px-2.5 py-0.5 text-xs font-semibold text-primary-text"
      data-testid="supplier-recommended-badge"
    >
      <Star aria-hidden="true" className="size-3.5" />
      {t('marketplace.recommended')}
    </span>
  );
}
