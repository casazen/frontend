import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { actionLabelKey } from '@/lib/routine-model';

const ROUTINE_ACTION_NOT_AVAILABLE = 'routine_action_not_available';

function listedActions(data: unknown, t: TFunction): string[] {
  const listed = typeof data === 'object' && data !== null ? (data as { actions?: unknown }).actions : undefined;
  if (!Array.isArray(listed)) return [];
  return listed.flatMap((type) => {
    const key = typeof type === 'string' ? actionLabelKey(type) : undefined;
    return key ? [t(key)] : [];
  });
}

/**
 * The words for a failed call of the routines API. The same as every other call (`getProblemMessage`: the text of the code, else the message of the server), with one more
 * thing for the answer the page waits for most: when a routine cannot be switched on because of its actions, it says which ones, by the names the editor gives them.
 */
export function describeRoutineError(error: unknown, t: TFunction): string | undefined {
  if (isAxiosError(error) && getHttpStatus(error) === 422 && getProblemCode(error.response?.data) === ROUTINE_ACTION_NOT_AVAILABLE) {
    const names = listedActions(error.response?.data, t);
    if (names.length > 0) return t('routines.action.notAvailableNamed', { actions: names.join(', ') });
  }
  return getProblemMessage(error, t);
}
