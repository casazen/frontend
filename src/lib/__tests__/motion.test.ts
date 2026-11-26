import { describe, expect, it, vi } from 'vitest';
import { enableEntranceMotion, entranceMotionAllowed, fadeInPage } from '../motion';

function fakeWindow({ webdriver = false, reduce = false }: { webdriver?: boolean; reduce?: boolean } = {}) {
  const documentElement = document.createElement('html');
  return {
    navigator: { webdriver },
    matchMedia: (query: string) => ({ matches: query.includes('no-preference') ? !reduce : reduce }),
    document: { documentElement },
  } as unknown as Window;
}

describe('entrance motion', () => {
  it('runs when the person allows motion and no automation drives the page', () => {
    const win = fakeWindow();
    expect(entranceMotionAllowed(win)).toBe(true);
    enableEntranceMotion(win);
    expect(win.document.documentElement.dataset.motion).toBe('on');
  });

  it('stays off when the person asks for less motion', () => {
    const win = fakeWindow({ reduce: true });
    expect(entranceMotionAllowed(win)).toBe(false);
    enableEntranceMotion(win);
    expect(win.document.documentElement.dataset.motion).toBeUndefined();
  });

  it('stays off under browser automation, where a half transparent page would fail a contrast check', () => {
    expect(entranceMotionAllowed(fakeWindow({ webdriver: true }))).toBe(false);
  });

  it('fades the page in only where the entrances are on', () => {
    const page = document.createElement('main');
    const animate = vi.fn();
    Object.assign(page, { animate });

    fadeInPage(page);
    expect(animate).not.toHaveBeenCalled();

    document.documentElement.dataset.motion = 'on';
    try {
      fadeInPage(page);
      expect(animate).toHaveBeenCalledWith([{ opacity: 0 }, { opacity: 1 }], expect.objectContaining({ duration: 240 }));
    } finally {
      delete document.documentElement.dataset.motion;
    }
  });
});
