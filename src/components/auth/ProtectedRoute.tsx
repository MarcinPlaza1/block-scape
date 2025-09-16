import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, User } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  requireRole?: 'USER' | 'MODERATOR' | 'ADMIN';
  requireAnyRole?: Array<'USER' | 'MODERATOR' | 'ADMIN'>;
  fallbackMessage?: string;
}

const ProtectedRoute = ({ 
  children, 
  requireAuth = true, 
  redirectTo = '/login',
  requireRole,
  requireAnyRole,
  fallbackMessage 
}: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const { user, token, loading, fetchMe } = useAuthStore();

  useEffect(() => {
    // Try to fetch user data if we have token but no user
    if (token && !user && !loading) {
      fetchMe();
    }
  }, [token, user, loading, fetchMe]);

  // Show loading while checking auth status
  if (loading || (token && !user)) {
    return (
      <div className="min-h-screen w-full bg-gradient-bg flex items-center justify-center">
        <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl p-8">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Sprawdzanie uprawnień...</span>
          </div>
        </Card>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !user) {
    return (
      <div className="min-h-screen w-full bg-gradient-bg flex items-center justify-center">
        <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl p-8 max-w-md">
          <div className="text-center space-y-4">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Wymagane logowanie</h2>
            <p className="text-sm text-muted-foreground">
              {fallbackMessage || 'Musisz się zalogować, aby uzyskać dostęp do tej strony.'}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="flex-1"
              >
                Strona główna
              </Button>
              <Button 
                onClick={() => navigate(redirectTo)}
                className="flex-1"
              >
                Zaloguj się
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Check role requirement
  if (requireRole && user && user.role !== requireRole) {
    return (
      <div className="min-h-screen w-full bg-gradient-bg flex items-center justify-center">
        <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl p-8 max-w-md">
          <div className="text-center space-y-4">
            <User className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Brak uprawnień</h2>
            <p className="text-sm text-muted-foreground">
              Nie masz wystarczających uprawnień do tej strony.
            </p>
            <Button onClick={() => navigate('/')}>
              Wróć do strony głównej
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Check any-of roles requirement
  if (requireAnyRole && user && !requireAnyRole.includes(user.role as any)) {
    return (
      <div className="min-h-screen w-full bg-gradient-bg flex items-center justify-center">
        <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl p-8 max-w-md">
          <div className="text-center space-y-4">
            <User className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Brak uprawnień</h2>
            <p className="text-sm text-muted-foreground">
              Nie masz wystarczających uprawnień do tej strony.
            </p>
            <Button onClick={() => navigate('/') }>
              Wróć do strony głównej
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
