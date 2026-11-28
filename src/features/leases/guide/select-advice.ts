import { ADVICE_CATALOGUE, type AdviceEntry } from './advice-catalogue';
import type { GuideFacts } from './guide-facts';

export const ADVICE_SHOWN = 3;

function rankOf(entry: AdviceEntry, facts: GuideFacts): number {
  return typeof entry.priority === 'function' ? entry.priority(facts) : entry.priority;
}

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
