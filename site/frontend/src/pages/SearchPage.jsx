import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Users, Heart, Loader2, Lock, Globe, ChevronLeft } from 'lucide-react';
import { usersApi } from '../lib/api';
import { duoProfilePath } from '../lib/duoProfile';
import { UserAvatar } from '../components/UserAvatar';
import { formatHandle, getDisplayName, getPublicHandle } from '../lib/userProfile';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

const TABS = [
  { id: 'user', label: 'Utilisateurs', icon: Users },
  { id: 'duo', label: 'Duos', icon: Heart },
];

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

  return (
    <div data-testid="search-page" className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:text-white"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white font-['Outfit']">Recherche</h1>
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={
            activeTab === 'user'
              ? 'Pseudo, @arobase ou @username exact…'
              : 'Nom de duo ou LesGuerriers#1042…'
          }
          autoFocus
          className="pl-10 h-12 rounded-xl bg-[#141414] border-white/10 text-white"
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
                  ? 'bg-[var(--theme-surface-active)] text-white border border-[var(--theme-primary)]/30'
                  : 'bg-white/5 text-zinc-400 hover:text-white'
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
                  <p className="text-white font-medium truncate">{getDisplayName(result)}</p>
                  <p className="text-zinc-500 text-sm">{formatHandle(result)}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {result.account_visibility === 'public' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-400/80">
                        <Globe size={10} /> Public
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
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
                <Button
                  asChild
                  size="sm"
                  className="rounded-xl btn-primary text-white shrink-0"
                >
                  <Link to={`/profile/${handle}`}>Voir profil</Link>
                </Button>
              </div>
            );
          })}
          {searched && results.length === 0 ? (
            <div className="text-center py-14 text-zinc-500 text-sm">
              Aucun utilisateur trouvé.
            </div>
          ) : null}
          {!searched ? (
            <div className="text-center py-14 text-zinc-600 text-sm">
              Tape au moins 2 caractères ou un @arobase exact.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((duo) => (
            <div key={duo.id} className="card p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[var(--theme-secondary)]/20 flex items-center justify-center shrink-0">
                <Heart size={20} className="text-[var(--theme-secondary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{duo.name}</p>
                <p className="text-zinc-500 text-sm font-mono">{duo.tag}</p>
                <p className="text-zinc-600 text-xs mt-1">{duo.member_count} membres</p>
              </div>
              <Button
                asChild
                size="sm"
                className="rounded-xl btn-primary text-white shrink-0"
              >
                <Link to={duoProfilePath(duo.tag)}>Voir profil</Link>
              </Button>
            </div>
          ))}
          {searched && results.length === 0 ? (
            <div className="text-center py-14">
              <p className="text-zinc-500 text-sm">Aucun duo trouvé.</p>
              <p className="text-zinc-600 text-xs mt-2">
                Les profils duo apparaissent quand deux partenaires sont liés.
              </p>
            </div>
          ) : null}
          {!searched ? (
            <div className="text-center py-14 text-zinc-600 text-sm">
              Recherche par nom ou identifiant unique (ex. LesGuerriers#1042).
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
