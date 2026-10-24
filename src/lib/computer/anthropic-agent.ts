import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, getModel } from "@/lib/ai";
import type { AssistantEvent } from "@/lib/assistant-events";
import { ActionError, planAction } from "@/lib/computer/actions";
import type { DesktopLease } from "@/lib/computer/desktop";
import { MAX_COMPUTER_TURNS } from "@/lib/computer/prompt";
import type { ChatMessage } from "@/lib/validations/assistant";

const MAX_OUTPUT_TOKENS = 4096;

type ComputerCall = Anthropic.ComputerToolUseBlock;

const isComputerCall = (block: Anthropic.ContentBlock): block is ComputerCall & Anthropic.ContentBlock =>
  block.type === "tool_use" && "toolset_name" in block && block.toolset_name === "computer";

const toolResult = (
  id: string,
  content: Anthropic.ToolResultBlockParam["content"],
  isError = false,
): Anthropic.ToolResultBlockParam => ({
  type: "tool_result",
  tool_use_id: id,
  toolset_name: "computer",
  content,
  ...(isError && { is_error: true }),
});

/** Computer-use loop on Anthropic's computer toolset (computer_toolset_20260801). */
export async function* runAnthropicAgent(
  history: ChatMessage[],
  desktops: DesktopLease,
  signal: AbortSignal,
  system: string,
): AsyncGenerator<AssistantEvent> {
  const client = getAnthropicClient();
  const messages: Anthropic.MessageParam[] = history.map(({ role, content }) => ({ role, content }));
  let spoke = false;

  for (let turn = 0; turn < MAX_COMPUTER_TURNS && !signal.aborted; turn++) {
    // Show that it is the model thinking, not a stuck action, once the first step is done.
    if (turn > 0) yield { type: "action", label: "Thinking" };

    const stream = client.messages.stream(
      {
        model: getModel("anthropic"),
        max_tokens: MAX_OUTPUT_TOKENS,
        system,
        // Zoom needs image processing the desktop does not provide, so it is turned off.
        tools: [{ type: "computer_toolset_20260801", configs: { zoom: { enabled: false } } }],
        messages,
      },
      { signal },
    );

    let separate = spoke;
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        // Keep text from different turns apart.
        yield { type: "text", text: separate ? `\n\n${event.delta.text}` : event.delta.text };
        separate = false;
        spoke = true;
      }
    }

    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      yield { type: "text", text: "I can't help with that request." };
      return;
    }

    const calls = message.content.filter(isComputerCall);
    if (message.stop_reason !== "tool_use" || calls.length === 0) return;

    // Thinking blocks and tool calls must go back exactly as received.
    messages.push({ role: "assistant", content: message.content });

    const results: Anthropic.ToolResultBlockParam[] = [];
    let failed = false;
    for (const call of calls) {
      if (failed) {
        results.push(toolResult(call.id, "Not executed: an earlier computer action in this turn failed.", true));
        continue;
      }
      try {
        const label = planAction(call).label;
        const { desktop, created } = await desktops.acquire();
        if (created) yield { type: "desktop", url: desktop.viewUrl };
        yield { type: "action", label };

        const result = await desktop.perform(call);
        results.push(
          toolResult(
            call.id,
            "image" in result
              ? [{ type: "image", source: { type: "base64", media_type: "image/png", data: result.image } }]
              : result.text,
          ),
        );
      } catch (error) {
        failed = true;
        // Model-facing: expected action errors are explained, anything else stays generic.
        if (!(error instanceof ActionError)) console.error("computer action failed", error);
        const reason = error instanceof ActionError ? error.message : "The desktop action failed";
        results.push(toolResult(call.id, `Error: ${reason}`, true));
      }
    }
    messages.push({ role: "user", content: results });
  }

  if (!signal.aborted) {
    yield { type: "text", text: "\n\nI stopped because this task is taking too many steps. Tell me how to continue." };
  }
}
