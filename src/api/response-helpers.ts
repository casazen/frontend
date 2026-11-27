import { UnexpectedApiResponseError } from '@/lib/api-errors';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The value of a header of an answer, whatever the case of its name, or `null`. A browser lets a page read only the headers that the API exposes
 * (CORS), so a header that is not there is `null`: whoever reads it has a way on without it.
 */
export function headerOf(headers: unknown, name: string): string | null {
  if (!isRecord(headers)) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
}

/** A read that did not come back as an object (the page of another kind an odd proxy sends) is an error to show, not data to draw. */
export function asReport<T>(url: string, data: unknown): T {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new UnexpectedApiResponseError(url);
  return data as T;
}
