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
