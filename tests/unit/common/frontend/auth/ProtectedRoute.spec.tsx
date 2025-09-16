import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/features/auth/store';

function renderWithRouter(ui: any) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, loading: false } as any);
  });

  it('shows login required message when not authenticated', () => {
    renderWithRouter(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Wymagane logowanie')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    useAuthStore.setState({ token: 't', user: { id: 'u', email: 'x', role: 'USER', name: 'U' } as any } as any);
    renderWithRouter(
      <ProtectedRoute>
        <div>Secret</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('blocks when role does not match', () => {
    useAuthStore.setState({ token: 't', user: { id: 'u', email: 'x', role: 'USER', name: 'U' } as any } as any);
    renderWithRouter(
      <ProtectedRoute requireRole="ADMIN">
        <div>Admin Only</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Brak uprawnień')).toBeInTheDocument();
  });

  it('allows when any-of roles includes user role', () => {
    useAuthStore.setState({ token: 't', user: { id: 'u', email: 'x', role: 'MODERATOR', name: 'M' } as any } as any);
    renderWithRouter(
      <ProtectedRoute requireAnyRole={["ADMIN","MODERATOR"]}>
        <div>Staff</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Staff')).toBeInTheDocument();
  });
});


