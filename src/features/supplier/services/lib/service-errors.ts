import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { SERVICE_LIMITS } from './service-limits';

/** What went wrong with a call of the catalog, in the terms the screens act on. */
export type ServiceProblemKind =
  | 'invalid'
  | 'notPublishable'
  | 'changed'
  | 'limit'
  | 'notFound'
  | 'cannotPause'
  | 'photo'
  | 'other';

export interface ServiceProblem {
  kind: ServiceProblemKind;
  /** The fields at fault, as the API names them (`name`, `supplements[1].amountCents`); only for `invalid` and `notPublishable`. */
  fields: string[];
  /** For the person, in their language: no field name of the API in it. */
  message: string;
  status?: number;
}

/** The stable codes of the catalog (ProblemDetails `code`); the category of a service has the one of every catalog of categories. */
const KIND_OF_CODE: Record<string, ServiceProblemKind> = {
  supplier_service_invalid: 'invalid',
  invalid_service_category: 'invalid',
  supplier_service_not_publishable: 'notPublishable',
  supplier_service_changed: 'changed',
  supplier_service_limit_reached: 'limit',
  supplier_service_not_found: 'notFound',
  supplier_service_cannot_pause: 'cannotPause',
  supplier_service_photo_none: 'photo',
  supplier_service_photo_invalid_type: 'photo',
  supplier_service_photo_invalid_size: 'photo',
  supplier_service_photo_limit_reached: 'photo',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The `fields` the API adds to a 422 of the catalog; anything that is not a list of names is left out. */
function readFields(data: unknown): string[] {
  if (!isRecord(data) || !Array.isArray(data.fields)) return [];
  return data.fields.filter((field): field is string => typeof field === 'string' && field !== '');
}

/** The field of the form that holds what the API calls `field`; `null` for one the form has no place for (the order, the photos). */
export function formPathOfField(field: string): string | null {
  const supplement = /^supplements\[(\d+)\]\.(code|label|amountCents|per|max)$/.exec(field);
  if (supplement) {
    const part = supplement[2] === 'code' ? 'label' : supplement[2] === 'amountCents' ? 'amount' : supplement[2];
    return `supplements.${supplement[1]}.${part}`;
  }
  switch (field) {
    case 'name':
    case 'category':
    case 'summary':
    case 'description':
    case 'durationMinutes':
    case 'minNoticeHours':
    case 'weekdays':
    case 'included':
    case 'excluded':
    case 'supplements':
      return field;
    case 'priceFromCents':
      return 'amount';
    case 'priceUnit':
      return 'fixedUnit';
    default:
      return null;
  }
}

/** The key of the name a field has for the person (`supplier.services.fields.<key>`), or `null` when it has none. */
function fieldLabelKey(field: string): string | null {
  if (field.startsWith('supplements')) return 'supplements';
  switch (field) {
    case 'name':
    case 'category':
    case 'summary':
    case 'description':
    case 'included':
    case 'excluded':
      return field;
    case 'priceFromCents':
    case 'priceUnit':
      return 'price';
    case 'durationMinutes':
      return 'duration';
    case 'minNoticeHours':
      return 'notice';
    case 'weekdays':
      return 'weekdays';
    case 'photoUrls':
      return 'photos';
    default:
      return null;
  }
}

/** "Name, Price": the fields at fault named as the screen names them, each once. */
function fieldNames(fields: readonly string[], t: TFunction): string {
  const keys = [...new Set(fields.map(fieldLabelKey).filter((key): key is string => key !== null))];
  return keys.map((key) => t(`supplier.services.fields.${key}`)).join(', ');
}

/**
 * What a failed call of the catalog means for the screen, and what to tell the person: the message never carries the
 * names the API gives the fields (they are English words of a JSON), only the names the form shows.
 */
export function describeServiceError(error: unknown, t: TFunction): ServiceProblem {
  const status = getHttpStatus(error);
  const data: unknown = isAxiosError(error) ? error.response?.data : undefined;
  const code = getProblemCode(data);
  const kind = (code ? KIND_OF_CODE[code] : undefined) ?? 'other';
  const fields = kind === 'invalid' || kind === 'notPublishable' ? readFields(data) : [];
  const server = getProblemMessage(error, t);
  const base = { fields, status };

  switch (kind) {
    case 'invalid': {
      const names = code === 'invalid_service_category' ? fieldNames(['category'], t) : fieldNames(fields, t);
      return {
        ...base,
        kind,
        fields: code === 'invalid_service_category' && fields.length === 0 ? ['category'] : fields,
        message: names ? t('supplier.services.errors.serverInvalid', { fields: names }) : t('supplier.services.errors.serverInvalidAny'),
      };
    }
    case 'notPublishable': {
      const names = fieldNames(fields, t);
      return {
        ...base,
        kind,
        message: names ? t('supplier.services.errors.serverNotPublishable', { fields: names }) : t('supplier.services.errors.serverNotPublishableAny'),
      };
    }
    case 'changed':
      return { ...base, kind, message: t('supplier.services.errors.changed') };
    case 'limit':
      return { ...base, kind, message: t('supplier.services.errors.limit', { max: SERVICE_LIMITS.maxServices }) };
    case 'notFound':
      return { ...base, kind, message: t('supplier.services.errors.notFound') };
    case 'cannotPause':
      return { ...base, kind, message: t('supplier.services.errors.cannotPause') };
    case 'photo':
      // The API names the file and the limit in the language of the person: better than anything written here.
      return { ...base, kind, message: server ?? t('supplier.services.errors.photoFailed') };
    default:
      return { ...base, kind, message: server ?? t('supplier.services.errors.generic') };
  }
}

/**
 * Marks on the form the fields the API refused (a 422 with `fields`), so that the person sees which ones: the names of the
 * API (`priceFromCents`, `supplements[1].amountCents`) are mapped to the fields of the form. The focus goes to the first.
 * Returns the paths it marked.
 */
export function markServerFields<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  problem: Pick<ServiceProblem, 'kind' | 'fields'>,
): string[] {
  if (problem.kind !== 'invalid' && problem.kind !== 'notPublishable') return [];
  const message = problem.kind === 'invalid' ? 'supplier.services.errors.serverField' : 'supplier.services.errors.requiredToPublish';
  const paths = [...new Set(problem.fields.map(formPathOfField).filter((path): path is string => path !== null))];
  for (const path of paths) form.setError(path as Path<TValues>, { type: 'server', message });
  if (paths.length > 0) form.setFocus(paths[0] as Path<TValues>);
  return paths;
}
