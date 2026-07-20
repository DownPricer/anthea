import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Loader2, Dumbbell, Eye, EyeOff, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

const FITNESS_LEVEL_KEYS = ['beginner', 'intermediate', 'advanced', 'expert'];
const GOAL_KEYS = ['lose_weight', 'gain_muscle', 'stay_fit', 'improve_endurance', 'flexibility'];

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common']);
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('beginner');
  const [mainGoal, setMainGoal] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleStep1 = (e) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error(t('register.errors.usernameRequired'));
      return;
    }
    if (username.length < 3) {
      toast.error(t('register.errors.usernameMin'));
      return;
    }
    if (!password) {
      toast.error(t('register.errors.passwordRequired'));
      return;
    }
    if (password.length < 6) {
      toast.error(t('register.errors.passwordMin'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('register.errors.passwordMismatch'));
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsLoading(true);
    const result = await register({
      username: username.trim().toLowerCase(),
      password,
      display_name: displayName.trim() || username.trim(),
      gender: gender || null,
      fitness_level: fitnessLevel,
      main_goal: mainGoal || null,
    });
    setIsLoading(false);

    if (result.success) {
      toast.success(t('register.success'));
      navigate('/');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
            style={{
              background: 'linear-gradient(135deg, var(--theme-primary), var(--theme-secondary))',
              boxShadow: '0 8px 30px var(--theme-primary-glow)',
            }}
          >
            <Dumbbell className="w-7 h-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight font-['Outfit']">
            {t('register.title')}
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{t('register.step', { step })}</p>
        </div>

        <div className="flex gap-2 mb-8">
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${
              step >= 1 ? 'bg-[var(--theme-primary)]' : 'bg-zinc-800'
            }`}
          />
          <div
            className={`h-1 flex-1 rounded-full transition-colors ${
              step >= 2 ? 'bg-[var(--theme-primary)]' : 'bg-zinc-800'
            }`}
          />
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-400 text-sm">
                {t('register.username')}
              </Label>
              <Input
                id="username"
                data-testid="register-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                placeholder="tonpseudo"
                className="h-14 rounded-xl bg-[#141414] border-white/10 text-white placeholder:text-zinc-600"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-400 text-sm">
                {t('register.password')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  data-testid="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 rounded-xl bg-[#141414] border-white/10 text-white placeholder:text-zinc-600 pr-12"
                  autoComplete="new-password"
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-zinc-400 text-sm">
                {t('register.confirmPassword')}
              </Label>
              <Input
                id="confirmPassword"
                data-testid="register-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="h-14 rounded-xl bg-[#141414] border-white/10 text-white placeholder:text-zinc-600"
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              data-testid="register-next"
              className="w-full h-14 rounded-xl font-bold text-white btn-primary mt-6"
            >
              {t('register.continue')}
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-zinc-400 text-sm">
                {t('register.displayName')}
              </Label>
              <Input
                id="displayName"
                data-testid="register-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('register.displayNamePlaceholder')}
                className="h-14 rounded-xl bg-[#141414] border-white/10 text-white placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm">{t('register.gender')}</Label>
              <div className="flex gap-3">
                {['male', 'female', 'other'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex-1 h-12 rounded-xl border transition-all ${
                      gender === g
                        ? 'border-[var(--theme-primary)] bg-[var(--theme-surface-active)] text-white'
                        : 'border-white/10 bg-[#141414] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    {t(`common:gender.${g}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm">{t('register.fitnessLevel')}</Label>
              <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                <SelectTrigger
                  data-testid="register-fitness-level"
                  className="h-14 rounded-xl bg-[#141414] border-white/10 text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  {FITNESS_LEVEL_KEYS.map((level) => (
                    <SelectItem key={level} value={level} className="text-white hover:bg-white/10">
                      {t(`common:fitnessLevels.${level}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm">{t('register.mainGoal')}</Label>
              <Select value={mainGoal} onValueChange={setMainGoal}>
                <SelectTrigger
                  data-testid="register-main-goal"
                  className="h-14 rounded-xl bg-[#141414] border-white/10 text-white"
                >
                  <SelectValue placeholder={t('register.goalPlaceholder')} />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  {GOAL_KEYS.map((goal) => (
                    <SelectItem key={goal} value={goal} className="text-white hover:bg-white/10">
                      {t(`common:goals.${goal}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 h-14 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                {t('register.back')}
              </Button>
              <Button
                type="submit"
                data-testid="register-submit"
                disabled={isLoading}
                className="flex-1 h-14 rounded-xl font-bold text-white btn-primary"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('register.submit')}
              </Button>
            </div>
          </form>
        )}

        <p className="text-center mt-8 text-zinc-500 text-sm">
          {t('register.hasAccount')}{' '}
          <Link
            to="/login"
            data-testid="login-link"
            className="text-[var(--theme-primary)] hover:underline font-medium"
          >
            {t('register.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
