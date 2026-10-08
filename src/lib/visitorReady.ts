/**
 * Visitor/session readiness signal.
 *
 * On a first visit the visitor cookie is not available synchronously on mount,
 * because POST /api/visitors has to resolve first. SessionInitializer must
 * therefore wait for VisitorInitializer to finish instead of racing it.
 */

type VisitorState = {
  ready: boolean;
  code?: string;
  error?: unknown;
};

let state: VisitorState = { ready: false };
const listeners = new Set<(next: VisitorState) => void>();

function emit(next: VisitorState) {
  state = next;
  listeners.forEach((listener) => listener(next));
}

export function markVisitorReady(code: string) {
  emit({ ready: true, code });
}

export function markVisitorFailed(error: unknown) {
  emit({ ready: true, error });
}

export function getVisitorState(): VisitorState {
  return state;
}

/**
 * Resolves once the visitor_code cookie is available (or creation failed).
 * Resolves immediately if the cookie already existed on load.
 */
export function whenVisitorReady(): Promise<VisitorState> {
  if (state.ready) return Promise.resolve(state);

  return new Promise((resolve) => {
    listeners.add(resolve);
  });
}