import { useState, useEffect, useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import { duoProfilesApi } from '../../lib/api';
import { PostCard } from '../social/PostCard';
import { ProfileEmptyState } from '../profile/ProfileEmptyState';
import { Loader2 } from 'lucide-react';
import { canViewDuoSection } from '../../lib/duoProfile';

export function DuoPostFeed({ duoProfile, viewer }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const tag = duoProfile?.tag;

  const canView = canViewDuoSection(duoProfile, 'posts');

  const load = useCallback(async () => {
    if (!tag || !canView) {
      setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await duoProfilesApi.getPosts(tag);
      setPosts(data || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [tag, canView]);

  useEffect(() => {
    load();
  }, [load]);

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

  if (posts.length === 0) {
    return (
      <ProfileEmptyState
        icon={LayoutGrid}
        title="Aucune publication"
        description="Le mur duo est vide pour le moment."
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="duo-post-feed">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} viewer={viewer} onUpdate={load} showRepostAction={false} />
      ))}
    </div>
  );
}
