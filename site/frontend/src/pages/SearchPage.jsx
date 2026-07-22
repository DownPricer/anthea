import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Users, Heart, Loader2, Lock, Globe, ChevronLeft, UserPlus, UserMinus } from 'lucide-react';
import { usersApi, formatApiError } from '../lib/api';
import { duoProfilePath } from '../lib/duoProfile';
import { DuoAvatar } from '../components/duo/DuoAvatar';
import { DuoFollowButton } from '../components/duo/DuoFollowButton';
import { UserAvatar } from '../components/UserAvatar';
import { formatHandle, getDisplayName, getPublicHandle } from '../lib/userProfile';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const TABS = [
  { id: 'user', label: 'Utilisateurs', icon: Users },
  { id: 'duo', label: 'Duos', icon: Heart },
];

function FollowButton({ result, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const handle = getPublicHandle(result);

  const handleFollow = async () => {
    if (!handle) return;
    setLoading(true);
    try {
      const { data } = await usersApi.follow(handle);
      onUpdate(data);
      toast.success(data.follow_request_pending ? 'Demande envoyée' : 'Abonnement ajouté');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!handle) return;
    setLoading(true);
    try {
      const { data } = await usersApi.unfollow(handle);
      onUpdate(data);
      toast.success('Abonnement retiré');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  if (result.is_following) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={handleUnfollow}
        className="rounded-xl border-border text-muted shrink-0"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} className="mr-1" />}
        Ne plus suivre
      </Button>
    );
  }

  if (result.follow_request_pending) {
    return (
      <Button type="button" size="sm" disabled className="rounded-xl bg-hover text-subtle shrink-0">
        Demande envoyée
      </Button>
    );
  }

  const isPrivate = result.account_visibility === 'private' && !result.is_mutual;

  return (
    <Button
      type="button"
      size="sm"
      disabled={loading}
      onClick={handleFollow}
      className="rounded-xl btn-primary text-foreground shrink-0"
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <>
          <UserPlus size={14} className="mr-1" />
          {isPrivate ? 'Demander' : 'Suivre'}
        </>
      )}
    </Button>
  );
}

export function SearchPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('user');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async (q, tab) => {
    const trimmed = q.trim();
    setSearched(true);
    if (trimmed.length < 2 && !trimmed.startsWith('@')) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await usersApi.search(trimmed, tab);
      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value) => {
    setQuery(value);
    if (value.trim().length >= 2 || value.trim().startsWith('@')) {
      runSearch(value, activeTab);
    } else {
      setResults([]);
      setSearched(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setResults([]);
    setSearched(false);
    if (query.trim().length >= 2 || query.trim().startsWith('@')) {
      runSearch(query, tab);
    }
  };

  const updateResult = (updated) => {
    setResults((prev) =>
      prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
    );
  };

  return (
    <div data-testid="search-page" className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-hover text-muted hover:text-foreground"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-foreground font-['Outfit']">Recherche</h1>
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" size={18} />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={
            activeTab === 'user'
              ? 'Pseudo, @arobase ou @username exact…'
              : 'Nom de duo ou LesGuerriers#1042…'
          }
          autoFocus
          className="pl-10 h-12 rounded-xl bg-surface-elevated border-border text-foreground"
        />
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--theme-surface-active)] text-foreground border border-[var(--theme-primary)]/30'
                  : 'bg-hover text-muted hover:text-foreground'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
        </div>
      ) : activeTab === 'user' ? (
        <div className="space-y-2">
          {results.map((result) => {
            const handle = getPublicHandle(result);
            return (
              <div
                key={result.id}
                className="card p-4 flex items-center gap-3"
              >
                <UserAvatar user={result} className="w-12 h-12 text-lg shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium truncate">{getDisplayName(result)}</p>
                  <p className="text-subtle text-sm">{formatHandle(result)}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {result.account_visibility === 'public' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-400/80">
                        <Globe size={10} /> Public
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-subtle">
                        <Lock size={10} /> Privé
                      </span>
                    )}
                    {result.is_mutual ? (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--theme-primary)]">
                        · Ami mutuel
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <FollowButton result={result} onUpdate={updateResult} />
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-border text-foreground"
                  >
                    <Link to={`/profile/${handle}`}>Voir profil</Link>
                  </Button>
                </div>
              </div>
            );
          })}
          {searched && results.length === 0 ? (
            <div className="text-center py-14 text-subtle text-sm">
              Aucun utilisateur trouvé.
            </div>
          ) : null}
          {!searched ? (
            <div className="text-center py-14 text-subtle text-sm">
              Tape au moins 2 caractères ou un @arobase exact.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((duo) => (
            <div key={duo.id} className="card p-4 flex items-center gap-3">
              <DuoAvatar duoProfile={duo} members={duo.members} className="w-12 h-12 shrink-0" textSize="text-sm" />
              <div className="flex-1 min-w-0">
                <p className="text-foreground font-medium truncate">{duo.name}</p>
                <p className="text-subtle text-sm font-mono">{duo.tag}</p>
                <div className="flex items-center gap-2 mt-1">
                  {duo.account_visibility === 'public' ? (
                    <span className="text-[10px] uppercase text-emerald-400/80">Public</span>
                  ) : (
                    <span className="text-[10px] uppercase text-subtle">Privé</span>
                  )}
                  {duo.followers_count != null ? (
                    <span className="text-subtle text-xs">{duo.followers_count} abonnés</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                {!duo.is_member ? (
                  <DuoFollowButton duoProfile={duo} onUpdate={(d) => updateResult(d)} />
                ) : null}
                <Button asChild size="sm" className="rounded-xl btn-primary text-foreground">
                  <Link to={duoProfilePath(duo.tag)}>Voir profil</Link>
                </Button>
              </div>
            </div>
          ))}
          {searched && results.length === 0 ? (
            <div className="text-center py-14">
              <p className="text-subtle text-sm">Aucun duo trouvé.</p>
              <p className="text-subtle text-xs mt-2">
                Les profils duo apparaissent quand deux partenaires sont liés.
              </p>
            </div>
          ) : null}
          {!searched ? (
            <div className="text-center py-14 text-subtle text-sm">
              Recherche par nom ou identifiant unique (ex. LesGuerriers#1042).
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
