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
import {
  ArrowRight,
  Dumbbell,
  Heart,
  MessageCircle,
  Trophy,
  UserRoundCheck,
} from 'lucide-react';

const TRENDING_LIMIT = 6;

export function PublicLandingPage() {
  const { t, i18n } = useTranslation(['public', 'common']);
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinNext, setJoinNext] = useState('/app');

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
    setJoinNext(post?.id ? `/post/${post.id}` : '/app');
    setJoinOpen(true);
  };

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground"
      data-testid="public-landing-page"
    >
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-70"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 15% 0%, color-mix(in srgb, var(--theme-primary) 22%, transparent), transparent), radial-gradient(ellipse 55% 35% at 100% 18%, color-mix(in srgb, var(--theme-secondary) 14%, transparent), transparent)',
        }}
      />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex min-h-11 min-w-0 items-center gap-2"
            data-testid="public-landing-brand"
          >
            <AntheaLogo className="h-9 w-9 shrink-0" />
            <span className="truncate text-lg font-black tracking-tight font-['Outfit']">
              {t('common:app.brand')}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="ghost" className="min-h-11 rounded-xl px-3 sm:px-4">
              <Link to={withNextParam('/login', '/')} data-testid="public-nav-login">
                {t('nav.login')}
              </Link>
            </Button>
            <Button
              asChild
              className="hidden min-h-11 rounded-xl px-5 font-bold btn-primary sm:inline-flex"
            >
              <Link to={withNextParam('/register', '/')} data-testid="public-nav-join">
                {t('nav.join')}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:gap-16 lg:px-8 lg:py-20">
          <div
            className="min-w-0 motion-safe:animate-fade-in"
            data-testid="public-landing-hero"
          >
            <div className="max-w-2xl">
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-[var(--theme-primary)]">
                {t('hero.eyebrow')}
              </p>
              <h1 className="text-[clamp(2.25rem,9vw,3.5rem)] font-black leading-[1.04] tracking-[-0.035em] font-['Outfit'] lg:text-6xl">
                {t('hero.title')}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                {t('hero.subtitle')}
              </p>
              <p
                className="mt-4 text-sm font-semibold text-[var(--theme-primary)]"
                data-testid="public-community-stat"
              >
                {t('hero.communityStat', { count: memberCountLabel })}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="min-h-12 w-full rounded-xl px-6 font-bold btn-primary sm:w-auto"
                >
                  <Link to="/register" data-testid="public-cta-register">
                    {t('hero.ctaRegister')}
                    <ArrowRight className="ml-2" size={18} aria-hidden />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="min-h-12 w-full rounded-xl px-6 sm:w-auto"
                >
                  <Link to="/login" data-testid="public-cta-login">
                    {t('hero.ctaLogin')}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div
            className="relative min-w-0 rounded-[2rem] border border-border bg-surface-elevated/70 p-3 shadow-[0_24px_70px_var(--shadow-color)] sm:p-5"
            data-testid="public-hero-preview"
          >
            <div className="rounded-2xl border border-border bg-background/90 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--theme-surface-active)] text-[var(--theme-primary)]">
                  <Dumbbell size={21} aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{t('hero.previewWorkoutTitle')}</p>
                  <p className="text-xs text-subtle">{t('hero.previewWorkoutMeta')}</p>
                </div>
                <span className="ml-auto shrink-0 rounded-full bg-[var(--theme-surface-active)] px-2.5 py-1 text-xs font-bold text-[var(--theme-primary)]">
                  +12%
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {['42 min', '8,4 km', '620 kcal'].map((value) => (
                  <div key={value} className="min-w-0 rounded-xl bg-hover p-2.5 text-center">
                    <p className="truncate text-sm font-bold sm:text-base">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-background/90 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Heart size={18} className="text-[var(--theme-primary)]" aria-hidden />
                  {t('hero.previewEncouragement')}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {t('hero.previewEncouragementBody')}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-background/90 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle size={18} className="text-[var(--theme-primary)]" aria-hidden />
                  {t('hero.previewCommunity')}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {t('hero.previewCommunityBody')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
          data-testid="public-trending-section"
        >
          <h2 className="text-2xl font-black tracking-tight font-['Outfit'] text-foreground sm:text-3xl">
            {t('trending.title')}
          </h2>
          <p className="mt-2 text-sm text-muted max-w-2xl">{t('trending.subtitle')}</p>

          <div
            className="mt-7 grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3"
            data-testid="public-trending-grid"
          >
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-h-72 rounded-2xl border border-border bg-hover motion-safe:animate-pulse"
                    data-testid="public-post-skeleton"
                  >
                    <div className="aspect-video rounded-t-2xl bg-overlay" />
                  </div>
                ))
              : null}
            {!loading && error ? (
              <p className="text-sm text-muted md:col-span-2 xl:col-span-3">{t('trending.error')}</p>
            ) : null}
            {!loading && !error && posts.length === 0 ? (
              <p className="text-sm text-muted md:col-span-2 xl:col-span-3">{t('trending.empty')}</p>
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

        <section
          className="border-y border-border/70 bg-surface-elevated/35"
          data-testid="public-benefits-section"
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black tracking-tight font-['Outfit'] sm:text-3xl">
                {t('benefits.title')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t('benefits.subtitle')}</p>
            </div>
            <div className="mt-8 grid gap-7 md:grid-cols-3">
              {[
                { key: 'tracking', Icon: Dumbbell },
                { key: 'partner', Icon: UserRoundCheck },
                { key: 'sharing', Icon: Trophy },
              ].map(({ key, Icon }) => (
                <article key={key} className="min-w-0">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--theme-surface-active)] text-[var(--theme-primary)]">
                    <Icon size={21} aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-bold font-['Outfit']">
                    {t(`benefits.items.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {t(`benefits.items.${key}.description`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div
            className="overflow-hidden rounded-[2rem] border border-[var(--theme-primary)]/25 bg-[var(--theme-surface-active)] px-5 py-9 text-center sm:px-10 sm:py-12"
            data-testid="public-final-cta"
          >
            <h2 className="text-2xl font-black tracking-tight font-['Outfit'] sm:text-4xl">
              {t('finalCta.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              {t('finalCta.body')}
            </p>
            <div className="mx-auto mt-7 flex max-w-md flex-col justify-center gap-3 sm:flex-row">
              <Button
                asChild
                className="min-h-12 w-full rounded-xl px-6 font-bold btn-primary sm:w-auto"
              >
                <Link to="/register">{t('finalCta.register')}</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="min-h-12 w-full rounded-xl px-6 sm:w-auto"
              >
                <Link to="/login">{t('finalCta.login')}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center text-xs text-subtle sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <Link to="/" className="flex min-h-11 items-center gap-2 font-bold text-foreground">
            <AntheaLogo className="h-7 w-7" />
            FitGather
          </Link>
          <p>{t('footer.tagline')}</p>
        </div>
      </footer>

      <JoinFitGatherModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        nextPath={joinNext}
      />
    </div>
  );
}
