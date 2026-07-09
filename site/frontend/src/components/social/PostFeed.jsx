import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PostCard } from './PostCard';
import { ProfileEmptyState } from '../profile/ProfileEmptyState';
import { postsApi } from '../../lib/api';
import { getPublicHandle } from '../../lib/userProfile';

export function PostFeed({
  profileUser,
  viewer,
  mode = 'posts',
  emptyIcon,
  emptyTitle,
  emptyDescription,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const handle = getPublicHandle(profileUser);
    if (!handle) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'reposts') {
        const { data } = await postsApi.getRepostsByHandle(handle);
        setItems(
          (data || [])
            .filter((r) => r.post)
            .map((r) => ({ ...r.post, _repostId: r.id, is_repost: true }))
        );
      } else {
        const { data } = await postsApi.getByHandle(handle);
        setItems(data || []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profileUser, mode]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-7 h-7 animate-spin text-[var(--theme-primary)]" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <ProfileEmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-4">
      {items.map((post) => (
        <PostCard
          key={post._repostId || post.id}
          post={post}
          viewer={viewer}
          onUpdate={load}
          onDelete={() => load()}
          isRepost={!!post.is_repost}
          showRepostAction={mode === 'posts'}
        />
      ))}
    </div>
  );
}
