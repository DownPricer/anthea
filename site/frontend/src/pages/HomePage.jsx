import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, partnerApi, streakApi, notificationsApi } from '../lib/api';
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
  Search,
} from 'lucide-react';
import { format, startOfWeek, addDays, isToday, parseISO } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { WeekAgendaStrip } from '../components/agenda/WeekAgendaStrip';
import { HomeFeed } from '../components/social/HomeFeed';
import { PartnerLiveStatus } from '../components/PartnerLiveStatus';
import { useUserAccent } from '../hooks/useUserAccent';
import { usePartnerLiveSession } from '../hooks/usePartnerLiveSession';
import { useLocaleFormat } from '../hooks/useLocaleFormat';
import { getAccentForUser } from '../lib/userAccent';
import { calendarDaysToMap } from '../lib/agendaDayMap';
import { UserAvatar } from '../components/UserAvatar';
import { PageHeader } from '../components/layout/PageHeader';
import { getPublicHandle } from '../lib/userProfile';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function HomePage() {
  const { t } = useTranslation(['home', 'common']);
  const { formatWeekdayDate } = useLocaleFormat();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [todayWorkouts, setTodayWorkouts] = useState([]);
  const [calendarDayMap, setCalendarDayMap] = useState({});
  const [partner, setPartner] = useState(null);
  const [partnerRequests, setPartnerRequests] = useState([]);
  const [streakDays, setStreakDays] = useState([]);
  const [streakDaysLoading, setStreakDaysLoading] = useState(false);
  const [todayLoading, setTodayLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(true);
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
        const [partnerRes, requestsRes] = await Promise.all([
          partnerApi.getInfo(),
          partnerApi.getRequests(),
        ]);
        if (!isActive()) return;
        setPartner(partnerRes.data);
        setPartnerRequests(requestsRes.data || []);
      } catch (error) {
        console.error('Failed to load home secondary data:', error);
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
      toast.success(t('home:restDayMarked'));
      setShowStreakModal(false);
    } catch {
      toast.error(t('common:states.error'));
    }
  };

  const handleMarkSkipDay = async (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      await streakApi.markSkipDay(dateStr);
      setStreakDays((prev) => [...prev.filter((d) => d.date !== dateStr), { date: dateStr, type: 'skip' }]);
      toast.success(t('home:skipDayMarked'));
      setShowStreakModal(false);
    } catch {
      toast.error(t('common:states.error'));
    }
  };

  const handleRemoveStreakDay = async (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      await streakApi.removeDay(dateStr);
      setStreakDays((prev) => prev.filter((d) => d.date !== dateStr));
      toast.success(t('home:markerRemoved'));
      setShowStreakModal(false);
    } catch {
      toast.error(t('common:states.error'));
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
    <div
      data-testid="home-page"
      className="w-full max-w-7xl mx-auto p-5 animate-fade-in"
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <PageHeader
          title={t('home:title')}
          subtitle={formatWeekdayDate(new Date())}
          subtitleClassName="capitalize"
          actions={
            <>
              <button
                type="button"
                onClick={() => navigate('/search')}
                data-testid="home-search-btn"
                className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-hover text-muted transition-colors hover:bg-active hover:text-foreground"
                aria-label={t('common:aria.search')}
              >
                <Search size={20} />
              </button>
              <div className="relative">
                {(unreadNotifications > 0 || partnerRequests.length > 0) && (
                  <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-foreground">
                    {unreadNotifications + partnerRequests.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/notifications')}
                  data-testid="home-notifications-btn"
                  className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-hover text-muted transition-colors hover:bg-active hover:text-foreground"
                  aria-label={t('common:aria.notifications')}
                >
                  <Bell size={20} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="inline-flex size-10 items-center justify-center overflow-hidden rounded-full border border-border bg-hover transition-colors hover:bg-active"
                aria-label={t('common:aria.myProfile')}
              >
                <UserAvatar user={user} className="w-full h-full" />
              </button>
            </>
          }
        />

        {/* Partner requests notification */}
        {partnerRequests.length > 0 && (
          <Link
            to="/profile"
            data-testid="partner-request-banner"
            className="block p-4 rounded-2xl bg-[var(--theme-surface-active)] border border-[var(--theme-primary)]/30"
          >
            <div className="flex items-center gap-3">
              <Bell className="text-[var(--theme-primary)]" size={20} />
              <span className="text-foreground text-sm flex-1">
                {t('home:partnerRequests', { count: partnerRequests.length })}
              </span>
              <ChevronRight className="text-muted" size={18} />
            </div>
          </Link>
        )}

        {partner && liveSession && (
          <PartnerLiveStatus liveSession={liveSession} />
        )}
      </div>

      <div className="mx-auto mt-6 w-full max-w-4xl space-y-6">
          {/* Next Workout Card */}
          {todayLoading ? (
            <div className="card p-5 relative overflow-hidden">
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-hover animate-pulse" />
                <div className="h-7 w-64 rounded bg-hover animate-pulse" />
                <div className="h-4 w-44 rounded bg-hover animate-pulse" />
                <div className="h-14 w-full rounded-2xl bg-hover animate-pulse" />
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

              <p className="text-muted text-sm uppercase tracking-wider mb-2">
                {primaryWorkoutAction.resume ? t('home:resumeWorkout') : t('home:nextWorkout')}
              </p>
              <h3 className="text-xl font-bold text-foreground mb-1">{primaryWorkoutAction.workout.title}</h3>
              <p className="text-subtle text-sm mb-4">
                {primaryWorkoutAction.workout.scheduled_time || t('home:noTimeSet')}
                {primaryWorkoutAction.workout.for_user_id !== user?.id && (
                  <span className="ml-2 text-[var(--theme-primary)]">
                    • {t('home:forUser', { username: primaryWorkoutAction.workout.for_username })}
                  </span>
                )}
              </p>

              <Button
                onClick={() => navigate(`/player/${primaryWorkoutAction.workout.id}`)}
                data-testid="start-workout-btn"
                className="w-full h-14 rounded-2xl font-bold text-foreground btn-primary"
              >
                {primaryWorkoutAction.resume ? (
                  <>
                    <RotateCcw size={20} className="mr-2" />
                    {t('home:resume')}
                  </>
                ) : (
                  <>
                    <Play size={20} className="mr-2" fill="currentColor" />
                    {t('home:start')}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="card p-5 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-hover flex items-center justify-center mb-3">
                <Calendar className="text-subtle" size={24} />
              </div>
              <p className="text-muted mb-3">{t('home:noWorkoutToday')}</p>
              <Button
                onClick={() => navigate('/create')}
                variant="outline"
                className="bg-hover border-border text-foreground hover:bg-active"
              >
                {t('home:scheduleWorkout')}
              </Button>
            </div>
          )}

          {/* Week View */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground font-['Outfit']">{t('home:thisWeek')}</h2>
              <Link to="/workouts" className="text-[var(--theme-primary)] text-sm flex items-center">
                {t('home:seeAll')} <ChevronRight size={16} />
              </Link>
            </div>

            {weekLoading ? (
              <div className="flex gap-1.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-0 h-[74px] rounded-2xl bg-hover animate-pulse"
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
              <h2 className="text-lg font-semibold text-foreground font-['Outfit'] mb-4">{t('common:relative.today')}</h2>
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
                          : 'bg-hover text-muted'
                      }`}
                    >
                      {workout.status === 'completed' ? (
                        <Trophy size={20} />
                      ) : (
                        <Clock size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-foreground font-medium truncate">{workout.title}</h4>
                      <p className="text-subtle text-sm">
                        {workout.status === 'in_progress' && workout.for_user_id === user?.id
                          ? t('home:pausedPlayer')
                          : workout.scheduled_time || t('home:flexible')}
                        {workout.for_user_id !== user?.id && ` • ${t('home:forUser', { username: workout.for_username })}`}
                      </p>
                    </div>
                    <ChevronRight className="text-subtle" size={18} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <HomeFeed />
      </div>

      {/* Streak Day Modal */}
      <Dialog open={showStreakModal} onOpenChange={setShowStreakModal}>
        <DialogContent className="bg-surface-elevated border-border text-foreground max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground text-center">
              {selectedDay && formatWeekdayDate(selectedDay)}
            </DialogTitle>
            <p className="text-subtle text-sm text-center">{t('home:manageStreakDay')}</p>
          </DialogHeader>
          {streakDaysLoading && (
            <div className="flex items-center justify-center py-2 text-subtle text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('common:states.loading')}
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
                    {dayType === 'rest' ? t('home:restDayActive') : t('home:skipDayActive')}
                  </div>
                )}

                {dayType ? (
                  <Button
                    onClick={() => handleRemoveStreakDay(selectedDay)}
                    data-testid="remove-streak-day-btn"
                    className="w-full h-12 rounded-xl bg-active hover:bg-active text-foreground"
                  >
                    <Undo2 size={18} className="mr-2" />
                    {t('home:removeMarker')}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => handleMarkRestDay(selectedDay)}
                      data-testid="mark-rest-day-btn"
                      className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-foreground"
                    >
                      <BedDouble size={18} className="mr-2" />
                      {t('home:restDay')}
                    </Button>
                    <p className="text-subtle text-xs text-center -mt-1">
                      {t('home:restDayHint')}
                    </p>

                    <Button
                      onClick={() => handleMarkSkipDay(selectedDay)}
                      data-testid="mark-skip-day-btn"
                      className="w-full h-12 rounded-xl bg-red-600/80 hover:bg-red-600 text-foreground"
                    >
                      <XCircle size={18} className="mr-2" />
                      {t('home:skipDay')}
                    </Button>
                    <p className="text-subtle text-xs text-center -mt-1">
                      {t('home:skipDayHint')}
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
