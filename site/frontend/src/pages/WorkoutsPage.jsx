import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, streakApi, partnerApi } from '../lib/api';
import { invalidateHomeWeekCache } from '../lib/homeCache';
import { useUserAccent } from '../hooks/useUserAccent';
import { getAccentForUser } from '../lib/userAccent';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AgendaCalendar } from '../components/agenda/AgendaCalendar';
import { PartnerLiveStatus } from '../components/PartnerLiveStatus';
import { usePartnerLiveSession } from '../hooks/usePartnerLiveSession';
import { calendarDaysToMap } from '../lib/agendaDayMap';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Play,
  Clock,
  Trophy,
  Plus,
  MoreVertical,
  Trash2,
  Copy,
  Edit,
  ChevronRight,
  Loader2,
  Calendar as CalendarIcon,
  CheckSquare,
  Square,
  X,
  RotateCcw,
  BedDouble,
  XCircle,
  Undo2,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { useLocaleFormat } from '../hooks/useLocaleFormat';
import { getDayRelation } from '../lib/homeWorkoutState';

export function WorkoutsPage() {
  const { t } = useTranslation(['workouts', 'common', 'home']);
  const { formatWeekdayDate } = useLocaleFormat();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('today');
  const [calendarDayMap, setCalendarDayMap] = useState({});
  const [duoStreak, setDuoStreak] = useState(0);
  const [partner, setPartner] = useState(null);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [todayWorkouts, setTodayWorkouts] = useState([]);
  const [calendarWorkouts, setCalendarWorkouts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState([]);

  const agendaMetaCacheRef = useRef(new Map());
  const calendarWorkoutsCacheRef = useRef(new Map());

  useEffect(() => {
    loadTodayWorkouts();
    partnerApi.getInfo()
      .then((res) => setPartner(res.data))
      .catch(() => {});
  }, []);

  const { liveSession } = usePartnerLiveSession(!!partner);
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

  useEffect(() => {
    if (activeTab === 'agenda') {
      loadCalendarWorkouts();
      loadAgendaMeta();
    }
  }, [activeTab, currentMonth]);

  const getStreakDayType = (date) => {
    const state = calendarDayMap[format(date, 'yyyy-MM-dd')] || {};
    if (state.skip) return 'skip';
    if (state.rest) return 'rest';
    return null;
  };

  const handleMarkRestDay = async (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      await streakApi.markRestDay(dateStr);
      invalidateHomeWeekCache(user?.id);
      agendaMetaCacheRef.current.clear();
      await loadAgendaMeta();
      toast.success(t('home:restDayMarked', { ns: 'home' }));
    } catch {
      toast.error(t('workouts:deleteError'));
    }
  };

  const handleMarkSkipDay = async (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      await streakApi.markSkipDay(dateStr);
      invalidateHomeWeekCache(user?.id);
      agendaMetaCacheRef.current.clear();
      await loadAgendaMeta();
      toast.success(t('home:skipDayMarked', { ns: 'home' }));
    } catch {
      toast.error(t('workouts:deleteError'));
    }
  };

  const handleRemoveStreakDay = async (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      await streakApi.removeDay(dateStr);
      invalidateHomeWeekCache(user?.id);
      agendaMetaCacheRef.current.clear();
      await loadAgendaMeta();
      toast.success(t('home:markerRemoved', { ns: 'home' }));
    } catch {
      toast.error(t('workouts:deleteError'));
    }
  };

  const loadAgendaMeta = async () => {
    const monthKey = `${format(currentMonth, 'yyyy-MM')}:${user?.id || ''}`;
    const cached = agendaMetaCacheRef.current.get(monthKey);
    if (cached) {
      setCalendarDayMap(cached.dayMap);
      setDuoStreak(cached.streak);
      return;
    }

    setAgendaLoading(true);
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const ws = format(start, 'yyyy-MM-dd');
      const we = format(end, 'yyyy-MM-dd');
      const calRes = await streakApi.getCalendar(ws, we);
      const dayMap = calendarDaysToMap(calRes.data?.days || []);
      const streak = calRes.data?.streak || 0;
      agendaMetaCacheRef.current.set(monthKey, { dayMap, streak });
      setCalendarDayMap(dayMap);
      setDuoStreak(streak);
    } catch {
      console.error('Agenda calendar load failed');
    } finally {
      setAgendaLoading(false);
    }
  };

  const loadTodayWorkouts = async () => {
    try {
      const { data } = await workoutsApi.getToday();
      setTodayWorkouts(data || []);
    } catch (error) {
      console.error('Failed to load today workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarWorkouts = async () => {
    const monthKey = `${format(currentMonth, 'yyyy-MM')}:${user?.id || ''}`;
    const cached = calendarWorkoutsCacheRef.current.get(monthKey);
    if (cached) {
      setCalendarWorkouts(cached);
      return;
    }

    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const { data } = await workoutsApi.getAll({
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
        light: true,
      });
      const rows = data || [];
      calendarWorkoutsCacheRef.current.set(monthKey, rows);
      setCalendarWorkouts(rows);
    } catch (error) {
      console.error('Failed to load calendar workouts:', error);
    }
  };

  const handleDelete = async (workoutId) => {
    if (!window.confirm(t('workouts:confirmDelete'))) return;
    
    try {
      await workoutsApi.delete(workoutId);
      invalidateHomeWeekCache(user?.id);
      toast.success(t('workouts:deleted'));
      loadTodayWorkouts();
      if (activeTab === 'agenda') loadCalendarWorkouts();
    } catch (error) {
      toast.error(t('workouts:deleteError'));
    }
  };

  const handleDuplicate = async (workoutIds, offsetDays = 7) => {
    try {
      await workoutsApi.duplicate({
        workout_ids: workoutIds,
        offset_days: offsetDays,
        repeat_weeks: 1,
      });
      toast.success(t('workouts:duplicated'));
      loadCalendarWorkouts();
      setSelectMode(false);
      setSelectedWorkouts([]);
    } catch (error) {
      toast.error(t('workouts:duplicateError'));
    }
  };

  const toggleWorkoutSelection = (workoutId) => {
    setSelectedWorkouts((prev) =>
      prev.includes(workoutId)
        ? prev.filter((id) => id !== workoutId)
        : [...prev, workoutId]
    );
  };

  const getWorkoutsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return calendarWorkouts.filter((w) => w.scheduled_date === dateStr && !w.is_draft);
  };

  const selectedDateWorkouts = getWorkoutsForDate(selectedDate);
  const selectedDayRelation = getDayRelation(selectedDate);
  const canManageStreakDay = selectedDayRelation !== 'past';
  const selectedStreakType = getStreakDayType(selectedDate);
  // Les brouillons ne doivent pas apparaître dans la liste « Séances »
  const publishedToday = todayWorkouts.filter((w) => !w.is_draft);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-500';
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-500';
      case 'abandoned':
        return 'bg-red-500/20 text-red-500';
      default:
        return 'bg-hover text-muted';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <Trophy size={18} />;
      case 'in_progress':
        return <Play size={18} />;
      default:
        return <Clock size={18} />;
    }
  };

  const renderWorkoutCard = (workout, showSelect = false) => (
    <div
      key={workout.id}
      data-testid={`workout-item-${workout.id}`}
      className={`card p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 w-full max-w-full min-w-0 overflow-hidden transition-all ${
        showSelect && selectedWorkouts.includes(workout.id)
          ? 'ring-2 ring-[var(--theme-primary)]'
          : ''
      }`}
    >
      {showSelect && (
        <button
          onClick={() => toggleWorkoutSelection(workout.id)}
          className="shrink-0"
        >
          {selectedWorkouts.includes(workout.id) ? (
            <CheckSquare className="text-[var(--theme-primary)]" size={22} />
          ) : (
            <Square className="text-subtle" size={22} />
          )}
        </button>
      )}

      <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center ${getStatusColor(workout.status)}`}>
        {getStatusIcon(workout.status)}
      </div>

      <div className="flex-1 min-w-0 max-w-full overflow-hidden">
        <h4
          className="block min-w-0 max-w-full text-foreground font-medium break-words [overflow-wrap:anywhere] line-clamp-2"
          data-testid="selected-day-workout-title"
        >
          {workout.title}
          {workout.is_draft && (
            <span className="ml-2 inline-block shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400 align-middle">
              {t('workouts:draft')}
            </span>
          )}
        </h4>
        <p className="text-subtle text-sm min-w-0 max-w-full break-words [overflow-wrap:anywhere] line-clamp-2">
          {workout.scheduled_time || t('workouts:flexible')}
          {workout.for_user_id !== user?.id && (
            <span className="text-[var(--theme-primary)]"> • {t('workouts:forUser', { username: workout.for_username })}</span>
          )}
        </p>
      </div>

          {!showSelect && (
        <div className="flex items-center gap-1 shrink-0 ml-auto sm:ml-0">
          {(workout.status === 'pending' || workout.status === 'in_progress') &&
            workout.for_user_id === user?.id &&
            !workout.is_draft && (
            <Button
              size="sm"
              onClick={() => navigate(`/player/${workout.id}`)}
              className="bg-[var(--theme-primary)] text-foreground rounded-full px-4 sm:px-5 shrink-0"
            >
              {workout.status === 'in_progress' ? (
                <>
                  <RotateCcw size={16} className="mr-1" />
                  {t('workouts:resume')}
                </>
              ) : (
                <>
                  <Play size={16} className="mr-1" fill="currentColor" />
                  {t('workouts:go')}
                </>
              )}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 min-h-10 min-w-10 hover:bg-active rounded-full transition-colors shrink-0 inline-flex items-center justify-center">
                <MoreVertical size={18} className="text-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-surface-elevated border-border">
              <DropdownMenuItem
                onClick={() => navigate(`/workouts/${workout.id}`)}
                className="text-foreground hover:bg-active"
              >
                <Edit size={16} className="mr-2" /> {t('workouts:edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDuplicate([workout.id])}
                className="text-foreground hover:bg-active"
              >
                <Copy size={16} className="mr-2" /> {t('workouts:duplicatePlus7')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDelete(workout.id)}
                className="text-red-400 hover:bg-active"
              >
                <Trash2 size={16} className="mr-2" /> {t('workouts:delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  return (
    <div data-testid="workouts-page" className="p-5 animate-fade-in">
      <PageHeader
        title={t('workouts:title')}
        actions={
          <Button
            onClick={() => navigate('/create')}
            size="sm"
            className="bg-[var(--theme-primary)] text-foreground rounded-full px-4"
            data-testid="workouts-new-btn"
          >
            <Plus size={18} className="mr-1" /> {t('workouts:new')}
          </Button>
        }
      />

      {liveSession && <PartnerLiveStatus liveSession={liveSession} className="mb-4" />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full bg-surface-elevated p-1 rounded-2xl border border-border">
          <TabsTrigger
            value="today"
            data-testid="tab-today"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-foreground"
          >
            {t('workouts:today')}
          </TabsTrigger>
          <TabsTrigger
            value="agenda"
            data-testid="tab-agenda"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-foreground"
          >
            {t('workouts:agenda')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          {publishedToday.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-hover flex items-center justify-center mb-4">
                <CalendarIcon className="text-subtle" size={28} />
              </div>
              <p className="text-muted mb-4">{t('workouts:emptyToday')}</p>
              <Button
                onClick={() => navigate('/create')}
                className="bg-[var(--theme-primary)] text-foreground"
              >
                {t('workouts:schedule')}
              </Button>
            </div>
          ) : publishedToday.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {publishedToday.map((workout) => renderWorkoutCard(workout))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4 w-full max-w-full min-w-0 overflow-hidden">
          <div className="grid gap-4 lg:grid-cols-12 w-full max-w-full min-w-0">
            <div className="space-y-4 lg:col-span-7 min-w-0 max-w-full overflow-hidden">
              <div className="card p-4 min-w-0 max-w-full overflow-hidden">
                {agendaLoading ? (
                  <div className="space-y-4 py-6">
                    <div className="h-5 w-40 rounded bg-hover animate-pulse mx-auto" />
                    <div className="h-[320px] w-full rounded-xl bg-hover animate-pulse" />
                  </div>
                ) : (
                  <AgendaCalendar
                    month={currentMonth}
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    onMonthChange={setCurrentMonth}
                    dayMap={calendarDayMap}
                    myAccent={myAccent}
                    partnerAccent={partnerAccent}
                    streak={duoStreak}
                  />
                )}
              </div>

              {calendarDayMap[format(selectedDate, 'yyyy-MM-dd')] && (
                <SelectedDaySummary
                  state={calendarDayMap[format(selectedDate, 'yyyy-MM-dd')]}
                  myAccent={myAccent}
                />
              )}
            </div>

            <div
              className="space-y-4 lg:col-span-5 w-full max-w-full min-w-0 overflow-hidden"
              data-testid="selected-day-detail-panel"
            >
              {/* Selection mode toolbar */}
              {selectMode && (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-surface-elevated rounded-xl border border-border w-full max-w-full min-w-0 overflow-hidden">
                  <span className="text-sm text-muted flex-1 min-w-0">
                    {t('workouts:selected', { count: selectedWorkouts.length })}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDuplicate(selectedWorkouts, 7)}
                    disabled={selectedWorkouts.length === 0}
                    className="text-foreground border-border shrink-0"
                  >
                    {t('workouts:plus7')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDuplicate(selectedWorkouts, 14)}
                    disabled={selectedWorkouts.length === 0}
                    className="text-foreground border-border shrink-0"
                  >
                    {t('workouts:plus14')}
                  </Button>
                  <button
                    onClick={() => {
                      setSelectMode(false);
                      setSelectedWorkouts([]);
                    }}
                    className="p-2 hover:bg-active rounded-lg shrink-0"
                  >
                    <X size={18} className="text-muted" />
                  </button>
                </div>
              )}

              <div className="w-full max-w-full min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
                  <h3 className="text-foreground font-medium min-w-0 max-w-full break-words [overflow-wrap:anywhere] line-clamp-2">
                    {formatWeekdayDate(selectedDate)}
                  </h3>
                  {selectedDateWorkouts.length > 0 && (
                    <button
                      onClick={() => setSelectMode(!selectMode)}
                      className="text-sm text-[var(--theme-primary)] shrink-0"
                    >
                      {selectMode ? t('workouts:cancel') : t('workouts:select')}
                    </button>
                  )}
                </div>

                {selectedDateWorkouts.length === 0 ? (
                  <div className="card p-6 text-center w-full max-w-full min-w-0 overflow-hidden">
                    <p className="text-subtle text-sm">{t('workouts:emptyDay')}</p>
                  </div>
                ) : (
                  <div className="space-y-3 w-full max-w-full min-w-0 overflow-hidden">
                    {selectedDateWorkouts.map((workout) =>
                      renderWorkoutCard(workout, selectMode)
                    )}
                  </div>
                )}

                {canManageStreakDay ? (
                  <div className="card p-4 space-y-3" data-testid="agenda-streak-actions">
                    <p className="text-sm font-medium text-foreground">{t('home:manageStreakDay', { ns: 'home' })}</p>
                    {selectedStreakType ? (
                      <>
                        <p className={`rounded-xl px-3 py-2 text-center text-sm ${
                          selectedStreakType === 'rest' ? 'bg-blue-500/15 text-blue-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {selectedStreakType === 'rest'
                            ? t('home:restDayActive', { ns: 'home' })
                            : t('home:skipDayActive', { ns: 'home' })}
                        </p>
                        <Button
                          onClick={() => handleRemoveStreakDay(selectedDate)}
                          data-testid="agenda-remove-streak-day-btn"
                          className="w-full h-11 rounded-xl bg-active hover:bg-active text-foreground"
                        >
                          <Undo2 size={16} className="mr-2" />
                          {t('home:removeMarker', { ns: 'home' })}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleMarkRestDay(selectedDate)}
                          data-testid="agenda-mark-rest-day-btn"
                          className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-foreground"
                        >
                          <BedDouble size={16} className="mr-2" />
                          {t('home:restDay', { ns: 'home' })}
                        </Button>
                        <Button
                          onClick={() => handleMarkSkipDay(selectedDate)}
                          data-testid="agenda-mark-skip-day-btn"
                          className="w-full h-11 rounded-xl bg-red-600/80 hover:bg-red-600 text-foreground"
                        >
                          <XCircle size={16} className="mr-2" />
                          {t('home:skipDay', { ns: 'home' })}
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SelectedDaySummary({ state, myAccent }) {
  const { t } = useTranslation('workouts');
  const labels = [];
  if (state.both_completed) labels.push(t('markers.duo'));
  else {
    if (state.partner_completed) labels.push(t('markers.partner'));
  }
  if (state.rest) labels.push(t('markers.rest'));
  if (labels.length === 0 && state.has_planned) labels.push(t('markers.planned'));

  if (labels.length === 0) return null;

  return (
    <div
      className="mb-3 flex flex-wrap gap-2 p-3 rounded-2xl border border-border bg-surface-elevated/80"
      style={{ borderLeftColor: state.both_completed ? '#fbbf24' : myAccent, borderLeftWidth: 3 }}
    >
      {labels.map((l) => (
        <span
          key={l}
          className="text-[11px] px-2.5 py-1 rounded-full bg-hover text-muted"
        >
          {l}
        </span>
      ))}
    </div>
  );
}
