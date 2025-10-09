import React from 'react';
import { Music, Play, Pause } from 'lucide-react';
import { useMusic } from '../contexts/MusicContext';

interface MusicPlayerProps {
  className?: string;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ className = '' }) => {
  const { 
    enabled, 
    volume, 
    currentTrack, 
    isPlaying, 
    togglePlayPause
  } = useMusic();

  const musicTracks = [
    { id: 0, name: 'Casino Ambience', file: '/music/casino-ambience.mp3' },
    { id: 1, name: 'Jazz Lounge', file: '/music/jazz-lounge.mp3' },
    { id: 2, name: 'Electronic Vibes', file: '/music/electronic-vibes.mp3' },
    { id: 3, name: 'Classical Elegance', file: '/music/classical-elegance.mp3' },
    { id: 4, name: 'Modern Casino', file: '/music/modern-casino.mp3' }
  ];

  if (!enabled) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <div className="casino-bg-secondary rounded-lg p-3 casino-border shadow-lg backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          {/* Music Icon */}
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FFD700' }}>
            <Music className="w-4 h-4" style={{ color: '#0A0A0F' }} />
          </div>
          
          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs casino-text-primary font-medium truncate">
              {musicTracks[currentTrack].name}
            </p>
            <p className="text-xs casino-text-secondary">
              {Math.round(volume * 100)}% {!isPlaying && '• Paused'}
            </p>
          </div>
          
          {/* Play/Pause Button */}
          <button
            onClick={togglePlayPause}
            className="btn-casino-primary p-2 rounded-lg transition-colors"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MusicPlayer;
