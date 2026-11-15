import type { ContextBootstrapDto } from '@/api/contexts';
import {
  BIOMETRIC_ACCEPT_MAX,
  BIOMETRIC_ATTEMPTS_MAX,
  BIOMETRIC_ATTEMPTS_MIN,
  BIOMETRIC_ESCALATE_MIN,
  type BiometricSettings,
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

/** The platform administrators of CasaZen, the only ones the status of the models is for: they hold the admin context with its platform role (the API asks `AdminOnly`). */
export function isPlatformAdmin(contexts: readonly Pick<ContextBootstrapDto, 'contextKey' | 'roleKey'>[]): boolean {
  return contexts.some((context) => context.contextKey === 'admin' && context.roleKey === 'platform_admin');
}
