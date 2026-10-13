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
 * Field errors of a 400 ValidationProblem keyed by react-hook-form path, for forms with lists: `Guests[1].DocumentNumber`
 * → `guests.1.documentNumber`, `$.guests[0].gender` → `guests.0.gender`, `GdprConsent` → `gdprConsent`. JSON-path
 * messages are converter internals, so they are replaced by `unreadableValueMessage`. The caller keeps only the paths
 * its form renders and shows `getProblemMessage` for the rest.
 */
export function getServerFieldErrorsByPath(error: unknown, unreadableValueMessage: string): Record<string, string> {
  if (!isAxiosError(error) || error.response?.status !== 400) return {};
  const data: unknown = error.response.data;
  if (!isRecord(data) || !isRecord(data.errors)) return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.errors)) {
    const isJsonPath = key.startsWith('$');
    const path = key
      .replace(/^\$\.?/, '')
      .replace(/\[(\d+)\]/g, '.$1')
      .split('.')
      .filter(Boolean)
      .map((segment) => (/^\d+$/.test(segment) ? segment : segment.charAt(0).toLowerCase() + segment.slice(1)))
      .join('.');
    if (!path || result[path]) continue;

    const message = isJsonPath ? unreadableValueMessage : firstMessage(value);
    if (message) result[path] = message;
  }

  return result;
}
