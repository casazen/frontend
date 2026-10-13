import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyUiVersion, isNotRedesignedMatch, isUiV2Override, NOT_REDESIGNED_ROUTE_HANDLE, UI_VERSION_STORAGE_KEY } from '@/lib/ui-version';

const storageWith = (value: string | null) => ({ getItem: (key: string) => (key === UI_VERSION_STORAGE_KEY ? value : null) });

describe('isUiV2Override (QA and build overrides of the redesign)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('isUiV2Override_NothingSet_IsOff', () => {
    expect(isUiV2Override(storageWith(null), undefined)).toBe(false);
    expect(isUiV2Override()).toBe(false);
  });

  it('isUiV2Override_StorageKeyIsV2_IsOn', () => {
    expect(UI_VERSION_STORAGE_KEY).toBe('casazen:ui');
    expect(isUiV2Override(storageWith('v2'), undefined)).toBe(true);
    localStorage.setItem('casazen:ui', 'v2');
    expect(isUiV2Override()).toBe(true);
  });

  it.each(['v1', 'true', '', 'V2', ' v2'])('isUiV2Override_StorageValue_%j_IsOff', (value) => {
    expect(isUiV2Override(storageWith(value), undefined)).toBe(false);
  });

  it('isUiV2Override_BuildFlagTrue_IsOn', () => {
    expect(isUiV2Override(storageWith(null), 'true')).toBe(true);
    vi.stubEnv('VITE_UI_V2', 'true');
    expect(isUiV2Override()).toBe(true);
  });

  it.each(['false', '1', 'yes', '', undefined])('isUiV2Override_BuildFlag_%j_IsOff', (value) => {
    expect(isUiV2Override(storageWith(null), value)).toBe(false);
  });

  it('isUiV2Override_BlockedStorage_IsOffInsteadOfThrowing', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    expect(isUiV2Override(blocked, undefined)).toBe(false);
    expect(isUiV2Override(null, undefined)).toBe(false);
    // The build flag does not need the storage.
    expect(isUiV2Override(blocked, 'true')).toBe(true);
  });
});

describe('applyUiVersion', () => {
  afterEach(() => document.documentElement.removeAttribute('data-ui'));

  it('applyUiVersion_OnAndOff_SetsAndRemovesTheAttributeOnHtml', () => {
    applyUiVersion(true);
    expect(document.documentElement.getAttribute('data-ui')).toBe('v2');
    applyUiVersion(true);
    expect(document.documentElement.getAttribute('data-ui')).toBe('v2');
    applyUiVersion(false);
    expect(document.documentElement.hasAttribute('data-ui')).toBe(false);
  });

  it('applyUiVersion_OtherRoot_LeavesHtmlAlone', () => {
    const root = document.createElement('div');
    applyUiVersion(true, root);
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(document.documentElement.hasAttribute('data-ui')).toBe(false);
  });
});

describe('isNotRedesignedMatch', () => {
  it('isNotRedesignedMatch_OneRouteMarkedNotRedesigned_IsTrue', () => {
    expect(NOT_REDESIGNED_ROUTE_HANDLE).toEqual({ redesign: false });
    expect(isNotRedesignedMatch([{ route: {} }, { route: { handle: NOT_REDESIGNED_ROUTE_HANDLE } }])).toBe(true);
  });

  it.each([
    null,
    [],
    [{ route: {} }],
    [{ route: { handle: { other: true } } }],
    // Only an explicit `redesign: false` keeps the current look: a route that is redesigned says nothing (or `true`).
    [{ route: { handle: { redesign: true } } }],
    [{ route: { handle: { redesign: 'false' } } }],
    [{ route: { handle: 'redesign' } }],
  ])('isNotRedesignedMatch_%j_IsFalse', (matches) => {
    expect(isNotRedesignedMatch(matches)).toBe(false);
  });
});
