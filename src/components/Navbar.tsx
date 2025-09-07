import { Button } from '@/components/ui/button';
import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/store';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const isActive = (match: (p: string) => boolean) => match(path);

  return (
    <div className="w-full bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">Block‑Scape Studio</div>
        <div className="flex items-center gap-1">
          <Button
            variant={isActive(p => p === '/' ) ? 'default' : 'ghost'}
            onClick={() => navigate('/')}
            className={isActive(p => p === '/') ? 'relative after:absolute after:inset-x-2 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-primary' : ''}
          >
            Gry
          </Button>
          <Button
            variant={isActive(p => p.startsWith('/games')) ? 'default' : 'ghost'}
            onClick={() => navigate('/games')}
            className={isActive(p => p.startsWith('/games')) ? 'relative after:absolute after:inset-x-2 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-primary' : ''}
          >
            Projekty
          </Button>
          <Button
            variant={isActive(p => p.startsWith('/marketplace')) ? 'default' : 'ghost'}
            onClick={() => navigate('/marketplace')}
            className={isActive(p => p.startsWith('/marketplace')) ? 'relative after:absolute after:inset-x-2 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-[hsl(var(--brand-market))]' : ''}
          >
            Rynek
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={isActive(p => p.startsWith('/profile')) ? 'default' : 'ghost'} className={`gap-2 max-w-[200px] ${isActive(p => p.startsWith('/profile')) ? 'relative after:absolute after:inset-x-2 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-accent' : ''}`}>
                <Avatar className="h-5 w-5">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                  ) : (
                    <AvatarFallback>{(user?.name || 'U')[0]}</AvatarFallback>
                  )}
                </Avatar>
                <span className="truncate">{user?.name || user?.email || 'Profil'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/profile')}>Profil</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { logout(); navigate('/login'); }}>Wyloguj</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant={isActive(p => p.startsWith('/news')) ? 'default' : 'ghost'}
            onClick={() => navigate('/news')}
            className={isActive(p => p.startsWith('/news')) ? 'relative after:absolute after:inset-x-2 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-[hsl(var(--brand-news))]' : ''}
          >
            Aktualności
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Navbar;


