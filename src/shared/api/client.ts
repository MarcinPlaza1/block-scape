export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

let inMemoryAccessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function getAuthToken(): string | null {
  return inMemoryAccessToken;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as any),
  };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include", // for refresh cookie
  });

  // Attempt auto-refresh on 401 (even without a token to support bootstrap on reload)
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as any),
      };
      const newToken = getAuthToken();
      if (newToken) retryHeaders.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: retryHeaders,
        credentials: "include",
      });
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return res.json();
}

export async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.token) {
        setAuth(data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function setAuth(token: string, email?: string) {
  inMemoryAccessToken = token;
  if (email) localStorage.setItem("auth-email", email);
}

export function clearAuth() {
  inMemoryAccessToken = null;
  localStorage.removeItem("auth-email");
  localStorage.removeItem("auth-username");
}


