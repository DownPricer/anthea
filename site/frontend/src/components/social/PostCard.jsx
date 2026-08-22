import { useState, useEffect, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  Heart,
  MessageCircle,
  Repeat2,
  Clock,
  Zap,
  Flame,
  ChevronDown,
  Send,
  Trophy,
  Trash2,
  Users,
  Share2,
} from 'lucide-react';
import { UserAvatar } from '../UserAvatar';
import { PostImageFrame } from './PostImageFrame';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { WorkoutDetailsDrawer } from './WorkoutDetailsDrawer';
import { getBadgeRarityStyle } from '../../lib/badgeStyles';
import { BadgeArtwork } from '../badges/BadgeArtwork';
import { FeedSourceBadge } from './FeedSourceBadge';
import { formatDuration, getPublicHandle } from '../../lib/userProfile';
import { getPostActorDisplay, canDeletePost } from '../../lib/postActor';
import { DuoAvatarStack } from '../duo/DuoAvatar';
import { postsApi, formatApiError } from '../../lib/api';
import { patchPostInFeedCaches } from '../../lib/feedCache';
import { toast } from 'sonner';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { getBadgeName } from '../../i18n/badgeLabels';
import {
  formatExerciseSummaryMetrics,
  getExerciseSummaryDisplayName,
} from '../../lib/activities/formatExerciseSummary';
import { sharePublicPost } from '../../lib/sharePublicPost';

const ActivityPostBody = lazy(() => import('../activities/ActivityPostBody').then(m => ({ default: m.ActivityPostBody })));

const BADGE_ICONS = { trophy: Trophy, flame: Flame, heart: Heart, zap: Zap };

function broadcastPostPatch(postId, patch) {
  if (!postId || !patch) return;
  patchPostInFeedCaches(postId, patch);
  window.dispatchEvent(new CustomEvent('feed:post-patch', { detail: { postId, patch } }));
}

export function PostCard({
  post,
  viewer,
  onUpdate,
  onDelete,
  showRepostAction = true,
  isRepost = false,
  highlightCommentId = null,
}) {
  const { t, i18n } = useTranslation(['common', 'badges', 'home', 'workouts', 'duo', 'public']);
  const locale = (i18n?.language || 'fr').split('-')[0];
  const { formatDateTime, formatDayMonthTime } = useLocaleFormat();
  const [liked, setLiked] = useState(!!post?.is_liked);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [previewComment, setPreviewComment] = useState(post.preview_comment);
  const [allComments, setAllComments] = useState(null);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentOpen, setCommentOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [repostPending, setRepostPending] = useState(false);
  const [reposted, setReposted] = useState(!!post?.viewer_has_reposted);
  const [repostId, setRepostId] = useState(post?.viewer_repost_id || null);
  const [repostsCount, setRepostsCount] = useState(post?.reposts_count || 0);
  const [commentLikes, setCommentLikes] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [canRepost, setCanRepost] = useState(
    post?.can_repost !== false || !!post?.viewer_has_reposted
  );

  useEffect(() => {
    setReposted(!!post?.viewer_has_reposted);
    setRepostId(post?.viewer_repost_id || null);
    setRepostsCount(post?.reposts_count || 0);
    setCanRepost(post?.can_repost !== false || !!post?.viewer_has_reposted);
  }, [post?.id, post?.viewer_has_reposted, post?.viewer_repost_id, post?.reposts_count, post?.can_repost]);

  useEffect(() => {
    const onPatch = (event) => {
      const { postId, patch } = event.detail || {};
      if (!postId || postId !== post?.id || !patch) return;
      if (typeof patch.viewer_has_reposted === 'boolean') setReposted(patch.viewer_has_reposted);
      if ('viewer_repost_id' in patch) setRepostId(patch.viewer_repost_id || null);
      if (typeof patch.reposts_count === 'number') setRepostsCount(Math.max(0, patch.reposts_count));
      if (typeof patch.can_repost === 'boolean') setCanRepost(patch.can_repost);
    };
    window.addEventListener('feed:post-patch', onPatch);
    return () => window.removeEventListener('feed:post-patch', onPatch);
  }, [post?.id]);

  const isOwn = canDeletePost(post, viewer);
  const actorDisplay = getPostActorDisplay(post);
  const isDuoActor = actorDisplay.type === 'duo';
  const isCommonSession = post.type === 'duo' && !!post.partner_session_snapshot;
  const author = actorDisplay.user || {
    id: post.author_id,
    username: post.author_username,
    handle: post.author_handle,
    display_name: post.author_display_name,
    avatar_url: post.author_avatar_url,
  };
  const snapshot = post.session_snapshot;
  const rarityStyle = getBadgeRarityStyle(post.badge_rarity);

  const handleLike = async () => {
    if (!post.id || post.id.startsWith('session-')) return;
    setLikeLoading(true);
    try {
      const { data } = await postsApi.toggleLike(post.id);
      setLiked(data.is_liked);
      setLikesCount(data.likes_count);
      onUpdate?.();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLikeLoading(false);
    }
  };

  useEffect(() => {
    if (!highlightCommentId) return;
    setCommentOpen(true);
    loadAllComments(true).then(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`comment-${highlightCommentId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightCommentId, post?.id]);

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text || !post.id || post.id.startsWith('session-')) return;
    setCommentLoading(true);
    try {
      const payload = { text };
      if (replyingTo?.id) {
        payload.parent_comment_id = replyingTo.id;
      }
      const { data } = await postsApi.addComment(post.id, payload);
      setCommentText('');
      setReplyingTo(null);
      setCommentsCount(data.comments_count);
      setPreviewComment(data.preview_comment);
      if (showAllComments && data.comments) {
        setAllComments(data.comments);
      }
      onUpdate?.();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setCommentLoading(false);
    }
  };

  const loadAllComments = async (silent = false) => {
    if (allComments && !silent) {
      setShowAllComments(true);
      return;
    }
    try {
      const { data } = await postsApi.getComments(post.id);
      setAllComments(data.comments || []);
      setShowAllComments(true);
    } catch (error) {
      if (!silent) toast.error(formatApiError(error));
    }
  };

  const resolveRepostErrorMessage = (error) => {
    const detail = error?.response?.data?.detail;
    const reason = typeof detail === 'object' && detail ? detail.reason : null;
    if (reason === 'private_post' || reason === 'friends_only' || reason === 'limited_visibility') {
      return t('home:comments.repostPrivacyBlocked');
    }
    if (reason === 'own_post' || reason === 'not_allowed') {
      return t('home:comments.repostForbidden');
    }
    if (typeof detail === 'object' && detail?.message) {
      return detail.message;
    }
    if (error?.response?.status === 403) {
      return t('home:comments.repostForbidden');
    }
    return formatApiError(error) || t('home:comments.repostUnavailable');
  };

  const handleRepostToggle = async () => {
    if (repostPending || !post?.id) return;
    if (!reposted && post?.can_repost === false) return;

    const prevReposted = reposted;
    const prevRepostId = repostId;
    const prevCount = repostsCount;

    if (reposted && repostId && repostId !== 'pending') {
      const nextCount = Math.max(0, prevCount - 1);
      setRepostPending(true);
      setReposted(false);
      setRepostId(null);
      setRepostsCount(nextCount);
      const patch = { viewer_has_reposted: false, viewer_repost_id: null, reposts_count: nextCount };
      broadcastPostPatch(post.id, patch);
      try {
        await postsApi.deleteRepost(prevRepostId);
        onUpdate?.({ ...post, ...patch });
      } catch (error) {
        setReposted(prevReposted);
        setRepostId(prevRepostId);
        setRepostsCount(prevCount);
        broadcastPostPatch(post.id, {
          viewer_has_reposted: prevReposted,
          viewer_repost_id: prevRepostId,
          reposts_count: prevCount,
        });
        toast.error(resolveRepostErrorMessage(error));
      } finally {
        setRepostPending(false);
      }
      return;
    }

    if (post?.can_repost === false) {
      toast.error(t('home:comments.repostForbidden'));
      return;
    }

    const nextCount = prevCount + 1;
    setRepostPending(true);
    setReposted(true);
    setRepostsCount(nextCount);
    broadcastPostPatch(post.id, {
      viewer_has_reposted: true,
      viewer_repost_id: 'pending',
      reposts_count: nextCount,
    });
    try {
      // Toujours republier via post_id pour les publications du feed
      // (évite le chemin séance réservé propriétaire/partenaire).
      const { data } = await postsApi.repost({ post_id: post.id });
      const newId = data?.id || null;
      const already = !!data?.already_exists;
      setRepostId(newId);
      if (already) {
        setRepostsCount(prevCount > 0 ? prevCount : 1);
      }
      const patch = {
        viewer_has_reposted: true,
        viewer_repost_id: newId,
        reposts_count: already ? (prevCount > 0 ? prevCount : 1) : nextCount,
        can_repost: true,
      };
      setRepostsCount(patch.reposts_count);
      broadcastPostPatch(post.id, patch);
      onUpdate?.({ ...post, ...patch });
    } catch (error) {
      setReposted(prevReposted);
      setRepostId(prevRepostId);
      setRepostsCount(prevCount);
      const detail = error?.response?.data?.detail;
      const reason = typeof detail === 'object' && detail ? detail.reason : null;
      if (error?.response?.status === 403) {
        setCanRepost(false);
        broadcastPostPatch(post.id, {
          viewer_has_reposted: prevReposted,
          viewer_repost_id: prevRepostId,
          reposts_count: prevCount,
          can_repost: false,
          repost_block_reason: reason || 'not_allowed',
        });
      } else {
        broadcastPostPatch(post.id, {
          viewer_has_reposted: prevReposted,
          viewer_repost_id: prevRepostId,
          reposts_count: prevCount,
        });
      }
      toast.error(resolveRepostErrorMessage(error));
    } finally {
      setRepostPending(false);
    }
  };

  const handleCommentLike = async (comment) => {
    if (!post.id || post.id.startsWith('session-') || !comment?.id) return;
    try {
      const { data } = await postsApi.toggleCommentLike(post.id, comment.id);
      setCommentLikes((prev) => ({
        ...prev,
        [comment.id]: { likes_count: data.likes_count, is_liked: data.is_liked },
      }));
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const getCommentLikeState = (comment) => {
    const override = commentLikes[comment.id];
    if (override) return override;
    return {
      likes_count: comment.likes_count || 0,
      is_liked: !!comment.is_liked,
    };
  };

  const handleDelete = async () => {
    if (!window.confirm(t('common:confirmDeletePost'))) return;
    const deletedId = post.id;
    onDelete?.(deletedId);
    try {
      await postsApi.delete(deletedId);
      toast.success('Publication supprimée');
    } catch (error) {
      onUpdate?.();
      toast.error(formatApiError(error));
    }
  };

  const commentsToShow = showAllComments && allComments ? allComments : (
    previewComment ? [{ ...previewComment, replies: previewComment.replies || [] }] : []
  );

  const startReply = (comment) => {
    setCommentOpen(true);
    setReplyingTo(comment);
    const mention = comment.handle || comment.username;
    setCommentText(mention ? `@${mention.replace(/^@/, '')} ` : '');
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  const renderCommentActions = (comment) => {
    const likeState = getCommentLikeState(comment);
    return (
      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
        {comment.created_at && (
          <p className="text-subtle text-[10px]">
            {formatDayMonthTime(parseISO(comment.created_at))}
          </p>
        )}
        {!post.id?.startsWith('session-') && comment.id ? (
          <>
            <button
              type="button"
              onClick={() => handleCommentLike(comment)}
              aria-label={likeState.is_liked ? t('home:comments.unlike') : t('home:comments.like')}
              aria-pressed={likeState.is_liked}
              className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] ${
                likeState.is_liked ? 'text-[var(--theme-primary)]' : 'text-muted hover:bg-hover hover:text-foreground'
              }`}
            >
              <Heart size={15} strokeWidth={2} fill={likeState.is_liked ? 'currentColor' : 'none'} />
              {likeState.likes_count > 0 ? <span className="tabular-nums">{likeState.likes_count}</span> : null}
            </button>
            <button
              type="button"
              onClick={() => startReply(comment)}
              className="text-xs text-muted hover:text-foreground min-h-10 px-2 rounded-full hover:bg-hover"
              data-testid={`reply-btn-${comment.id}`}
            >
              {t('home:comments.reply', { defaultValue: 'Répondre' })}
            </button>
          </>
        ) : null}
      </div>
    );
  };

  const renderCommentBlock = (comment, { isReply = false } = {}) => {
    const commentUser = {
      username: comment.username,
      display_name: comment.display_name,
      avatar_url: comment.avatar_url,
      handle: comment.handle,
    };
    const commentHandle = getPublicHandle(commentUser) || comment.username;
    const mention = comment.reply_to_handle || comment.reply_to_display_name;
    return (
      <div
        key={comment.id}
        id={comment.id ? `comment-${comment.id}` : undefined}
        className={`flex gap-2 ${isReply ? 'ml-8 mt-2' : ''}`}
        data-testid={isReply ? 'comment-reply' : 'comment-root'}
      >
        <Link to={commentHandle ? `/profile/${commentHandle}` : '#'} className="shrink-0">
          <UserAvatar user={commentUser} className={isReply ? 'w-5 h-5' : 'w-6 h-6'} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-muted text-sm">
            <Link
              to={commentHandle ? `/profile/${commentHandle}` : '#'}
              className="text-foreground font-medium hover:underline"
            >
              {comment.display_name || comment.username || 'Utilisateur'}
            </Link>{' '}
            {mention && isReply ? (
              <span className="text-[var(--theme-primary)]">@{String(mention).replace(/^@/, '')} </span>
            ) : null}
            {comment.deleted
              ? t('home:comments.deleted', { defaultValue: 'Commentaire supprimé' })
              : comment.text}
          </p>
          {!comment.deleted ? renderCommentActions(comment) : null}
        </div>
      </div>
    );
  };

  const renderReplies = (comment) => {
    const replies = comment.replies || [];
    if (!replies.length) return null;
    const expanded = expandedReplies[comment.id];
    const visible = expanded ? replies : replies.slice(0, 4);
    const hiddenCount = replies.length - visible.length;
    return (
      <div className="mt-1">
        {visible.map((reply) => renderCommentBlock(reply, { isReply: true }))}
        {replies.length > 4 ? (
          <button
            type="button"
            className="text-[var(--theme-primary)] text-xs hover:underline ml-8 mt-1 min-h-10 px-2"
            onClick={() =>
              setExpandedReplies((prev) => ({ ...prev, [comment.id]: !expanded }))
            }
          >
            {expanded
              ? t('home:comments.hideReplies', { defaultValue: 'Masquer les réponses' })
              : t('home:comments.viewReplies', { count: hiddenCount || replies.length, defaultValue: `Voir les ${hiddenCount || replies.length} réponses` })}
          </button>
        ) : null}
      </div>
    );
  };

  if (!post) return null;

  return (
    <article
      className={`card p-4 space-y-3 ${isCommonSession ? 'border border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5' : ''}`}
      data-testid={`post-card-${post.id || 'unknown'}`}
    >
      {post.feed_source ? (
        <div className="flex justify-end -mt-1 mb-1">
          <FeedSourceBadge source={post.feed_source} />
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <Link to={actorDisplay.link}>
          {isDuoActor ? (
            <DuoAvatarStack
              duoProfile={actorDisplay.duoProfile}
              members={actorDisplay.members}
              className="w-10 h-10"
            />
          ) : (
            <UserAvatar user={author} className="w-10 h-10" />
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={actorDisplay.link}
              className="text-foreground font-medium hover:underline"
            >
              {actorDisplay.name}
            </Link>
            {actorDisplay.handleLabel ? (
              <span className="text-subtle text-xs">{actorDisplay.handleLabel}</span>
            ) : null}
            {isDuoActor ? (
              <span className="text-[10px] uppercase tracking-wide text-violet-400/80 bg-violet-500/10 px-1.5 py-0.5 rounded">
                Duo
              </span>
            ) : null}
            {isRepost && (
              <span className="text-subtle text-xs flex items-center gap-1">
                <Repeat2 size={12} /> Republication
              </span>
            )}
          </div>
          <p className="text-subtle text-xs">
            {post.created_at ? formatDateTime(parseISO(post.created_at)) : ''}
          </p>
        </div>
        {isOwn && !post.id?.startsWith('session-') && (
          <button
            type="button"
            onClick={handleDelete}
            className="p-2 text-subtle hover:text-red-400 transition-colors"
            aria-label={t('common:actions.delete')}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {(post.type === 'badge' || post.type === 'duo_badge') && (
        <div
          className={`rounded-2xl border p-4 text-center ${rarityStyle.border} ${rarityStyle.bg} ${rarityStyle.glow}`}
          data-testid="post-badge-card"
        >
          <p className={`text-xs uppercase tracking-wider mb-2 ${rarityStyle.text}`}>
            {rarityStyle.label}
          </p>
          <BadgeArtwork
            rarity={post.badge_rarity}
            iconKey={post.badge_icon || 'trophy'}
            locked={false}
            size={72}
            className="mx-auto mb-2"
          />
          <p className="text-foreground font-semibold">
            {getBadgeName(post.badge_id, t, post.badge_name || post.title)}
          </p>
          {post.description && (
            <p className="text-muted text-sm mt-1">{post.description}</p>
          )}
        </div>
      )}

      {post.type === 'activity' && (
        <Suspense fallback={<div className="animate-pulse bg-hover rounded-xl h-32" />}>
          <ActivityPostBody activity={post} />
        </Suspense>
      )}

      {post.type !== 'badge' && post.type !== 'duo_badge' && post.type !== 'activity' && post.title && (
        <h3 className="text-foreground font-semibold font-['Outfit']">{post.title}</h3>
      )}

      {post.description && post.type !== 'badge' && post.type !== 'duo_badge' && post.type !== 'activity' && (
        <p className="text-muted text-sm whitespace-pre-wrap">{post.description}</p>
      )}

      {post.image_url && (
        <PostImageFrame
          src={post.image_url}
          alt={post.title || 'Publication'}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}

      {isCommonSession ? (
        <span className="shared-workout-badge">
          <Users size={14} />
          {t('workouts:labels.sharedWorkout')}
        </span>
      ) : null}

      {snapshot && (
        <div className={`rounded-xl bg-hover border p-3 space-y-2 ${isCommonSession ? 'border-amber-500/20' : 'border-border'}`}>
          {isCommonSession ? (
            <p className="text-amber-400/80 text-xs uppercase tracking-wide mb-1">{t('duo:commonSession.mySession')}</p>
          ) : post.type === 'duo' && post.partner_session_snapshot ? (
            <span className="shared-workout-badge mb-1">
              <Users size={14} />
              {t('workouts:labels.sharedWorkout')}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => post.can_view_session_details && setDetailsOpen(true)}
            className={`text-left w-full ${post.can_view_session_details ? 'hover:opacity-90' : ''}`}
          >
            <p className="text-foreground font-medium">{snapshot.workout_title}</p>
          </button>
          <div className="flex flex-wrap gap-3 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatDuration(snapshot.total_time)}
            </span>
            <span className="flex items-center gap-1">
              <Zap size={14} />
              {snapshot.exercises_completed}/{snapshot.exercises_total} exercices
            </span>
            {snapshot.difficulty_felt != null && (
              <span>Diff. {snapshot.difficulty_felt}/10</span>
            )}
            {snapshot.estimated_calories > 0 && (
              <span className="flex items-center gap-1 text-orange-400/90">
                <Flame size={14} />
                ~{snapshot.estimated_calories} kcal
              </span>
            )}
          </div>
          {post.can_view_session_details &&
            Array.isArray(snapshot.exercise_summaries) &&
            snapshot.exercise_summaries.length > 0 && (
              <ul
                className="mt-2 space-y-1.5 border-t border-border pt-2"
                data-testid="workout-exercise-summaries"
              >
                {snapshot.exercise_summaries.map((entry, idx) => {
                  const name = getExerciseSummaryDisplayName(entry, locale);
                  const metrics = formatExerciseSummaryMetrics(entry, { locale });
                  if (!name) return null;
                  return (
                    <li key={`${entry.exercise_id || entry.preset_id || name}-${idx}`} className="min-w-0">
                      <p className="text-foreground text-sm font-medium truncate">{name}</p>
                      {metrics ? (
                        <p className="text-muted text-xs tabular-nums">{metrics}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          {post.can_view_session_details && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDetailsOpen(true)}
              className="text-[var(--theme-primary)] hover:text-[var(--theme-primary)] p-0 h-auto"
            >
              {t('common:actions.viewDetails')} <ChevronDown size={14} className="ml-1" />
            </Button>
          )}
        </div>
      )}

      {post.partner_session_snapshot && (
        <div className={`rounded-xl bg-hover border p-3 space-y-2 ${isCommonSession ? 'border-amber-500/20' : 'border-border'}`}>
          <p className="text-subtle text-xs uppercase tracking-wide">
            {isCommonSession ? 'Séance partenaire' : 'Partenaire'}
          </p>
          <p className="text-foreground font-medium">{post.partner_session_snapshot.workout_title || 'Séance'}</p>
          <div className="flex flex-wrap gap-3 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {formatDuration(post.partner_session_snapshot.total_time)}
            </span>
            <span className="flex items-center gap-1">
              <Zap size={14} />
              {post.partner_session_snapshot.exercises_completed}/{post.partner_session_snapshot.exercises_total}
            </span>
          </div>
        </div>
      )}

      {post.duo_tag && (
        <p className="text-subtle text-xs font-mono">{post.duo_tag}</p>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        {!post.id?.startsWith('session-') && (
          <>
            <button
              type="button"
              onClick={handleLike}
              disabled={likeLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                liked
                  ? 'bg-red-500/20 text-red-500'
                  : 'bg-hover text-muted hover:bg-active'
              }`}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
              <span className="text-sm">{likesCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setCommentOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                commentOpen
                  ? 'bg-[var(--theme-surface-active)] text-[var(--theme-primary)]'
                  : 'bg-hover text-muted hover:bg-active'
              }`}
            >
              <MessageCircle size={16} />
              <span className="text-sm">{commentsCount}</span>
            </button>

            {showRepostAction && !isOwn && (reposted || canRepost) && (
              <button
                type="button"
                onClick={handleRepostToggle}
                disabled={repostPending || (!reposted && !canRepost)}
                data-testid="repost-button"
                aria-pressed={reposted}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                  reposted
                    ? 'bg-[var(--theme-surface-active)] text-[var(--theme-primary)]'
                    : 'bg-hover text-muted hover:bg-active'
                }`}
              >
                <Repeat2 size={16} />
                <span className="text-sm tabular-nums">{repostsCount}</span>
                <span className="text-sm hidden sm:inline">
                  {reposted ? t('home:comments.unrepost') : t('home:comments.repost')}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                sharePublicPost(post, {
                  t,
                  copiedMessage: t('public:post.shareCopied'),
                  failedMessage: t('public:post.shareFailed'),
                })
              }
              data-testid="post-share-button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-hover text-muted hover:bg-active transition-colors ml-auto"
              aria-label={t('public:post.share')}
            >
              <Share2 size={16} />
            </button>
          </>
        )}
      </div>

      {(commentOpen || commentsToShow.length > 0) && !post.id?.startsWith('session-') && (
        <div className="space-y-3 pt-1">
          {commentsToShow.map((comment) => (
            <div key={comment.id || comment.created_at}>
              {renderCommentBlock(comment)}
              {showAllComments ? renderReplies(comment) : null}
            </div>
          ))}

          {commentsCount > 1 && !showAllComments && (
            <button
              type="button"
              onClick={() => loadAllComments()}
              className="text-[var(--theme-primary)] text-sm hover:underline min-h-10"
            >
              {t('home:comments.viewCommentsCount', { count: commentsCount })}
            </button>
          )}

          {commentOpen && (
            <div className="space-y-2">
              {replyingTo ? (
                <div className="flex items-center justify-between text-xs text-muted px-1">
                  <span>
                    {t('home:comments.replyingTo', {
                      defaultValue: 'Réponse à {{name}}',
                      name: replyingTo.display_name || replyingTo.username,
                    })}
                  </span>
                  <button type="button" onClick={cancelReply} className="text-[var(--theme-primary)] hover:underline min-h-10 px-2">
                    {t('common:actions.cancel')}
                  </button>
                </div>
              ) : null}
              <div className="flex gap-2 items-end">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('home:comments.addPlaceholder')}
                  className="flex-1 min-h-[2.5rem] max-h-32 rounded-xl bg-background border-border text-foreground text-sm resize-y"
                  rows={replyingTo ? 2 : 1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleComment();
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleComment}
                  disabled={!commentText.trim() || commentLoading}
                  className="bg-[var(--theme-primary)] text-foreground rounded-xl min-h-10 min-w-10 shrink-0"
                  aria-label={t('home:comments.send', { defaultValue: 'Envoyer' })}
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <WorkoutDetailsDrawer
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        snapshot={snapshot}
        details={post.session_details}
        canView={post.can_view_session_details}
        partnerSnapshot={post.partner_session_snapshot}
        partnerDetails={post.partner_session_details}
        canViewPartner={post.can_view_partner_session_details}
        isCommonSession={isCommonSession}
      />
    </article>
  );
}
