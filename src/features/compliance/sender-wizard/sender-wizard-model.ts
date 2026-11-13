import { isAxiosError } from 'axios';
import { SENDER_WIZARD_PATH } from '@/features/compliance/lib/connection-health-model';
import { getProblemCode } from '@/lib/api-errors';
import type { PropertySender, SenderConnectionTest, SwitchSenderRequest } from '@/types';
import type { ComplianceSenderType } from '@/types/checkin-wizard.types';
import type { PanelStep, StartPanelStepRequest } from '@/types/onboarding.types';
import type { SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';

/** The parameter of the address that names the property (`?property=<id>`): the one the panel «Invio a Polizia e ISTAT» and the pages that lead here write. */
export const SENDER_PROPERTY_PARAM = 'property';

/** What changing the sender asks: the permission of the endpoints that change it (`PUT`, the connection test, the declaration), the one the route of the wizard asks. */
export const SENDER_WRITE_PERMISSION = 'property.write';

/** Raise it when the shape of the values changes: a draft written for the old shape is ignored. (2: the consent to the delegation is no longer kept in it.) */
export const SENDER_DRAFT_VERSION = 2;

/**
 * What the draft never keeps. The confirmation that the other sender goes off is given on the summary, about the change that is on screen at that moment, and the consent to the delegation
 * is given on the choice, with the text in front of the person: both are given again when the wizard is resumed (also from another device, and straight at the summary), so a box that was
 * ticked at another time is never ticked for them and a consent is never recorded for a text that was not shown in that session. Nothing of the credentials is here at all: they are not a
 * value of the wizard (they are in its state, outside its form, and leave with the save).
 */
export const SENDER_DRAFT_EXCLUDE: readonly string[] = ['switchConfirmed', 'delegationConsentVersion'];

/** The steps of the wizard, by the name `?step=` carries. */
export const SENDER_STEP = {
  choice: 'choice',
  summary: 'summary',
  credentials: 'credentials',
  panel: 'panel',
  test: 'test',
} as const;
export type SenderStepId = (typeof SENDER_STEP)[keyof typeof SENDER_STEP];

/**
 * The answers of the wizard. `delegationConsentVersion` is the version of the delegation text the person ticked, never a bare yes: the consent counts only for the
 * text in force (`consentGiven`). `switchConfirmed` is the change the person confirmed (`confirmationOf`), so a confirmation never outlives the change it was about. Those two are
 * given in the session that shows what they are about and are not part of the draft (`SENDER_DRAFT_EXCLUDE`).
 */
export interface SenderWizardValues {
  sender: ComplianceSenderType | '';
  delegationConsentVersion: string;
  switchConfirmed: string;
}

export const SENDER_WIZARD_DEFAULTS: SenderWizardValues = { sender: '', delegationConsentVersion: '', switchConfirmed: '' };

/** The name the draft of the wizard is kept under, in the browser: one for each property, so a draft never leads to another property than the one in the address. */
export const senderWizardId = (propertyId: string) => `compliance-sender:${propertyId}`;

/** The address of the wizard for a property, at a step when there is one: only the id of the property is in it. */
export function senderWizardHref(propertyId: string, step?: SenderStepId): string {
  const query = new URLSearchParams({ [SENDER_PROPERTY_PARAM]: propertyId });
  if (step) query.set('step', step);
  return `${SENDER_WIZARD_PATH}?${query.toString()}`;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The property the address names, or `''` when it names none that can be one: the id ends up in the path of requests, so nothing but an id goes through. */
export function propertyOfAddress(params: URLSearchParams): string {
  const value = params.get(SENDER_PROPERTY_PARAM)?.trim() ?? '';
  return GUID.test(value) ? value : '';
}

export const isAutomaticSender = (sender: ComplianceSenderType | ''): boolean => sender === 'ChannelManager' || sender === 'CasaZen';

/** The steps for the sender chosen: the manual send ends at the summary, and CasaZen has no panel to pass through. */
export function senderStepIds(sender: ComplianceSenderType | ''): SenderStepId[] {
  if (sender === 'ChannelManager') return [SENDER_STEP.choice, SENDER_STEP.summary, SENDER_STEP.credentials, SENDER_STEP.panel, SENDER_STEP.test];
  if (sender === 'CasaZen') return [SENDER_STEP.choice, SENDER_STEP.summary, SENDER_STEP.credentials, SENDER_STEP.test];
  return [SENDER_STEP.choice, SENDER_STEP.summary];
}

/** One of the ways to send, with whether the host can choose it now. */
export interface SenderOption {
  sender: ComplianceSenderType;
  available: boolean;
}

const ALL_SENDERS: readonly ComplianceSenderType[] = ['ChannelManager', 'CasaZen', 'Manual'];

/**
 * What is offered. The channel manager is hidden when the property has none that can send (`channelManagerAvailable`), so a property without one has only the other ways (NF-49);
 * a way the server does not let the host choose now (CasaZen, in this release) is shown as not available and cannot be picked: the list is the server's, never the client's.
 */
export function senderOptions(read: Pick<PropertySender, 'channelManagerAvailable' | 'availableSenders'>): SenderOption[] {
  return ALL_SENDERS.filter((sender) => sender !== 'ChannelManager' || read.channelManagerAvailable).map((sender) => ({
    sender,
    available: read.availableSenders.includes(sender),
  }));
}

/** What the choice starts from: the sender in effect when the host can choose it again (the channel manager when the property is connected is the default), else the first way offered. */
export function defaultSenderChoice(read: Pick<PropertySender, 'sender' | 'channelManagerAvailable' | 'availableSenders'>): ComplianceSenderType | '' {
  if (read.availableSenders.includes(read.sender)) return read.sender;
  return senderOptions(read).find((option) => option.available)?.sender ?? '';
}

/**
 * The texts of the delegation this version of the app can show, by the version of the text (`delegationTextVersion` of the API). A version that is not here is a text this
 * page cannot show: the consent is not asked for it (a person never consents to a text they were not shown), and the wizard tells them to reload the page.
 */
const DELEGATION_TEXT_KEYS: Readonly<Record<string, string>> = {
  '2026-11-v1': 'compliance.sender.delegation.text',
};

export function delegationTextKey(version: string): string | null {
  return Object.hasOwn(DELEGATION_TEXT_KEYS, version) ? DELEGATION_TEXT_KEYS[version] : null;
}

/** The consent counts only when it was given to the version of the text in force, and this page can show that text. */
export function consentGiven(values: Pick<SenderWizardValues, 'delegationConsentVersion'>, read: Pick<PropertySender, 'delegationTextVersion'>): boolean {
  return values.delegationConsentVersion !== '' && values.delegationConsentVersion === read.delegationTextVersion && delegationTextKey(read.delegationTextVersion) !== null;
}

/** Whether the delegation is settled for the sender chosen: nothing is asked for the manual send, and nothing again once the organization accepted the text in force. */
export function delegationSettled(values: SenderWizardValues, read: Pick<PropertySender, 'delegationAccepted' | 'delegationTextVersion'>): boolean {
  return !isAutomaticSender(values.sender) || read.delegationAccepted || consentGiven(values, read);
}

/** How the sender changes: nothing, or from an automatic send to another, from the host's own to an automatic one, or to the host's own. */
export type SwitchKind = 'same' | 'automaticToAutomatic' | 'manualToAutomatic' | 'toManual';

export function switchKind(current: ComplianceSenderType, chosen: ComplianceSenderType | ''): SwitchKind {
  if (chosen === '' || chosen === current) return 'same';
  if (chosen === 'Manual') return 'toManual';
  return current === 'Manual' ? 'manualToAutomatic' : 'automaticToAutomatic';
}

/** What the confirmation is about: the change on screen. It is the value `switchConfirmed` holds when the host confirmed it. */
export const confirmationOf = (current: ComplianceSenderType, chosen: ComplianceSenderType | ''): string => `${current}>${chosen}`;

export function switchConfirmed(values: SenderWizardValues, read: Pick<PropertySender, 'sender'>): boolean {
  return switchKind(read.sender, values.sender) === 'same' || values.switchConfirmed === confirmationOf(read.sender, values.sender);
}

/**
 * The request that changes the sender. The consent is sent only when the host gave it to the text in force and the organization has not accepted it yet; the version sent is the
 * one the screen was loaded from, which is the text the person read. The confirmation is sent only for the change the host confirmed.
 */
export function toSwitchRequest(values: SenderWizardValues, read: PropertySender): SwitchSenderRequest {
  if (values.sender === '') throw new Error('The sender is not chosen');
  const consent = isAutomaticSender(values.sender) && !read.delegationAccepted && consentGiven(values, read);
  return {
    sender: values.sender,
    confirmed: switchKind(read.sender, values.sender) !== 'same' && values.switchConfirmed === confirmationOf(read.sender, values.sender),
    delegationConsent: consent,
    ...(consent ? { delegationTextVersion: read.delegationTextVersion } : {}),
  };
}

/** What a refusal of the change says, so the screen tells the person what to do (and never leaves them with a code). */
export type SwitchProblemKind =
  | 'confirmationRequired'
  | 'delegationRequired'
  | 'delegationOutdated'
  | 'casaZenNotAvailable'
  | 'channelManagerNotAvailable'
  | 'notApplicable'
  | 'changedConcurrently';

const PROBLEM_KINDS: Readonly<Record<string, SwitchProblemKind>> = {
  sender_switch_confirmation_required: 'confirmationRequired',
  alloggiati_delegation_required: 'delegationRequired',
  alloggiati_delegation_text_outdated: 'delegationOutdated',
  alloggiati_delegation_text_version_required: 'delegationRequired',
  sender_casazen_not_available: 'casaZenNotAvailable',
  sender_channel_manager_not_available: 'channelManagerNotAvailable',
  sender_not_applicable: 'notApplicable',
  sender_changed_concurrently: 'changedConcurrently',
};

/** The kind of refusal an error is, or `null` for any other failure (the screen then says what the server said, or the generic words). */
export function switchProblemOf(error: unknown): SwitchProblemKind | null {
  if (!isAxiosError(error)) return null;
  const code = getProblemCode(error.response?.data);
  return code !== undefined && Object.hasOwn(PROBLEM_KINDS, code) ? PROBLEM_KINDS[code] : null;
}

/**
 * What stops a step with words of its own: a refusal of the change of the sender, or the credentials of the portal that were typed and could not be saved (`credentialsIncomplete`: a field is
 * missing or too long; `credentialsNotSaved`: the server did not take them). The words are `compliance.sender.errors.<kind>`.
 */
export type StepProblemKind = SwitchProblemKind | 'credentialsIncomplete' | 'credentialsNotSaved';

/**
 * The step stops on something that has words of its own. It is thrown in place of the answer, which holds the request that was sent: the shell finds nothing to say in it
 * and shows the words of the kind (`finishFailedMessage`).
 */
export class SenderStepBlockedError extends Error {
  readonly kind: StepProblemKind;

  constructor(kind: StepProblemKind) {
    super(`The sender wizard cannot go on: ${kind}`);
    this.kind = kind;
  }
}

/**
 * Whether the person typed something in the credentials of the portal that is not saved yet (a field of spaces is empty). The credentials are in no value of the wizard and in no draft, so
 * what leaves the step with them typed is lost: the main button saves them first and «Salva ed esci» says that they were not kept.
 */
export function hasTypedCredentials(values: SetQuesturaCredentialsRequest): boolean {
  return Object.values(values).some((value) => value.trim() !== '');
}

/** What the result of the connection test, or of the state of the sender, means for the host. Only `active` is shown as «Attivo». */
export type SenderOutcome = 'active' | 'declared' | 'unverified' | 'inactive' | 'manual' | 'notAvailable';

/**
 * The outcome of the sender as the server says it (`state` and `verification`): a state is «Attivo» only when the server verified it. A sender that is chosen and that
 * the server cannot confirm is never shown as working.
 */
export function outcomeOfSender(read: Pick<PropertySender, 'sender' | 'state' | 'verification'>): SenderOutcome {
  if (read.sender === 'Manual' || read.state === 'NotConfigured') return 'manual';
  if (read.sender === 'CasaZen') return 'notAvailable';
  if (read.state === 'Active' && read.verification === 'Verified') return 'active';
  if (read.state === 'Declared') return 'declared';
  if (read.state === 'Inactive') return 'inactive';
  return 'unverified';
}

/** What a connection test found, in the words of the screen: `active` only for `Verified`. */
export function outcomeOfTest(test: Pick<SenderConnectionTest, 'outcome'>): SenderOutcome {
  switch (test.outcome) {
    case 'Verified':
      return 'active';
    case 'Inactive':
      return 'inactive';
    case 'Unverifiable':
      return 'unverified';
    case 'NotApplicable':
      return 'manual';
    default:
      return 'notAvailable';
  }
}

/**
 * What the screen says about the sender: the test of this visit, or the state the server holds when there is none; the host's own declaration stands only while the test cannot tell.
 * «Attivo» is the outcome `active`, which only the server's word `Verified` gives.
 */
export function outcomeToShow(read: PropertySender, result: SenderConnectionTest | undefined): SenderOutcome {
  const outcome = result ? outcomeOfTest(result) : outcomeOfSender(read);
  return read.state === 'Declared' && read.sender === 'ChannelManager' && (result === undefined || outcome === 'unverified') ? 'declared' : outcome;
}

/** The reason codes (`octorate_*`) of the server that have words of their own; any other code gets the generic words of the outcome. */
const KNOWN_REASONS: ReadonlySet<string> = new Set([
  'octorate_not_connected',
  'octorate_police_account_invalid',
  'octorate_police_autorun_off',
  'octorate_police_not_exposed',
  'octorate_unavailable',
  'sender_casazen_not_available',
]);

export const knownReason = (reason: string | null | undefined): string | null => (reason !== null && reason !== undefined && KNOWN_REASONS.has(reason) ? reason : null);

/** The step where a reason is fixed: the panel for the police account, the choice when the channel manager cannot send at all; nothing when the fix is only to wait. */
export function fixStepOf(reason: string | null | undefined): SenderStepId | null {
  switch (reason) {
    case 'octorate_police_account_invalid':
    case 'octorate_police_autorun_off':
      return SENDER_STEP.panel;
    case 'octorate_not_connected':
    case 'sender_casazen_not_available':
      return SENDER_STEP.choice;
    default:
      return null;
  }
}

/** What the guided step of the panel stores to come back here: the wizard, its draft (the property) and the step, named and never carried. */
export function senderPanelResume(propertyId: string): Pick<StartPanelStepRequest, 'resumeWizardType' | 'resumeDraftEntityId' | 'resumeStepCode'> {
  return { resumeWizardType: 'ComplianceSender', resumeDraftEntityId: propertyId, resumeStepCode: SENDER_STEP.panel };
}

/**
 * The address of the wizard a guided step of the panel was started from, at the step it stored, for the property of the step: where the person goes when the step is done.
 * `null` for a step that this wizard did not start (or whose step code this version does not know).
 */
export function senderResumePath(step: Pick<PanelStep, 'propertyId' | 'resume'> | undefined): string | null {
  if (!step?.propertyId || step.resume.wizardType !== 'ComplianceSender') return null;
  const stepId = (Object.values(SENDER_STEP) as string[]).find((candidate) => candidate === step.resume.stepCode);
  return senderWizardHref(step.propertyId, stepId as SenderStepId | undefined);
}
