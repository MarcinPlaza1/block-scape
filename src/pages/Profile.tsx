import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import Navbar from '@/components/Navbar';

const Profile = () => {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const fetchMe = useAuthStore(s => s.fetchMe);
  const updateProfile = useAuthStore(s => (s as any).updateProfile as (p: { name?: string; avatarUrl?: string | null }) => Promise<void>);
  const deleteAccount = useAuthStore(s => (s as any).deleteAccount as () => Promise<void>);
  const loading = useAuthStore(s => s.loading);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [logins, setLogins] = useState<Array<{ id: string; action: string; createdAt: string }>>([]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    if (!user) fetchMe();
    // load security/permissions
    Promise.all([
      apiFetch<{ role: string; permissions: string[] }>(`/users/me/permissions`).catch(() => ({ role: user?.role || 'USER', permissions: [] } as any)),
      apiFetch<{ logs: any[] }>(`/users/me/logins`).catch(() => ({ logs: [] } as any)),
    ]).then(([perm, logs]) => {
      if (perm) { setRole((perm as any).role || 'USER'); setPermissions((perm as any).permissions || []); }
      if (logs?.logs) setLogins(logs.logs as any);
    });
  }, [token]);

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (user?.avatarUrl) setAvatarPreview(user.avatarUrl);
  }, [user?.name]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({ name, avatarUrl: avatarPreview ?? null });
      toast({ title: 'Zaktualizowano profil', description: 'Nazwa wyświetlana została zapisana.' });
    } catch (e: any) {
      toast({ title: 'Aktualizacja nieudana', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const onRemoveAvatar = () => {
    setAvatarPreview(null);
  };

  const onDeleteAccount = async () => {
    if (!confirm('To usunie Twoje konto i wszystkie gry. Kontynuować?')) return;
    try {
      await deleteAccount();
      navigate('/login');
    } catch (e: any) {
      toast({ title: 'Usuwanie nieudane', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
    }
  };

  // removed devices management (sessions) from profile for privacy

  const ChangePasswordForm = () => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const onChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 6) {
        toast({ title: 'Hasło zbyt krótkie', description: 'Co najmniej 6 znaków.', variant: 'destructive' });
        return;
      }
      setSaving(true);
      try {
        await apiFetch(`/users/me/password`, { method: 'POST', body: JSON.stringify({ oldPassword, newPassword }) });
        setOldPassword('');
        setNewPassword('');
        toast({ title: 'Hasło zmienione', description: 'Zalogowano ponownie bieżącą sesję.' });
      } catch (e: any) {
        toast({ title: 'Zmiana hasła nie powiodła się', description: e?.message || 'Spróbuj ponownie.', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    };
    return (
      <form className="space-y-2" onSubmit={onChangePassword}>
        <Input type="password" placeholder="Stare hasło" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
        <Input type="password" placeholder="Nowe hasło" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" type="submit" disabled={saving}>{saving ? 'Zapisywanie…' : 'Zmień hasło'}</Button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background to-muted">
      <Navbar />
      <div className="grid md:grid-cols-2">
      <div className="hidden md:flex items-center justify-center p-8 bg-[url('/assets/hero-scene.jpg')] bg-cover bg-center relative">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-md text-center text-white space-y-4">
          <h1 className="text-3xl font-bold">Twój profil, Twoje studio <span className="inline-block align-middle h-2 w-2 rounded-full ml-2" style={{ backgroundColor: 'hsl(var(--brand-build))' }} /></h1>
          <p className="text-white/80">Personalizuj konto, ustaw avatar i nazwę wyświetlaną. Bądź rozpoznawalny w społeczności twórców.</p>
          <div className="flex items-center justify-center gap-2 text-sm text-white/70">
            <span>🧱 Projekty</span>
            <span>•</span>
            <span>🤝 Współpraca</span>
            <span>•</span>
            <span>🚀 Publikacje</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10 overflow-y-auto max-h-screen">
        <Card className="w-full max-w-2xl p-6 space-y-6 bg-card/95 backdrop-blur-sm border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Ustawienia konta</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-8" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label>Avatar</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16">
                      {avatarPreview ? (
                        <AvatarImage src={avatarPreview} alt="avatar" />
                      ) : (
                        <AvatarFallback>{(user?.name || 'U')[0]}</AvatarFallback>
                      )}
                    </Avatar>
                    <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 cursor-pointer rounded-full bg-primary text-primary-foreground p-2 shadow-lg">
                      <Camera size={14} />
                    </label>
                    <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
                  </div>
                  <Button type="button" variant="ghost" onClick={onRemoveAvatar} disabled={!avatarPreview}>
                    <Trash2 className="mr-2 h-4 w-4" /> Usuń
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nazwa wyświetlana</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>Wstecz</Button>
                <Button type="submit" disabled={loading} className="shadow-glow">Zapisz</Button>
              </div>
              <div className="grid md:grid-cols-2 gap-6 pt-6 border-t">
                <div className="space-y-3">
                  <h3 className="font-medium">Rola i uprawnienia</h3>
                  <div className="text-sm text-muted-foreground">Twoja rola: <span className="font-medium text-foreground">{role || user?.role || 'USER'}</span></div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {permissions.length ? permissions.map((p, i) => (
                      <li key={i}>{p}</li>
                    )) : (
                      <li>Tworzenie i edycja własnych gier</li>
                    )}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="font-medium">Bezpieczeństwo</h3>
                  <div className="space-y-2 text-sm">
                    <div className="text-muted-foreground">Zmiana hasła</div>
                    <ChangePasswordForm />
                  </div>
                </div>
              </div>
              <div className="grid md:grid-cols-1 gap-6">
                <div className="space-y-3">
                  <h3 className="font-medium">Ostatnia aktywność</h3>
                  <div className="space-y-2">
                    {logins.length === 0 && <div className="text-sm text-muted-foreground">Brak danych.</div>}
                    {logins.map(l => (
                      <div key={l.id} className="rounded-md border p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{l.action}</span>
                          <span className="text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</span>
                        </div>
                        {/* IP and device details removed for privacy */}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t mt-2">
                <Button type="button" variant="destructive" onClick={onDeleteAccount}>Usuń konto</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default Profile;
