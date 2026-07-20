import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Dumbbell, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error(t('login.fillAllFields'));
      return;
    }

    setIsLoading(true);
    const result = await login(username.trim(), password);
    setIsLoading(false);

    if (result.success) {
      toast.success(t('login.success'));
      navigate(from, { replace: true });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
              boxShadow: '0 8px 30px var(--theme-primary-glow)',
            }}
          >
            <Dumbbell className="w-8 h-8 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight font-['Outfit']">
            {t('common:app.brand')}
          </h1>
          <p className="text-zinc-500 text-sm mt-2">{t('login.tagline')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-zinc-400 text-sm">
              {t('login.username')}
            </Label>
            <Input
              id="username"
              data-testid="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tonpseudo"
              className="h-14 rounded-xl bg-[#141414] border-white/10 text-white placeholder:text-zinc-600 focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)]"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-400 text-sm">
              {t('login.password')}
            </Label>
            <div className="relative">
              <Input
                id="password"
                data-testid="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 rounded-xl bg-[#141414] border-white/10 text-white placeholder:text-zinc-600 focus:border-[var(--theme-primary)] focus:ring-1 focus:ring-[var(--theme-primary)] pr-12"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            data-testid="login-submit"
            disabled={isLoading}
            className="w-full h-14 rounded-xl font-bold text-white btn-primary"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('login.submit')
            )}
          </Button>
        </form>

        <p className="text-center mt-8 text-zinc-500 text-sm">
          {t('login.noAccount')}{' '}
          <Link
            to="/register"
            data-testid="register-link"
            className="text-[var(--theme-primary)] hover:underline font-medium"
          >
            {t('login.createAccount')}
          </Link>
        </p>
      </div>
    </div>
  );
}
