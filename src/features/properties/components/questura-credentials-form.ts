import { QUESTURA_CREDENTIALS_MAX_LENGTH, type SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';

export type QuesturaCredentialsField = keyof typeof QUESTURA_CREDENTIALS_MAX_LENGTH;
export type QuesturaCredentialsErrors = Partial<Record<QuesturaCredentialsField, string>>;

export const QUESTURA_CREDENTIAL_FIELDS: readonly { field: QuesturaCredentialsField; type: 'text' | 'password'; autoComplete: string }[] = [
  { field: 'username', type: 'text', autoComplete: 'off' },
  { field: 'password', type: 'password', autoComplete: 'off' },
  { field: 'wsKey', type: 'password', autoComplete: 'off' },
];

export const EMPTY_QUESTURA_CREDENTIALS: SetQuesturaCredentialsRequest = { username: '', password: '', wsKey: '' };

export function validateQuesturaCredentials(values: SetQuesturaCredentialsRequest): QuesturaCredentialsErrors {
  const errors: QuesturaCredentialsErrors = {};
  for (const { field } of QUESTURA_CREDENTIAL_FIELDS) {
    if (!values[field].trim()) errors[field] = `questuraCredentials.errors.${field}Required`;
    else if (values[field].length > QUESTURA_CREDENTIALS_MAX_LENGTH[field]) errors[field] = `questuraCredentials.errors.${field}TooLong`;
  }
  return errors;
}
