const STORAGE_KEY = "anon_id";

function fallbackId(): string {
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateClientAnonId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const created = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export function withAnonHeaders(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers || {});
  const anonId = getOrCreateClientAnonId();

  if (anonId) {
    headers.set("x-anon-id", anonId);
  }

  return {
    ...init,
    headers,
    credentials: "include",
  };
}

export function fetchWithAnon(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, withAnonHeaders(init));
}
