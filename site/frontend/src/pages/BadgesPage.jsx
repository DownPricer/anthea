import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { badgesApi } from '../lib/api';
import { BadgesCatalogView } from '../components/badges/BadgesCatalog';
import { PageHeader } from '../components/layout/PageHeader';

export function BadgesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = searchParams.get('scope') === 'duo' ? 'duo' : 'solo';
  const [badges, setBadges] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pairKey, setPairKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const loader =
      scope === 'duo'
        ? badgesApi.getCatalog('duo')
        : badgesApi.getMyBadges();
    loader
      .then(({ data }) => {
        if (cancelled) return;
        setBadges(data?.badges || []);
        setSummary(data?.summary || null);
        if (scope === 'duo' && user?.partner_id) {
          const pk = [user.id, user.partner_id].sort().join('_');
          setPairKey(pk);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBadges([]);
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.partner_id, scope]);

  const unlocked = summary?.unlocked ?? badges.filter((b) => b.unlocked).length;
  const total = summary?.total ?? badges.length;

  return (
    <div
      data-testid="badges-page"
      className="p-5 pb-32 md:pb-8 animate-fade-in max-w-2xl mx-auto"
    >
      <PageHeader
        title={scope === 'duo' ? 'Badges du Duo' : 'Mes badges'}
        subtitle={`${unlocked}/${total} débloqués`}
        leading={
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:text-white"
            aria-label="Retour"
          >
            <ChevronLeft size={20} />
          </button>
        }
        actions={<Trophy size={22} className="text-[var(--theme-primary)]" />}
      />

      <div className="mb-4 flex gap-2">
        <Link
          to="/badges?scope=solo"
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            scope === 'solo'
              ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)]/40 text-white'
              : 'border-white/10 text-zinc-500'
          }`}
        >
          Solo
        </Link>
        {user?.partner_id ? (
          <Link
            to="/badges?scope=duo"
            className={`px-3 py-1.5 rounded-lg text-xs border ${
              scope === 'duo'
                ? 'bg-[var(--theme-primary)]/20 border-[var(--theme-primary)]/40 text-white'
                : 'border-white/10 text-zinc-500'
            }`}
          >
            Duo
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
        </div>
      ) : (
        <BadgesCatalogView
          badges={badges}
          summary={summary}
          scope={scope}
          canPublish={scope === 'solo' || Boolean(user?.partner_id)}
          pairKey={pairKey}
        />
      )}

      <div className="mt-8 text-center">
        <Link
          to={scope === 'duo' ? '/duo' : '/profile'}
          className="text-[var(--theme-primary)] text-sm hover:underline"
        >
          {scope === 'duo' ? 'Retour au Duo' : 'Retour au profil'}
        </Link>
      </div>
    </div>
  );
}
