import "server-only";
import { Environment, type Content, type Part } from "@google/genai";
import { getGeminiClient, getModel } from "@/lib/ai";
import type { AssistantEvent } from "@/lib/assistant-events";
import { ActionError, planAction } from "@/lib/computer/actions";
import type { DesktopLease, PerformResult } from "@/lib/computer/desktop";
import { fromGeminiCall } from "@/lib/computer/gemini-actions";
import { COMPUTER_SYSTEM_PROMPT, MAX_COMPUTER_TURNS } from "@/lib/computer/prompt";
import type { ChatMessage } from "@/lib/validations/assistant";

const MAX_OUTPUT_TOKENS = 4096;

type SafetyDecision = { decision?: string; explanation?: string };

/** Computer-use loop on Gemini's computer_use tool, running against the desktop environment. */
export async function* runGeminiAgent(
  history: ChatMessage[],
  desktops: DesktopLease,
  signal: AbortSignal,
): AsyncGenerator<AssistantEvent> {
  const client = getGeminiClient();
  const contents: Content[] = history.map(({ role, content }) => ({
    role: role === "assistant" ? "model" : "user",
    parts: [{ text: content }],
  }));
  let spoke = false;

  for (let turn = 0; turn < MAX_COMPUTER_TURNS && !signal.aborted; turn++) {
    const stream = await client.models.generateContentStream({
      model: getModel("gemini"),
      contents,
      config: {
        systemInstruction: COMPUTER_SYSTEM_PROMPT,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: signal,
        tools: [
          {
            computerUse: {
              environment: Environment.ENVIRONMENT_DESKTOP,
              enablePromptInjectionDetection: true,
            },
          },
        ],
      },
    });

    const parts: Part[] = [];
    let separate = spoke;
    for await (const chunk of stream) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        parts.push(part);
        if (part.text && !part.thought) {
          yield { type: "text", text: separate ? `\n\n${part.text}` : part.text };
          separate = false;
          spoke = true;
        }
      }
    }

    const calls = parts.filter((part) => part.functionCall);
    if (calls.length === 0) return;

    // Echo the model's turn back untouched (this preserves its thought signatures).
    contents.push({ role: "model", parts });

    const responses: Part[] = [];
    for (const { functionCall } of calls) {
      const name = functionCall?.name ?? "";
      const args = (functionCall?.args ?? {}) as Record<string, unknown>;

      // Gemini flags risky steps itself. We never auto-approve them: the user finishes those by hand.
      const safety = args.safety_decision as SafetyDecision | undefined;
      if (safety?.decision === "require_confirmation" || safety?.decision === "blocked") {
        const what = safety.explanation ? `: ${safety.explanation}` : ".";
        yield {
          type: "text",
          text: `${spoke ? "\n\n" : ""}I stopped before a step that needs your approval${what} Please complete that step yourself in the desktop view, then tell me to continue.`,
        };
        return;
      }

      let result: PerformResult;
      try {
        const actions = fromGeminiCall(name, args);
        const { desktop, created } = await desktops.acquire();
        if (created) yield { type: "desktop", url: desktop.viewUrl };
        yield { type: "action", label: planAction(actions[0]).label };

        for (const action of actions) await desktop.perform(action);
        // Gemini expects a fresh screenshot back after every action.
        result = await desktop.perform({ name: "screenshot", input: {} });
      } catch (error) {
        if (!(error instanceof ActionError)) console.error("computer action failed", error);
        const reason = error instanceof ActionError ? error.message : "The desktop action failed";
        responses.push({ functionResponse: { id: functionCall?.id, name, response: { error: reason } } });
        continue;
      }

      responses.push({
        functionResponse: {
          id: functionCall?.id,
          name,
          response: { status: "ok" },
          parts: "image" in result ? [{ inlineData: { mimeType: "image/png", data: result.image } }] : [],
        },
      });
    }
    contents.push({ role: "user", parts: responses });
  }

  if (!signal.aborted) {
    yield { type: "text", text: "\n\nI stopped because this task is taking too many steps. Tell me how to continue." };
  }
}
