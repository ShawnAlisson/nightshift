// The names of the live walkthrough's steps. Shared by the server, which runs them, and the
// browser, which asks for them by name.
export const LIVE_STEPS = ["prepare", "open", "accept-cookies", "enter-address", "pick-address", "grocery", "login", "cleanup"] as const;
export type LiveStep = (typeof LIVE_STEPS)[number];
