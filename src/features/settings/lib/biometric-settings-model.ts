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

export interface BiometricForm {
  enabled: boolean;
  accept: string;
  escalate: string;
  attempts: string;
}

export function formOf(settings: BiometricSettings): BiometricForm {
  return {
    enabled: settings.enabled,
    accept: String(settings.acceptThreshold),
    escalate: String(settings.escalateThreshold),
    attempts: String(settings.maxAttempts),
  };
}

export function numberOf(text: string): number {
  const clean = text.trim().replace(',', '.');
  return clean === '' ? Number.NaN : Number(clean);
}

export type BiometricFieldError = 'notANumber' | 'thresholdsRange' | 'thresholdsOrder' | 'attemptsRange';
export type BiometricFormErrors = Partial<Record<'accept' | 'escalate' | 'attempts', BiometricFieldError>>;

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

export function requestOf(form: BiometricForm): UpdateBiometricSettingsRequest {
  return {
    enabled: form.enabled,
    acceptThreshold: numberOf(form.accept),
    escalateThreshold: numberOf(form.escalate),
    maxAttempts: numberOf(form.attempts),
  };
}

export function isChanged(form: BiometricForm, settings: BiometricSettings): boolean {
  return (
    form.enabled !== settings.enabled ||
    numberOf(form.accept) !== settings.acceptThreshold ||
    numberOf(form.escalate) !== settings.escalateThreshold ||
    numberOf(form.attempts) !== settings.maxAttempts
  );
}

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

export const MODEL_STATES = ['disabled', 'loading', 'ready', 'present', 'failed', 'unavailable'] as const;

export function modelReasonKey(code: string): string {
  return (MODEL_REASON_CODES as readonly string[]).includes(code) ? `biometricSettings.models.reason.${code}` : 'biometricSettings.models.reason.other';
}

export function modelStateKey(state: string): string {
  return (MODEL_STATES as readonly string[]).includes(state) ? `biometricSettings.models.state.${state}` : 'biometricSettings.models.state.other';
}

export function segmentModeOf(value: string): IdentitySegmentMode {
  return (IDENTITY_SEGMENT_MODES as readonly string[]).includes(value) ? (value as IdentitySegmentMode) : 'observation';
}

export function segmentModeKey(mode: IdentitySegmentMode): string {
  return `biometricSettings.segments.mode.${mode}`;
}

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

export function segmentReasonKey(code: string): string {
  return (SEGMENT_REASON_CODES as readonly string[]).includes(code) ? `biometricSettings.segments.reason.${code}` : 'biometricSettings.segments.reason.other';
}

export const SEGMENT_CHANNEL_KEYS: Readonly<Record<string, string>> = {
  'web:ios-safari': 'biometricSettings.segments.channel.iosSafari',
  'web:android-chrome': 'biometricSettings.segments.channel.androidChrome',
  'web:desktop-chromium': 'biometricSettings.segments.channel.desktopChromium',
  'web:desktop-safari': 'biometricSettings.segments.channel.desktopSafari',
  'web:desktop-firefox': 'biometricSettings.segments.channel.desktopFirefox',
  'web:other': 'biometricSettings.segments.channel.other',
};

export function segmentFormatLabel(formats: readonly IdentitySegmentFormat[], formatId: string): string {
  return formats.find((format) => format.id === formatId)?.label ?? formatId;
}

const ordinal = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function sortSegments(segments: readonly IdentitySegment[]): IdentitySegment[] {
  return [...segments].sort(
    (a, b) =>
      (a.propertyId === null ? 0 : 1) - (b.propertyId === null ? 0 : 1) ||
      ordinal(a.propertyName ?? '', b.propertyName ?? '') ||
      ordinal(a.formatId, b.formatId) ||
      ordinal(a.channel, b.channel),
  );
}

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

export function isPlatformAdmin(contexts: readonly Pick<ContextBootstrapDto, 'contextKey' | 'roleKey'>[]): boolean {
  return contexts.some((context) => context.contextKey === 'admin' && context.roleKey === 'platform_admin');
}
