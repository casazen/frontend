import { UnexpectedApiResponseError } from '@/lib/api-errors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function headerOf(headers: unknown, name: string): string | null {
  if (!isRecord(headers)) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
}

export function asReport<T>(url: string, data: unknown): T {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T;
}
