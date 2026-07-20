/**
 * Cache mémoire simple pour les fils (équivalent clés React Query).
 */
const feedCache = {
  following: { posts: [], cursor: null },
  global: { posts: [], cursor: null },
  trending: { posts: [], windowDays: 7 },
};

export function getFeedCache(scope) {
  return feedCache[scope] || null;
}

export function setFeedCache(scope, data) {
  if (feedCache[scope]) {
    feedCache[scope] = { ...feedCache[scope], ...data };
  }
}

export function invalidateFeedCache() {
  feedCache.following = { posts: [], cursor: null };
  feedCache.global = { posts: [], cursor: null };
  feedCache.trending = { posts: [], windowDays: 7 };
}

/** Retire un post des caches following / global / trending. */
export function removePostFromFeedCaches(postId) {
  if (!postId) return;
  ['following', 'global', 'trending'].forEach((scope) => {
    const cached = feedCache[scope];
    if (!cached?.posts?.length) return;
    feedCache[scope] = {
      ...cached,
      posts: cached.posts.filter((p) => p?.id !== postId),
    };
  });
}

/** Réinsère un post en tête des caches où il était présent (rollback). */
export function restorePostInFeedCaches(post, scopes = ['following', 'global', 'trending']) {
  if (!post?.id) return;
  scopes.forEach((scope) => {
    const cached = feedCache[scope];
    if (!cached) return;
    const without = (cached.posts || []).filter((p) => p?.id !== post.id);
    feedCache[scope] = {
      ...cached,
      posts: [post, ...without],
    };
  });
}

const SEEN_AT_KEY = 'feed_last_seen_at';
const SEEN_IDS_KEY = 'feed_seen_post_ids';

export function getFeedLastSeenAt() {
  try {
    return localStorage.getItem(SEEN_AT_KEY) || null;
  } catch {
    return null;
  }
}

export function markFeedSeenNow() {
  try {
    localStorage.setItem(SEEN_AT_KEY, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function isPostNew(post) {
  if (!post?.created_at) return false;
  const lastSeen = getFeedLastSeenAt();
  if (!lastSeen) return false;
  return post.created_at > lastSeen;
}

export function markPostSeen(postId) {
  if (!postId) return;
  try {
    const raw = localStorage.getItem(SEEN_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    if (!ids.includes(postId)) {
      ids.push(postId);
      if (ids.length > 500) ids.shift();
      localStorage.setItem(SEEN_IDS_KEY, JSON.stringify(ids));
    }
  } catch {
    /* ignore */
  }
}
