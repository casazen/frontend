import { QUESTURA_CREDENTIALS_MAX_LENGTH, type SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';

export type QuesturaCredentialsField = keyof SetQuesturaCredentialsRequest;
export type QuesturaCredentialsErrors = Partial<Record<QuesturaCredentialsField, string>>;

/**
 * The three fields, in the order they are asked. The password and the key are `type="password"` and no field has the autocomplete of the browser: these are the credentials of
 * a portal that is not CasaZen, so the browser neither fills them in nor offers to generate or remember them.
 */
export const QUESTURA_CREDENTIAL_FIELDS: readonly { field: QuesturaCredentialsField; type: 'text' | 'password'; autoComplete: string }[] = [
  { field: 'username', type: 'text', autoComplete: 'off' },
  { field: 'password', type: 'password', autoComplete: 'off' },
  { field: 'wsKey', type: 'password', autoComplete: 'off' },
];

export const EMPTY_QUESTURA_CREDENTIALS: SetQuesturaCredentialsRequest = { username: '', password: '', wsKey: '' };

/** Client checks mirroring the API (required, maximum length); the API validates again. The messages are i18n keys. */
export function validateQuesturaCredentials(values: SetQuesturaCredentialsRequest): QuesturaCredentialsErrors {
  const errors: QuesturaCredentialsErrors = {};
  for (const { field } of QUESTURA_CREDENTIAL_FIELDS) {
    if (!values[field].trim()) errors[field] = `questuraCredentials.errors.${field}Required`;
    else if (values[field].length > QUESTURA_CREDENTIALS_MAX_LENGTH[field]) errors[field] = `questuraCredentials.errors.${field}TooLong`;
  }
  return errors;
}
