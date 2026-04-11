import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workoutsApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Calendar } from '../components/ui/calendar';
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
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export function WorkoutsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('today');
  const [todayWorkouts, setTodayWorkouts] = useState([]);
  const [calendarWorkouts, setCalendarWorkouts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState([]);

  useEffect(() => {
    loadTodayWorkouts();
  }, []);

  useEffect(() => {
    if (activeTab === 'agenda') {
      loadCalendarWorkouts();
    }
  }, [activeTab, currentMonth]);

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

      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getStatusColor(workout.status)}`}>
        {getStatusIcon(workout.status)}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-white font-medium truncate">{workout.title}</h4>
        <p className="text-zinc-500 text-sm">
          {workout.scheduled_time || 'Flexible'}
          {workout.for_user_id !== user?.id && (
            <span className="text-[var(--theme-primary)]"> • Pour {workout.for_username}</span>
          )}
        </p>
      </div>

      {!showSelect && (
        <>
          {workout.status === 'pending' && workout.for_user_id === user?.id && (
            <Button
              size="sm"
              onClick={() => navigate(`/player/${workout.id}`)}
              className="bg-[var(--theme-primary)] text-white rounded-lg px-4"
            >
              <Play size={16} className="mr-1" fill="currentColor" />
              Go
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
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
          className="bg-[var(--theme-primary)] text-white rounded-lg"
        >
          <Plus size={18} className="mr-1" /> Nouvelle
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full bg-[#141414] p-1 rounded-xl border border-white/10">
          <TabsTrigger
            value="today"
            data-testid="tab-today"
            className="flex-1 rounded-lg data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Aujourd'hui
          </TabsTrigger>
          <TabsTrigger
            value="agenda"
            data-testid="tab-agenda"
            className="flex-1 rounded-lg data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          {todayWorkouts.length === 0 ? (
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
          ) : (
            <div className="space-y-3">
              {todayWorkouts.map((workout) => renderWorkoutCard(workout))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4">
          {/* Calendar */}
          <div className="card p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={fr}
              className="rounded-md"
              modifiers={{
                hasWorkout: (date) => getWorkoutsForDate(date).length > 0,
              }}
              modifiersStyles={{
                hasWorkout: {
                  backgroundColor: 'var(--theme-surface-active)',
                  borderRadius: '8px',
                },
              }}
            />
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

          {/* Selected date workouts */}
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
