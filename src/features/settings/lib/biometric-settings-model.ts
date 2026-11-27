import type { ContextBootstrapDto } from '@/api/contexts';
import {
  BIOMETRIC_ACCEPT_MAX,
  BIOMETRIC_ATTEMPTS_MAX,
  BIOMETRIC_ATTEMPTS_MIN,
  BIOMETRIC_ESCALATE_MIN,
  IDENTITY_SEGMENT_MODES,
  IDENTITY_SEGMENT_REASON_MAX_LENGTH,
  type BiometricSettings,
  type IdentitySegment,
  type IdentitySegmentFormat,
  type IdentitySegmentMode,
  type UpdateBiometricSettingsRequest,
} from '@/types/biometric-settings.types';

/** What the card edits, as the boxes hold it: text for the numbers (a box that is half typed is not a number yet). */
export interface BiometricForm {
  enabled: boolean;
  accept: string;
  escalate: string;
  attempts: string;
}

/** The form that shows the settings in force. */
export function formOf(settings: BiometricSettings): BiometricForm {
  return {
    enabled: settings.enabled,
    accept: String(settings.acceptThreshold),
    escalate: String(settings.escalateThreshold),
    attempts: String(settings.maxAttempts),
  };
}

/** The number a box holds (a comma counts as the decimal point), or `NaN` for a box that is empty or is not one. */
export function numberOf(text: string): number {
  const clean = text.trim().replace(',', '.');
  return clean === '' ? Number.NaN : Number(clean);
}

/** What is wrong with a box, as the key of the words that say it (`biometricSettings.errors.*`). */
export type BiometricFieldError = 'notANumber' | 'thresholdsRange' | 'thresholdsOrder' | 'attemptsRange';
export type BiometricFormErrors = Partial<Record<'accept' | 'escalate' | 'attempts', BiometricFieldError>>;

/**
 * The same bounds the API holds the settings to: 0.50 <= minimum < acceptance <= 0.95 and 1 to 5 attempts. The server checks again (422), and nothing is saved when it does not agree. A
 * threshold outside the bounds is told before the order of the two: the order is only worth saying about two thresholds that are both possible.
 */
export function validateBiometricForm(form: BiometricForm): BiometricFormErrors {
  const errors: BiometricFormErrors = {};
  const accept = numberOf(form.accept);
  const escalate = numberOf(form.escalate);
  const attempts = numberOf(form.attempts);

  if (Number.isNaN(accept)) errors.accept = 'notANumber';
  else if (accept > BIOMETRIC_ACCEPT_MAX) errors.accept = 'thresholdsRange';

  if (Number.isNaN(escalate)) errors.escalate = 'notANumber';
  else if (escalate < BIOMETRIC_ESCALATE_MIN) errors.escalate = 'thresholdsRange';

  if (!errors.accept && !errors.escalate && escalate >= accept) errors.accept = 'thresholdsOrder';

  if (Number.isNaN(attempts)) errors.attempts = 'notANumber';
  else if (!Number.isInteger(attempts) || attempts < BIOMETRIC_ATTEMPTS_MIN || attempts > BIOMETRIC_ATTEMPTS_MAX) errors.attempts = 'attemptsRange';

  return errors;
}

/** The body of the save: every value of the form, so what the page shows is what the server holds after it. */
export function requestOf(form: BiometricForm): UpdateBiometricSettingsRequest {
  return {
    enabled: form.enabled,
    acceptThreshold: numberOf(form.accept),
    escalateThreshold: numberOf(form.escalate),
    maxAttempts: numberOf(form.attempts),
  };
}

/** The form differs from what the server holds: there is something to save. */
export function isChanged(form: BiometricForm, settings: BiometricSettings): boolean {
  return (
    form.enabled !== settings.enabled ||
    numberOf(form.accept) !== settings.acceptThreshold ||
    numberOf(form.escalate) !== settings.escalateThreshold ||
    numberOf(form.attempts) !== settings.maxAttempts
  );
}

/** The reasons a model can fail with (`GET api/admin/biometrics/status`), each with its words in the language of the page (`biometricSettings.models.reason.*`). */
export const MODEL_REASON_CODES = [
  'hash_not_configured',
  'file_missing',
  'hash_mismatch',
  'download_failed',
  'path_invalid',
  'model_incompatible',
  'load_failed',
  'config_invalid',
] as const;

/** The states a model or the set can be in, each with its words (`biometricSettings.models.state.*`). */
export const MODEL_STATES = ['disabled', 'loading', 'ready', 'present', 'failed', 'unavailable'] as const;

/** The key of the words of a reason code, or of the generic sentence for a code that is not known. */
export function modelReasonKey(code: string): string {
  return (MODEL_REASON_CODES as readonly string[]).includes(code) ? `biometricSettings.models.reason.${code}` : 'biometricSettings.models.reason.other';
}

/** The key of the words of a state, or of the generic word for one that is not known. */
export function modelStateKey(state: string): string {
  return (MODEL_STATES as readonly string[]).includes(state) ? `biometricSettings.models.state.${state}` : 'biometricSettings.models.state.other';
}

/** The mode of a segment as the page reads it: a mode the page does not know is observation, the prudent one (the server reads it the same way). */
export function segmentModeOf(value: string): IdentitySegmentMode {
  return (IDENTITY_SEGMENT_MODES as readonly string[]).includes(value) ? (value as IdentitySegmentMode) : 'observation';
}

/** The key of the words of a mode of a segment (`biometricSettings.segments.mode.*`). */
export function segmentModeKey(mode: IdentitySegmentMode): string {
  return `biometricSettings.segments.mode.${mode}`;
}

/**
 * Why a segment does not approve automatically (`autoApprovalReason`) or is not qualified (`qualificationReason`): the codes of the API (`IdentitySegmentReasonCodes`), each with its words in the language of the
 * page (`biometricSettings.segments.reason.*`); a code the page does not know is shown with the generic sentence.
 */
export const SEGMENT_REASON_CODES = [
  'assurance_requires_chip',
  'auto_approval_disabled',
  'policy_provisional',
  'policy_unavailable',
  'qualification_mismatch',
  'segment_not_qualified',
  'segment_observation',
  'segment_suspended',
] as const;

/** The key of the words of a reason code, or of the generic sentence for a code that is not known. */
export function segmentReasonKey(code: string): string {
  return (SEGMENT_REASON_CODES as readonly string[]).includes(code) ? `biometricSettings.segments.reason.${code}` : 'biometricSettings.segments.reason.other';
}

/**
 * The families of browser a segment can name (the channels of the API, `IdentityChannels`), each with the key of its words. A channel carries a colon, which a key of the catalogue cannot hold, so the words are found
 * through this table; a channel it does not list is shown as its code.
 */
export const SEGMENT_CHANNEL_KEYS: Readonly<Record<string, string>> = {
  'web:ios-safari': 'biometricSettings.segments.channel.iosSafari',
  'web:android-chrome': 'biometricSettings.segments.channel.androidChrome',
  'web:desktop-chromium': 'biometricSettings.segments.channel.desktopChromium',
  'web:desktop-safari': 'biometricSettings.segments.channel.desktopSafari',
  'web:desktop-firefox': 'biometricSettings.segments.channel.desktopFirefox',
  'web:other': 'biometricSettings.segments.channel.other',
};

/** The label of a format of the registry, as the API gives it for the staff; the id for one the list does not hold any more. */
export function segmentFormatLabel(formats: readonly IdentitySegmentFormat[], formatId: string): string {
  return formats.find((format) => format.id === formatId)?.label ?? formatId;
}

const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The order the API lists the segments in: the ones of every property first, then by property name, format and channel. */
function sortSegments(segments: readonly IdentitySegment[]): IdentitySegment[] {
  return [...segments].sort(
    (a, b) =>
      (a.propertyId === null ? 0 : 1) - (b.propertyId === null ? 0 : 1) ||
      ordinal(a.propertyName ?? '', b.propertyName ?? '') ||
      ordinal(a.formatId, b.formatId) ||
      ordinal(a.channel, b.channel),
  );
}

/** The list with `segment` in it: it replaces the one with its id, or is added where the API would list it. */
export function withSegment(segments: readonly IdentitySegment[], segment: IdentitySegment): IdentitySegment[] {
  const exists = segments.some((entry) => entry.id === segment.id);
  return sortSegments(exists ? segments.map((entry) => (entry.id === segment.id ? segment : entry)) : [...segments, segment]);
}

/**
 * The reason of a suspension as the API takes it: the text without the spaces around it, 1 to 200 characters. `null` for what the API would refuse (nothing, or too long), so that the button that suspends is
 * not live for it.
 */
export function suspensionReasonOf(text: string): string | null {
  const reason = text.trim();
  return reason.length >= 1 && reason.length <= IDENTITY_SEGMENT_REASON_MAX_LENGTH ? reason : null;
}

/** The platform administrators of CasaZen, the only ones the status of the models is for: they hold the admin context with its platform role (the API asks `AdminOnly`). */
export function isPlatformAdmin(contexts: readonly Pick<ContextBootstrapDto, 'contextKey' | 'roleKey'>[]): boolean {
  return contexts.some((context) => context.contextKey === 'admin' && context.roleKey === 'platform_admin');
}
