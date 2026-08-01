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
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated/60 p-4 transition-colors hover:border-[var(--theme-primary)]/40"
      data-testid={`public-post-card-${post.id}`}
    >
      <button
        type="button"
        className="min-w-0 flex-1 space-y-3 text-left"
        onClick={() => (onOpen ? onOpen(post) : null)}
        data-testid={`public-post-open-${post.id}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar user={author} className="h-10 w-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-medium truncate">{actorDisplay.name}</p>
            {actorDisplay.handleLabel ? (
              <span className="block truncate text-subtle text-xs">{actorDisplay.handleLabel}</span>
            ) : null}
            <p className="text-subtle text-xs">
              {post.created_at ? formatDateTime(parseISO(post.created_at)) : ''}
            </p>
          </div>
          {post.type ? (
            <span className="max-w-20 shrink-0 truncate rounded bg-hover px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-subtle">
              {post.type}
            </span>
          ) : null}
        </div>

        {post.title ? (
          <h3 className="line-clamp-2 [overflow-wrap:anywhere] text-foreground font-semibold font-['Outfit']">{post.title}</h3>
        ) : null}
        {post.description ? (
          <p className="line-clamp-4 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-muted">{post.description}</p>
        ) : null}
        {imageUrl ? (
          <div className="aspect-video overflow-hidden rounded-xl border border-border bg-overlay">
            <img
              src={imageUrl}
              alt={post.title || ''}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : null}
      </button>

      <div className="mt-3 flex min-w-0 items-center gap-1 border-t border-border/60 pt-2 text-sm text-subtle">
        <button
          type="button"
          onClick={guard}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-hover hover:text-foreground"
          data-testid={`public-post-like-${post.id}`}
          aria-label={t('common:actions.confirm')}
        >
          <Heart size={16} />
          <span>{post.likes_count || 0}</span>
        </button>
        <button
          type="button"
          onClick={guard}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-hover hover:text-foreground"
          data-testid={`public-post-comment-${post.id}`}
        >
          <MessageCircle size={16} />
          <span>{post.comments_count || 0}</span>
        </button>
        <button
          type="button"
          onClick={guard}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-hover hover:text-foreground"
          data-testid={`public-post-repost-${post.id}`}
        >
          <Repeat2 size={16} />
          <span>{post.reposts_count || 0}</span>
        </button>
        <Link
          to={postPath}
          className="ml-auto flex min-h-11 min-w-0 items-center rounded-lg px-2 text-right text-xs text-[var(--theme-primary)] hover:underline"
          data-testid={`public-post-link-${post.id}`}
        >
          {t('common:actions.seeAll')}
        </Link>
      </div>
    </article>
  );
}
