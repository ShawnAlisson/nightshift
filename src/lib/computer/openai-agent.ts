import "server-only";
import type OpenAI from "openai";
import { getModel, requestExtras, type OpenAICompatibleProvider } from "@/lib/ai";
import type { AssistantEvent } from "@/lib/assistant-events";
import { ActionError, planAction, SCREEN } from "@/lib/computer/actions";
import type { DesktopLease } from "@/lib/computer/desktop";
import { MAX_COMPUTER_TURNS } from "@/lib/computer/prompt";
import { mergeToolCallDeltas, parseArguments, type PartialToolCall } from "@/lib/computer/tool-calls";
import type { ChatMessage } from "@/lib/validations/assistant";

// Actions and short answers need little room, and providers reserve this much credit per request.
const MAX_OUTPUT_TOKENS = 2048;
// Older screenshots are replaced with a note so a long task stays affordable.
const KEPT_SCREENSHOTS = 3;

const COORDINATE = {
  type: "array",
  items: { type: "integer" },
  minItems: 2,
  maxItems: 2,
  description: `[x, y] in pixels on the ${SCREEN.width}x${SCREEN.height} screen. (0, 0) is the top-left corner.`,
} as const;

// The same actions as Anthropic's computer toolset, so every provider shares one validated executor.
const COMPUTER_TOOL: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "computer",
    description:
      "Control the desktop with the mouse and keyboard. After your action you receive a fresh screenshot of the screen.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: [
            "screenshot", "left_click", "right_click", "middle_click", "double_click", "triple_click",
            "mouse_move", "left_click_drag", "type", "key", "scroll", "wait", "cursor_position",
          ],
        },
        coordinate: { ...COORDINATE, description: `Where to act. ${COORDINATE.description}` },
        start_coordinate: { ...COORDINATE, description: `Where a drag starts. ${COORDINATE.description}` },
        text: { type: "string", description: 'Text to type, or a key such as "Return" or "ctrl+s" for the key action.' },
        scroll_direction: { type: "string", enum: ["up", "down", "left", "right"] },
        scroll_amount: { type: "integer", description: "Wheel clicks to scroll." },
        duration: { type: "number", description: "Seconds to wait." },
      },
      required: ["action"],
    },
  },
};

const FUNCTION_CALLING_NOTE = `You operate the desktop through the "computer" function. Every coordinate is in pixels on the ${SCREEN.width}x${SCREEN.height} screenshot you are shown, with (0, 0) at the top-left. Look at the latest screenshot carefully before choosing where to click.`;

const screenshotMessage = (image: string): OpenAI.ChatCompletionUserMessageParam => ({
  role: "user",
  content: [
    { type: "text", text: "Screenshot of the screen now." },
    { type: "image_url", image_url: { url: `data:image/png;base64,${image}` } },
  ],
});

/** Swaps all but the newest screenshots for a short note. */
function pruneScreenshots(messages: OpenAI.ChatCompletionMessageParam[]) {
  const shots = messages.filter(
    (m) => m.role === "user" && Array.isArray(m.content) && m.content.some((part) => part.type === "image_url"),
  );
  for (const message of shots.slice(0, -KEPT_SCREENSHOTS)) {
    message.content = "[An earlier screenshot was removed.]";
  }
}

/**
 * Computer-use loop for OpenAI-compatible providers (OpenAI, OpenRouter), using
 * plain function calling. Works with any model that supports tools and images.
 */
export async function* runOpenAIAgent(
  client: OpenAI,
  provider: OpenAICompatibleProvider,
  history: ChatMessage[],
  desktops: DesktopLease,
  signal: AbortSignal,
  system: string,
): AsyncGenerator<AssistantEvent> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: `${system}\n\n${FUNCTION_CALLING_NOTE}` },
    ...history.map(({ role, content }) => ({ role, content })),
  ];
  let spoke = false;

  for (let turn = 0; turn < MAX_COMPUTER_TURNS && !signal.aborted; turn++) {
    // Show that it is the model thinking, not a stuck action, once the first step is done.
    if (turn > 0) yield { type: "action", label: "Thinking" };

    const stream = await client.chat.completions.create(
      {
        model: getModel(provider),
        stream: true,
        messages,
        tools: [COMPUTER_TOOL],
        ...requestExtras(provider, MAX_OUTPUT_TOKENS),
      },
      { signal },
    );

    let text = "";
    const calls: PartialToolCall[] = [];
    let reasoningDetails: unknown[] = [];
    let separate = spoke;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta as
        | (OpenAI.ChatCompletionChunk.Choice.Delta & { reasoning_details?: unknown[] })
        | undefined;
      if (!delta) continue;
      if (delta.content) {
        text += delta.content;
        yield { type: "text", text: separate ? `\n\n${delta.content}` : delta.content };
        separate = false;
        spoke = true;
      }
      if (delta.tool_calls) mergeToolCallDeltas(calls, delta.tool_calls);
      // Some providers attach reasoning that must be returned with the next request.
      if (delta.reasoning_details) reasoningDetails = reasoningDetails.concat(delta.reasoning_details);
    }

    const toolCalls = calls.filter((call) => call.name === "computer");
    if (toolCalls.length === 0) return;

    messages.push({
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: { name: call.name, arguments: call.arguments },
        ...(call.extra !== undefined && { extra_content: call.extra }),
      })),
      ...(reasoningDetails.length > 0 && { reasoning_details: reasoningDetails }),
    } as OpenAI.ChatCompletionAssistantMessageParam);

    let failed = false;
    let acted = false;
    for (const call of toolCalls) {
      if (failed) {
        messages.push({ role: "tool", tool_call_id: call.id, content: "Not executed: an earlier action in this turn failed." });
        continue;
      }
      try {
        const { action, ...input } = parseArguments(call.arguments);
        if (typeof action !== "string") throw new ActionError("Missing action");
        const computerAction = { name: action, input };
        const label = planAction(computerAction).label;

        const { desktop, created } = await desktops.acquire();
        if (created) yield { type: "desktop", url: desktop.viewUrl };
        yield { type: "action", label };

        const result = await desktop.perform(computerAction);
        acted = true;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: "text" in result ? result.text : "Done. The screenshot follows.",
        });
      } catch (error) {
        failed = true;
        if (!(error instanceof ActionError)) console.error("computer action failed", error);
        const reason = error instanceof ActionError ? error.message : "The desktop action failed";
        messages.push({ role: "tool", tool_call_id: call.id, content: `Error: ${reason}` });
      }
    }

    // Tool messages are text only, so the screenshot comes as the next user message.
    if (acted) {
      try {
        const { desktop } = await desktops.acquire();
        const shot = await desktop.perform({ name: "screenshot", input: {} });
        if ("image" in shot) messages.push(screenshotMessage(shot.image));
      } catch (error) {
        console.error("screenshot failed", error);
      }
    }
    pruneScreenshots(messages);
  }

  if (!signal.aborted) {
    yield { type: "text", text: "\n\nI stopped because this task is taking too many steps. Tell me how to continue." };
  }
}
