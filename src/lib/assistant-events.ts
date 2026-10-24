/** What the assistant stream sends to the browser, one JSON object per line. */
export type AssistantEvent =
  | { type: "text"; text: string }
  /** A computer action the assistant is performing, safe to show to the user. */
  | { type: "action"; label: string }
  /** The live desktop is ready to view. */
  | { type: "desktop"; url: string }
  /** The reply failed part-way. Sent in the stream, because the response has already started. */
  | { type: "error"; message: string };
