import { toast } from 'sonner';
import { buildPublicPostUrl } from './publicMarketingConfig';

function resolveAuthorHandle(post) {
  const raw =
    post?.author_handle ||
    post?.author_username ||
    post?.actor?.handle ||
    post?.actor?.username ||
    post?.author_display_name ||
    post?.actor?.name ||
    'FitGather';
  const handle = String(raw).replace(/^@/, '').trim() || 'FitGather';
  return `@${handle}`;
}

/**
 * Payload de partage unifié — titre, texte et URL propres (sans placeholders ni tabulations).
 */
export function buildPostSharePayload(post, { t } = {}) {
  const postId = typeof post === 'string' ? post : post?.id;
  const url = buildPublicPostUrl(postId);
  const authorHandle = resolveAuthorHandle(typeof post === 'string' ? {} : post);
  const title = t
    ? t('public:post.byAuthor', { name: authorHandle })
    : `Publication de ${authorHandle} sur FitGather`;
  const text = t
    ? t('public:post.shareBody')
    : 'Découvrez cette publication sur FitGather.';
  const clipboardText = `${title}\n\n${text}\n\n${url}`;
  return { postId, url, title, text, clipboardText };
}

/**
 * Partage le lien canonique fitgather.fr/post/:id (jamais d'hôte legacy).
 */
export async function sharePublicPost(postOrId, { t, copiedMessage, failedMessage } = {}) {
  const payload =
    postOrId && typeof postOrId === 'object' && postOrId.url
      ? postOrId
      : buildPostSharePayload(
          typeof postOrId === 'string' ? { id: postOrId } : postOrId,
          { t }
        );

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      });
      return { ok: true, method: 'share', ...payload };
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { ok: false, aborted: true, ...payload };
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload.clipboardText);
      if (copiedMessage) toast.success(copiedMessage);
      return { ok: true, method: 'clipboard', ...payload };
    }
  } catch {
    // fall through
  }

  if (failedMessage) toast.error(failedMessage);
  return { ok: false, ...payload };
}
