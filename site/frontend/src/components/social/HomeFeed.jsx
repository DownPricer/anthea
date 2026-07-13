import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Newspaper, Flame } from 'lucide-react';
import { feedApi, formatApiError } from '../../lib/api';
import { PostCard } from './PostCard';
import { ProfileEmptyState } from '../profile/ProfileEmptyState';
import { FeedSourceBadge } from './FeedSourceBadge';
import { useAuth } from '../../context/AuthContext';
import { normalizeArray } from '../../lib/normalizeArray';
import { isCommonSessionPost, commonSessionFromPost } from '../../lib/commonSession';
import { CommonDuoSessionCard } from '../duo/CommonDuoSessionCard';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import {
  getFeedCache,
  setFeedCache,
  isPostNew,
  markFeedSeenNow,
  markPostSeen,
} from '../../lib/feedCache';

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

function TrendingBadge({ rank }) {
  if (!rank) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border bg-orange-500/15 text-orange-300 border-orange-500/30">
      <Flame size={10} />
      Top {rank}
    </span>
  );
}

function NewBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border bg-cyan-500/15 text-cyan-300 border-cyan-500/30">
      Nouveau
    </span>
  );
}

function renderPostItem(post, user, theme, onUpdate, options = {}) {
  const { showTrendingRank = false } = options;
  const isNew = isPostNew(post);

  if (isCommonSessionPost(post)) {
    const ctx = commonSessionFromPost(post, user);
    if (ctx) {
      return (
        <div key={post?.id} className="space-y-2">
          <div className="flex justify-end gap-2 flex-wrap">
            {showTrendingRank && post.trending_rank ? (
              <TrendingBadge rank={post.trending_rank} />
            ) : null}
            {isNew ? <NewBadge /> : null}
            {post.feed_source ? <FeedSourceBadge source={post.feed_source} /> : null}
          </div>
          <CommonDuoSessionCard
            item={ctx.item}
            user={ctx.user}
            partner={ctx.partner}
            theme={theme}
            readOnly
          />
        </div>
      );
    }
  }

  return (
    <div key={post?.id} className="space-y-1">
      <div className="flex justify-end gap-2 flex-wrap px-1">
        {showTrendingRank && post.trending_rank ? (
          <TrendingBadge rank={post.trending_rank} />
        ) : null}
        {isNew ? <NewBadge /> : null}
      </div>
      <PostCard post={post} viewer={user} onUpdate={onUpdate} />
    </div>
  );
}

function FeedList({ posts, loading, emptyDescription, user, theme, onUpdate, showTrendingRank }) {
  const safePosts = normalizeArray(posts);

  if (loading && safePosts.length === 0) {
    return <FeedSkeleton />;
  }

  if (!loading && safePosts.length === 0) {
    return (
      <ProfileEmptyState
        icon={Newspaper}
        title="Aucun post pour le moment"
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-4">
      {safePosts.map((post) =>
        renderPostItem(post, user, theme, onUpdate, { showTrendingRank })
      )}
    </div>
  );
}

export function HomeFeed() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = searchParams.get('scope') === 'global' ? 'global' : 'following';

  const [followingPosts, setFollowingPosts] = useState(() => getFeedCache('following')?.posts || []);
  const [followingCursor, setFollowingCursor] = useState(() => getFeedCache('following')?.cursor || null);
  const [globalPosts, setGlobalPosts] = useState(() => getFeedCache('global')?.posts || []);
  const [globalCursor, setGlobalCursor] = useState(() => getFeedCache('global')?.cursor || null);
  const [trendingPosts, setTrendingPosts] = useState(() => getFeedCache('trending')?.posts || []);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [loadingTrending, setLoadingTrending] = useState(false);

  const loadFollowing = useCallback(async (cursor = null, append = false) => {
    setLoadingFollowing(true);
    try {
      const { data } = await feedApi.get({ scope: 'following', limit: 20, cursor: cursor || undefined });
      const incoming = normalizeArray(data?.posts);
      setFollowingPosts((prev) => {
        const merged = append ? [...prev, ...incoming] : incoming;
        setFeedCache('following', { posts: merged, cursor: data?.next_cursor || null });
        return merged;
      });
      setFollowingCursor(data?.next_cursor || null);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoadingFollowing(false);
    }
  }, []);

  const loadTrending = useCallback(async () => {
    setLoadingTrending(true);
    try {
      const { data } = await feedApi.getTrending({ limit: 3, window_days: 7 });
      const incoming = normalizeArray(data?.posts);
      setTrendingPosts(incoming);
      setFeedCache('trending', { posts: incoming, windowDays: data?.window_days || 7 });
      return incoming.map((p) => p.id).filter(Boolean);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('[feed trending]', err);
      setTrendingPosts([]);
      return [];
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  const loadGlobal = useCallback(async (cursor = null, append = false, excludeIds = []) => {
    setLoadingGlobal(true);
    try {
      const params = {
        scope: 'global',
        limit: 20,
        cursor: cursor || undefined,
      };
      if (excludeIds.length > 0) {
        params.exclude_ids = excludeIds.join(',');
      }
      const { data } = await feedApi.get(params);
      const incoming = normalizeArray(data?.posts);
      setGlobalPosts((prev) => {
        const merged = append ? [...prev, ...incoming] : incoming;
        setFeedCache('global', { posts: merged, cursor: data?.next_cursor || null });
        return merged;
      });
      setGlobalCursor(data?.next_cursor || null);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoadingGlobal(false);
    }
  }, []);

  const refreshScope = useCallback(async (targetScope) => {
    if (targetScope === 'following') {
      await loadFollowing(null, false);
      return;
    }
    const trendingIds = await loadTrending();
    await loadGlobal(null, false, trendingIds);
  }, [loadFollowing, loadTrending, loadGlobal]);

  useEffect(() => {
    refreshScope(scope);
  }, [scope, refreshScope]);

  useEffect(() => {
    return () => markFeedSeenNow();
  }, []);

  const handleTabChange = (value) => {
    const next = value === 'global' ? 'global' : 'following';
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('scope', next);
    setSearchParams(nextParams, { replace: true });
  };

  const handlePostUpdate = () => refreshScope(scope);

  return (
    <section data-testid="home-feed" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white font-['Outfit']">Fil d&apos;actualité</h2>
      </div>

      <Tabs value={scope} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 h-11 rounded-2xl bg-[#141414] border border-white/10 p-1">
          <TabsTrigger
            value="following"
            data-testid="feed-tab-following"
            className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 text-xs sm:text-sm"
          >
            Abonnements et amis
          </TabsTrigger>
          <TabsTrigger
            value="global"
            data-testid="feed-tab-global"
            className="rounded-full data-[state=active]:bg-white/10 data-[state=active]:text-white text-zinc-500 text-xs sm:text-sm"
          >
            Monde
          </TabsTrigger>
        </TabsList>

        <TabsContent value="following" className="mt-4 space-y-4 focus-visible:outline-none">
          <FeedList
            posts={followingPosts}
            loading={loadingFollowing}
            emptyDescription="Suis des personnes ou des duos pour voir leurs publications ici."
            user={user}
            theme={theme}
            onUpdate={handlePostUpdate}
          />
          {followingCursor ? (
            <Button
              type="button"
              variant="outline"
              disabled={loadingFollowing}
              onClick={() => loadFollowing(followingCursor, true)}
              className="w-full rounded-xl border-white/15 text-white"
            >
              {loadingFollowing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Charger plus'}
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="global" className="mt-4 space-y-6 focus-visible:outline-none">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-orange-400" />
              <h3 className="text-white font-medium text-sm">Top tendances</h3>
              <span className="text-zinc-600 text-xs">7 derniers jours</span>
            </div>
            {loadingTrending && trendingPosts.length === 0 ? (
              <FeedSkeleton />
            ) : trendingPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {normalizeArray(trendingPosts).map((post) => (
                  <div key={`trend-${post.id}`} className="card p-1">
                    {renderPostItem(post, user, theme, handlePostUpdate, { showTrendingRank: true })}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">Aucune tendance cette semaine.</p>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-white font-medium text-sm">Dernières publications</h3>
            <FeedList
              posts={globalPosts}
              loading={loadingGlobal}
              emptyDescription="Aucune publication publique récente."
              user={user}
              theme={theme}
              onUpdate={handlePostUpdate}
            />
            {globalCursor ? (
              <Button
                type="button"
                variant="outline"
                disabled={loadingGlobal}
                onClick={() => loadGlobal(globalCursor, true)}
                className="w-full rounded-xl border-white/15 text-white"
              >
                {loadingGlobal ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Charger plus'}
              </Button>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
