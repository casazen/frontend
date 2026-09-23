import { isAxiosError } from 'axios';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstMessage(value: unknown): string | undefined {
  const messages = Array.isArray(value) ? value : [value];
  const text = messages.find((message): message is string => typeof message === 'string' && message.trim() !== '');
  return text?.trim();
}

/**
 * Field errors of a 400 ValidationProblem (`errors: { Field: ["message"] }`) keyed by the form field they belong to,
 * for `setError(field, { type: 'server', message })`.
 *
 * The API keys errors by C# property name (`DocumentNumber`) or, when a value cannot be read at all, by JSON path
 * (`$.gender`): both are matched to `fields` ignoring case. JSON-path messages are converter internals, so they are
 * replaced by `unreadableValueMessage`. Keys that match no field are left out: show `getProblemMessage` for those.
 */
export function getServerFieldErrors<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  unreadableValueMessage: string,
): Partial<Record<TField, string>> {
  if (!isAxiosError(error) || error.response?.status !== 400) return {};
  const data: unknown = error.response.data;
  if (!isRecord(data) || !isRecord(data.errors)) return {};

  const byLowerName = new Map(fields.map((field) => [field.toLowerCase(), field] as const));
  const result: Partial<Record<TField, string>> = {};

  for (const [key, value] of Object.entries(data.errors)) {
    const isJsonPath = key.startsWith('$');
    const name = key.replace(/^\$\.?/, '').split('.').pop()?.toLowerCase() ?? '';
    const field = byLowerName.get(name);
    if (!field || result[field]) continue;

    const message = isJsonPath ? unreadableValueMessage : firstMessage(value);
    if (message) result[field] = message;
  }

  return result;
}
