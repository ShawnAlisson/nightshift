const GENERIC = "The assistant couldn't respond. Please try again.";

/**
 * A message that is safe to show the user for a failed AI provider call. The wording is
 * ours, never the provider's, so nothing internal leaks. Details go to the server log.
 */
export function assistantErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : undefined;

  if (message.includes("starter_credit_tools")) {
    return "Computer use isn't included in Mubit's starter credit. Add your own provider key in the Mubit console to use it.";
  }
  if (status === 402) {
    return "The AI provider doesn't have enough credit available right now. Add credit, or wait a couple of minutes and try again.";
  }
  if (status === 429) return "The AI provider is busy right now. Please try again in a moment.";
  if (status === 401 || status === 403) return "The assistant couldn't sign in to its AI provider. Check the API key.";
  return GENERIC;
}
