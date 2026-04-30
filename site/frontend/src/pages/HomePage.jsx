import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, duoApi, partnerApi, streakApi } from '../lib/api';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Play,
  Calendar,
  Flame,
  Trophy,
  Heart,
  ChevronRight,
  Zap,
  Clock,
  User,
  Loader2,
  Bell,
  BedDouble,
  XCircle,
  Undo2,
  RotateCcw,
} from 'lucide-react';
import { format, startOfWeek, addDays, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';

export function HomePage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [todayWorkouts, setTodayWorkouts] = useState([]);
  const [weekWorkouts, setWeekWorkouts] = useState([]);
  const [duoStats, setDuoStats] = useState(null);
  const [partner, setPartner] = useState(null);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [streakDays, setStreakDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEndDate = addDays(weekStartDate, 6);
      const wsStr = format(weekStartDate, 'yyyy-MM-dd');
      const weStr = format(weekEndDate, 'yyyy-MM-dd');

      const [todayRes, duoRes, partnerRes, requestsRes, weekRes, streakRes] = await Promise.all([
        workoutsApi.getToday(),
        duoApi.getStats(),
        partnerApi.getInfo(),
        partnerApi.getRequests(),
        workoutsApi.getAll({ start_date: wsStr, end_date: weStr, light: true }),
        streakApi.getDays(wsStr, weStr),
      ]);

      setTodayWorkouts(todayRes.data || []);
      setDuoStats(duoRes.data);
      setPartner(partnerRes.data);
      setPartnerRequests(requestsRes.data || []);
      setWeekWorkouts(weekRes.data || []);
      setStreakDays(streakRes.data || []);
    } catch (error) {
      console.error('Failed to load home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  /** Prochaine action utile : reprendre une séance en cours (toi), sinon première séance pending. */
  const getPrimaryWorkoutAction = () => {
    const mineInProg = todayWorkouts.find(
      (w) => w.for_user_id === user?.id && w.status === 'in_progress'
    );
    if (mineInProg) return { workout: mineInProg, resume: true };
    const pending = todayWorkouts.filter((w) => w.status === 'pending');
    const next = pending[0];
    if (next) return { workout: next, resume: false };
    return null;
  };

  const primaryWorkoutAction = getPrimaryWorkoutAction();

  const workoutHref = (w) => {
    if (
      (w.status === 'pending' || w.status === 'in_progress') &&
      w.for_user_id === user?.id
    ) {
      return `/player/${w.id}`;
    }
    return `/workouts/${w.id}`;
  };

  const getStreakDayType = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const entry = streakDays.find((d) => d.date === dateStr);
    return entry?.type || null;
  };

  const handleMarkRestDay = async (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      await streakApi.markRestDay(dateStr);
      setStreakDays((prev) => [...prev.filter((d) => d.date !== dateStr), { date: dateStr, type: 'rest' }]);
      setDuoStats((prev) => prev); // will refresh
      toast.success('Jour de repos marqué');
      setShowStreakModal(false);
      // Refresh stats
      const statsRes = await duoApi.getStats();
      setDuoStats(statsRes.data);
    } catch {
      toast.error('Erreur');
    }
  };

  const handleMarkSkipDay = async (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      await streakApi.markSkipDay(dateStr);
      setStreakDays((prev) => [...prev.filter((d) => d.date !== dateStr), { date: dateStr, type: 'skip' }]);
      toast.success('Streak abandonnée pour ce jour');
      setShowStreakModal(false);
      const statsRes = await duoApi.getStats();
      setDuoStats(statsRes.data);
    } catch {
      toast.error('Erreur');
    }
  };

  const handleRemoveStreakDay = async (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      await streakApi.removeDay(dateStr);
      setStreakDays((prev) => prev.filter((d) => d.date !== dateStr));
      toast.success('Marqueur supprimé');
      setShowStreakModal(false);
      const statsRes = await duoApi.getStats();
      setDuoStats(statsRes.data);
    } catch {
      toast.error('Erreur');
    }
  };

  // Week view
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getWorkoutsForDay = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return weekWorkouts.filter((w) => w.scheduled_date === dateStr);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  return (
    <div data-testid="home-page" className="p-5 space-y-6 animate-fade-in">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-zinc-500 text-sm">
            {format(new Date(), 'EEEE d MMMM', { locale: fr })}
          </p>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">
            {getGreeting()}, {user?.display_name || user?.username}
          </h1>
        </div>
        <div className="relative">
          {partnerRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white">
              {partnerRequests.length}
            </span>
          )}
          <button
            onClick={() => navigate('/profile')}
            className="w-11 h-11 rounded-full bg-[#141414] border border-white/10 flex items-center justify-center"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User size={20} className="text-zinc-400" />
            )}
          </button>
        </div>
      </header>

      {/* Partner requests notification */}
      {partnerRequests.length > 0 && (
        <Link
          to="/profile"
          data-testid="partner-request-banner"
          className="block p-4 rounded-2xl bg-[var(--theme-surface-active)] border border-[var(--theme-primary)]/30"
        >
          <div className="flex items-center gap-3">
            <Bell className="text-[var(--theme-primary)]" size={20} />
            <span className="text-white text-sm flex-1">
              {partnerRequests.length} demande(s) de partenaire en attente
            </span>
            <ChevronRight className="text-zinc-400" size={18} />
          </div>
        </Link>
      )}

      {/* Duo Stats Card */}
      {partner && duoStats && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-full bg-[var(--theme-primary)] flex items-center justify-center border-2 border-[#141414]">
                <span className="text-white text-sm font-bold">
                  {user?.display_name?.[0] || user?.username?.[0] || 'M'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center border-2 border-[#141414]">
                <span className="text-white text-sm font-bold">
                  {partner.display_name?.[0] || partner.username?.[0] || 'P'}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Duo avec {partner.display_name || partner.username}</p>
              <p className="text-zinc-500 text-sm">{user?.relation_type === 'coach' ? 'Coach' : 'Partenaire'}</p>
            </div>
            <Link to="/duo" className="text-[var(--theme-primary)]">
              <ChevronRight size={20} />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-white/5">
              <div className="flex items-center justify-center gap-1 mb-1">
                {theme === 'girly' ? (
                  <Heart className="text-pink-500" size={16} fill="currentColor" />
                ) : (
                  <Flame className="text-orange-500" size={16} />
                )}
                <span className="text-xl font-bold text-white">{duoStats.streak}</span>
              </div>
              <p className="text-zinc-500 text-xs">Streak</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/5">
              <p className="text-xl font-bold text-white">{duoStats.this_week_user}</p>
              <p className="text-zinc-500 text-xs">Toi</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-white/5">
              <p className="text-xl font-bold text-white">{duoStats.this_week_partner}</p>
              <p className="text-zinc-500 text-xs">{partner.display_name?.split(' ')[0] || partner.username}</p>
            </div>
          </div>
        </div>
      )}

      {/* Next Workout Card */}
      {primaryWorkoutAction ? (
        <div
          data-testid="next-workout-card"
          className="card p-5 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, var(--surface-elevated), var(--theme-surface-active))`,
          }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
            <Zap className="w-full h-full text-[var(--theme-primary)]" />
          </div>

          <p className="text-zinc-400 text-sm uppercase tracking-wider mb-2">
            {primaryWorkoutAction.resume ? 'À reprendre' : 'Prochaine séance'}
          </p>
          <h3 className="text-xl font-bold text-white mb-1">{primaryWorkoutAction.workout.title}</h3>
          <p className="text-zinc-500 text-sm mb-4">
            {primaryWorkoutAction.workout.scheduled_time || 'Pas d\'heure définie'}
            {primaryWorkoutAction.workout.for_user_id !== user?.id && (
              <span className="ml-2 text-[var(--theme-primary)]">
                • Pour {primaryWorkoutAction.workout.for_username}
              </span>
            )}
          </p>

          <Button
            onClick={() => navigate(`/player/${primaryWorkoutAction.workout.id}`)}
            data-testid="start-workout-btn"
            className="w-full h-14 rounded-xl font-bold text-white btn-primary"
          >
            {primaryWorkoutAction.resume ? (
              <>
                <RotateCcw size={20} className="mr-2" />
                Reprendre
              </>
            ) : (
              <>
                <Play size={20} className="mr-2" fill="currentColor" />
                Démarrer
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="card p-5 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-3">
            <Calendar className="text-zinc-500" size={24} />
          </div>
          <p className="text-zinc-400 mb-3">Pas de séance prévue aujourd'hui</p>
          <Button
            onClick={() => navigate('/create')}
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            Planifier une séance
          </Button>
        </div>
      )}

      {/* Week View */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white font-['Outfit']">Cette semaine</h2>
          <Link to="/workouts" className="text-[var(--theme-primary)] text-sm flex items-center">
            Voir tout <ChevronRight size={16} />
          </Link>
        </div>

        <div className="flex gap-2">
          {weekDays.map((day) => {
            const dayWorkouts = getWorkoutsForDay(day);
            const hasWorkout = dayWorkouts.length > 0;
            const isCurrentDay = isToday(day);
            const streakType = getStreakDayType(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDay(day);
                  setShowStreakModal(true);
                }}
                data-testid={`week-day-${format(day, 'yyyy-MM-dd')}`}
                className={`flex-1 p-3 rounded-xl text-center transition-all ${
                  streakType === 'skip'
                    ? 'bg-red-500/15 border border-red-500/30'
                    : streakType === 'rest'
                    ? 'bg-blue-500/15 border border-blue-500/30'
                    : isCurrentDay
                    ? 'bg-[var(--theme-primary)] text-white'
                    : hasWorkout
                    ? 'bg-[var(--theme-surface-active)] border border-[var(--theme-primary)]/30'
                    : 'bg-[#141414] border border-white/5'
                }`}
              >
                <p className={`text-[10px] uppercase ${
                  streakType === 'skip' ? 'text-red-400' :
                  streakType === 'rest' ? 'text-blue-400' :
                  isCurrentDay ? 'text-white/70' : 'text-zinc-500'
                }`}>
                  {format(day, 'EEE', { locale: fr })}
                </p>
                <p className={`text-lg font-bold ${
                  streakType === 'skip' ? 'text-red-400' :
                  streakType === 'rest' ? 'text-blue-400' :
                  isCurrentDay ? 'text-white' : hasWorkout ? 'text-white' : 'text-zinc-400'
                }`}>
                  {format(day, 'd')}
                </p>
                {streakType === 'rest' && (
                  <BedDouble size={12} className="mx-auto mt-1 text-blue-400" />
                )}
                {streakType === 'skip' && (
                  <XCircle size={12} className="mx-auto mt-1 text-red-400" />
                )}
                {!streakType && hasWorkout && (
                  <div className={`w-1.5 h-1.5 mx-auto mt-1 rounded-full ${isCurrentDay ? 'bg-white' : 'bg-[var(--theme-primary)]'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's workouts list */}
      {todayWorkouts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white font-['Outfit'] mb-4">Aujourd'hui</h2>
          <div className="space-y-3">
            {todayWorkouts.map((workout) => (
              <Link
                key={workout.id}
                to={workoutHref(workout)}
                data-testid={`workout-card-${workout.id}`}
                className="card p-4 flex items-center gap-4 hover:-translate-y-0.5 transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    workout.status === 'completed'
                      ? 'bg-green-500/20 text-green-500'
                      : workout.status === 'in_progress'
                      ? 'bg-yellow-500/20 text-yellow-500'
                      : 'bg-white/5 text-zinc-400'
                  }`}
                >
                  {workout.status === 'completed' ? (
                    <Trophy size={20} />
                  ) : (
                    <Clock size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{workout.title}</h4>
                  <p className="text-zinc-500 text-sm">
                    {workout.status === 'in_progress' && workout.for_user_id === user?.id
                      ? 'En pause — lecteur'
                      : workout.scheduled_time || 'Flexible'}
                    {workout.for_user_id !== user?.id && ` • Pour ${workout.for_username}`}
                  </p>
                </div>
                <ChevronRight className="text-zinc-500" size={18} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      {duoStats?.badges?.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white font-['Outfit'] mb-4">Badges</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
            {duoStats.badges.map((badge) => (
              <div
                key={badge.id}
                className="flex-shrink-0 w-20 text-center"
              >
                <div className="w-14 h-14 mx-auto rounded-full bg-[var(--theme-surface-active)] border border-[var(--theme-primary)]/30 flex items-center justify-center mb-2">
                  <Trophy className="text-[var(--theme-primary)]" size={24} />
                </div>
                <p className="text-xs text-zinc-400 truncate">{badge.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak Day Modal */}
      <Dialog open={showStreakModal} onOpenChange={setShowStreakModal}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-center">
              {selectedDay && format(selectedDay, 'EEEE d MMMM', { locale: fr })}
            </DialogTitle>
            <p className="text-zinc-500 text-sm text-center">Gérer le jour pour la streak</p>
          </DialogHeader>
          {selectedDay && (() => {
            const dayType = getStreakDayType(selectedDay);
            const dayStr = format(selectedDay, 'yyyy-MM-dd');
            return (
              <div className="space-y-3 pt-2">
                {dayType && (
                  <div className={`p-3 rounded-xl text-center text-sm font-medium ${
                    dayType === 'rest' ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/15 text-red-400'
                  }`}>
                    {dayType === 'rest' ? 'Jour de repos (streak maintenue)' : 'Jour skip (streak cassée)'}
                  </div>
                )}

                {dayType ? (
                  <Button
                    onClick={() => handleRemoveStreakDay(selectedDay)}
                    data-testid="remove-streak-day-btn"
                    className="w-full h-12 rounded-xl bg-white/10 hover:bg-white/15 text-white"
                  >
                    <Undo2 size={18} className="mr-2" />
                    Retirer le marqueur
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => handleMarkRestDay(selectedDay)}
                      data-testid="mark-rest-day-btn"
                      className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <BedDouble size={18} className="mr-2" />
                      Jour de repos
                    </Button>
                    <p className="text-zinc-500 text-xs text-center -mt-1">
                      La streak continue malgré l'absence d'entraînement
                    </p>

                    <Button
                      onClick={() => handleMarkSkipDay(selectedDay)}
                      data-testid="mark-skip-day-btn"
                      className="w-full h-12 rounded-xl bg-red-600/80 hover:bg-red-600 text-white"
                    >
                      <XCircle size={18} className="mr-2" />
                      Abandonner la streak
                    </Button>
                    <p className="text-zinc-500 text-xs text-center -mt-1">
                      Casse la streak volontairement pour ce jour
                    </p>
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
