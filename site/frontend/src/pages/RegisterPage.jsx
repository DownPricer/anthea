import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const FITNESS_LEVELS = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
  { value: 'expert', label: 'Expert' },
];

const GOALS = [
  { value: 'lose_weight', label: 'Perdre du poids' },
  { value: 'gain_muscle', label: 'Prendre du muscle' },
  { value: 'stay_fit', label: 'Rester en forme' },
  { value: 'improve_endurance', label: 'Améliorer mon endurance' },
  { value: 'flexibility', label: 'Gagner en souplesse' },
];

export function RegisterPage() {
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
      toast.error("Choisis un nom d'utilisateur");
      return;
    }
    if (username.length < 3) {
      toast.error("Le nom d'utilisateur doit faire au moins 3 caractères");
      return;
    }
    if (!password) {
      toast.error('Choisis un mot de passe');
      return;
    }
    if (password.length < 6) {
      toast.error('Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
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
      toast.success('Compte créé avec succès !');
      navigate('/');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo */}
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
            Créer un compte
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Étape {step} sur 2</p>
        </div>

        {/* Progress bar */}
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
                Nom d'utilisateur *
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
                Mot de passe *
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
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-zinc-400 text-sm">
                Confirmer le mot de passe *
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
              Continuer
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-zinc-400 text-sm">
                Prénom ou surnom
              </Label>
              <Input
                id="displayName"
                data-testid="register-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Comment tu t'appelles ?"
                className="h-14 rounded-xl bg-[#141414] border-white/10 text-white placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm">Genre (optionnel)</Label>
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
                    {g === 'male' ? 'Homme' : g === 'female' ? 'Femme' : 'Autre'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm">Niveau sportif</Label>
              <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                <SelectTrigger
                  data-testid="register-fitness-level"
                  className="h-14 rounded-xl bg-[#141414] border-white/10 text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  {FITNESS_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value} className="text-white hover:bg-white/10">
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400 text-sm">Objectif principal</Label>
              <Select value={mainGoal} onValueChange={setMainGoal}>
                <SelectTrigger
                  data-testid="register-main-goal"
                  className="h-14 rounded-xl bg-[#141414] border-white/10 text-white"
                >
                  <SelectValue placeholder="Choisis ton objectif" />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-white/10">
                  {GOALS.map((goal) => (
                    <SelectItem key={goal.value} value={goal.value} className="text-white hover:bg-white/10">
                      {goal.label}
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
                Retour
              </Button>
              <Button
                type="submit"
                data-testid="register-submit"
                disabled={isLoading}
                className="flex-1 h-14 rounded-xl font-bold text-white btn-primary"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "C'est parti !"}
              </Button>
            </div>
          </form>
        )}

        {/* Login link */}
        <p className="text-center mt-8 text-zinc-500 text-sm">
          Déjà un compte ?{' '}
          <Link
            to="/login"
            data-testid="login-link"
            className="text-[var(--theme-primary)] hover:underline font-medium"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
