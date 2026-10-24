import "server-only";

/** Computer use is on when switched on in the env. Every provider supports it. */
export function isComputerUseEnabled() {
  return process.env.COMPUTER_USE_ENABLED === "true";
}
