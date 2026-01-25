import { useEffect } from 'react';

interface PageMetaProps {
  title: string;
  description?: string;
}

/**
 * Sets document title and meta description for the page. Use in each route
 * to support SEO. No external deps.
 */
export function PageMeta({ title, description }: PageMetaProps) {
  useEffect(() => {
    document.title = title;
    let el = document.querySelector('meta[name="description"]');
    if (description) {
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', 'description');
        document.head.appendChild(el);
      }
      el.setAttribute('content', description);
    }
  }, [title, description]);
  return null;
}
