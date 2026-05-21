import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ExternalLink, Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '../../utils/api';
import { LazyImage } from '../LazyImage';

interface Platform {
  _id: string;
  name: string;
  description: string;
  image: string;
  gameLink: string;
  isActive: boolean;
  order: number;
}

const HOME_PLATFORM_LIMIT = 8;

export function HomePlatformsSection() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${getApiBaseUrl()}/platforms`);
        if (!cancelled && res.data.success) {
          const list = (res.data.data || []) as Platform[];
          setPlatforms(
            list
              .filter((p) => p.isActive !== false)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .slice(0, HOME_PLATFORM_LIMIT),
          );
        }
      } catch {
        if (!cancelled) setPlatforms([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      id="platforms"
      className="relative z-10 scroll-mt-20 px-3 py-10 sm:px-4 sm:py-14 lg:px-8 lg:py-16"
      aria-labelledby="home-platforms-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 text-center sm:mb-10">
          <h2
            id="home-platforms-heading"
            className="text-2xl font-bold casino-text-primary sm:text-3xl md:text-4xl"
          >
            Platforms We Have
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm casino-text-secondary sm:text-base">
            Play on trusted partner platforms—full catalog on our platforms page.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="h-10 w-10 animate-spin"
              style={{ color: 'var(--casino-highlight-gold)' }}
            />
          </div>
        ) : platforms.length === 0 ? (
          <p className="text-center text-sm casino-text-secondary">
            Platforms coming soon.{' '}
            <Link to="/platforms" className="font-semibold hover:underline" style={{ color: '#FFD700' }}>
              View platforms
            </Link>
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {platforms.map((platform) => (
              <li key={platform._id}>
                <article className="group h-full overflow-hidden rounded-xl border border-white/10 bg-black/20 transition hover:border-[#FFD700]/35 sm:rounded-2xl">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <LazyImage src={platform.image} alt={platform.name} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <h3 className="absolute bottom-2 left-2 right-2 text-sm font-bold text-white drop-shadow-md sm:text-base">
                      {platform.name}
                    </h3>
                  </div>
                  {platform.description ? (
                    <p className="line-clamp-2 px-3 py-2 text-[11px] casino-text-secondary sm:text-xs">
                      {platform.description}
                    </p>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 text-center sm:mt-8">
          <Link
            to="/platforms"
            className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold transition active:scale-95 sm:text-base"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
              color: '#0A0A0F',
              boxShadow: '0 0 15px rgba(255,215,0,0.25)',
            }}
          >
            View all platforms
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
