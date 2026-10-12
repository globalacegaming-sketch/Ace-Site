import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';

const parseHttpUrl = (value: string): URL | null => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null;
  } catch {
    return null;
  }
};

/** Only hosts used by an active platform's game link may be launched. */
const fetchAllowedGameHosts = async (): Promise<Set<string>> => {
  const res = await axios.get(`${getApiBaseUrl()}/platforms`);
  const platforms: Array<{ gameLink?: string }> = res.data?.data ?? [];
  const hosts = new Set<string>();
  for (const p of platforms) {
    const parsed = p.gameLink ? parseHttpUrl(p.gameLink) : null;
    if (parsed) hosts.add(parsed.hostname.toLowerCase());
  }
  return hosts;
};

const GameLaunch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string>('Game');
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const url = searchParams.get('url');
    const name = searchParams.get('name');
    
    const parsed = url ? parseHttpUrl(url) : null;
    if (!parsed) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    fetchAllowedGameHosts()
      .then((allowedHosts) => {
        if (cancelled) return;
        if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
          setLoading(false);
          return;
        }
        const safeUrl = parsed.toString();
        setGameUrl(safeUrl);
        setGameName(name || 'Game');
        setLoading(false);

        // Automatically redirect to game URL after a brief delay
        // This works better than iframe since many game providers block iframe embedding
        setRedirecting(true);
        redirectTimer = setTimeout(() => {
          window.location.href = safeUrl;
        }, 1500); // 1.5 second delay to show loading message
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [searchParams]);

  const handleOpenInNewTab = () => {
    if (gameUrl) {
      window.open(gameUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleGoBack = () => {
    navigate('/games');
  };

  if (loading) {
    return (
      <div className="min-h-screen casino-bg-primary flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#FFD700' }} />
          <p className="casino-text-secondary">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!gameUrl) {
    return (
      <div className="min-h-screen casino-bg-primary flex items-center justify-center">
        <div className="casino-bg-secondary rounded-3xl shadow-xl p-10 text-center max-w-md w-full casino-border">
          <h2 className="text-2xl font-bold casino-text-primary mb-4">Game Not Found</h2>
          <p className="casino-text-secondary mb-6">This game link is missing or not allowed.</p>
          <button
            onClick={handleGoBack}
            className="btn-casino-primary px-6 py-3 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen casino-bg-primary flex items-center justify-center">
      <div className="casino-bg-secondary rounded-3xl shadow-xl p-8 sm:p-10 text-center max-w-lg w-full mx-4 casino-border">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4" style={{ backgroundColor: 'rgba(255, 215, 0, 0.1)' }}>
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#FFD700' }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold casino-text-primary mb-2">{gameName}</h2>
          <p className="casino-text-secondary text-sm sm:text-base">
            {redirecting ? 'Redirecting to game...' : 'Preparing game...'}
          </p>
        </div>

        <div className="space-y-4">
          <p className="casino-text-secondary text-xs sm:text-sm">
            The game will open in a new window. Use your browser's back button to return.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                if (gameUrl) {
                  window.location.href = gameUrl;
                }
              }}
              className="btn-casino-primary px-6 py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Game Now</span>
            </button>
            <button
              onClick={handleOpenInNewTab}
              className="btn-casino-outline px-6 py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in New Tab</span>
            </button>
            <button
              onClick={handleGoBack}
              className="btn-casino-outline px-6 py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Games</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameLaunch;
