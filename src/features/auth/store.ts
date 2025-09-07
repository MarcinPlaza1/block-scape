import { create } from 'zustand';
import { apiFetch, clearAuth as clearAuthLocal, setAuth as setAuthLocal, getAuthToken, API_BASE, tryRefreshToken } from '@/shared/api/client';

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => void;
  updateProfile: (payload: { name?: string; avatarUrl?: string | null }) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: getAuthToken(),
  loading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{ token: string; user: User }>(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthLocal(data.token, data.user.email);
      set({ token: data.token, user: data.user, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Login failed', loading: false });
      throw e;
    }
  },

  register: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const name = email.split('@')[0] || 'User';
      const data = await apiFetch<{ token: string; user: User }>(`/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
      setAuthLocal(data.token, data.user.email);
      set({ token: data.token, user: data.user, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Registration failed', loading: false });
      throw e;
    }
  },

  fetchMe: async () => {
    let token = get().token || getAuthToken();
    if (!token) {
      try {
        const refreshed = await tryRefreshToken();
        if (refreshed) token = getAuthToken();
      } catch {}
      if (!token) return;
    }
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{ user: User }>(`/users/me`);
      set({ user: data.user, token, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Session fetch failed', loading: false });
    }
  },

  logout: () => {
    // Best-effort server logout to revoke refresh session
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
    clearAuthLocal();
    set({ user: null, token: null });
  },

  updateProfile: async ({ name, avatarUrl }) => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<{ user: User }>(`/users/me`, {
        method: 'PUT',
        body: JSON.stringify({ ...(typeof name !== 'undefined' ? { name } : {}), ...(typeof avatarUrl !== 'undefined' ? { avatarUrl } : {}) }),
      });
      set({ user: data.user, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Update failed', loading: false });
      throw e;
    }
  },

  deleteAccount: async () => {
    set({ loading: true, error: null });
    try {
      await apiFetch(`/users/me`, { method: 'DELETE' });
      clearAuthLocal();
      set({ user: null, token: null, loading: false });
    } catch (e: any) {
      set({ error: e?.message || 'Delete failed', loading: false });
      throw e;
    }
  },
}));


