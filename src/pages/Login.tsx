import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { Progress } from '@/components/ui/progress';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore(s => s.login);
  const register = useAuthStore(s => (s as any).register as (email: string, password: string) => Promise<void>);

  const validate = (): string | null => {
    if (!email || !password) return 'Uzupełnij oba pola.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Podaj poprawny adres e‑mail.';
    if (password.length < 6) return 'Hasło musi mieć co najmniej 6 znaków.';
    return null;
  };

  const onEmailChange = (v: string) => {
    setEmail(v);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!v) setEmailError('Email jest wymagany.');
    else if (!emailRegex.test(v)) setEmailError('Podaj poprawny adres e‑mail.');
    else setEmailError(null);
  };

  const onPasswordChange = (v: string) => {
    setPassword(v);
    if (!v) setPasswordError('Hasło jest wymagane.');
    else if (v.length < 6) setPasswordError('Hasło musi mieć co najmniej 6 znaków.');
    else setPasswordError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.message || (mode === 'login' ? 'Logowanie nieudane. Spróbuj ponownie później.' : 'Rejestracja nieudana. Spróbuj ponownie później.'));
    } finally {
      setLoading(false);
    }
  };

  const scorePassword = (pwd: string): number => {
    let score = 0;
    if (!pwd) return 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 20;
    if (/[a-z]/.test(pwd)) score += 20;
    if (/\d/.test(pwd)) score += 20;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 15;
    return Math.min(100, score);
  };

  const passScore = scorePassword(password);

  return (
    <div className="min-h-screen w-full grid md:grid-cols-2 bg-gradient-to-br from-background to-muted">
      <div className="hidden md:flex items-center justify-center p-8 bg-[url('/assets/hero-scene.jpg')] bg-cover bg-center relative">
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-md text-center text-white space-y-4">
          <h1 className="text-3xl font-bold">Zbuduj swoją grę szybciej</h1>
          <p className="text-white/80">Dołącz do twórców, którzy w minutę tworzą prototypy i publikują gry. Zacznij za darmo — bez karty.</p>
          <div className="flex items-center justify-center gap-2 text-sm text-white/70">
            <span>🔒 Bezpieczne logowanie</span>
            <span>•</span>
            <span>⚡️ Szybki start</span>
            <span>•</span>
            <span>💾 Auto‑zapis</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md p-6 space-y-5 bg-card/95 backdrop-blur-sm border-border shadow-xl">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-foreground">{mode === 'login' ? 'Zaloguj się' : 'Stwórz konto'}</h2>
            <p className="text-sm text-muted-foreground">Uzyskaj dostęp do swojego studia tworzenia gier.</p>
          </div>
          <form className="space-y-5" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => onEmailChange(e.target.value)} aria-invalid={!!emailError} />
              {emailError && <div className="text-xs text-destructive">{emailError}</div>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} className="pr-10" placeholder="••••••••" value={password} onChange={(e) => onPasswordChange(e.target.value)} aria-invalid={!!passwordError} />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && <div className="text-xs text-destructive">{passwordError}</div>}
              {mode === 'register' && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Siła hasła</span>
                    <span>{passScore}%</span>
                  </div>
                  <Progress value={passScore} />
                </div>
              )}
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading || !!emailError || !!passwordError}>
              {loading ? (mode === 'login' ? 'Logowanie…' : 'Tworzenie konta…') : (mode === 'login' ? 'Zaloguj się' : 'Załóż konto')}
            </Button>
            <div className="text-xs text-muted-foreground text-center">
              {mode === 'login' ? (
                <button type="button" className="underline" onClick={() => setMode('register')}>Nie masz konta? Załóż je teraz</button>
              ) : (
                <button type="button" className="underline" onClick={() => setMode('login')}>Masz już konto? Zaloguj się</button>
              )}
            </div>
            <div className="text-xs text-muted-foreground text-center">Twoje dane są bezpieczne. Możesz zrezygnować w każdej chwili.</div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;