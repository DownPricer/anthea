import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, duoApi, partnerApi, streakApi, notificationsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { useDuoNavLabel } from '../hooks/useDuoNavLabel';
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
  Search,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import { format, startOfWeek, addDays, isToday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTheme } from '../context/ThemeContext';
import { BadgesGrid } from '../components/BadgesGrid';
import { WeekAgendaStrip } from '../components/agenda/WeekAgendaStrip';
import { HomeFeed } from '../components/social/HomeFeed';
import { PartnerLiveStatus } from '../components/PartnerLiveStatus';
import { useUserAccent } from '../hooks/useUserAccent';
import { usePartnerLiveSession } from '../hooks/usePartnerLiveSession';
import { getAccentForUser } from '../lib/userAccent';
import { calendarDaysToMap } from '../lib/agendaDayMap';
import { getPublicHandle } from '../lib/userProfile';
import { toast } from 'sonner';

export function HomePage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const duoNav = useDuoNavLabel();
  
  const [todayWorkouts, setTodayWorkouts] = useState([]);
  const [calendarDayMap, setCalendarDayMap] = useState({});
  const [duoStats, setDuoStats] = useState(null);
  const [partner, setPartner] = useState(null);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [streakDays, setStreakDays] = useState([]);
  const [streakDaysLoading, setStreakDaysLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(true);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const { liveSession } = usePartnerLiveSession(!!partner);

  const reqIdRef = useRef(0);
  const didInitRef = useRef(false);
  const weekRangeRef = useRef({ start: null, end: null });
  const streakDaysRangeRef = useRef({ start: null, end: null, loaded: false });

  const scheduleNonBlocking = (fn) => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(fn, { timeout: 1200 });
    } else {
      setTimeout(fn, 0);
    }
  };

  const loadData = useCallback(() => {
    const reqId = ++reqIdRef.current;
    const isActive = () => reqIdRef.current === reqId;

    const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEndDate = addDays(weekStartDate, 6);
    const wsStr = format(weekStartDate, 'yyyy-MM-dd');
    const weStr = format(weekEndDate, 'yyyy-MM-dd');
    weekRangeRef.current = { start: wsStr, end: weStr };

    setTodayLoading(true);
    setWeekLoading(true);
    setSidebarLoading(true);
    setStreakDays([]);
    setStreakDaysLoading(false);
    streakDaysRangeRef.current = { start: null, end: null, loaded: false };

    workoutsApi
      .getToday()
      .then((todayRes) => {
        if (!isActive()) return;
        setTodayWorkouts(todayRes.data || []);
      })
      .catch((error) => {
        console.error('Failed to load today workouts:', error);
      })
      .finally(() => {
        if (!isActive()) return;
        setTodayLoading(false);
      });

    streakApi
      .getCalendar(wsStr, weStr)
      .then((calRes) => {
        if (!isActive()) return;
        setCalendarDayMap(calendarDaysToMap(calRes.data?.days || []));
      })
      .catch((error) => {
        console.error('Failed to load week agenda:', error);
      })
      .finally(() => {
        if (!isActive()) return;
        setWeekLoading(false);
      });

    // Sections secondaires : ne doivent pas bloquer l'affichage initial.
    scheduleNonBlocking(async () => {
      try {
        const [duoRes, partnerRes, requestsRes] = await Promise.all([
          duoApi.getStats(),
          partnerApi.getInfo(),
          partnerApi.getRequests(),
        ]);
        if (!isActive()) return;
        setDuoStats(duoRes.data);
        setPartner(partnerRes.data);
        setPartnerRequests(requestsRes.data || []);
      } catch (error) {
        console.error('Failed to load home secondary data:', error);
      } finally {
        if (!isActive()) return;
        setSidebarLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    loadData();
  }, [loadData]);

  const refreshUnreadNotifications = useCallback(async () => {
    try {
      const { data } = await notificationsApi.unreadCount();
      setUnreadNotifications(data?.count || 0);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  useEffect(() => {
    refreshUnreadNotifications();
    const onRead = () => refreshUnreadNotifications();
    window.addEventListener('notifications:read', onRead);
    return () => window.removeEventListener('notifications:read', onRead);
  }, [refreshUnreadNotifications]);

  const ensureStreakDaysLoaded = useCallback(async () => {
    const { start, end } = weekRangeRef.current || {};
    if (!start || !end) return;
    if (
      streakDaysRangeRef.current?.start === start &&
      streakDaysRangeRef.current?.end === end &&
      streakDaysRangeRef.current?.loaded
    ) {
      return;
    }

    setStreakDaysLoading(true);
    try {
      const streakRes = await streakApi.getDays(start, end);
      setStreakDays(streakRes.data || []);
      streakDaysRangeRef.current = { start, end, loaded: true };
    } catch (error) {
      console.error('Failed to load streak days:', error);
    } finally {
      setStreakDaysLoading(false);
    }
  }, []);


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

  const { accent: myAccent } = useUserAccent();
  const partnerAccent = useMemo(
    () => {
      if (!partner) return 'var(--theme-secondary)';
      return partner.accent_color
        ? getAccentForUser({ accent_color: partner.accent_color }, theme)
        : 'var(--theme-secondary)';
    },
    [partner, theme]
  );

  return (
    <div data-testid="home-page" className="p-5 animate-fade-in">
      <div className="space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-zinc-400 text-sm capitalize">
              {format(new Date(), 'EEEE d MMMM', { locale: fr })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/search')}
              data-testid="home-search-btn"
              className="w-11 h-11 rounded-full bg-[#141414] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              aria-label="Rechercher"
            >
              <Search size={20} />
            </button>
            <div className="relative">
              {(unreadNotifications > 0 || partnerRequests.length > 0) && (
                <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white">
                  {unreadNotifications + partnerRequests.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                data-testid="home-notifications-btn"
                className="w-11 h-11 rounded-full bg-[#141414] border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                aria-label="Notifications"
              >
                <Bell size={20} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="w-11 h-11 rounded-full bg-[#141414] border border-white/10 flex items-center justify-center overflow-hidden"
              aria-label="Mon profil"
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

        {partner && liveSession && (
          <PartnerLiveStatus liveSession={liveSession} />
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          {/* Next Workout Card */}
          {todayLoading ? (
            <div className="card p-5 relative overflow-hidden">
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-white/5 animate-pulse" />
                <div className="h-7 w-64 rounded bg-white/5 animate-pulse" />
                <div className="h-4 w-44 rounded bg-white/5 animate-pulse" />
                <div className="h-14 w-full rounded-2xl bg-white/5 animate-pulse" />
              </div>
            </div>
          ) : primaryWorkoutAction ? (
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
                className="w-full h-14 rounded-2xl font-bold text-white btn-primary"
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

            {weekLoading ? (
              <div className="flex gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-0 h-[74px] rounded-2xl bg-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <WeekAgendaStrip
                weekDays={weekDays}
                dayMap={calendarDayMap}
                myAccent={myAccent}
                partnerAccent={partnerAccent}
                isToday={isToday}
                onDayClick={(day) => {
                  ensureStreakDaysLoaded();
                  setSelectedDay(day);
                  setShowStreakModal(true);
                }}
              />
            )}
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

          <HomeFeed />
        </div>

        <div className="space-y-6 lg:col-span-5">
          {/* Duo Stats Card */}
          {sidebarLoading ? (
            <div className="card p-5">
              <div className="space-y-4">
                <div className="h-5 w-52 rounded bg-white/5 animate-pulse" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-20 rounded-xl bg-white/5 animate-pulse col-span-3 sm:col-span-1" />
                  <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
                  <div className="h-20 rounded-xl bg-white/5 animate-pulse" />
                </div>
              </div>
            </div>
          ) : partner && duoStats && (
            <div className="card p-5">
          <Link
            to={`/profile/${getPublicHandle(partner) || partner.username}`}
            className="flex items-center gap-3 mb-4 hover:opacity-90 transition-opacity"
          >
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
            <ChevronRight className="text-[var(--theme-primary)]" size={20} />
          </Link>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-xl bg-white/5 col-span-3 sm:col-span-1">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Flame
                  size={18}
                  className={(duoStats.streak || 0) > 0 ? 'text-orange-500' : 'text-zinc-600'}
                  fill="currentColor"
                />
                <span className="text-orange-300/80 text-sm font-semibold">×</span>
                <span className="text-xl font-bold text-white tabular-nums">
                  {duoStats.streak || 0}
                </span>
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

          {!partner && duoStats && (
            <Link
              to="/duo"
              data-testid="home-solo-card"
              className="card p-5 block hover:border-[var(--theme-primary)]/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--theme-primary)]/20 flex items-center justify-center">
                  <ChartNoAxesColumnIncreasing className="text-[var(--theme-primary)]" size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{duoNav.label} — ton tableau de bord</p>
                  <p className="text-zinc-500 text-sm">Stats, badges et défis personnels</p>
                </div>
                <ChevronRight className="text-[var(--theme-primary)]" size={20} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-white/5 col-span-3 sm:col-span-1">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Flame
                      size={18}
                      className={(duoStats.streak || 0) > 0 ? 'text-orange-500' : 'text-zinc-600'}
                      fill="currentColor"
                    />
                    <span className="text-xl font-bold text-white tabular-nums">{duoStats.streak || 0}</span>
                  </div>
                  <p className="text-zinc-500 text-xs">Streak</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-xl font-bold text-white">{duoStats.this_week_user ?? 0}</p>
                  <p className="text-zinc-500 text-xs">Cette semaine</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/5">
                  <p className="text-xl font-bold text-white">{duoStats.badges_unlocked ?? 0}</p>
                  <p className="text-zinc-500 text-xs">Badges</p>
                </div>
              </div>
            </Link>
          )}

          {/* Badges */}
          {duoStats?.badges?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white font-['Outfit']">Badges</h2>
                <Link to="/duo" className="text-[var(--theme-primary)] text-sm">
                  Tout voir
                </Link>
              </div>
              <div className="flex w-full justify-center">
                <BadgesGrid badges={duoStats.badges.filter((b) => b.unlocked).slice(0, 8)} compact />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Streak Day Modal */}
      <Dialog open={showStreakModal} onOpenChange={setShowStreakModal}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-center">
              {selectedDay && format(selectedDay, 'EEEE d MMMM', { locale: fr })}
            </DialogTitle>
            <p className="text-zinc-500 text-sm text-center">Gérer le jour pour la streak</p>
          </DialogHeader>
          {streakDaysLoading && (
            <div className="flex items-center justify-center py-2 text-zinc-500 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement…
            </div>
          )}
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
