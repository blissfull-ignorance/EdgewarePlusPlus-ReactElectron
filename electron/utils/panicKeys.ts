/**
 * @file panicKeys — Maps the configured panic key to an Electron accelerator.
 *
 * The `globalPanicButton` setting carries legacy pynput key names ("Key.esc",
 * "Key.f12", "Key.space") or a bare character ("e"). Anything that already
 * looks like an Electron accelerator passes through unchanged; unusable
 * values fall back to Escape, the legacy default panic key.
 */

const SPECIAL_KEYS: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  space: "Space",
  tab: "Tab",
  enter: "Return",
  return: "Return",
  backspace: "Backspace",
  delete: "Delete",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  ctrl: "Control",
  alt: "Alt",
  shift: "Shift",
  cmd: "Command",
};

export function toAccelerator(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "Escape";

  if (value.startsWith("Key.")) {
    const name = value.slice(4).toLowerCase();
    if (!name) return "Escape";
    if (SPECIAL_KEYS[name]) return SPECIAL_KEYS[name];
    const fn = name.match(/^f(\d{1,2})$/);
    if (fn) return `F${fn[1]}`;
    if (name.length === 1 && /[a-z0-9]/.test(name)) return name.toUpperCase();
    return "Escape";
  }

  if (value.length === 1) {
    return /[a-zA-Z0-9]/.test(value) ? value.toUpperCase() : "Escape";
  }

  return value;
}

const DOM_CODES: Record<string, string> = {
  esc: "Escape",
  escape: "Escape",
  space: "Space",
  tab: "Tab",
  enter: "Enter",
  return: "Enter",
  backspace: "Backspace",
  delete: "Delete",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  ctrl: "ControlLeft",
  alt: "AltLeft",
  shift: "ShiftLeft",
  cmd: "MetaLeft",
};

/**
 * Map a configured panic key to a DOM KeyboardEvent.code for the in-window
 * panic key (`panicButton`, legacy panic_key: needs app focus). Returns null
 * for values that cannot be matched to a physical key.
 */
export function toKeyboardCode(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const name = value.startsWith("Key.") ? value.slice(4).toLowerCase() : value.toLowerCase();
  if (!name) return null;
  if (DOM_CODES[name]) return DOM_CODES[name];
  const fn = name.match(/^f(\d{1,2})$/);
  if (fn) return `F${fn[1]}`;
  if (name.length === 1) {
    if (/[a-z]/.test(name)) return `Key${name.toUpperCase()}`;
    if (/[0-9]/.test(name)) return `Digit${name}`;
  }
  return null;
}
