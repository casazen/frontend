import { ADVICE_CATALOGUE, type AdviceEntry } from './advice-catalogue';
import type { GuideFacts } from './guide-facts';

/** How many pieces of advice the guide shows first; the rest is behind «Mostra tutti i consigli». One screen, one thing to look at. */
export const ADVICE_SHOWN = 3;

/** The lower the number, the earlier the advice (`AdviceEntry.priority`); a function asks the facts. */
function rankOf(entry: AdviceEntry, facts: GuideFacts): number {
  return typeof entry.priority === 'function' ? entry.priority(facts) : entry.priority;
}

/**
 * The advice that is for this lease, in the order to show it. An entry is for the lease when its type and its phase are the lease's,
 * its figures are known (`needsRules`), the step of «Cosa devi fare ora» does not already say it (`coveredBy`) and its conditions on
 * the data hold (`when`). Of two with the same priority, the one written first in the catalogue goes first.
 */
export function selectAdvice(facts: GuideFacts, catalogue: readonly AdviceEntry[] = ADVICE_CATALOGUE): AdviceEntry[] {
  return catalogue
    .map((entry, order) => ({ entry, order }))
    .filter(({ entry }) => entry.types.includes(facts.type) && entry.phases.includes(facts.phase))
    .filter(({ entry }) => !entry.needsRules || facts.rules !== undefined)
    .filter(({ entry }) => !(facts.stepCode !== null && entry.coveredBy?.includes(facts.stepCode)))
    .filter(({ entry }) => entry.when?.(facts) ?? true)
    .map(({ entry, order }) => ({ entry, order, rank: rankOf(entry, facts) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ entry }) => entry);
}
