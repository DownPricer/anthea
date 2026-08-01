import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Share2, ArrowLeft, Loader2, Lock } from 'lucide-react';
import { AntheaLogo } from '../components/branding/AntheaLogo';
import { Button } from '../components/ui/button';
import { PublicPostCard } from '../components/public/PublicPostCard';
import { JoinFitGatherModal } from '../components/public/JoinFitGatherModal';
import { PostCard } from '../components/social/PostCard';
import { useAuth } from '../context/AuthContext';
import { publicPostsApi, resolveMediaUrl } from '../lib/api';
import { sharePublicPost } from '../lib/sharePublicPost';
import { withNextParam } from '../lib/safeNextPath';
import { PUBLIC_SITE_ORIGIN } from '../lib/publicMarketingConfig';
import { usePublicSeo } from '../hooks/usePublicSeo';

export function PublicPostPage() {
  const { postId } = useParams();
  const { t } = useTranslation(['public', 'common']);
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ status: 'loading' });
  const [joinOpen, setJoinOpen] = useState(false);

  const nextPath = `/post/${postId}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!postId) {
        setState({ status: 'unavailable' });
        return;
      }
      setState({ status: 'loading' });
      try {
        const { data } = await publicPostsApi.getOne(postId);
        if (cancelled) return;
        if (data?.status === 'visible' && data.post) {
          setState({ status: 'visible', post: data.post });
        } else if (data?.status === 'locked') {
          setState({ status: 'locked', reason: data.reason || 'authentication_required' });
        } else {
          setState({ status: 'unavailable' });
        }
      } catch (err) {
        if (cancelled) return;
        const code = err?.response?.status;
        if (code === 403) {
          setState({ status: 'locked', reason: 'authentication_required' });
        } else {
          setState({ status: 'unavailable' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, user?.id]);

  const visiblePost = state.status === 'visible' ? state.post : null;
  const authorName =
    visiblePost?.author_display_name ||
    visiblePost?.author_username ||
    visiblePost?.actor?.name ||
    'FitGather';
  const resolvedImage = visiblePost?.image_url ? resolveMediaUrl(visiblePost.image_url) : '';
  const ogImage =
    state.status === 'visible' && resolvedImage
      ? resolvedImage.startsWith('http')
        ? resolvedImage
        : `${PUBLIC_SITE_ORIGIN}${resolvedImage}`
      : undefined;

  usePublicSeo({
    title:
      state.status === 'visible'
        ? t('post.byAuthor', { name: authorName })
        : state.status === 'locked'
          ? t('seo.postLockedTitle')
          : state.status === 'unavailable'
            ? t('seo.postUnavailableTitle')
            : t('seo.landingTitle'),
    description:
      state.status === 'visible'
        ? String(visiblePost?.description || visiblePost?.title || t('seo.landingDescription')).slice(0, 160)
        : t('seo.landingDescription'),
    canonicalPath: `/post/${postId || ''}`,
    image: state.status === 'visible' ? ogImage : `${PUBLIC_SITE_ORIGIN}/icons/icon-512.png`,
    noindex: state.status === 'locked' || state.status === 'unavailable',
  });

  const handleShare = async () => {
    await sharePublicPost(visiblePost || { id: postId }, {
      t,
      copiedMessage: t('post.shareCopied'),
      failedMessage: t('post.shareFailed'),
    });
  };

  const openJoin = () => setJoinOpen(true);
  const showBody = !authLoading && state.status !== 'loading';

  return (
    <div className="min-h-screen bg-background" data-testid="public-post-page">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2" data-testid="public-post-brand">
            <AntheaLogo className="h-8 w-8" />
            <span className="font-black font-['Outfit']">{t('common:app.brand')}</span>
          </Link>
          {!user && !authLoading ? (
            <div className="flex gap-2">
              <Button asChild variant="ghost" className="h-9 rounded-xl">
                <Link to={withNextParam('/login', nextPath)}>{t('post.login')}</Link>
              </Button>
              <Button asChild className="h-9 rounded-xl btn-primary font-bold">
                <Link to={withNextParam('/register', nextPath)}>{t('post.register')}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" className="h-9 rounded-xl -ml-2">
            <Link to="/" data-testid="public-post-back">
              <ArrowLeft size={16} className="mr-1" />
              {t('post.backHome')}
            </Link>
          </Button>
          {state.status === 'visible' ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-xl"
              onClick={handleShare}
              data-testid="public-post-share"
            >
              <Share2 size={16} className="mr-1.5" />
              {t('post.share')}
            </Button>
          ) : null}
        </div>

        {(state.status === 'loading' || authLoading) && (
          <div className="flex justify-center py-16" data-testid="public-post-loading">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--theme-primary)]" />
          </div>
        )}

        {showBody && state.status === 'unavailable' ? (
          <div
            className="rounded-2xl border border-border bg-surface-elevated p-8 text-center space-y-3"
            data-testid="public-post-unavailable"
          >
            <p className="text-foreground font-semibold">{t('post.unavailable')}</p>
            <Button asChild className="btn-primary rounded-xl">
              <Link to="/">{t('post.backHome')}</Link>
            </Button>
          </div>
        ) : null}

        {showBody && state.status === 'locked' ? (
          <div
            className="rounded-2xl border border-border bg-surface-elevated p-8 text-center space-y-4"
            data-testid="public-post-locked"
          >
            <Lock className="mx-auto text-subtle" size={28} />
            <p className="text-foreground font-semibold">{t('post.locked')}</p>
            {!user ? (
              <Button asChild className="btn-primary rounded-xl">
                <Link to={withNextParam('/login', nextPath)} data-testid="public-post-locked-cta">
                  {t('post.lockedCta')}
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-muted">{t('post.locked')}</p>
            )}
          </div>
        ) : null}

        {showBody && state.status === 'visible' && visiblePost ? (
          user ? (
            <PostCard post={visiblePost} viewer={user} showRepostAction />
          ) : (
            <PublicPostCard post={visiblePost} onRequireAuth={openJoin} />
          )
        ) : null}
      </main>

      <JoinFitGatherModal open={joinOpen} onClose={() => setJoinOpen(false)} nextPath={nextPath} />
    </div>
  );
}
