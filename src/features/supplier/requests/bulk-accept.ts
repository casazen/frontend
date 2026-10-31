import { ACCEPT_REQUESTS_MAX, type AcceptSupplierRequestsResponse } from '@/types/supplier';

/** The code of a request that was not sent because the whole block failed (no answer from the server): the dialog says so in words. */
export const BLOCK_NOT_SENT = 'block_not_sent';
/** The code of a request that is not taken in a block (a backup that waits for the primary supplier): it has its own button. */
export const NOT_IN_BLOCK = 'not_in_bulk';

/** A request that was not taken: why, in the words of the server when it gave them (`message`, localized) and its `code`. */
export interface BulkAcceptFailure {
  id: string;
  code: string | null;
  message: string | null;
}

export interface BulkAcceptOutcome {
  /** The ids that are now taken, in the order they were sent. */
  accepted: string[];
  /** The ids that are not, each with the reason. Nothing happened to them: they are as they were. */
  failed: BulkAcceptFailure[];
}

/** The ids in blocks of at most `size`, in the order they came. A repeated id counts once (the server does the same). */
export function inBlocks(ids: readonly string[], size: number = ACCEPT_REQUESTS_MAX): string[][] {
  const unique = [...new Set(ids)];
  const blocks: string[][] = [];
  for (let start = 0; start < unique.length; start += size) blocks.push(unique.slice(start, start + size));
  return blocks;
}

/**
 * Takes the requests in blocks of 20, one block after the other (`POST inbox/accept`): the order is kept, so that of two requests that
 * overlap the first is taken and the second is told by the server why it is not. Every request has its own outcome. A block that does not
 * go through at all (no network, an error of the server) leaves its requests as they were and marks them `block_not_sent`, and the next
 * blocks are still tried: what went through is never hidden by what did not.
 */
export async function acceptInBlocks(
  ids: readonly string[],
  accept: (block: string[]) => Promise<AcceptSupplierRequestsResponse>,
): Promise<BulkAcceptOutcome> {
  const accepted: string[] = [];
  const failed: BulkAcceptFailure[] = [];
  for (const block of inBlocks(ids)) {
    let answer: AcceptSupplierRequestsResponse;
    try {
      answer = await accept(block);
    } catch {
      failed.push(...block.map((id) => ({ id, code: BLOCK_NOT_SENT, message: null })));
      continue;
    }
    const results = new Map(answer.results.map((result) => [result.id, result]));
    for (const id of block) {
      const result = results.get(id);
      if (result?.accepted) accepted.push(id);
      else failed.push({ id, code: result?.code ?? null, message: result?.message ?? null });
    }
  }
  return { accepted, failed };
}
