import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
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
} from 'lucide-react';
import { UserAvatar } from '../UserAvatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { WorkoutDetailsDrawer } from './WorkoutDetailsDrawer';
import { getBadgeRarityStyle } from '../../lib/badgeStyles';
import { formatDuration, formatHandle, getDisplayName } from '../../lib/userProfile';
import { postsApi, formatApiError } from '../../lib/api';
import { toast } from 'sonner';

const BADGE_ICONS = { trophy: Trophy, flame: Flame, heart: Heart, zap: Zap };

export function PostCard({
  post,
  viewer,
  onUpdate,
  onDelete,
  showRepostAction = true,
  isRepost = false,
}) {
  const [liked, setLiked] = useState(!!post.is_liked);
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
  const [repostLoading, setRepostLoading] = useState(false);

  const isOwn = viewer?.id === post.author_id;
  const author = {
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

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text || !post.id || post.id.startsWith('session-')) return;
    setCommentLoading(true);
    try {
      const { data } = await postsApi.addComment(post.id, { text });
      setCommentText('');
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

  const loadAllComments = async () => {
    if (allComments) {
      setShowAllComments(true);
      return;
    }
    try {
      const { data } = await postsApi.getComments(post.id);
      setAllComments(data.comments || []);
      setShowAllComments(true);
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const handleRepost = async () => {
    setRepostLoading(true);
    try {
      const payload = post.workout_session_id
        ? { workout_session_id: post.workout_session_id }
        : { post_id: post.id };
      await postsApi.repost(payload);
      toast.success('Republication ajoutée à ton profil');
      onUpdate?.();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setRepostLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Supprimer cette publication ?')) return;
    try {
      await postsApi.delete(post.id);
      toast.success('Publication supprimée');
      onDelete?.(post.id);
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  const commentsToShow = showAllComments && allComments ? allComments : (
    previewComment ? [previewComment] : []
  );

  return (
    <article className="card p-4 space-y-3" data-testid={`post-card-${post.id}`}>
      <div className="flex items-start gap-3">
        <Link to={`/profile/${post.author_handle || post.author_username}`}>
          <UserAvatar user={author} className="w-10 h-10" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/profile/${post.author_handle || post.author_username}`}
              className="text-white font-medium hover:underline"
            >
              {getDisplayName(author)}
            </Link>
            <span className="text-zinc-500 text-xs">{formatHandle(author)}</span>
            {isRepost && (
              <span className="text-zinc-500 text-xs flex items-center gap-1">
                <Repeat2 size={12} /> Republication
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-xs">
            {post.created_at
              ? format(parseISO(post.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })
              : ''}
          </p>
        </div>
        {isOwn && !post.id?.startsWith('session-') && (
          <button
            type="button"
            onClick={handleDelete}
            className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
            aria-label="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {post.type === 'badge' && (
        <div
          className={`rounded-2xl border p-4 text-center ${rarityStyle.border} ${rarityStyle.bg} ${rarityStyle.glow}`}
        >
          <p className={`text-xs uppercase tracking-wider mb-2 ${rarityStyle.text}`}>
            {rarityStyle.label}
          </p>
          <Trophy className={`mx-auto mb-2 ${rarityStyle.text}`} size={32} />
          <p className="text-white font-semibold">{post.title || post.badge_name}</p>
          {post.description && (
            <p className="text-zinc-400 text-sm mt-1">{post.description}</p>
          )}
        </div>
      )}

      {post.type !== 'badge' && post.title && (
        <h3 className="text-white font-semibold font-['Outfit']">{post.title}</h3>
      )}

      {post.description && post.type !== 'badge' && (
        <p className="text-zinc-300 text-sm whitespace-pre-wrap">{post.description}</p>
      )}

      {post.image_url && (
        <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
          <img
            src={post.image_url}
            alt={post.title || 'Publication'}
            className="w-full max-h-80 object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {snapshot && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
          {post.type === 'duo' && post.partner_session_snapshot ? (
            <p className="text-amber-400/80 text-xs uppercase tracking-wide mb-1">Séance commune</p>
          ) : null}
          <button
            type="button"
            onClick={() => post.can_view_session_details && setDetailsOpen(true)}
            className={`text-left w-full ${post.can_view_session_details ? 'hover:opacity-90' : ''}`}
          >
            <p className="text-white font-medium">{snapshot.workout_title}</p>
          </button>
          <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
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
          {post.can_view_session_details && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDetailsOpen(true)}
              className="text-[var(--theme-primary)] hover:text-[var(--theme-primary)] p-0 h-auto"
            >
              Voir détails <ChevronDown size={14} className="ml-1" />
            </Button>
          )}
        </div>
      )}

      {post.partner_session_snapshot && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Partenaire</p>
          <p className="text-white font-medium">{post.partner_session_snapshot.workout_title}</p>
          <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
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
        <p className="text-zinc-600 text-xs font-mono">{post.duo_tag}</p>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        {!post.id?.startsWith('session-') && (
          <>
            <button
              type="button"
              onClick={handleLike}
              disabled={likeLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                liked
                  ? 'bg-red-500/20 text-red-500'
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10'
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
                  : 'bg-white/5 text-zinc-400 hover:bg-white/10'
              }`}
            >
              <MessageCircle size={16} />
              <span className="text-sm">{commentsCount}</span>
            </button>

            {showRepostAction && !isOwn && (
              <button
                type="button"
                onClick={handleRepost}
                disabled={repostLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 transition-colors"
              >
                <Repeat2 size={16} />
                <span className="text-sm hidden sm:inline">Republier</span>
              </button>
            )}
          </>
        )}
      </div>

      {(commentOpen || commentsToShow.length > 0) && !post.id?.startsWith('session-') && (
        <div className="space-y-3 pt-1">
          {commentsToShow.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <UserAvatar
                user={{
                  username: comment.username,
                  display_name: comment.display_name,
                  avatar_url: comment.avatar_url,
                  handle: comment.handle,
                }}
                className="w-6 h-6"
              />
              <div className="flex-1 min-w-0">
                <p className="text-zinc-400 text-sm">
                  <span className="text-white font-medium">
                    {comment.display_name || comment.username}
                  </span>{' '}
                  {comment.text}
                </p>
                {comment.created_at && (
                  <p className="text-zinc-600 text-[10px] mt-0.5">
                    {format(parseISO(comment.created_at), 'd MMM HH:mm', { locale: fr })}
                  </p>
                )}
              </div>
            </div>
          ))}

          {commentsCount > 1 && !showAllComments && (
            <button
              type="button"
              onClick={loadAllComments}
              className="text-[var(--theme-primary)] text-sm hover:underline"
            >
              Voir tous les commentaires ({commentsCount})
            </button>
          )}

          {commentOpen && (
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="flex-1 h-10 rounded-xl bg-[#0A0A0A] border-white/10 text-white text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleComment();
                }}
              />
              <Button
                size="sm"
                onClick={handleComment}
                disabled={!commentText.trim() || commentLoading}
                className="bg-[var(--theme-primary)] text-white rounded-xl"
              >
                <Send size={16} />
              </Button>
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
      />
    </article>
  );
}
