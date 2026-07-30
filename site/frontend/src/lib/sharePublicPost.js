import { toast } from 'sonner';
import { buildPublicPostUrl } from './publicMarketingConfig';

/**
 * Partage le lien canonique fitgather.fr/post/:id (jamais d’hôte legacy).
 */
export async function sharePublicPost(postId, { title, text, copiedMessage, failedMessage } = {}) {
  const url = buildPublicPostUrl(postId);
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({
        title: title || 'FitGather',
        text: text || '',
        url,
      });
      return { ok: true, method: 'share', url };
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { ok: false, aborted: true, url };
    }
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      if (copiedMessage) toast.success(copiedMessage);
      return { ok: true, method: 'clipboard', url };
    }
  } catch {
    // fall through
  }

  if (failedMessage) toast.error(failedMessage);
  return { ok: false, url };
}
