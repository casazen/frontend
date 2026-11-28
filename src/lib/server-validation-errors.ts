import { isAxiosError } from 'axios';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstMessage(value: unknown): string | undefined {
  const messages = Array.isArray(value) ? value : [value];
  const text = messages.find((message): message is string => typeof message === 'string' && message.trim() !== '');
  return text?.trim();
}

interface ServerFieldErrorOptions {
  translateCode?: (code: string) => string | undefined;
}

export function getServerFieldErrorsByPath(
  error: unknown,
  unreadableValueMessage: string,
  options: ServerFieldErrorOptions = {},
): Record<string, string> {
  if (!isAxiosError(error) || error.response?.status !== 400) return {};
  const data: unknown = error.response.data;
  if (!isRecord(data) || !isRecord(data.errors)) return {};

  const codes = isRecord(data.codes) ? data.codes : {};
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

    const code = codes[key];
    const translated = !isJsonPath && typeof code === 'string' ? options.translateCode?.(code) : undefined;
    const message = isJsonPath ? unreadableValueMessage : (translated ?? firstMessage(value));
    if (message) result[path] = message;
  }

  return result;
}
