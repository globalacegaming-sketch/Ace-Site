import { memo, useState, useCallback } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  /** Desired width for Cloudinary transform (default 400) */
  width?: number;
}

/**
 * Optimised image component:
 * - Applies Cloudinary transforms (w_, f_auto, q_auto) when the src is a
 *   Cloudinary URL, cutting payload by ~60 % on mobile.
 * - Uses loading="lazy" + decoding="async" for native browser lazy-loading.
 * - Shows a shimmer placeholder until the image is decoded.
 * - Gracefully falls back to a placeholder on error.
 */
export const LazyImage = memo(function LazyImage({
  src,
  alt,
  className = '',
  width = 400,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Cloudinary optimisation — inject transforms before the filename
  const optimisedSrc = src?.includes('cloudinary.com')
    ? src.replace(/\/upload\//, `/upload/w_${width},f_auto,q_auto/`)
    : src;

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => {
    setError(true);
    setLoaded(true);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-800">
      {/* Shimmer placeholder shown until image loads */}
      {!loaded && (
        <div className="absolute inset-0 skeleton-shimmer" />
      )}

      <img
        src={error ? `https://placehold.co/400x400/1F2937/FFFFFF?text=${encodeURIComponent(alt || 'Game')}` : optimisedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
      />
    </div>
  );
});
