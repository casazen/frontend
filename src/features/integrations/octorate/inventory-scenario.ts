import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import type { MappingDecision } from './mapping-model';

/**
 * Where the listings of the host are today: the first question of the connect wizard (E02/F01/US01/T04, PO-01). Three answers that
 * exclude each other, and none of them ever means another one: "not on the channel manager" is not "new" (D6).
 *
 * - `onOctorate`: already on the channel manager. One consent, then the listings it finds (this wizard).
 * - `onOtas`: already on the OTAs, or on another channel manager. The listings are imported with their own ids, nothing is created
 *   (the import flow of E02/F01/US03).
 * - `newInventory`: never published. The listing wizard creates the property.
 */
export const INVENTORY_SCENARIOS = ['onOctorate', 'onOtas', 'newInventory'] as const;
export type InventoryScenario = (typeof INVENTORY_SCENARIOS)[number];

/** What the host answers in the wizard. The wizard (`WizardShell`) holds it as the values of its form and keeps it as a draft in the session. */
export interface ConnectWizardValues {
  /** `null` until the host answers. */
  scenario: InventoryScenario | null;
  /** What the host decided about the listings found on the channel manager (E02/F01/US02/T05): nothing is sent until the last button. */
  decisions: MappingDecision[];
}

/**
 * Where an answer leads. Each scenario has its own kind, and no kind is shared: an answer that imports can never reach the path that
 * creates, nor the other way round (the no-duplicate rule of D6).
 */
export interface ScenarioRoute {
  /** `consent`: the next steps of this wizard. `import`: the import of the listings that exist. `listing`: the wizard that creates the property. */
  readonly kind: 'consent' | 'import' | 'listing';
  /** Whether the host can take this path today. The import is built by E02/F01/US03: until then its answer is shown and cannot be chosen. */
  readonly available: boolean;
  /** Where the answer takes the host out of this wizard (`listing` only). */
  readonly path?: string;
}

const ROUTES: Readonly<Record<InventoryScenario, ScenarioRoute>> = {
  onOctorate: { kind: 'consent', available: true },
  onOtas: { kind: 'import', available: false },
  newInventory: { kind: 'listing', available: true, path: PROPERTY_CREATE_PATH },
};

export function routeForScenario(scenario: InventoryScenario): ScenarioRoute {
  return ROUTES[scenario];
}

/** A group of properties of a mixed portfolio with the answer given for it (E02/F01/US03 lets an agency define the groups). */
export interface PortfolioGroup {
  id: string;
  scenario: InventoryScenario;
  /** The properties of the group, each by the key the caller uses for it (the id of the property, or of the listing on the channel). */
  members: readonly string[];
}

/** A property that two groups would send down different paths. */
export interface PortfolioConflict {
  member: string;
  groupIds: readonly string[];
}

export interface PortfolioAssignment {
  /** Where each group goes, in the order given. */
  routes: ReadonlyArray<{ groupId: string; route: ScenarioRoute }>;
  /** The properties that belong to groups with different answers: a property is imported or created, never both. */
  conflicts: readonly PortfolioConflict[];
}

/**
 * Gives each group of a mixed portfolio the route of its answer and finds the properties that sit in groups with different answers.
 * The routes are never mixed: a group follows its own answer only, whatever the others say. A property in two groups with the same
 * answer is not a conflict.
 */
export function assignPortfolio(groups: readonly PortfolioGroup[]): PortfolioAssignment {
  const groupsOf = new Map<string, PortfolioGroup[]>();
  for (const group of groups) {
    for (const member of new Set(group.members)) {
      groupsOf.set(member, [...(groupsOf.get(member) ?? []), group]);
    }
  }

  const conflicts: PortfolioConflict[] = [];
  for (const [member, owners] of groupsOf) {
    if (new Set(owners.map((owner) => owner.scenario)).size > 1) {
      conflicts.push({ member, groupIds: owners.map((owner) => owner.id) });
    }
  }

  return {
    routes: groups.map((group) => ({ groupId: group.id, route: routeForScenario(group.scenario) })),
    conflicts,
  };
}

type StepSchema = ZodType<unknown, FieldValues>;

/** The first step needs an answer, and one whose path the host can take today. The messages are i18n keys, as in every form. */
export const SCENARIO_STEP_SCHEMA: StepSchema = z.object({
  scenario: z
    .enum(INVENTORY_SCENARIOS, 'octorate.connect.errors.scenarioRequired')
    .refine((scenario) => routeForScenario(scenario).available, 'octorate.connect.errors.scenarioUnavailable'),
});
