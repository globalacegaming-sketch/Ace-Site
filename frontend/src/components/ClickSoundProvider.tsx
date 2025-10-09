import { useEffect } from 'react';
import { useClickSound } from '../hooks/useClickSound';
import { useMusic } from '../contexts/MusicContext';

interface ClickSoundProviderProps {
  children: React.ReactNode;
}

const ClickSoundProvider = ({ children }: ClickSoundProviderProps) => {
  const { playClickSound } = useClickSound();
  const { stopMusic } = useMusic();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Determine sound type based on element
      let soundType: 'click' | 'button' | 'game' | 'success' = 'click';
      
      // Check for game-related elements
      if (target.closest('[data-game]') || target.closest('.game') || target.closest('.casino')) {
        soundType = 'game';
        // Stop music when game is clicked
        stopMusic();
      }
      // Check for success elements (like successful actions)
      else if (target.closest('.success') || target.closest('[data-success]')) {
        soundType = 'success';
      }
      // Check for button elements
      else if (target.matches('button') || target.closest('button') || 
               target.classList.contains('btn') || target.closest('.btn')) {
        soundType = 'button';
      }
      
      // Only play sound for interactive elements
      const interactiveElements = [
        'button',
        'a',
        'input[type="button"]',
        'input[type="submit"]',
        'input[type="checkbox"]',
        'input[type="radio"]',
        '[role="button"]',
        '[onclick]',
        '.btn',
        '.button',
        '.clickable',
        '[data-game]',
        '.game',
        '.casino'
      ];
      
      const isInteractive = interactiveElements.some(selector => 
        target.matches(selector) || target.closest(selector)
      );
      
      if (isInteractive) {
        playClickSound(soundType);
      }
    };

    // Add click listener to document
    document.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [playClickSound]);

  return <>{children}</>;
};

export default ClickSoundProvider;
