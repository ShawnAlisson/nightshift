import { ActionError, SCREEN, type ComputerAction } from "@/lib/computer/actions";

// Gemini's key names -> X11 keysyms (xdotool). Unlisted names pass through unchanged.
const KEYSYMS: Record<string, string> = {
  enter: "Return", return: "Return", escape: "Escape", esc: "Escape", backspace: "BackSpace",
  delete: "Delete", tab: "Tab", space: "space", " ": "space", insert: "Insert",
  arrowup: "Up", arrowdown: "Down", arrowleft: "Left", arrowright: "Right",
  pageup: "Prior", pagedown: "Next", home: "Home", end: "End",
  control: "ctrl", ctrl: "ctrl", shift: "shift", alt: "alt",
  meta: "super", command: "super", cmd: "super", super: "super",
};

const PIXELS_PER_WHEEL_CLICK = 100;
const keysym = (name: unknown) => {
  if (typeof name !== "string") throw new ActionError("Unsupported key");
  return KEYSYMS[name.toLowerCase()] ?? name;
};

/** Gemini coordinates are integers in 0-999 on both axes, whatever the screen size. */
function toPixels(x: unknown, y: unknown): [number, number] {
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) throw new ActionError("Missing coordinates");
  return [
    Math.min(Math.round((nx / 1000) * SCREEN.width), SCREEN.width - 1),
    Math.min(Math.round((ny / 1000) * SCREEN.height), SCREEN.height - 1),
  ];
}

const at = (args: Record<string, unknown>, name: string) => {
  const coordinate = toPixels(args.x, args.y);
  return { name, input: { coordinate } };
};

/**
 * Translates one Gemini computer-use function call into one or more neutral
 * actions. Several Gemini actions are a short sequence in X11 terms.
 */
export function fromGeminiCall(name: string, args: Record<string, unknown>): ComputerAction[] {
  switch (name) {
    case "take_screenshot":
      return [{ name: "screenshot", input: {} }];
    case "click":
      return [at(args, "left_click")];
    case "double_click":
    case "triple_click":
    case "middle_click":
    case "right_click":
      return [at(args, name)];
    case "move":
      return [at(args, "mouse_move")];
    case "mouse_down":
      return [at(args, "mouse_move"), { name: "left_mouse_down", input: {} }];
    case "mouse_up":
      return [at(args, "mouse_move"), { name: "left_mouse_up", input: {} }];
    case "type":
      return [
        { name: "type", input: { text: args.text } },
        ...(args.press_enter === true ? [{ name: "key", input: { text: "Return" } }] : []),
      ];
    case "press_key":
      return [{ name: "key", input: { text: keysym(args.key) } }];
    case "key_down":
    case "key_up":
      return [{ name, input: { text: keysym(args.key) } }];
    case "hotkey": {
      if (!Array.isArray(args.keys) || args.keys.length === 0) throw new ActionError("Missing keys");
      return [{ name: "key", input: { text: args.keys.map(keysym).join("+") } }];
    }
    case "drag_and_drop":
      return [
        {
          name: "left_click_drag",
          input: {
            start_coordinate: toPixels(args.start_x, args.start_y),
            coordinate: toPixels(args.end_x, args.end_y),
          },
        },
      ];
    case "scroll": {
      const magnitude = Number(args.magnitude_in_pixels ?? 300);
      return [
        {
          name: "scroll",
          input: {
            ...(args.x != null && args.y != null && { coordinate: toPixels(args.x, args.y) }),
            scroll_direction: args.direction,
            scroll_amount: Math.max(1, Math.round(magnitude / PIXELS_PER_WHEEL_CLICK)),
          },
        },
      ];
    }
    case "wait":
      return [{ name: "wait", input: { duration: Number(args.seconds ?? 1) } }];
    case "go_back":
      return [{ name: "key", input: { text: "alt+Left" } }];
    case "go_forward":
      return [{ name: "key", input: { text: "alt+Right" } }];
    case "navigate": {
      if (typeof args.url !== "string" || !/^https?:\/\//i.test(args.url)) {
        throw new ActionError("Only http(s) URLs can be opened");
      }
      return [
        { name: "key", input: { text: "ctrl+l" } },
        { name: "type", input: { text: args.url } },
        { name: "key", input: { text: "Return" } },
      ];
    }
    default:
      throw new ActionError(`Unsupported action: ${name}`);
  }
}
