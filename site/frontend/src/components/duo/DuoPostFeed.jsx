import { useState, useEffect, useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import { duoProfilesApi } from '../../lib/api';
import { PostCard } from '../social/PostCard';
import { ProfileEmptyState } from '../profile/ProfileEmptyState';
import { Loader2 } from 'lucide-react';
import { canViewDuoSection } from '../../lib/duoProfile';
import { normalizeArray } from '../../lib/normalizeArray';
import { isCommonSessionPost, commonSessionFromPost } from '../../lib/commonSession';
import { CommonDuoSessionCard } from './CommonDuoSessionCard';
import { useTheme } from '../../context/ThemeContext';

export function DuoPostFeed({ duoProfile, viewer }) {
  const { theme } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tag = duoProfile?.tag;

  const canView = duoProfile ? canViewDuoSection(duoProfile, 'posts') : false;

  const load = useCallback(async () => {
    if (!tag || !canView) {
      setPosts([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await duoProfilesApi.getPosts(tag);
      setPosts(normalizeArray(data));
    } catch {
      setPosts([]);
      setError('Impossible de charger le mur duo.');
    } finally {
      setLoading(false);
    }
  }, [tag, canView]);

  useEffect(() => {
    load();
  }, [load]);

  if (!duoProfile) {
    return (
      <ProfileEmptyState
        icon={LayoutGrid}
        title="Profil duo incomplet"
        description="Les informations duo ne sont pas encore disponibles."
      />
    );
  }

  if (!canView) {
    return (
      <ProfileEmptyState
        icon={LayoutGrid}
        title="Mur masqué"
        description="Ce duo a choisi de garder son mur privé."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  if (error) {
    return (
      <ProfileEmptyState
        icon={LayoutGrid}
        title="Erreur de chargement"
        description={error}
      />
    );
  }

  const safePosts = normalizeArray(posts);

  if (safePosts.length === 0) {
    return (
      <ProfileEmptyState
        icon={LayoutGrid}
        title="Aucune publication"
        description="Le mur duo est vide pour le moment."
      />
    );
  }

  const members = Array.isArray(duoProfile.members) ? duoProfile.members : [];

  return (
    <div className="space-y-4" data-testid="duo-post-feed">
      {safePosts.map((post, idx) => {
        if (isCommonSessionPost(post)) {
          const ctx = commonSessionFromPost(post, viewer);
          if (ctx) {
            const memberA = members.find((m) => m.id === ctx.user?.id) || ctx.user;
            const memberB = members.find((m) => m.id === ctx.partner?.id) || ctx.partner;
            return (
              <CommonDuoSessionCard
                key={post?.id || `duo-common-${idx}`}
                item={ctx.item}
                user={memberA}
                partner={memberB}
                theme={theme}
                readOnly
              />
            );
          }
        }
        return (
          <PostCard
            key={post?.id || `duo-post-${idx}`}
            post={post}
            viewer={viewer}
            onUpdate={load}
            showRepostAction={false}
          />
        );
      })}
    </div>
  );
}
