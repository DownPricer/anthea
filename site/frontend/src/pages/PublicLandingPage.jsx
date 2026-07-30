import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AntheaLogo } from '../components/branding/AntheaLogo';
import { Button } from '../components/ui/button';
import { PublicPostCard } from '../components/public/PublicPostCard';
import { JoinFitGatherModal } from '../components/public/JoinFitGatherModal';
import { publicFeedApi } from '../lib/api';
import {
  formatCommunityMemberCount,
  PUBLIC_SITE_ORIGIN,
} from '../lib/publicMarketingConfig';
import { withNextParam } from '../lib/safeNextPath';
import { usePublicSeo } from '../hooks/usePublicSeo';

const TRENDING_LIMIT = 6;

export function PublicLandingPage() {
  const { t, i18n } = useTranslation(['public', 'common']);
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinNext, setJoinNext] = useState('/');

  const memberCountLabel = formatCommunityMemberCount(i18n.language);

  usePublicSeo({
    title: t('seo.landingTitle'),
    description: t('seo.landingDescription'),
    canonicalPath: '/',
    image: `${PUBLIC_SITE_ORIGIN}/icons/icon-512.png`,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const { data } = await publicFeedApi.getTrending({ limit: TRENDING_LIMIT });
        if (!cancelled) {
          setPosts(Array.isArray(data?.posts) ? data.posts.slice(0, TRENDING_LIMIT) : []);
        }
      } catch {
        if (!cancelled) {
          setPosts([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openJoin = (post) => {
    setJoinNext(post?.id ? `/post/${post.id}` : '/');
    setJoinOpen(true);
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-testid="public-landing-page"
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-80"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--theme-primary) 28%, transparent), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, color-mix(in srgb, var(--theme-primary) 12%, transparent), transparent)',
        }}
      />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2" data-testid="public-landing-brand">
            <AntheaLogo className="h-9 w-9" />
            <span className="text-lg font-black tracking-tight font-['Outfit']">
              {t('common:app.brand')}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="h-10 rounded-xl px-3">
              <Link to={withNextParam('/login', '/')} data-testid="public-nav-login">
                {t('nav.login')}
              </Link>
            </Button>
            <Button asChild className="h-10 rounded-xl px-4 font-bold btn-primary">
              <Link to={withNextParam('/register', '/')} data-testid="public-nav-join">
                {t('nav.join')}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 pt-12 pb-10 sm:pt-16 sm:pb-14">
          <div className="max-w-2xl animate-fade-in" data-testid="public-landing-hero">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight font-['Outfit'] text-foreground leading-tight">
              {t('hero.title')}
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
              {t('hero.subtitle')}
            </p>
            <p
              className="mt-4 text-sm font-medium text-[var(--theme-primary)]"
              data-testid="public-community-stat"
            >
              {t('hero.communityStat', { count: memberCountLabel })}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="h-12 rounded-xl px-6 font-bold btn-primary">
                <Link to="/register" data-testid="public-cta-register">
                  {t('hero.ctaRegister')}
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-xl px-6">
                <Link to="/login" data-testid="public-cta-login">
                  {t('hero.ctaLogin')}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16" data-testid="public-trending-section">
          <h2 className="text-xl sm:text-2xl font-bold font-['Outfit'] text-foreground">
            {t('trending.title')}
          </h2>
          <p className="mt-2 text-sm text-muted max-w-2xl">{t('trending.subtitle')}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="public-trending-grid">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-40 rounded-2xl border border-border bg-hover animate-pulse"
                    data-testid="public-post-skeleton"
                  />
                ))
              : null}
            {!loading && error ? (
              <p className="text-sm text-muted sm:col-span-2">{t('trending.error')}</p>
            ) : null}
            {!loading && !error && posts.length === 0 ? (
              <p className="text-sm text-muted sm:col-span-2">{t('trending.empty')}</p>
            ) : null}
            {!loading &&
              posts.map((post) => (
                <PublicPostCard
                  key={post.id}
                  post={post}
                  onRequireAuth={openJoin}
                  onOpen={(p) => navigate(`/post/${p.id}`)}
                />
              ))}
          </div>
        </section>
      </main>

      <JoinFitGatherModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        nextPath={joinNext}
      />
    </div>
  );
}
