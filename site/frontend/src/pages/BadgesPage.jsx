import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { duoApi } from '../lib/api';
import { BadgesGrid } from '../components/BadgesGrid';

export function BadgesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    duoApi
      .getStats()
      .then(({ data }) => setBadges(data?.badges || []))
      .catch(() => setBadges([]))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const unlocked = badges.filter((b) => b.unlocked).length;

  return (
    <div
      data-testid="badges-page"
      className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto"
    >
      <header className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:text-white"
          aria-label="Retour"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white font-['Outfit']">Tous les badges</h1>
          <p className="text-zinc-500 text-sm">{unlocked}/{badges.length} débloqués</p>
        </div>
        <Trophy size={22} className="text-[var(--theme-primary)]" />
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
        </div>
      ) : badges.length === 0 ? (
        <div className="text-center py-20 text-zinc-500 text-sm">
          Aucun badge disponible pour le moment.
        </div>
      ) : (
        <div className="flex justify-center">
          <div className="w-full max-w-md mx-auto">
            <BadgesGrid badges={badges} showShare />
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          to="/profile"
          className="text-[var(--theme-primary)] text-sm hover:underline"
        >
          Retour au profil
        </Link>
      </div>
    </div>
  );
}
