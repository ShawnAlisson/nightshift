// Drives the real search box from the outside, the way a person would: open it with the keyboard
// shortcut, type into it, close it again.

const INPUT = '[data-slot="command-input"]';

/** Presses Ctrl+K. The search box listens for it on the window and toggles. */
export function togglePalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
}

export const isPaletteOpen = () => document.querySelector(INPUT) !== null;

/** Sets the search box's text so React notices, exactly like typing. */
export function typeInPalette(text: string) {
  const input = document.querySelector<HTMLInputElement>(INPUT);
  if (!input) return;
  // React tracks the value itself, so go through the native setter, then announce the change.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
