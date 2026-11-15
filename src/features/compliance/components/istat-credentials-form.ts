import { ISTAT_CREDENTIALS_MAX_LENGTH, type SetIstatCredentialsRequest } from '@/types/onboarding.types';

export type IstatCredentialsField = keyof SetIstatCredentialsRequest;
export type IstatCredentialsErrors = Partial<Record<IstatCredentialsField, string>>;

/**
 * The fields of the regional ISTAT credentials, in the order they are asked. The password is `type="password"` and no field has the autocomplete of the browser: these are the
 * credentials of a portal that is not CasaZen, so the browser neither fills them in nor offers to generate or remember them. The code of the structure is the only one that may be left
 * empty (the portal of some regions asks for it, the others do not).
 */
export const ISTAT_CREDENTIAL_FIELDS: readonly { field: IstatCredentialsField; type: 'text' | 'password'; required: boolean }[] = [
  { field: 'username', type: 'text', required: true },
  { field: 'password', type: 'password', required: true },
  { field: 'structureCode', type: 'text', required: false },
];

export const EMPTY_ISTAT_CREDENTIALS: SetIstatCredentialsRequest = { username: '', password: '', structureCode: '' };

/** Client checks mirroring the API (required, maximum length); the API validates again. The messages are i18n keys. */
export function validateIstatCredentials(values: SetIstatCredentialsRequest): IstatCredentialsErrors {
  const errors: IstatCredentialsErrors = {};
  for (const { field, required } of ISTAT_CREDENTIAL_FIELDS) {
    if (required && !values[field].trim()) errors[field] = `istatCredentials.errors.${field}Required`;
    else if (values[field].length > ISTAT_CREDENTIALS_MAX_LENGTH[field]) errors[field] = `istatCredentials.errors.${field}TooLong`;
  }
  return errors;
}

/**
 * Whether the person typed something in the ISTAT credentials that is not saved yet (a field of spaces is empty). They are in no value of a wizard and in no draft, so what leaves the
 * step with them typed is lost: the main button of the sender wizard saves them first.
 */
export function hasTypedIstatCredentials(values: SetIstatCredentialsRequest): boolean {
  return Object.values(values).some((value) => value.trim() !== '');
}
