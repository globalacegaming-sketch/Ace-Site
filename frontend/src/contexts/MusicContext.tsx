import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface MusicContextType {
  enabled: boolean;
  volume: number;
  currentTrack: number;
  isPlaying: boolean;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTrack: (track: number) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: () => void;
  stopMusic: () => void;
  startMusic: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

interface MusicProviderProps {
  children: React.ReactNode;
}

export const MusicProvider: React.FC<MusicProviderProps> = ({ children }) => {
  const [enabled, setEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true); // Auto-play enabled by default
  const audioRef = useRef<HTMLAudioElement>(null);

  const musicTracks = [
    { id: 0, name: 'Casino Ambience', file: '/music/casino-ambience.mp3' },
    { id: 1, name: 'Jazz Lounge', file: '/music/jazz-lounge.mp3' },
    { id: 2, name: 'Electronic Vibes', file: '/music/electronic-vibes.mp3' },
    { id: 3, name: 'Classical Elegance', file: '/music/classical-elegance.mp3' },
    { id: 4, name: 'Modern Casino', file: '/music/modern-casino.mp3' }
  ];

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const stopMusic = () => {
    setIsPlaying(false);
  };

  const startMusic = () => {
    setIsPlaying(true);
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('musicSettings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setEnabled(settings.enabled);
      setVolume(settings.volume);
      setCurrentTrack(settings.currentTrack);
      setIsPlaying(settings.isPlaying);
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    const settings = { enabled, volume, currentTrack, isPlaying };
    localStorage.setItem('musicSettings', JSON.stringify(settings));
  }, [enabled, volume, currentTrack, isPlaying]);

  // Handle audio playback
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      if (enabled && isPlaying) {
        // Try to play, but handle autoplay restrictions
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // If autoplay is prevented, we'll try again on user interaction
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [enabled, isPlaying, volume, currentTrack]);

  // Handle user interaction to enable audio
  useEffect(() => {
    const handleUserInteraction = () => {
      if (audioRef.current && enabled && isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    };

    // Add event listeners for user interaction
    document.addEventListener('click', handleUserInteraction, { once: true });
    document.addEventListener('keydown', handleUserInteraction, { once: true });
    document.addEventListener('touchstart', handleUserInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [enabled, isPlaying]);


  const value: MusicContextType = {
    enabled,
    volume,
    currentTrack,
    isPlaying,
    setEnabled,
    setVolume,
    setCurrentTrack,
    setIsPlaying,
    togglePlayPause,
    stopMusic,
    startMusic
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={musicTracks[currentTrack].file}
        loop
        preload="metadata"
      />
    </MusicContext.Provider>
  );
};
