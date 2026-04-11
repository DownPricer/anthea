import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { sessionsApi, duoApi, partnerApi } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Heart,
  Flame,
  MessageCircle,
  Trophy,
  Clock,
  Zap,
  Send,
  Loader2,
  UserPlus,
  ChevronRight,
  BarChart3,
  Target,
  TrendingUp,
  Calendar,
  Activity,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const QUICK_REACTIONS = [
  { type: 'bravo', emoji: '👏', label: 'Bravo' },
  { type: 'proud', emoji: '🥹', label: 'Fier de toi' },
  { type: 'fire', emoji: '🔥', label: 'En feu' },
  { type: 'heart', emoji: '❤️', label: 'Coeur' },
  { type: 'strong', emoji: '💪', label: "T'as géré" },
];

export function DuoPage() {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  
  const [activeTab, setActiveTab] = useState('activity');
  const [sessions, setSessions] = useState([]);
  const [duoStats, setDuoStats] = useState(null);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [activeCommentSession, setActiveCommentSession] = useState(null);
  
  // Stats state
  const [detailedStats, setDetailedStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('30');
  const [statsTarget, setStatsTarget] = useState('partner'); // 'me' or 'partner'
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'stats' && partner) {
      loadDetailedStats();
    }
  }, [activeTab, statsPeriod, statsTarget, partner]);

  const loadData = async () => {
    try {
      const [sessionsRes, statsRes, partnerRes] = await Promise.all([
        sessionsApi.getAll(20),
        duoApi.getStats(),
        partnerApi.getInfo(),
      ]);
      setSessions(sessionsRes.data || []);
      setDuoStats(statsRes.data);
      setPartner(partnerRes.data);
    } catch (error) {
      console.error('Failed to load duo data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedStats = async () => {
    if (!partner) return;
    setStatsLoading(true);
    try {
      const targetUserId = statsTarget === 'partner' ? partner.id : user?.id;
      const { data } = await duoApi.getDetailedStats(statsPeriod, targetUserId);
      setDetailedStats(data);
    } catch (error) {
      console.error('Failed to load detailed stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLike = async (sessionId) => {
    try {
      const { data } = await sessionsApi.toggleLike(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, likes: data.likes } : s))
      );
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleReaction = async (sessionId, reactionType) => {
    try {
      const { data } = await sessionsApi.addReaction(sessionId, {
        session_id: sessionId,
        reaction_type: reactionType,
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, reactions: data.reactions } : s))
      );
      toast.success('Réaction ajoutée !');
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const handleComment = async (sessionId) => {
    if (!commentText.trim()) return;

    try {
      const { data } = await sessionsApi.addComment(sessionId, {
        session_id: sessionId,
        text: commentText.trim(),
      });
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, comments: data.comments } : s))
      );
      setCommentText('');
      setActiveCommentSession(null);
      toast.success('Commentaire ajouté !');
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const isLikedByMe = (session) => session.likes?.includes(user?.id);

  const formatDuration = (seconds) => {
    if (!seconds) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  // No partner state
  if (!partner) {
    return (
      <div data-testid="duo-page-no-partner" className="p-5 animate-fade-in">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Duo</h1>
          <p className="text-zinc-500 text-sm mt-1">Lie-toi à ton partenaire</p>
        </header>

        <div className="card p-8 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-[var(--theme-surface-active)] flex items-center justify-center mb-4">
            <UserPlus className="text-[var(--theme-primary)]" size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Pas encore de partenaire</h2>
          <p className="text-zinc-500 text-sm mb-6">
            Lie-toi à quelqu'un pour partager vos séances et vous motiver mutuellement !
          </p>
          <Button
            onClick={() => window.location.href = '/profile'}
            className="btn-primary text-white"
          >
            Trouver un partenaire
          </Button>
        </div>

        {sessions.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white font-['Outfit'] mb-4">Mes séances</h2>
            <div className="space-y-4">
              {sessions.filter(s => s.user_id === user?.id).map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  user={user}
                  partner={null}
                  theme={theme}
                  isLikedByMe={isLikedByMe(session)}
                  onLike={handleLike}
                  onReaction={handleReaction}
                  activeCommentSession={activeCommentSession}
                  setActiveCommentSession={setActiveCommentSession}
                  commentText={commentText}
                  setCommentText={setCommentText}
                  onComment={handleComment}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="duo-page" className="p-5 animate-fade-in">
      {/* Header with duo avatars */}
      <header className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            <div className="w-12 h-12 rounded-full bg-[var(--theme-primary)] flex items-center justify-center border-2 border-[#0A0A0A] z-10">
              <span className="text-white font-bold">
                {user?.display_name?.[0] || user?.username?.[0] || 'M'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-full bg-[var(--theme-secondary)] flex items-center justify-center border-2 border-[#0A0A0A]">
              <span className="text-white font-bold">
                {partner.display_name?.[0] || partner.username?.[0] || 'P'}
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-['Outfit']">
              {user?.display_name || user?.username} & {partner.display_name || partner.username}
            </h1>
            <p className="text-zinc-500 text-sm">
              {user?.relation_type === 'coach' ? 'Coach & Élève' : 'Partenaires'}
            </p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full bg-[#141414] p-1 rounded-xl border border-white/10">
          <TabsTrigger
            value="activity"
            data-testid="tab-activity"
            className="flex-1 rounded-lg data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Activité
          </TabsTrigger>
          <TabsTrigger
            value="stats"
            data-testid="tab-stats"
            className="flex-1 rounded-lg data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white"
          >
            Stats
          </TabsTrigger>
        </TabsList>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          {/* Duo Stats Card */}
          {duoStats && (
            <div className="card p-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {theme === 'girly' ? (
                      <Heart className="text-pink-500" size={16} fill="currentColor" />
                    ) : (
                      <Flame className="text-orange-500" size={16} />
                    )}
                    <span className="text-xl font-bold text-white">{duoStats.streak}</span>
                  </div>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Streak</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{duoStats.total_workouts_together}</p>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{duoStats.this_week_user}</p>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-wider">Toi</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{duoStats.this_week_partner}</p>
                  <p className="text-zinc-500 text-[10px] uppercase tracking-wider">
                    {partner.display_name?.split(' ')[0] || partner.username}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Weekly challenge */}
          {duoStats?.current_challenge && (
            <div className="card p-4 border-[var(--theme-primary)]/30">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="text-[var(--theme-primary)]" size={18} />
                <span className="text-white font-medium">Défi de la semaine</span>
              </div>
              <p className="text-zinc-400 text-sm mb-3">{duoStats.current_challenge.title}</p>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--theme-primary)] transition-all"
                  style={{
                    width: `${Math.min(100, (duoStats.current_challenge.current / duoStats.current_challenge.target) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-zinc-500 text-xs mt-2">
                {duoStats.current_challenge.current}/{duoStats.current_challenge.target}
              </p>
            </div>
          )}

          {/* Badges */}
          {duoStats?.badges?.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Badges</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5">
                {duoStats.badges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex-shrink-0 px-3 py-2 bg-[#141414] border border-white/10 rounded-full flex items-center gap-2"
                  >
                    <Trophy className="text-[var(--theme-primary)]" size={14} />
                    <span className="text-white text-sm whitespace-nowrap">{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity feed */}
          <div>
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">Activité récente</h2>
            {sessions.length === 0 ? (
              <div className="card p-6 text-center">
                <p className="text-zinc-500">Pas encore d'activité</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    user={user}
                    partner={partner}
                    theme={theme}
                    isLikedByMe={isLikedByMe(session)}
                    onLike={handleLike}
                    onReaction={handleReaction}
                    activeCommentSession={activeCommentSession}
                    setActiveCommentSession={setActiveCommentSession}
                    commentText={commentText}
                    setCommentText={setCommentText}
                    onComment={handleComment}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-6">
          {/* Filters */}
          <div className="flex gap-3">
            <Select value={statsTarget} onValueChange={setStatsTarget}>
              <SelectTrigger className="flex-1 h-12 rounded-xl bg-[#141414] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                <SelectItem value="partner" className="text-white">
                  {partner.display_name || partner.username}
                </SelectItem>
                <SelectItem value="me" className="text-white">Moi</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statsPeriod} onValueChange={setStatsPeriod}>
              <SelectTrigger className="w-32 h-12 rounded-xl bg-[#141414] border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-white/10">
                <SelectItem value="7" className="text-white">7 jours</SelectItem>
                <SelectItem value="30" className="text-white">30 jours</SelectItem>
                <SelectItem value="90" className="text-white">3 mois</SelectItem>
                <SelectItem value="all" className="text-white">Tout</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {statsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
            </div>
          ) : detailedStats ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="text-[var(--theme-primary)]" size={16} />
                    <span className="text-zinc-400 text-xs uppercase">Taux complétion</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{detailedStats.summary.completion_rate}%</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    {detailedStats.summary.total_completed}/{detailedStats.summary.total_sessions} séances
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="text-[var(--theme-primary)]" size={16} />
                    <span className="text-zinc-400 text-xs uppercase">Temps total</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatDuration(detailedStats.summary.total_time)}</p>
                  <p className="text-zinc-500 text-xs mt-1">
                    ~{formatDuration(detailedStats.summary.avg_time)} / séance
                  </p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-[var(--theme-primary)]" size={16} />
                    <span className="text-zinc-400 text-xs uppercase">Cette semaine</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{detailedStats.summary.this_week}</p>
                  <p className="text-zinc-500 text-xs mt-1">séances</p>
                </div>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="text-[var(--theme-primary)]" size={16} />
                    <span className="text-zinc-400 text-xs uppercase">Ce mois</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{detailedStats.summary.this_month}</p>
                  <p className="text-zinc-500 text-xs mt-1">séances</p>
                </div>
              </div>

              {/* Averages */}
              {(detailedStats.averages.fatigue_before != null || detailedStats.averages.difficulty != null) && (
                <div className="card p-4">
                  <h3 className="text-white font-medium mb-4">Moyennes</h3>
                  <div className="space-y-4">
                    {detailedStats.averages.fatigue_before != null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-400">Fatigue avant</span>
                          <span className="text-white">{detailedStats.averages.fatigue_before}/10</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 transition-all"
                            style={{ width: `${detailedStats.averages.fatigue_before * 10}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {detailedStats.averages.fatigue_after != null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-400">Fatigue après</span>
                          <span className="text-white">{detailedStats.averages.fatigue_after}/10</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${detailedStats.averages.fatigue_after * 10}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {detailedStats.averages.difficulty != null && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-400">Difficulté ressentie</span>
                          <span className="text-white">{detailedStats.averages.difficulty}/10</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--theme-primary)] transition-all"
                            style={{ width: `${detailedStats.averages.difficulty * 10}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Weekly Chart */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="text-[var(--theme-primary)]" size={18} />
                  <h3 className="text-white font-medium">7 derniers jours</h3>
                </div>
                <div className="flex items-end gap-2 h-24">
                  {detailedStats.daily_stats.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t transition-all"
                        style={{
                          height: `${Math.max(8, (day.count / Math.max(1, ...detailedStats.daily_stats.map(d => d.count))) * 80)}px`,
                          background: day.completed > 0 
                            ? 'linear-gradient(180deg, var(--theme-primary), var(--theme-secondary))' 
                            : 'rgba(255,255,255,0.1)',
                        }}
                      />
                      <span className="text-[10px] text-zinc-500">{day.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Sessions */}
              {detailedStats.recent_sessions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    Dernières séances
                  </h3>
                  <div className="space-y-2">
                    {detailedStats.recent_sessions.map((session) => (
                      <div
                        key={session.id}
                        className="card p-3 flex items-center gap-3"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          session.status === 'completed'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {session.status === 'completed' ? (
                            <Trophy size={18} />
                          ) : (
                            <Clock size={18} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm truncate">{session.workout_title}</p>
                          <p className="text-zinc-500 text-xs">
                            {session.created_at && format(parseISO(session.created_at), 'd MMM', { locale: fr })}
                            {' • '}
                            {formatDuration(session.total_time)}
                            {session.difficulty_felt && ` • Diff: ${session.difficulty_felt}/10`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm">
                            {session.exercises_completed}/{session.exercises_total}
                          </p>
                          <p className="text-zinc-500 text-xs">exercices</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-8 text-center">
              <BarChart3 className="mx-auto text-zinc-500 mb-4" size={32} />
              <p className="text-zinc-400">Aucune donnée disponible</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SessionCard({
  session,
  user,
  partner,
  theme,
  isLikedByMe,
  onLike,
  onReaction,
  activeCommentSession,
  setActiveCommentSession,
  commentText,
  setCommentText,
  onComment,
}) {
  const isOwn = session.user_id === user?.id;
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  return (
    <div
      data-testid={`session-card-${session.id}`}
      className="card p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isOwn ? 'bg-[var(--theme-primary)]' : 'bg-[var(--theme-secondary)]'
          }`}
        >
          <span className="text-white text-sm font-bold">
            {session.username?.[0]?.toUpperCase() || 'U'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium">{session.username}</span>
            {session.status === 'completed' && (
              <Trophy size={14} className="text-green-500" />
            )}
          </div>
          <p className="text-zinc-500 text-sm">{session.workout_title}</p>
        </div>
        <span className="text-zinc-500 text-xs">
          {format(parseISO(session.created_at), 'd MMM', { locale: fr })}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1 text-zinc-400">
          <Clock size={14} />
          <span>{formatDuration(session.total_time)}</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <Zap size={14} />
          <span>{session.exercises_completed}/{session.exercises_total}</span>
        </div>
        {session.difficulty_felt && (
          <div className="flex items-center gap-1 text-zinc-400">
            <span>Diff: {session.difficulty_felt}/10</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {session.notes && (
        <p className="text-zinc-400 text-sm italic">"{session.notes}"</p>
      )}

      {/* Reactions display */}
      {session.reactions?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {session.reactions.slice(-5).map((r, i) => (
            <span key={i} className="text-lg">
              {QUICK_REACTIONS.find((qr) => qr.type === r.reaction_type)?.emoji || '👍'}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <button
          onClick={() => onLike(session.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            isLikedByMe
              ? 'bg-red-500/20 text-red-500'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10'
          }`}
        >
          <Heart size={16} fill={isLikedByMe ? 'currentColor' : 'none'} />
          <span className="text-sm">{session.likes?.length || 0}</span>
        </button>

        {/* Quick reactions */}
        {QUICK_REACTIONS.slice(0, 3).map((reaction) => (
          <button
            key={reaction.type}
            onClick={() => onReaction(session.id, reaction.type)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            title={reaction.label}
          >
            <span>{reaction.emoji}</span>
          </button>
        ))}

        <button
          onClick={() =>
            setActiveCommentSession(activeCommentSession === session.id ? null : session.id)
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            activeCommentSession === session.id
              ? 'bg-[var(--theme-surface-active)] text-[var(--theme-primary)]'
              : 'bg-white/5 text-zinc-400 hover:bg-white/10'
          }`}
        >
          <MessageCircle size={16} />
          <span className="text-sm">{session.comments?.length || 0}</span>
        </button>
      </div>

      {/* Comments */}
      {(activeCommentSession === session.id || session.comments?.length > 0) && (
        <div className="space-y-3 pt-2">
          {session.comments?.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-[#141414] flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-white font-medium">
                  {comment.username?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-zinc-400 text-sm">
                  <span className="text-white font-medium">{comment.username}</span>{' '}
                  {comment.text}
                </p>
              </div>
            </div>
          ))}

          {activeCommentSession === session.id && (
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="flex-1 h-10 rounded-xl bg-[#0A0A0A] border-white/10 text-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onComment(session.id);
                }}
              />
              <Button
                size="sm"
                onClick={() => onComment(session.id)}
                disabled={!commentText.trim()}
                className="bg-[var(--theme-primary)] text-white rounded-xl"
              >
                <Send size={16} />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
