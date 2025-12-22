import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const GameLaunch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string>('Game');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = searchParams.get('url');
    const name = searchParams.get('name');
    
    if (url) {
      setGameUrl(url);
      setGameName(name || 'Game');
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const handleOpenInNewTab = () => {
    if (gameUrl) {
      window.open(gameUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes,noopener,noreferrer');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen casino-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
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
          <p className="casino-text-secondary mb-6">No game URL provided.</p>
          <button
            onClick={() => navigate('/games')}
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
    <div className="min-h-screen casino-bg-primary">
      {/* Header */}
      <div className="casino-bg-secondary border-b casino-border p-2 sm:p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
            <button
              onClick={() => navigate('/games')}
              className="btn-casino-primary p-2 rounded-lg flex-shrink-0"
              aria-label="Back to games"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-xl font-bold casino-text-primary truncate">{gameName}</h1>
              <p className="text-xs sm:text-sm casino-text-secondary hidden sm:block">Playing in fullscreen</p>
            </div>
          </div>
          <button
            onClick={handleOpenInNewTab}
            className="btn-casino-primary px-2 sm:px-4 py-2 rounded-lg flex items-center space-x-1 sm:space-x-2 flex-shrink-0 ml-2"
            title="Open in new tab"
          >
            <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Open in New Tab</span>
            <span className="sm:hidden">New Tab</span>
          </button>
        </div>
      </div>

      {/* Game iframe */}
      <div className="h-[calc(100vh-80px)] w-full">
        <iframe
          src={gameUrl}
          className="w-full h-full border-0"
          title={gameName}
          allowFullScreen
          allow="fullscreen; autoplay; payment; camera; microphone; geolocation"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-downloads"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
};

export default GameLaunch;
