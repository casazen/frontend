/**
 * The keyboard shortcut of the palette (UI-06): Ctrl+K, and Cmd+K on a Mac. It works from anywhere in the app, including
 * from a text field, except where the key already means something: a field that handled it itself, a rich text editor, a
 * field that opts out with `data-command-palette="off"`, and, on a Mac, Control+K inside a text field (there it is the
 * "delete to the end of the line" of the system; Command+K still opens the palette).
 */

/** True for the apple platforms, where the shortcut is written with the Command key. */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

/** How the shortcut is written next to the search: `⌘K` on a Mac, `Ctrl K` elsewhere. */
export function shortcutLabel(): string {
  return isApplePlatform() ? '⌘K' : 'Ctrl K';
}

/** True when the event is Ctrl+K or Cmd+K and nothing more: no Alt, no Shift, not a key held down, not part of a composition. */
export function isShortcutKey(event: KeyboardEvent): boolean {
  if (event.altKey || event.shiftKey || event.repeat || event.isComposing) return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  const key = event.key.toLowerCase();
  // On a layout without Latin letters (Greek, Cyrillic) the letter is not "k": the place of the key is.
  return key === 'k' || (!/^[a-z]$/.test(key) && event.code === 'KeyK');
}

const RICH_TEXT = '[contenteditable]:not([contenteditable="false"])';
const NOT_TEXT_INPUTS = ['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'];

function isTextEntry(element: Element): boolean {
  if (element.closest(RICH_TEXT)) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !NOT_TEXT_INPUTS.includes(element.type);
}

/**
 * True when the shortcut must be left to whoever has the focus. Called with the keydown event, at the document, after the
 * field has had its say: if it handled the key (`preventDefault`), the palette stays shut.
 */
export function shortcutIsTaken(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return false;
  if (target.closest('[data-command-palette="off"]')) return true;
  // A rich text editor binds Ctrl+K (insert a link): the palette does not take it from the person who is writing.
  if (target.closest(RICH_TEXT)) return true;
  // The Emacs keys of macOS: Control+K deletes to the end of the line in a text field.
  return isApplePlatform() && event.ctrlKey && !event.metaKey && isTextEntry(target);
}
