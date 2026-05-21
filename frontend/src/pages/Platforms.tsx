import { useState, useEffect } from 'react';
import { ExternalLink, MessageCircle, Loader2, LogIn } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../utils/api';
import { PageMeta } from '../components/PageMeta';
import { CosmicCard, PageShell } from '../components/cosmic';

interface Platform {
  _id: string;
  name: string;
  description: string;
  image: string;
  gameLink: string;
  isActive: boolean;
  order: number;
}

const Platforms = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const API_BASE_URL = getApiBaseUrl();

  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/platforms`);

      if (response.data.success) {
        setPlatforms(response.data.data || []);
      }
    } catch (error: unknown) {
      console.error('Failed to load platforms:', error);
      toast.error('Failed to load platforms');
    } finally {
      setLoading(false);
    }
  };

  const handleGameLink = (gameLink: string) => {
    window.open(gameLink, '_blank', 'noopener,noreferrer');
  };

  const handleRechargeNow = () => {
    if (!isAuthenticated) {
      toast.error('Please login to recharge your account');
      navigate('/login');
      return;
    }

    toast.success('Redirecting you to support...');
    navigate('/support');
  };

  if (loading) {
    return (
      <PageShell width="7xl" background="subtle" contentClassName="flex min-h-[50vh] items-center justify-center">
        <PageMeta
          title="Popular Online Slot Game Platforms in the USA | Global Ace Gaming"
          description="Explore our most popular online slot game platforms in the USA."
        />
        <div className="text-center">
          <Loader2
            className="mx-auto mb-4 h-12 w-12 animate-spin"
            style={{ color: 'var(--casino-highlight-gold)' }}
          />
          <p className="cosmic-body text-lg">Loading platforms...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <PageMeta
        title="Popular Online Slot Game Platforms in the USA | Global Ace Gaming"
        description="Explore our most popular online slot game platforms in the USA — Fortune Panda, Orionstars, Milkyway, Juwa, Vegas-X and more. Pick a platform and start playing."
      />
      <PageShell
        title="Popular Online Slot Game Platforms"
        subtitle="Discover thrilling online slot games with diverse themes, engaging gameplay, and rewarding features. Pick a platform and start playing."
        width="7xl"
        background="subtle"
      >
        {platforms.length === 0 ? (
          <div className="py-20 text-center">
            <p className="cosmic-h3">No platforms available at the moment.</p>
            <p className="cosmic-body mt-2 text-sm">Please check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {platforms.map((platform) => (
              <CosmicCard
                key={platform._id}
                variant="solid"
                padding="none"
                glow
                className="group relative overflow-hidden transition-all duration-300"
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={platform.image}
                    alt={platform.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://via.placeholder.com/400x300/1a1a2e/ffffff?text=' +
                        encodeURIComponent(platform.name);
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="cosmic-h3 mb-2 text-white drop-shadow-lg">{platform.name}</h3>
                  </div>
                </div>

                <div className="p-6">
                  <p className="cosmic-body mb-6 line-clamp-3 min-h-[60px] text-sm">
                    {platform.description}
                  </p>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => handleGameLink(platform.gameLink)}
                      className="btn-casino-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98]"
                    >
                      <ExternalLink className="h-5 w-5" />
                      Game Link
                    </button>

                    <button
                      type="button"
                      onClick={handleRechargeNow}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition active:scale-[0.98]"
                      style={{
                        borderColor: 'var(--casino-accent-green)',
                        color: 'var(--casino-accent-green)',
                      }}
                    >
                      {isAuthenticated ? (
                        <>
                          <MessageCircle className="h-5 w-5" />
                          Recharge Now
                        </>
                      ) : (
                        <>
                          <LogIn className="h-5 w-5" />
                          Login to Recharge
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </CosmicCard>
            ))}
          </div>
        )}
      </PageShell>
    </>
  );
};

export default Platforms;

