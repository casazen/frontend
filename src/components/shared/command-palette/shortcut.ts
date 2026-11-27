export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

export function shortcutLabel(): string {
  return isApplePlatform() ? '⌘K' : 'Ctrl K';
}

export function isShortcutKey(event: KeyboardEvent): boolean {
  if (event.altKey || event.shiftKey || event.repeat || event.isComposing) return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  const key = event.key.toLowerCase();
  return key === 'k' || (!/^[a-z]$/.test(key) && event.code === 'KeyK');
}

const RICH_TEXT = '[contenteditable]:not([contenteditable="false"])';
const NOT_TEXT_INPUTS = ['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'];

function isTextEntry(element: Element): boolean {
  if (element.closest(RICH_TEXT)) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !NOT_TEXT_INPUTS.includes(element.type);
}

export function shortcutIsTaken(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) return true;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return false;
  if (target.closest('[data-command-palette="off"]')) return true;
  if (target.closest(RICH_TEXT)) return true;
  return isApplePlatform() && event.ctrlKey && !event.metaKey && isTextEntry(target);
}
