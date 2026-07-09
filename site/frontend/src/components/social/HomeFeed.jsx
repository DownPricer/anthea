import { useCallback, useEffect, useState } from 'react';
import { Loader2, Newspaper } from 'lucide-react';
import { feedApi } from '../../lib/api';
import { PostCard } from './PostCard';
import { ProfileEmptyState } from '../profile/ProfileEmptyState';
import { useAuth } from '../../context/AuthContext';
import { normalizeArray } from '../../lib/normalizeArray';
import { isCommonSessionPost, commonSessionFromPost } from '../../lib/commonSession';
import { CommonDuoSessionCard } from '../duo/CommonDuoSessionCard';
import { useTheme } from '../../context/ThemeContext';

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="card p-4 space-y-3 animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-white/5" />
              <div className="h-2 w-20 rounded bg-white/5" />
            </div>
          </div>
          <div className="h-16 rounded-xl bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function HomeFeed() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await feedApi.get({ limit: 15 });
      setPosts(normalizeArray(data));
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const safePosts = normalizeArray(posts);

  return (
    <section data-testid="home-feed" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white font-['Outfit']">Fil d&apos;actualité</h2>
      </div>

      {loading ? (
        <FeedSkeleton />
      ) : safePosts.length === 0 ? (
        <ProfileEmptyState
          icon={Newspaper}
          title="Aucun post pour le moment"
          description="Suis des personnes ou attends les publications publiques récentes."
        />
      ) : (
        <div className="space-y-4">
          {safePosts.map((post, idx) => {
            if (isCommonSessionPost(post)) {
              const ctx = commonSessionFromPost(post, user);
              if (ctx) {
                return (
                  <CommonDuoSessionCard
                    key={post?.id || `feed-common-${idx}`}
                    item={ctx.item}
                    user={ctx.user}
                    partner={ctx.partner}
                    theme={theme}
                    readOnly
                  />
                );
              }
            }
            return (
              <PostCard
                key={post?.id || `feed-${idx}`}
                post={post}
                viewer={user}
                onUpdate={load}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
