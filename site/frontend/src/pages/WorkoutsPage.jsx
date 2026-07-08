import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi, streakApi, partnerApi } from '../lib/api';
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
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export function WorkoutsPage() {
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

  useEffect(() => {
    loadTodayWorkouts();
    partnerApi.getInfo()
      .then((res) => setPartner(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onProfileUpdate = () => {
      if (activeTab === 'agenda') loadAgendaMeta();
    };
    window.addEventListener('user:profile-updated', onProfileUpdate);
    return () => window.removeEventListener('user:profile-updated', onProfileUpdate);
  }, [activeTab, currentMonth]);

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
  }, [activeTab, currentMonth, user?.accent_color]);

  const loadAgendaMeta = async () => {
    setAgendaLoading(true);
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const ws = format(start, 'yyyy-MM-dd');
      const we = format(end, 'yyyy-MM-dd');
      const [calRes, partnerRes] = await Promise.all([
        streakApi.getCalendar(ws, we),
        partnerApi.getInfo().catch(() => ({ data: null })),
      ]);
      setCalendarDayMap(calendarDaysToMap(calRes.data?.days || []));
      setDuoStreak(calRes.data?.streak || 0);
      setPartner(partnerRes.data);
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
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      const { data } = await workoutsApi.getAll({
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
        light: true,
      });
      setCalendarWorkouts(data || []);
    } catch (error) {
      console.error('Failed to load calendar workouts:', error);
    }
  };

  const handleDelete = async (workoutId) => {
    if (!window.confirm('Supprimer cette séance ?')) return;
    
    try {
      await workoutsApi.delete(workoutId);
      toast.success('Séance supprimée');
      loadTodayWorkouts();
      if (activeTab === 'agenda') loadCalendarWorkouts();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleDuplicate = async (workoutIds, offsetDays = 7) => {
    try {
      await workoutsApi.duplicate({
        workout_ids: workoutIds,
        offset_days: offsetDays,
        repeat_weeks: 1,
      });
      toast.success('Séance(s) dupliquée(s)');
      loadCalendarWorkouts();
      setSelectMode(false);
      setSelectedWorkouts([]);
    } catch (error) {
      toast.error('Erreur lors de la duplication');
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
    return calendarWorkouts.filter((w) => w.scheduled_date === dateStr);
  };

  const selectedDateWorkouts = getWorkoutsForDate(selectedDate);
  const draftWorkouts = todayWorkouts.filter((w) => w.is_draft);
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
        return 'bg-white/5 text-zinc-400';
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
      className={`card p-4 flex items-center gap-4 transition-all ${
        showSelect && selectedWorkouts.includes(workout.id)
          ? 'ring-2 ring-[var(--theme-primary)]'
          : ''
      }`}
    >
      {showSelect && (
        <button
          onClick={() => toggleWorkoutSelection(workout.id)}
          className="flex-shrink-0"
        >
          {selectedWorkouts.includes(workout.id) ? (
            <CheckSquare className="text-[var(--theme-primary)]" size={22} />
          ) : (
            <Square className="text-zinc-500" size={22} />
          )}
        </button>
      )}

      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${getStatusColor(workout.status)}`}>
        {getStatusIcon(workout.status)}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium truncate flex items-center gap-2">
          {workout.title}
          {workout.is_draft && (
            <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">
              Brouillon
            </span>
          )}
        </h4>
        <p className="text-zinc-500 text-sm">
          {workout.scheduled_time || 'Flexible'}
          {workout.for_user_id !== user?.id && (
            <span className="text-[var(--theme-primary)]"> • Pour {workout.for_username}</span>
          )}
        </p>
      </div>

      {!showSelect && (
        <>
          {(workout.status === 'pending' || workout.status === 'in_progress') &&
            workout.for_user_id === user?.id && (
            <Button
              size="sm"
              onClick={() => navigate(`/player/${workout.id}`)}
              className="bg-[var(--theme-primary)] text-white rounded-full px-5"
            >
              {workout.status === 'in_progress' ? (
                <>
                  <RotateCcw size={16} className="mr-1" />
                  Reprendre
                </>
              ) : (
                <>
                  <Play size={16} className="mr-1" fill="currentColor" />
                  Go
                </>
              )}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <MoreVertical size={18} className="text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#141414] border-white/10">
              <DropdownMenuItem
                onClick={() => navigate(`/workouts/${workout.id}`)}
                className="text-white hover:bg-white/10"
              >
                <Edit size={16} className="mr-2" /> Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDuplicate([workout.id])}
                className="text-white hover:bg-white/10"
              >
                <Copy size={16} className="mr-2" /> Dupliquer (+7j)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDelete(workout.id)}
                className="text-red-400 hover:bg-white/10"
              >
                <Trash2 size={16} className="mr-2" /> Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
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
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white font-['Outfit']">Séances</h1>
        <Button
          onClick={() => navigate('/create')}
          size="sm"
          className="bg-[var(--theme-primary)] text-white rounded-full px-4"
        >
          <Plus size={18} className="mr-1" /> Nouvelle
        </Button>
      </header>

      {liveSession && <PartnerLiveStatus liveSession={liveSession} className="mb-4" />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full bg-[#141414] p-1 rounded-2xl border border-white/10">
          <TabsTrigger
            value="today"
            data-testid="tab-today"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Aujourd'hui
          </TabsTrigger>
          <TabsTrigger
            value="agenda"
            data-testid="tab-agenda"
            className="flex-1 rounded-full data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          {draftWorkouts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-amber-400/90">Brouillons</h3>
              {draftWorkouts.map((workout) => renderWorkoutCard(workout))}
            </div>
          )}
          {publishedToday.length === 0 && draftWorkouts.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-4">
                <CalendarIcon className="text-zinc-500" size={28} />
              </div>
              <p className="text-zinc-400 mb-4">Pas de séance aujourd'hui</p>
              <Button
                onClick={() => navigate('/create')}
                className="bg-[var(--theme-primary)] text-white"
              >
                Planifier une séance
              </Button>
            </div>
          ) : publishedToday.length > 0 ? (
            <div className="space-y-3">
              {publishedToday.map((workout) => renderWorkoutCard(workout))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          <div className="card p-4">
            {agendaLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
              </div>
            ) : (
              <AgendaCalendar
                key={`agenda-${myAccent}-${partnerAccent}`}
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

          {/* Selection mode toolbar */}
          {selectMode && (
            <div className="flex items-center gap-2 p-3 bg-[#141414] rounded-xl border border-white/10">
              <span className="text-sm text-zinc-400 flex-1">
                {selectedWorkouts.length} sélectionné(s)
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDuplicate(selectedWorkouts, 7)}
                disabled={selectedWorkouts.length === 0}
                className="text-white border-white/10"
              >
                +7 jours
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDuplicate(selectedWorkouts, 14)}
                disabled={selectedWorkouts.length === 0}
                className="text-white border-white/10"
              >
                +14 jours
              </Button>
              <button
                onClick={() => {
                  setSelectMode(false);
                  setSelectedWorkouts([]);
                }}
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X size={18} className="text-zinc-400" />
              </button>
            </div>
          )}

          {calendarDayMap[format(selectedDate, 'yyyy-MM-dd')] && (
            <SelectedDaySummary
              state={calendarDayMap[format(selectedDate, 'yyyy-MM-dd')]}
              myAccent={myAccent}
            />
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">
                {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
              </h3>
              {selectedDateWorkouts.length > 0 && (
                <button
                  onClick={() => setSelectMode(!selectMode)}
                  className="text-sm text-[var(--theme-primary)]"
                >
                  {selectMode ? 'Annuler' : 'Sélectionner'}
                </button>
              )}
            </div>

            {selectedDateWorkouts.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-zinc-500 text-sm">Aucune séance ce jour</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateWorkouts.map((workout) =>
                  renderWorkoutCard(workout, selectMode)
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SelectedDaySummary({ state, myAccent }) {
  const labels = [];
  if (state.both_completed) labels.push('Duo ✓');
  else {
    if (state.my_completed) labels.push('Toi ✓');
    if (state.partner_completed) labels.push('Partenaire ✓');
  }
  if (state.rest) labels.push('Repos');
  if (labels.length === 0 && state.has_planned) labels.push('Prévu');

  if (labels.length === 0) return null;

  return (
    <div
      className="mb-3 flex flex-wrap gap-2 p-3 rounded-2xl border border-white/10 bg-[#141414]/80"
      style={{ borderLeftColor: state.both_completed ? '#fbbf24' : myAccent, borderLeftWidth: 3 }}
    >
      {labels.map((l) => (
        <span
          key={l}
          className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-zinc-300"
        >
          {l}
        </span>
      ))}
    </div>
  );
}
