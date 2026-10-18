import { afterEach, describe, expect, it, vi } from 'vitest';
import { isApplePlatform, isShortcutKey, shortcutIsTaken, shortcutLabel } from '../shortcut';

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
}

/** Dispatches the key on `target` the way a browser does, and gives the event back with its target set. */
function press(target: Element, init: KeyboardEventInit, handler?: (event: KeyboardEvent) => void): KeyboardEvent {
  const event = key(init);
  if (handler) target.addEventListener('keydown', handler as EventListener, { once: true });
  target.dispatchEvent(event);
  return event;
}

function onPlatform(platform: string) {
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
}

describe('the shortcut of the palette (UI-06)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('isShortcutKey', () => {
    it.each([
      ['Control+K', { key: 'k', ctrlKey: true }],
      ['Command+K', { key: 'k', metaKey: true }],
      ['Control+K with the capitals lock on', { key: 'K', ctrlKey: true }],
      ['Control+K on a Greek or Cyrillic layout (the key where the K sits)', { key: 'л', code: 'KeyK', ctrlKey: true }],
    ])('IsShortcutKey_%s_IsTheShortcut', (_name, init) => {
      expect(isShortcutKey(key(init))).toBe(true);
    });

    it.each([
      ['K alone', { key: 'k' }],
      ['another letter with Control', { key: 'j', ctrlKey: true }],
      ['Control+Shift+K (the console of the browser)', { key: 'K', ctrlKey: true, shiftKey: true }],
      ['Control+Alt+K', { key: 'k', ctrlKey: true, altKey: true }],
      ['Control+K held down', { key: 'k', ctrlKey: true, repeat: true }],
      ['Control+K inside an input method composition', { key: 'k', ctrlKey: true, isComposing: true }],
      ['a Latin letter that sits where the K is on another layout', { key: 'j', code: 'KeyK', ctrlKey: true }],
    ])('IsShortcutKey_%s_IsNot', (_name, init) => {
      expect(isShortcutKey(key(init))).toBe(false);
    });
  });

  describe('shortcutIsTaken', () => {
    const CTRL_K = { key: 'k', ctrlKey: true } as const;

    it('ShortcutIsTaken_PlainPageAndTextField_IsFree', () => {
      document.body.innerHTML = '<main><input id="field" type="text"><textarea id="area"></textarea></main>';

      expect(shortcutIsTaken(press(document.querySelector('main')!, CTRL_K))).toBe(false);
      // A text field does not use Ctrl+K: the palette opens from it.
      expect(shortcutIsTaken(press(document.getElementById('field')!, CTRL_K))).toBe(false);
      expect(shortcutIsTaken(press(document.getElementById('area')!, CTRL_K))).toBe(false);
    });

    it('ShortcutIsTaken_AFieldThatHandledTheKeyItself_KeepsIt', () => {
      document.body.innerHTML = '<div><input id="field" type="text"></div>';
      const field = document.getElementById('field')!;

      const event = press(field, CTRL_K, (own) => own.preventDefault());

      expect(shortcutIsTaken(event)).toBe(true);
    });

    it('ShortcutIsTaken_FieldThatSaysItUsesTheKey_KeepsIt', () => {
      document.body.innerHTML = '<div data-command-palette="off"><input id="editor" type="text"></div><input id="other" type="text">';

      expect(shortcutIsTaken(press(document.getElementById('editor')!, CTRL_K))).toBe(true);
      expect(shortcutIsTaken(press(document.getElementById('other')!, CTRL_K))).toBe(false);
    });

    it('ShortcutIsTaken_RichTextEditor_KeepsIt', () => {
      document.body.innerHTML = '<div contenteditable="true"><p id="line">text</p></div><p id="plain" contenteditable="false">x</p>';

      expect(shortcutIsTaken(press(document.getElementById('line')!, CTRL_K))).toBe(true);
      expect(shortcutIsTaken(press(document.getElementById('plain')!, CTRL_K))).toBe(false);
    });

    it('ShortcutIsTaken_ControlInATextFieldOnAMac_IsTheEmacsKeyOfTheSystem', () => {
      onPlatform('MacIntel');
      document.body.innerHTML = '<input id="field" type="text"><textarea id="area"></textarea><input id="box" type="checkbox"><button id="button">b</button>';

      // Control+K deletes to the end of the line there: the palette stays out of it...
      expect(shortcutIsTaken(press(document.getElementById('field')!, CTRL_K))).toBe(true);
      expect(shortcutIsTaken(press(document.getElementById('area')!, CTRL_K))).toBe(true);
      // ...but Command+K opens it, and Control+K does outside a text field.
      expect(shortcutIsTaken(press(document.getElementById('field')!, { key: 'k', metaKey: true }))).toBe(false);
      expect(shortcutIsTaken(press(document.getElementById('box')!, CTRL_K))).toBe(false);
      expect(shortcutIsTaken(press(document.getElementById('button')!, CTRL_K))).toBe(false);
    });

    it('ShortcutIsTaken_ControlInATextFieldOnWindowsOrLinux_IsFree', () => {
      onPlatform('Win32');
      document.body.innerHTML = '<input id="field" type="text">';

      expect(shortcutIsTaken(press(document.getElementById('field')!, CTRL_K))).toBe(false);
    });
  });

  describe('how it is written', () => {
    it('ShortcutLabel_ByPlatform_IsCommandOnAMacAndControlElsewhere', () => {
      onPlatform('MacIntel');
      expect(isApplePlatform()).toBe(true);
      expect(shortcutLabel()).toBe('⌘K');
    });

    it.each(['Win32', 'Linux x86_64'])('ShortcutLabel_%s_IsControlK', (platform) => {
      onPlatform(platform);
      expect(isApplePlatform()).toBe(false);
      expect(shortcutLabel()).toBe('Ctrl K');
    });

    it('IsApplePlatform_IPhone_IsApple', () => {
      onPlatform('iPhone');
      expect(isApplePlatform()).toBe(true);
    });
  });
});
