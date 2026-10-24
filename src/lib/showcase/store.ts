// A tiny shared store (not React state) so the search box can start the run from the layout
// while the chat, which may not exist yet, picks it up once it appears.

type State = { pending: boolean; active: boolean };

let state: State = { pending: false, active: false };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

export const showcaseStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getState: () => state,
  /** Ask for a run. The chat starts it as soon as it is on screen. */
  request: () => set({ pending: true }),
  /** The chat claims the request. Returns false if there was none. */
  take() {
    if (!state.pending) return false;
    set({ pending: false });
    return true;
  },
  setActive: (active: boolean) => set({ active }),
};

export const serverState: State = { pending: false, active: false };
