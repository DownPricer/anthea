import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Repeat2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { parseISO } from 'date-fns';
import { UserAvatar } from '../UserAvatar';
import { resolveMediaUrl } from '../../lib/api';
import { useLocaleFormat } from '../../hooks/useLocaleFormat';
import { getPostActorDisplay } from '../../lib/postActor';

/**
 * Carte publication en lecture seule pour la landing / pages publiques.
 * Les interactions déclenchent onRequireAuth (aucune requête like/comment).
 */
export function PublicPostCard({ post, onRequireAuth, onOpen }) {
  const { t } = useTranslation(['public', 'common']);
  const { formatDateTime } = useLocaleFormat();
  if (!post) return null;

  const actorDisplay = getPostActorDisplay(post);
  const author = actorDisplay.user || {
    username: post.author_username,
    handle: post.author_handle,
    display_name: post.author_display_name,
    avatar_url: post.author_avatar_url,
  };
  const imageUrl = resolveMediaUrl(post.image_url);
  const postPath = `/post/${post.id}`;

  const guard = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onRequireAuth?.(post);
  };

  return (
    <article
      className="rounded-2xl border border-border bg-surface-elevated/60 p-4 space-y-3 transition-colors hover:border-[var(--theme-primary)]/40"
      data-testid={`public-post-card-${post.id}`}
    >
      <button
        type="button"
        className="w-full text-left space-y-3"
        onClick={() => (onOpen ? onOpen(post) : null)}
        data-testid={`public-post-open-${post.id}`}
      >
        <div className="flex items-start gap-3">
          <UserAvatar user={author} className="w-10 h-10" />
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-medium truncate">{actorDisplay.name}</p>
            {actorDisplay.handleLabel ? (
              <span className="text-subtle text-xs">{actorDisplay.handleLabel}</span>
            ) : null}
            <p className="text-subtle text-xs">
              {post.created_at ? formatDateTime(parseISO(post.created_at)) : ''}
            </p>
          </div>
          {post.type ? (
            <span className="text-[10px] uppercase tracking-wide text-subtle bg-hover px-1.5 py-0.5 rounded">
              {post.type}
            </span>
          ) : null}
        </div>

        {post.title ? (
          <h3 className="text-foreground font-semibold font-['Outfit'] line-clamp-2">{post.title}</h3>
        ) : null}
        {post.description ? (
          <p className="text-muted text-sm whitespace-pre-wrap line-clamp-4">{post.description}</p>
        ) : null}
        {imageUrl ? (
          <div className="rounded-xl overflow-hidden border border-border bg-overlay">
            <img
              src={imageUrl}
              alt={post.title || ''}
              className="w-full max-h-56 object-cover"
              loading="lazy"
            />
          </div>
        ) : null}
      </button>

      <div className="flex items-center gap-4 text-subtle text-sm pt-1">
        <button
          type="button"
          onClick={guard}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          data-testid={`public-post-like-${post.id}`}
          aria-label={t('common:actions.confirm')}
        >
          <Heart size={16} />
          <span>{post.likes_count || 0}</span>
        </button>
        <button
          type="button"
          onClick={guard}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          data-testid={`public-post-comment-${post.id}`}
        >
          <MessageCircle size={16} />
          <span>{post.comments_count || 0}</span>
        </button>
        <button
          type="button"
          onClick={guard}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          data-testid={`public-post-repost-${post.id}`}
        >
          <Repeat2 size={16} />
          <span>{post.reposts_count || 0}</span>
        </button>
        <Link
          to={postPath}
          className="ml-auto text-xs text-[var(--theme-primary)] hover:underline"
          data-testid={`public-post-link-${post.id}`}
        >
          {t('common:actions.seeAll')}
        </Link>
      </div>
    </article>
  );
}
