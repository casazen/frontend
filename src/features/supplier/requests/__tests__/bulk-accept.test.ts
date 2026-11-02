import { describe, expect, it, vi } from 'vitest';
import type { AcceptSupplierRequestsResponse } from '@/types/supplier';
import { acceptInBlocks, BLOCK_NOT_SENT, inBlocks } from '../bulk-accept';

const ids = (count: number, prefix = 'r') => Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);

/** An answer of the server in which every request is taken, except the ones named in `refused` (with the reason the server gives). */
function answerFor(block: string[], refused: Record<string, string> = {}): AcceptSupplierRequestsResponse {
  const results = block.map((id) =>
    id in refused ? { id, accepted: false, code: 'supplier_commitment_conflict', message: refused[id] } : { id, accepted: true, status: 'PresoInCarico' },
  );
  return { results, accepted: results.filter((result) => result.accepted).length, failed: results.filter((result) => !result.accepted).length };
}

describe('inBlocks (SP-08b)', () => {
  it('inBlocks_FortyFiveIds_AreSentInBlocksOfTwentyInTheOrderTheyCame', () => {
    const blocks = inBlocks(ids(45));

    expect(blocks.map((block) => block.length)).toEqual([20, 20, 5]);
    expect(blocks.flat()).toEqual(ids(45));
  });

  it('inBlocks_ARepeatedId_CountsOnce', () => {
    expect(inBlocks(['a', 'b', 'a', 'c', 'b'])).toEqual([['a', 'b', 'c']]);
  });
});

describe('acceptInBlocks (SP-08b): the outcome of every request is its own', () => {
  it('acceptInBlocks_SomeRefused_KeepsTheReasonOfEachAndTakesTheOthers', async () => {
    const accept = vi.fn(async (block: string[]) => answerFor(block, { r2: 'Si sovrappone a un lavoro già accettato.' }));

    const outcome = await acceptInBlocks(ids(3), accept);

    expect(accept).toHaveBeenCalledTimes(1);
    expect(outcome.accepted).toEqual(['r1', 'r3']);
    expect(outcome.failed).toEqual([{ id: 'r2', code: 'supplier_commitment_conflict', message: 'Si sovrappone a un lavoro già accettato.' }]);
  });

  it('acceptInBlocks_FortyFiveIds_AsksOneBlockAfterTheOtherAndNeverMoreThanTwenty', async () => {
    const sizes: number[] = [];
    const accept = vi.fn(async (block: string[]) => {
      sizes.push(block.length);
      return answerFor(block);
    });

    const outcome = await acceptInBlocks(ids(45), accept);

    expect(sizes).toEqual([20, 20, 5]);
    expect(outcome.accepted).toEqual(ids(45));
    expect(outcome.failed).toEqual([]);
  });

  it('acceptInBlocks_ABlockThatDoesNotGoThrough_LeavesItsRequestsAsTheyWereAndStillTriesTheNext', async () => {
    const accept = vi
      .fn<(block: string[]) => Promise<AcceptSupplierRequestsResponse>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementation(async (block) => answerFor(block));

    const outcome = await acceptInBlocks(ids(25), accept);

    expect(outcome.failed.map((failure) => failure.id)).toEqual(ids(20));
    expect(outcome.failed.every((failure) => failure.code === BLOCK_NOT_SENT && failure.message === null)).toBe(true);
    // What went through is not hidden by what did not.
    expect(outcome.accepted).toEqual(['r21', 'r22', 'r23', 'r24', 'r25']);
  });

  it('acceptInBlocks_ARequestTheServerDidNotAnswerFor_IsNotCountedAsTaken', async () => {
    const accept = vi.fn(async (block: string[]) => ({ results: [{ id: block.at(0) ?? '', accepted: true }], accepted: 1, failed: 0 }));

    const outcome = await acceptInBlocks(['a', 'b'], accept);

    expect(outcome.accepted).toEqual(['a']);
    expect(outcome.failed).toEqual([{ id: 'b', code: null, message: null }]);
  });
});
