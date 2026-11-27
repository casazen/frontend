import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { PROPERTY_CREATE_PATH } from '@/features/properties/properties-paths';
import { INVENTORY_SCENARIO_CODES, type InventoryScenarioCode } from '@/types';
import type { MappingDecision } from './mapping-model';

/**
 * Where the listings of the host are today: the first question of the connect wizard (E02/F01/US01/T04, E02/F01/US03/T02, PO-01). Three answers that
 * exclude each other, and none of them ever means another one: "not on the channel manager" is not "new" (D6).
 *
 * - `onOctorate`: already on the channel manager. One consent, then the listings it finds (the first road of this wizard).
 * - `onOtas`: already on the OTAs, or on another channel manager. The access to each channel is given on the panel, the listings are imported with
 *   their own ids and mapped; nothing is created or published.
 * - `newInventory`: never published. The listing wizard creates the property: the only road that creates.
 *
 * A fourth answer is not a place but a situation: `mixed`, where each property says which of the three it is.
 */
export const INVENTORY_SCENARIOS = INVENTORY_SCENARIO_CODES;
export type InventoryScenario = InventoryScenarioCode;

/** «Ho una situazione mista»: the host has properties in more than one of the three situations and says which is which. */
export const MIXED_SCENARIO = 'mixed' as const;
export const WIZARD_SCENARIOS = [...INVENTORY_SCENARIOS, MIXED_SCENARIO] as const;
export type WizardScenario = (typeof WIZARD_SCENARIOS)[number];

/** One of the situations of a mixed portfolio with the properties of the host that are in it: one group for each situation, never two. */
export interface MixedGroup {
  scenario: InventoryScenario;
  /** The CasaZen properties in this situation. Empty for a situation whose listings are not in CasaZen yet (they are found by the import). */
  propertyIds: string[];
}

/** What the host answers in the wizard. The wizard (`WizardShell`) holds it as the values of its form and keeps it as a draft, on the server too. */
export interface ConnectWizardValues {
  /** `null` until the host answers. */
  scenario: WizardScenario | null;
  /** The answer the host left the first step with: a later change to «new» is a change of an answer that already led somewhere. */
  committedScenario: WizardScenario | null;
  /** The host understood that choosing «new» now is not a way to recover from an import. */
  acknowledgeNew: boolean;
  /** What the host decided about the listings found on the channel manager (E02/F01/US02/T05): nothing is sent until the last button. */
  decisions: MappingDecision[];
  /** The OTAs the host uses today, by portal code (the `onOtas` road). */
  channels: string[];
  /** The import batch of the `onOtas` road, once started: the server holds its state, the draft keeps the id to find it again after a reload. */
  batchId: string | null;
  /** The situations of a mixed portfolio. */
  groups: MixedGroup[];
}

export const CONNECT_WIZARD_DEFAULTS: ConnectWizardValues = {
  scenario: null,
  committedScenario: null,
  acknowledgeNew: false,
  decisions: [],
  channels: [],
  batchId: null,
  groups: [],
};

/**
 * Where an answer leads. Each scenario has its own kind, and no kind is shared: an answer that imports can never reach the path that
 * creates, nor the other way round (the no-duplicate rule of D6).
 */
export interface ScenarioRoute {
  /** `consent`: the next steps of this wizard. `import`: the import of the listings that exist. `listing`: the wizard that creates the property. */
  readonly kind: 'consent' | 'import' | 'listing';
  /** Whether the host can take this path today. */
  readonly available: boolean;
  /** Where the answer takes the host out of this wizard (`listing` only). */
  readonly path?: string;
}

const ROUTES: Readonly<Record<InventoryScenario, ScenarioRoute>> = {
  onOctorate: { kind: 'consent', available: true },
  onOtas: { kind: 'import', available: true },
  newInventory: { kind: 'listing', available: true, path: PROPERTY_CREATE_PATH },
};

export function routeForScenario(scenario: InventoryScenario): ScenarioRoute {
  return ROUTES[scenario];
}

/** True for a code this wizard knows as an answer of the first question (the address and a draft are just data). */
export function isWizardScenario(value: unknown): value is WizardScenario {
  return typeof value === 'string' && (WIZARD_SCENARIOS as readonly string[]).includes(value);
}

/** A group of properties of a mixed portfolio with the answer given for it. */
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

/** The name the server keeps for the group of a situation of a mixed portfolio (`group` of an intent and of a batch): one for each situation. */
export const MIXED_GROUP_NAMES: Readonly<Record<InventoryScenario, string>> = {
  onOctorate: 'mixed-on-octorate',
  onOtas: 'mixed-on-otas',
  newInventory: 'mixed-new',
};

/** The groups of a mixed portfolio as the portfolio helpers read them. */
export function portfolioOf(groups: readonly MixedGroup[]): PortfolioGroup[] {
  return groups.map((group) => ({ id: MIXED_GROUP_NAMES[group.scenario], scenario: group.scenario, members: group.propertyIds }));
}

/** The groups that really are in a value that came from outside (a draft, an address): a well-formed group of each situation, once. */
export function readGroups(value: unknown): MixedGroup[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const groups: MixedGroup[] = [];
  for (const item of value as Array<Partial<MixedGroup> | null>) {
    if (!item || !INVENTORY_SCENARIOS.includes(item.scenario as InventoryScenario) || seen.has(item.scenario as string)) continue;
    seen.add(item.scenario as string);
    const propertyIds = Array.isArray(item.propertyIds) ? [...new Set(item.propertyIds.filter((id): id is string => typeof id === 'string' && id !== ''))] : [];
    groups.push({ scenario: item.scenario as InventoryScenario, propertyIds });
  }
  return groups;
}

/** The scenarios a mixed portfolio spreads over. */
export function scenariosOfGroups(groups: readonly MixedGroup[]): ReadonlySet<InventoryScenario> {
  return new Set(groups.map((group) => group.scenario));
}

/**
 * The assignments `PUT api/octorate/inventory-intents` takes for a mixed portfolio: one for each property of a group and, for a group with no
 * property yet, one for the group alone. The group name is the one of its situation.
 */
export function assignmentsOf(groups: readonly MixedGroup[]) {
  return groups.flatMap((group) =>
    group.propertyIds.length === 0
      ? [{ scenario: group.scenario, group: MIXED_GROUP_NAMES[group.scenario] }]
      : group.propertyIds.map((propertyId) => ({ propertyId, scenario: group.scenario, group: MIXED_GROUP_NAMES[group.scenario] })),
  );
}

type StepSchema = ZodType<unknown, FieldValues>;

/** The roads that start from an existing situation, which «new» cannot be reached from by changing one's mind (a change that is not a recovery). */
const EXISTING_SCENARIOS: ReadonlySet<WizardScenario> = new Set(['onOctorate', 'onOtas', 'mixed']);

/**
 * The first step needs an answer. Moving from a road that began (an answer already left, with an import started) to «new» is refused, and any
 * other move to «new» from an answer that led somewhere needs the host to say they understood (the messages are i18n keys, as in every form).
 */
export const SCENARIO_STEP_SCHEMA: StepSchema = z
  .object({
    scenario: z
      .enum(WIZARD_SCENARIOS, 'octorate.connect.errors.scenarioRequired')
      .refine((scenario) => scenario === MIXED_SCENARIO || routeForScenario(scenario).available, 'octorate.connect.errors.scenarioUnavailable'),
    committedScenario: z.string().nullish(),
    acknowledgeNew: z.boolean().nullish(),
    batchId: z.string().nullish(),
  })
  .superRefine((values, context) => {
    const changing = values.scenario === 'newInventory' && values.committedScenario != null && EXISTING_SCENARIOS.has(values.committedScenario as WizardScenario);
    if (!changing) return;
    if (values.batchId) context.addIssue({ code: 'custom', path: ['scenario'], message: 'octorate.connect.errors.scenarioChangeRefused' });
    else if (!values.acknowledgeNew) context.addIssue({ code: 'custom', path: ['acknowledgeNew'], message: 'octorate.connect.errors.scenarioChangeConfirm' });
  });

/** The mixed step needs two situations at least and a property in one of them only: a property is imported or created, never both. */
export const MIXED_STEP_SCHEMA: StepSchema = z.object({
  groups: z.array(z.object({ scenario: z.enum(INVENTORY_SCENARIOS), propertyIds: z.array(z.string()) })).superRefine((groups, context) => {
    if (groups.length < 2) context.addIssue({ code: 'custom', message: 'octorate.connect.errors.mixedTwoSituations' });
    if (assignPortfolio(portfolioOf(groups)).conflicts.length > 0) context.addIssue({ code: 'custom', message: 'octorate.connect.errors.mixedConflict' });
  }),
});
