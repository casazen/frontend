import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '../detail-chunk-error';

describe('isChunkLoadError (UI-15)', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://app.example/assets/booking-drawer-Bx3.js', // Chrome, Edge
    'error loading dynamically imported module: https://app.example/assets/booking-drawer-Bx3.js', // Firefox
    'Importing a module script failed.', // Safari
    'Loading chunk 42 failed.', // webpack-style bundlers
  ])('isChunkLoadError_%s_IsAChunkThatDidNotLoad', (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it('isChunkLoadError_ByTheNameOfTheError_IsAChunkThatDidNotLoad', () => {
    const error = new Error('whatever');
    error.name = 'ChunkLoadError';

    expect(isChunkLoadError(error)).toBe(true);
  });

  it.each([new Error('Cannot read properties of undefined'), new TypeError('x is not a function'), 'a string', null, undefined])(
    'isChunkLoadError_%s_IsAnErrorOfTheContentThatDrawingAgainCanFix',
    (error) => {
      expect(isChunkLoadError(error)).toBe(false);
    },
  );
});
