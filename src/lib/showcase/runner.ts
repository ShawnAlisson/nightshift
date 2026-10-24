import type { RunnerContext, Step } from "@/lib/showcase/types";

const WORD_MS = 170; // pace of live speech
const STREAM_MS = 38; // pace of the assistant's words appearing
const SPEECH_MS_PER_WORD = 330; // roughly how long a voice takes to read a word
const TYPE_MS = 110; // pace of typing into the search box

function aborted() {
  return new DOMException("Stopped", "AbortError");
}

/** A pause that ends early, with an error, when the run is stopped. `speed` scales every pause (tests use a huge value). */
function pause(ms: number, signal: AbortSignal, speed: number) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(aborted());
    const timer = setTimeout(resolve, ms / speed);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(aborted());
      },
      { once: true },
    );
  });
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);

/** Plays a script against the screen, one step at a time. Rejects with an AbortError when stopped. */
export async function runScript(steps: Step[], ctx: RunnerContext, signal: AbortSignal, speed = 1) {
  const wait = (ms: number) => pause(ms, signal, speed);

  for (const step of steps) {
    if (signal.aborted) throw aborted();

    switch (step.do) {
      case "caption":
        ctx.caption(step.text, step.tags ?? []);
        break;
      case "clearCaption":
        ctx.clearCaption();
        break;
      case "wait":
        await wait(step.ms);
        break;
      case "voice":
        ctx.voice(step.state);
        break;
      case "cards":
        ctx.cards(step.cards);
        break;
      case "tapCard":
        ctx.pressCard(step.id);
        await wait(900);
        ctx.pressCard(undefined);
        ctx.removeCard(step.id);
        break;
      case "user": {
        ctx.voice("listening");
        let spoken = "";
        for (const word of words(step.text)) {
          spoken = spoken ? `${spoken} ${word}` : word;
          ctx.input(spoken);
          await wait(WORD_MS);
        }
        // A short beat of silence, then it is sent on its own.
        await wait(550);
        ctx.input("");
        ctx.user(step.text);
        ctx.voice("thinking");
        break;
      }
      case "send":
        ctx.user(step.text);
        ctx.voice("thinking");
        break;
      case "assistant": {
        const parts = words(step.text);
        ctx.voice("thinking");
        for (const [index, part] of parts.entries()) {
          ctx.assistant(index === 0 ? part : ` ${part}`);
          await wait(STREAM_MS);
        }
        ctx.activity(undefined);
        ctx.replyDone();
        ctx.speak(step.text);
        ctx.voice("speaking");
        // Leave time for the voice to finish before the next thing happens.
        await wait(Math.max(1200, parts.length * SPEECH_MS_PER_WORD));
        ctx.voice(undefined);
        break;
      }
      case "act":
        ctx.activity(step.label);
        if (step.patch) ctx.desktop(step.patch);
        await wait(step.ms ?? 900);
        break;
      case "desktop":
        ctx.desktop(step.patch);
        break;
      case "live":
        ctx.activity(step.label);
        await ctx.live(step.step);
        break;
      case "liveView":
        ctx.liveView(step.show);
        break;
      case "reset":
        ctx.reset();
        break;
      case "palette":
        ctx.palette("open");
        await wait(900);
        for (let end = 1; end <= step.query.length; end++) {
          ctx.palette("type", step.query.slice(0, end));
          await wait(TYPE_MS);
        }
        await wait(2600);
        ctx.palette("close");
        await wait(500);
        break;
      case "save":
        await ctx.save();
        break;
      case "finish":
        ctx.finish();
        break;
    }
  }
}
