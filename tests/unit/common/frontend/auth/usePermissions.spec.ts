import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/features/auth/store';

describe('usePermissions', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null } as any);
  });

  it('returns guest permissions when no user', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isGuest).toBe(true);
    expect(result.current.canCreateProjects).toBe(false);
    expect(result.current.canViewPublicGames).toBe(true);
  });

  it('returns user permissions', () => {
    useAuthStore.setState({ token: 't', user: { id: 'u1', email: 'a', role: 'USER', name: 'A' } as any } as any);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.canManageUsers).toBe(false);
    expect(result.current.canPublishGames).toBe(true);
  });

  it('returns admin permissions', () => {
    useAuthStore.setState({ token: 't', user: { id: 'u2', email: 'b', role: 'ADMIN', name: 'B' } as any } as any);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.canManageUsers).toBe(true);
    expect(result.current.canModerateContent).toBe(true);
  });
});


