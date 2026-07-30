import { useEffect } from 'react';
import { PUBLIC_SITE_ORIGIN } from '../lib/publicMarketingConfig';

function upsertMeta(attr, key, content) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content || '');
}

function upsertLink(rel, href) {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Met à jour title / description / OG côté client (SPA — aperçus sociaux dynamiques limités).
 */
export function usePublicSeo({
  title,
  description,
  canonicalPath = '/',
  image,
  noindex = false,
}) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    if (description) {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:description', description);
    }
    if (title) {
      upsertMeta('property', 'og:title', title);
      upsertMeta('name', 'twitter:title', title);
    }
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'FitGather');

    const canonical = `${PUBLIC_SITE_ORIGIN}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;
    upsertLink('canonical', canonical);
    upsertMeta('property', 'og:url', canonical);

    if (image) {
      upsertMeta('property', 'og:image', image);
    }

    if (noindex) {
      upsertMeta('name', 'robots', 'noindex, nofollow');
    } else {
      const robots = document.querySelector('meta[name="robots"]');
      if (robots) robots.remove();
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, canonicalPath, image, noindex]);
}
