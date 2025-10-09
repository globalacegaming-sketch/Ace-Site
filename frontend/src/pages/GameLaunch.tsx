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
      <div className="casino-bg-secondary border-b casino-border p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/games')}
              className="btn-casino-primary p-2 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold casino-text-primary">{gameName}</h1>
              <p className="text-sm casino-text-secondary">Playing in fullscreen</p>
            </div>
          </div>
          <button
            onClick={handleOpenInNewTab}
            className="btn-casino-primary px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open in New Tab</span>
          </button>
        </div>
      </div>

      {/* Game iframe */}
      <div className="h-[calc(100vh-80px)]">
        <iframe
          src={gameUrl}
          className="w-full h-full border-0"
          title={gameName}
          allowFullScreen
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
};

export default GameLaunch;
