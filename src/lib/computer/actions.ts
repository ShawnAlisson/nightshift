export const SCREEN = { width: 1280, height: 800 } as const;

const MAX_TYPED_CHARS = 4000;
const MAX_WAIT_S = 30;
const MAX_SCROLL = 30;
const MODIFIERS = new Set(["shift", "ctrl", "alt", "super"]);
const KEY_PATTERN = /^[A-Za-z0-9_+]{1,64}$/;
const BUTTONS = { left: "1", middle: "2", right: "3" } as const;
const SCROLL_BUTTONS = { up: "4", down: "5", left: "6", right: "7" } as const;

export type Step = { xdotool: string[] } | { sleepMs: number };

export type Plan =
  | { label: string; kind: "screenshot" }
  | { label: string; kind: "cursor_position" }
  | { label: string; kind: "steps"; steps: Step[] };

export class ActionError extends Error {}

/** A provider-neutral computer action, in the vocabulary of the Anthropic computer toolset. */
export type ComputerAction = { name: string; input: object };

function point(value: unknown, name = "coordinate"): [string, string] {
  if (!Array.isArray(value) || value.length !== 2) throw new ActionError(`${name} must be [x, y]`);
  const [x, y] = value.map(Number);
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new ActionError(`${name} must be integers`);
  if (x < 0 || y < 0 || x >= SCREEN.width || y >= SCREEN.height) {
    throw new ActionError(`${name} is outside the ${SCREEN.width}x${SCREEN.height} screen`);
  }
  return [String(x), String(y)];
}

function modifiers(text: unknown) {
  if (text != null && typeof text !== "string") throw new ActionError("Unsupported click modifier");
  const mods = text ? text.toLowerCase().split("+") : [];
  if (!mods.every((m) => MODIFIERS.has(m))) throw new ActionError("Unsupported click modifier");
  return mods;
}

function key(text: unknown) {
  if (typeof text !== "string" || !KEY_PATTERN.test(text)) throw new ActionError("Unsupported key");
  return text;
}

function click(
  input: { coordinate?: unknown; text?: unknown },
  button: keyof typeof BUTTONS,
  repeat = 1,
): Step[] {
  const mods = modifiers(input.text);
  const args = [
    ...mods.flatMap((m) => ["keydown", m]),
    ...(input.coordinate ? ["mousemove", "--sync", ...point(input.coordinate)] : []),
    "click",
    ...(repeat > 1 ? ["--repeat", String(repeat), "--delay", "80"] : []),
    BUTTONS[button],
    ...mods.flatMap((m) => ["keyup", m]),
  ];
  return [{ xdotool: args }];
}

/**
 * Turns one computer tool call into concrete steps. Arguments are passed as an
 * array (never through a shell), and every value is validated first.
 */
export function planAction(action: ComputerAction): Plan {
  const steps = (label: string, list: Step[]): Plan => ({ label, kind: "steps", steps: list });
  const input = action.input as Record<string, unknown>;

  switch (action.name) {
    case "screenshot":
      return { label: "Looking at the screen", kind: "screenshot" };
    case "cursor_position":
      return { label: "Checking the cursor", kind: "cursor_position" };
    case "left_click":
      return steps("Clicking", click(input, "left"));
    case "right_click":
      return steps("Right-clicking", click(input, "right"));
    case "middle_click":
      return steps("Clicking", click(input, "middle"));
    case "double_click":
      return steps("Double-clicking", click(input, "left", 2));
    case "triple_click":
      return steps("Triple-clicking", click(input, "left", 3));
    case "mouse_move":
      return steps("Moving the mouse", [{ xdotool: ["mousemove", "--sync", ...point(input.coordinate)] }]);
    case "left_mouse_down":
      return steps("Pressing the mouse", [{ xdotool: ["mousedown", "1"] }]);
    case "left_mouse_up":
      return steps("Releasing the mouse", [{ xdotool: ["mouseup", "1"] }]);
    case "left_click_drag": {
      const mods = modifiers(input.text);
      return steps("Dragging", [
        {
          xdotool: [
            ...mods.flatMap((m) => ["keydown", m]),
            "mousemove", "--sync", ...point(input.start_coordinate, "start_coordinate"),
            "mousedown", "1",
            "mousemove", "--sync", ...point(input.coordinate),
            "mouseup", "1",
            ...mods.flatMap((m) => ["keyup", m]),
          ],
        },
      ]);
    }
    case "scroll": {
      const { scroll_direction: direction, scroll_amount: amount, coordinate } = input;
      if (typeof direction !== "string" || !Object.hasOwn(SCROLL_BUTTONS, direction)) {
        throw new ActionError("Unsupported scroll direction");
      }
      const clicks = Math.min(Math.max(Math.trunc(Number(amount)) || 1, 1), MAX_SCROLL);
      const mods = modifiers(input.text);
      return steps(`Scrolling ${direction}`, [
        {
          xdotool: [
            ...mods.flatMap((m) => ["keydown", m]),
            ...(coordinate ? ["mousemove", "--sync", ...point(coordinate)] : []),
            "click", "--repeat", String(clicks), "--delay", "30", SCROLL_BUTTONS[direction as keyof typeof SCROLL_BUTTONS],
            ...mods.flatMap((m) => ["keyup", m]),
          ],
        },
      ]);
    }
    case "type": {
      if (typeof input.text !== "string" || input.text.length > MAX_TYPED_CHARS) {
        throw new ActionError(`Text must be at most ${MAX_TYPED_CHARS} characters`);
      }
      // The typed text is deliberately left out of the label: it may be sensitive.
      return steps("Typing", [{ xdotool: ["type", "--delay", "10", "--", input.text] }]);
    }
    case "key": {
      const repeat = Math.min(Math.max(Math.trunc(Number(input.repeat ?? 1)) || 1, 1), 100);
      return steps("Pressing a key", [
        { xdotool: ["key", "--repeat", String(repeat), "--delay", "60", "--", key(input.text)] },
      ]);
    }
    case "hold_key": {
      const seconds = Math.min(Math.max(Number(input.duration) || 0, 0), MAX_WAIT_S);
      const name = key(input.text);
      return steps("Holding a key", [
        { xdotool: ["keydown", "--", name] },
        { sleepMs: seconds * 1000 },
        { xdotool: ["keyup", "--", name] },
      ]);
    }
    case "key_down":
      return steps("Pressing a key", [{ xdotool: ["keydown", "--", key(input.text)] }]);
    case "key_up":
      return steps("Releasing a key", [{ xdotool: ["keyup", "--", key(input.text)] }]);
    case "wait": {
      const seconds = Math.min(Math.max(Number(input.duration) || 0, 0), MAX_WAIT_S);
      return steps("Waiting", [{ sleepMs: seconds * 1000 }]);
    }
    default:
      // zoom is disabled in the request; anything else is unexpected.
      throw new ActionError(`Unsupported action: ${action.name}`);
  }
}
