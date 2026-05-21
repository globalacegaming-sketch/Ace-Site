import { useEffect } from 'react';

interface PageMetaProps {
  title: string;
  description?: string;
  /** Override canonical URL. Defaults to window.location.origin + pathname (no query/hash). */
  canonical?: string;
  /** Set to true on auth flows / thin pages to keep them out of the index. */
  noIndex?: boolean;
  /** Optional Open Graph image (absolute URL). */
  ogImage?: string;
}

/**
 * Sets document title, meta description, canonical URL, robots directives,
 * and Open Graph + Twitter card metadata. Used across all routes for SEO.
 *
 * No external dependencies (react-helmet would add ~30 kB; we set head tags
 * imperatively on mount and reset on unmount).
 */
function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  return el;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return el;
}

export function PageMeta({ title, description, canonical, noIndex, ogImage }: PageMetaProps) {
  useEffect(() => {
    document.title = title;

    if (description) {
      upsertMeta('meta[name="description"]', { name: 'description', content: description });
    }

    const url =
      canonical ||
      (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
    if (url) {
      upsertLink('canonical', url);
      upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
    }

    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Global Ace Gaming' });
    if (description) {
      upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    }
    const img = ogImage || (typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : '/logo.png');
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: img });

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    if (description) {
      upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    }
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: img });

    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    });
  }, [title, description, canonical, noIndex, ogImage]);

  return null;
}
