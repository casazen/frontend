import { afterEach, describe, expect, it } from 'vitest';
import { INTERNAL_ACTIVITIES_KEY, queryClient } from '../query-client';

const TODO_LIST_KEY = [INTERNAL_ACTIVITIES_KEY, 'todo'];
const TODO_COUNT_KEY = [INTERNAL_ACTIVITIES_KEY, 'todo-count'];

/** Runs a write of the app through the mutation cache of the shared client, as `useMutation` does. */
function runMutation(mutationFn: () => Promise<unknown>) {
  return queryClient.getMutationCache().build(queryClient, { mutationFn }).execute(undefined);
}

// ADR-026-R7: a "To do" closes by itself when the write that meets its condition is made, so the list is read again after any write.
describe('the shared query client and the To do list (ADR-026-R7)', () => {
  afterEach(() => {
    queryClient.clear();
  });

  it('queryClient_SuccessfulWrite_MarksTheToDoListAndItsCountForANewRead', async () => {
    queryClient.setQueryData(TODO_LIST_KEY, []);
    queryClient.setQueryData(TODO_COUNT_KEY, { count: 1 });
    queryClient.setQueryData(['bookings', 'list'], []);

    await runMutation(async () => 'saved');

    expect(queryClient.getQueryState(TODO_LIST_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(TODO_COUNT_KEY)?.isInvalidated).toBe(true);
    // Only the To do queries: the other lists are not read again because of it.
    expect(queryClient.getQueryState(['bookings', 'list'])?.isInvalidated).toBe(false);
  });

  it('queryClient_FailedWrite_LeavesTheToDoListAlone', async () => {
    queryClient.setQueryData(TODO_LIST_KEY, []);

    await expect(
      runMutation(async () => {
        throw new Error('not saved');
      }),
    ).rejects.toThrow('not saved');

    expect(queryClient.getQueryState(TODO_LIST_KEY)?.isInvalidated).toBe(false);
  });
});
