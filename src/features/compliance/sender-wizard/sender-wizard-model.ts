import { isAxiosError } from 'axios';
import { SENDER_WIZARD_PATH } from '@/features/compliance/lib/connection-health-model';
import { getProblemCode } from '@/lib/api-errors';
import type { PropertySender, SenderConnectionTest, SwitchSenderRequest } from '@/types';
import type { ComplianceSenderType } from '@/types/checkin-wizard.types';
import type { PanelStep, StartPanelStepRequest } from '@/types/onboarding.types';
import type { SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';

/** The parameter of the address that names the property (`?property=<id>`): the one the panel «Invio a Polizia e ISTAT» and the pages that lead here write. */
export const SENDER_PROPERTY_PARAM = 'property';

export const SENDER_WRITE_PERMISSION = 'property.write';

export const SENDER_DRAFT_VERSION = 2;

/**
 * What the draft never keeps. The confirmation that the other sender goes off is given on the summary, about the change that is on screen at that moment, and the consent to the delegation
 * is given on the choice, with the text in front of the person: both are given again when the wizard is resumed (also from another device, and straight at the summary), so a box that was
 * ticked at another time is never ticked for them and a consent is never recorded for a text that was not shown in that session. Nothing of the credentials is here at all: they are not a
 * value of the wizard (they are in its state, outside its form, and leave with the save). The automatic send of the guests (`autoSendGuests`) is a setting of the whole organization that
 * anyone may have changed since the draft was kept: the wizard always starts it from what the server says now, never from a draft.
 */
export const SENDER_DRAFT_EXCLUDE: readonly string[] = ['switchConfirmed', 'delegationConsentVersion', 'autoSendGuests'];

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
 * given in the session that shows what they are about and are not part of the draft (`SENDER_DRAFT_EXCLUDE`). `autoSendGuests` is the organization's setting «Invia gli ospiti da solo
 * quando i dati sono completi e l'identità è verificata» (E20/F01/US02, decision O1) as the person chose it on the summary: `null` until they touch the switch, which then shows the setting in
 * force as the server says it now (the setting is the organization's, so another property's page or another person may have changed it since this one was read) and sends nothing about it.
 * It is sent only when the person who may change it touched the switch and left a value that is not the one in force (`toSwitchRequest`).
 */
export interface SenderWizardValues {
  sender: ComplianceSenderType | '';
  delegationConsentVersion: string;
  switchConfirmed: string;
  autoSendGuests: boolean | null;
}

export const SENDER_WIZARD_DEFAULTS: SenderWizardValues = { sender: '', delegationConsentVersion: '', switchConfirmed: '', autoSendGuests: null };

export const autoSendInForce = (read: Pick<PropertySender, 'autoSendGuestsToOctorate'>): boolean => read.autoSendGuestsToOctorate === true;

export const autoSendShown = (values: Pick<SenderWizardValues, 'autoSendGuests'>, read: Pick<PropertySender, 'autoSendGuestsToOctorate'>): boolean =>
  typeof values.autoSendGuests === 'boolean' ? values.autoSendGuests : autoSendInForce(read);

export const autoSendAsked = (values: Pick<SenderWizardValues, 'autoSendGuests'>, read: Pick<PropertySender, 'autoSendGuestsToOctorate'>): boolean | undefined =>
  typeof values.autoSendGuests === 'boolean' && values.autoSendGuests !== autoSendInForce(read) ? values.autoSendGuests : undefined;

export const senderWizardId = (propertyId: string) => `compliance-sender:${propertyId}`;

export function senderWizardHref(propertyId: string, step?: SenderStepId): string {
  const query = new URLSearchParams({ [SENDER_PROPERTY_PARAM]: propertyId });
  if (step) query.set('step', step);
  return `${SENDER_WIZARD_PATH}?${query.toString()}`;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function propertyOfAddress(params: URLSearchParams): string {
  const value = params.get(SENDER_PROPERTY_PARAM)?.trim() ?? '';
  return GUID.test(value) ? value : '';
}

export const isAutomaticSender = (sender: ComplianceSenderType | ''): boolean => sender === 'ChannelManager' || sender === 'CasaZen';

export function senderStepIds(sender: ComplianceSenderType | ''): SenderStepId[] {
  if (sender === 'ChannelManager') return [SENDER_STEP.choice, SENDER_STEP.summary, SENDER_STEP.credentials, SENDER_STEP.panel, SENDER_STEP.test];
  if (sender === 'CasaZen') return [SENDER_STEP.choice, SENDER_STEP.summary, SENDER_STEP.credentials, SENDER_STEP.test];
  return [SENDER_STEP.choice, SENDER_STEP.summary];
}

export interface SenderOption {
  sender: ComplianceSenderType;
  available: boolean;
}

const ALL_SENDERS: readonly ComplianceSenderType[] = ['ChannelManager', 'CasaZen', 'Manual'];

export function senderOptions(read: Pick<PropertySender, 'channelManagerAvailable' | 'availableSenders'>): SenderOption[] {
  return ALL_SENDERS.filter((sender) => sender !== 'ChannelManager' || read.channelManagerAvailable).map((sender) => ({
    sender,
    available: read.availableSenders.includes(sender),
  }));
}

export function defaultSenderChoice(read: Pick<PropertySender, 'sender' | 'channelManagerAvailable' | 'availableSenders'>): ComplianceSenderType | '' {
  if (read.availableSenders.includes(read.sender)) return read.sender;
  return senderOptions(read).find((option) => option.available)?.sender ?? '';
}

const DELEGATION_TEXT_KEYS: Readonly<Record<string, string>> = {
  '2026-11-v1': 'compliance.sender.delegation.text',
};

export function delegationTextKey(version: string): string | null {
  return Object.hasOwn(DELEGATION_TEXT_KEYS, version) ? DELEGATION_TEXT_KEYS[version] : null;
}

export function consentGiven(values: Pick<SenderWizardValues, 'delegationConsentVersion'>, read: Pick<PropertySender, 'delegationTextVersion'>): boolean {
  return values.delegationConsentVersion !== '' && values.delegationConsentVersion === read.delegationTextVersion && delegationTextKey(read.delegationTextVersion) !== null;
}

export function delegationSettled(values: SenderWizardValues, read: Pick<PropertySender, 'delegationAccepted' | 'delegationTextVersion'>): boolean {
  return !isAutomaticSender(values.sender) || read.delegationAccepted || consentGiven(values, read);
}

export type SwitchKind = 'same' | 'automaticToAutomatic' | 'manualToAutomatic' | 'toManual';

export function switchKind(current: ComplianceSenderType, chosen: ComplianceSenderType | ''): SwitchKind {
  if (chosen === '' || chosen === current) return 'same';
  if (chosen === 'Manual') return 'toManual';
  return current === 'Manual' ? 'manualToAutomatic' : 'automaticToAutomatic';
}

export const confirmationOf = (current: ComplianceSenderType, chosen: ComplianceSenderType | ''): string => `${current}>${chosen}`;

export function switchConfirmed(values: SenderWizardValues, read: Pick<PropertySender, 'sender'>): boolean {
  return switchKind(read.sender, values.sender) === 'same' || values.switchConfirmed === confirmationOf(read.sender, values.sender);
}

interface SwitchRequestOptions {
  canChangeAutoSend?: boolean;
}

/**
 * The request that changes the sender. The consent is sent only when the host gave it to the text in force and the organization has not accepted it yet; the version sent is the
 * one the screen was loaded from, which is the text the person read. The confirmation is sent only for the change the host confirmed. The automatic send of the guests is a setting
 * of the whole organization that the server lets only its administrator change (anyone else who asks for another value is refused with a 403, and nothing of the request is done):
 * it goes only with the channel manager as the sender, only when the person may change it, only when they touched the switch and only when the value they left is not the one in force:
 * a switch they never touched never sends a value, so it cannot put back a setting that was turned on elsewhere.
 */
export function toSwitchRequest(values: SenderWizardValues, read: PropertySender, options: SwitchRequestOptions = {}): SwitchSenderRequest {
  if (values.sender === '') throw new Error('The sender is not chosen');
  const consent = isAutomaticSender(values.sender) && !read.delegationAccepted && consentGiven(values, read);
  const autoSend = options.canChangeAutoSend === true && values.sender === 'ChannelManager' ? autoSendAsked(values, read) : undefined;
  return {
    sender: values.sender,
    confirmed: switchKind(read.sender, values.sender) !== 'same' && values.switchConfirmed === confirmationOf(read.sender, values.sender),
    delegationConsent: consent,
    ...(consent ? { delegationTextVersion: read.delegationTextVersion } : {}),
    ...(autoSend !== undefined ? { autoSendGuestsToOctorate: autoSend } : {}),
  };
}

export function autoSendRefused(error: unknown, request: Pick<SwitchSenderRequest, 'autoSendGuestsToOctorate'>): boolean {
  return request.autoSendGuestsToOctorate !== undefined && isAxiosError(error) && error.response?.status === 403 && switchProblemOf(error) === null;
}

export type SwitchProblemKind =
  | 'confirmationRequired'
  | 'delegationRequired'
  | 'delegationOutdated'
  | 'casaZenNotAvailable'
  | 'channelManagerNotAvailable'
  | 'notApplicable'
  | 'changedConcurrently'
  | 'autoSendNotAllowed';

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

export function switchProblemOf(error: unknown): SwitchProblemKind | null {
  if (!isAxiosError(error)) return null;
  const code = getProblemCode(error.response?.data);
  return code !== undefined && Object.hasOwn(PROBLEM_KINDS, code) ? PROBLEM_KINDS[code] : null;
}

/**
 * What stops a step with words of its own: a refusal of the change of the sender, or the credentials of the portal that were typed and could not be saved (`credentialsIncomplete`: a field is
 * missing or too long; `credentialsNotSaved`: the server did not take them), or the same for the regional ISTAT credentials (`istatIncomplete`, `istatNotSaved`). The words are
 * `compliance.sender.errors.<kind>`.
 */
export type StepProblemKind = SwitchProblemKind | 'credentialsIncomplete' | 'credentialsNotSaved' | 'istatIncomplete' | 'istatNotSaved';

export class SenderStepBlockedError extends Error {
  readonly kind: StepProblemKind;

  constructor(kind: StepProblemKind) {
    super(`The sender wizard cannot go on: ${kind}`);
    this.kind = kind;
  }
}

export function hasTypedCredentials(values: SetQuesturaCredentialsRequest): boolean {
  return [values.username, values.password, values.wsKey].some((value) => value.trim() !== '');
}

export type SenderOutcome = 'active' | 'declared' | 'unverified' | 'inactive' | 'manual' | 'notAvailable';

export function outcomeOfSender(read: Pick<PropertySender, 'sender' | 'state' | 'verification'>): SenderOutcome {
  if (read.sender === 'Manual' || read.state === 'NotConfigured') return 'manual';
  if (read.sender === 'CasaZen') return 'notAvailable';
  if (read.state === 'Active' && read.verification === 'Verified') return 'active';
  if (read.state === 'Declared') return 'declared';
  if (read.state === 'Inactive') return 'inactive';
  return 'unverified';
}

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

export function outcomeToShow(read: PropertySender, result: SenderConnectionTest | undefined): SenderOutcome {
  const outcome = result ? outcomeOfTest(result) : outcomeOfSender(read);
  return read.state === 'Declared' && read.sender === 'ChannelManager' && (result === undefined || outcome === 'unverified') ? 'declared' : outcome;
}

const KNOWN_REASONS: ReadonlySet<string> = new Set([
  'octorate_not_connected',
  'octorate_police_account_invalid',
  'octorate_police_autorun_off',
  'octorate_police_not_exposed',
  'octorate_unavailable',
  'sender_casazen_not_available',
]);

export const knownReason = (reason: string | null | undefined): string | null => (reason !== null && reason !== undefined && KNOWN_REASONS.has(reason) ? reason : null);

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

export function senderPanelResume(propertyId: string): Pick<StartPanelStepRequest, 'resumeWizardType' | 'resumeDraftEntityId' | 'resumeStepCode'> {
  return { resumeWizardType: 'ComplianceSender', resumeDraftEntityId: propertyId, resumeStepCode: SENDER_STEP.panel };
}

export function senderResumePath(step: Pick<PanelStep, 'propertyId' | 'resume'> | undefined): string | null {
  if (!step?.propertyId || step.resume.wizardType !== 'ComplianceSender') return null;
  const stepId = (Object.values(SENDER_STEP) as string[]).find((candidate) => candidate === step.resume.stepCode);
  return senderWizardHref(step.propertyId, stepId as SenderStepId | undefined);
}
